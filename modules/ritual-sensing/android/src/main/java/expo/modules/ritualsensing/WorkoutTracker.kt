package expo.modules.ritualsensing

import android.content.Context
import android.hardware.SensorManager
import android.location.Location
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.UUID
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToLong
import kotlin.math.sin
import kotlin.math.sqrt

/**
 * The maths of a workout session, independent of Android services so it is easy to reason about.
 *
 * Distance prefers GPS, but every sample is cross-checked: noisy fixes (poor accuracy, impossible
 * speeds, sub-metre jitter) are dropped. When GPS is unavailable — indoors, a treadmill, airplane
 * mode — distance falls back to steps × stride, so a session still produces honest numbers.
 * Elevation gain uses the barometer when present (far less noisy than GPS altitude) with hysteresis
 * so pressure wobble isn't counted as climbing.
 */
class WorkoutSession(
  val id: String,
  val type: String,
  val startedAt: Long,
) {
  var paused = false
  var pausedAt = 0L
  var pausedTotal = 0L

  // GPS
  val points = ArrayList<DoubleArray>() // [lat, lon, alt, t]
  private var lastGood: Location? = null
  var gpsDistance = 0.0
  var lastFixAt = 0L
  var lastAccuracy = Float.MAX_VALUE
  var goodFixes = 0

  // Steps
  private var lastStepValue = -1f
  var steps = 0f

  // Elevation
  var hasBarometer = false
  private var baroSmooth: Double? = null
  private var baroRef: Double? = null
  private var gpsRef: Double? = null
  var gainBarometer = 0.0
  var gainGps = 0.0
  private var lastAltitudeSampleAt = 0L
  val altitudeSamples = ArrayList<DoubleArray>() // [movingSec, altitude]

  // Splits (seconds for each completed km)
  val splits = ArrayList<Double>()
  private var nextSplitAt = 1000.0
  private var lastSplitSec = 0.0

  private val maxSpeed = when (type) {
    "ride" -> 25.0
    "run" -> 9.0
    else -> 4.5
  }

  fun movingMs(now: Long = System.currentTimeMillis()): Long =
    max(0L, (if (paused) pausedAt else now) - startedAt - pausedTotal)

  fun pause(now: Long = System.currentTimeMillis()) {
    if (paused) return
    paused = true
    pausedAt = now
  }

  fun resume(now: Long = System.currentTimeMillis()) {
    if (!paused) return
    pausedTotal += now - pausedAt
    paused = false
    lastGood = null // don't draw a straight line across the pause
  }

  fun onLocation(loc: Location) {
    lastFixAt = System.currentTimeMillis()
    lastAccuracy = loc.accuracy
    if (paused || !loc.hasAccuracy() || loc.accuracy > 30f) return
    goodFixes++
    val prev = lastGood
    if (prev != null) {
      val d = haversine(prev.latitude, prev.longitude, loc.latitude, loc.longitude)
      val dt = max(1.0, (loc.time - prev.time) / 1000.0)
      if (d < 2.0) return // standing still: GPS jitter, not movement
      if (d / dt > maxSpeed) return // teleport — a bad fix
      gpsDistance += d
    }
    lastGood = loc
    points.add(doubleArrayOf(loc.latitude, loc.longitude, if (loc.hasAltitude()) loc.altitude else Double.NaN, loc.time.toDouble()))
    if (!hasBarometer && loc.hasAltitude()) trackGpsAltitude(loc.altitude)
    checkSplits()
  }

  fun onPressure(hPa: Float) {
    hasBarometer = true
    val alt = SensorManager.getAltitude(SensorManager.PRESSURE_STANDARD_ATMOSPHERE, hPa).toDouble()
    val smooth = baroSmooth?.let { it + 0.12 * (alt - it) } ?: alt
    baroSmooth = smooth
    val ref = baroRef
    if (ref == null) {
      baroRef = smooth
    } else if (smooth - ref >= 1.0) {
      if (!paused) gainBarometer += smooth - ref
      baroRef = smooth
    } else if (ref - smooth >= 1.0) {
      baroRef = smooth
    }
    sampleAltitude(smooth)
  }

  private fun trackGpsAltitude(alt: Double) {
    val ref = gpsRef
    if (ref == null) gpsRef = alt
    else if (alt - ref >= 5.0) {
      gainGps += alt - ref
      gpsRef = alt
    } else if (ref - alt >= 5.0) gpsRef = alt
    sampleAltitude(alt)
  }

  private fun sampleAltitude(alt: Double) {
    val now = System.currentTimeMillis()
    if (paused || now - lastAltitudeSampleAt < 10_000) return
    lastAltitudeSampleAt = now
    altitudeSamples.add(doubleArrayOf(movingMs(now) / 1000.0, alt))
  }

  fun onStepCounter(value: Float) {
    if (lastStepValue >= 0f) {
      val delta = if (value >= lastStepValue) value - lastStepValue else value
      if (!paused && delta < 5000f) steps += delta
    }
    lastStepValue = value
    checkSplits()
  }

  /** Average stride from cadence: running strides are much longer than walking ones. */
  private fun stride(): Double {
    val minutes = max(0.5, movingMs() / 60000.0)
    val cadence = steps / minutes
    return if (type == "run" || cadence > 140) 1.05 else 0.74
  }

  val stepDistance: Double
    get() = if (type == "ride") 0.0 else steps * stride()

  /** GPS is trusted once it has produced a real track that roughly agrees with the step count. */
  val gpsReliable: Boolean
    get() = goodFixes >= 5 && gpsDistance > 30 && (type == "ride" || steps < 50 || gpsDistance >= stepDistance * 0.5)

  val distance: Double
    get() = if (gpsReliable) gpsDistance else stepDistance

  val distanceSource: String
    get() = when {
      gpsReliable -> "gps"
      stepDistance > 0 -> "steps"
      else -> "none"
    }

  val elevationGain: Double
    get() = if (hasBarometer) gainBarometer else gainGps

  val gpsStatus: String
    get() {
      val age = System.currentTimeMillis() - lastFixAt
      return when {
        lastFixAt == 0L -> "searching"
        age > 20_000 -> "lost"
        lastAccuracy <= 15f -> "strong"
        lastAccuracy <= 30f -> "ok"
        else -> "weak"
      }
    }

  private fun checkSplits() {
    val d = distance
    while (d >= nextSplitAt) {
      val sec = movingMs() / 1000.0
      splits.add(sec - lastSplitSec)
      lastSplitSec = sec
      nextSplitAt += 1000.0
    }
  }

  /** Pace over the last ~30 s of track, in seconds per km (null until there's enough data). */
  fun currentPace(): Double? {
    if (!gpsReliable || points.size < 3) {
      val sec = movingMs() / 1000.0
      return if (distance > 50) sec / (distance / 1000.0) else null
    }
    val last = points.last()
    var i = points.size - 1
    var d = 0.0
    while (i > 0 && last[3] - points[i - 1][3] < 30_000) {
      d += haversine(points[i - 1][0], points[i - 1][1], points[i][0], points[i][1])
      i--
    }
    val dt = (last[3] - points[i][3]) / 1000.0
    return if (d > 20 && dt > 5) dt / (d / 1000.0) else null
  }

  fun live(): Map<String, Any?> = mapOf(
    "id" to id,
    "type" to type,
    "startedAt" to startedAt.toDouble(),
    "paused" to paused,
    "movingSec" to movingMs() / 1000.0,
    "distanceM" to distance,
    "distanceSource" to distanceSource,
    "paceSecPerKm" to currentPace(),
    "elevationGainM" to elevationGain,
    "elevationSource" to if (hasBarometer) "barometer" else if (gainGps > 0) "gps" else "none",
    "steps" to steps.toDouble(),
    "gpsStatus" to gpsStatus,
    "splits" to splits.toList(),
    "route" to previewRoute(),
  )

  /** Flat [lat, lon, lat, lon, …] downsampled for drawing while recording. */
  private fun previewRoute(): List<Double> {
    if (points.isEmpty()) return emptyList()
    val step = max(1, points.size / 300)
    val out = ArrayList<Double>()
    var i = 0
    while (i < points.size) {
      out.add(points[i][0]); out.add(points[i][1])
      i += step
    }
    out.add(points.last()[0]); out.add(points.last()[1])
    return out
  }

  fun summary(endedAt: Long = System.currentTimeMillis()): JSONObject {
    val usable = gpsReliable && points.size >= 2
    val route = if (usable) Polyline.encode(Polyline.simplify(points.map { doubleArrayOf(it[0], it[1]) }, 800)) else null
    val profile = downsample(altitudeSamples, 120)
    return JSONObject()
      .put("id", id)
      .put("type", type)
      .put("startedAt", startedAt)
      .put("endedAt", endedAt)
      .put("movingSec", (movingMs(endedAt) / 1000.0).roundToLong())
      .put("distanceM", Math.round(distance).toDouble())
      .put("distanceSource", distanceSource)
      .put("elevationGainM", Math.round(elevationGain).toDouble())
      .put("elevationSource", if (hasBarometer) "barometer" else if (gainGps > 0) "gps" else "none")
      .put("steps", Math.round(steps).toDouble())
      .put("splits", JSONArray(splits.map { Math.round(it).toDouble() }))
      .put("route", route ?: JSONObject.NULL)
      .put("elevationProfile", JSONArray(profile.map { Math.round(it[1] * 10) / 10.0 }))
  }

  private fun downsample(src: List<DoubleArray>, n: Int): List<DoubleArray> {
    if (src.size <= n) return src
    val step = src.size.toDouble() / n
    return (0 until n).map { src[min(src.size - 1, (it * step).toInt())] }
  }

  fun toJson(): JSONObject = JSONObject()
    .put("id", id).put("type", type).put("startedAt", startedAt)
    .put("paused", paused).put("pausedAt", pausedAt).put("pausedTotal", pausedTotal)
    .put("gpsDistance", gpsDistance).put("goodFixes", goodFixes).put("steps", steps.toDouble())
    .put("hasBarometer", hasBarometer).put("gainBarometer", gainBarometer).put("gainGps", gainGps)
    .put("splits", JSONArray(splits)).put("nextSplitAt", nextSplitAt).put("lastSplitSec", lastSplitSec)
    .put("points", JSONArray(points.map { JSONArray(it.map { v -> if (v.isNaN()) 0.0 else v }) }))
    .put("altitudeSamples", JSONArray(altitudeSamples.map { JSONArray(it.toList()) }))

  companion object {
    fun create(type: String) = WorkoutSession(UUID.randomUUID().toString().replace("-", "").take(20), type, System.currentTimeMillis())

    fun fromJson(o: JSONObject): WorkoutSession {
      val s = WorkoutSession(o.getString("id"), o.getString("type"), o.getLong("startedAt"))
      s.paused = o.optBoolean("paused")
      s.pausedAt = o.optLong("pausedAt")
      s.pausedTotal = o.optLong("pausedTotal")
      s.gpsDistance = o.optDouble("gpsDistance", 0.0)
      s.goodFixes = o.optInt("goodFixes")
      s.steps = o.optDouble("steps", 0.0).toFloat()
      s.hasBarometer = o.optBoolean("hasBarometer")
      s.gainBarometer = o.optDouble("gainBarometer", 0.0)
      s.gainGps = o.optDouble("gainGps", 0.0)
      val sp = o.optJSONArray("splits") ?: JSONArray()
      for (i in 0 until sp.length()) s.splits.add(sp.getDouble(i))
      s.nextSplitAt = o.optDouble("nextSplitAt", 1000.0)
      s.lastSplitSec = o.optDouble("lastSplitSec", 0.0)
      val pts = o.optJSONArray("points") ?: JSONArray()
      for (i in 0 until pts.length()) {
        val p = pts.getJSONArray(i)
        s.points.add(doubleArrayOf(p.getDouble(0), p.getDouble(1), p.getDouble(2), p.getDouble(3)))
      }
      val alts = o.optJSONArray("altitudeSamples") ?: JSONArray()
      for (i in 0 until alts.length()) {
        val a = alts.getJSONArray(i)
        s.altitudeSamples.add(doubleArrayOf(a.getDouble(0), a.getDouble(1)))
      }
      return s
    }

    fun haversine(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double {
      val r = 6371000.0
      val dLat = Math.toRadians(lat2 - lat1)
      val dLon = Math.toRadians(lon2 - lon1)
      val a = sin(dLat / 2) * sin(dLat / 2) +
        cos(Math.toRadians(lat1)) * cos(Math.toRadians(lat2)) * sin(dLon / 2) * sin(dLon / 2)
      return 2 * r * atan2(sqrt(a), sqrt(1 - a))
    }
  }
}

/** Holds the one active session and the queue of finished ones the app hasn't imported yet. */
object WorkoutStore {
  @Volatile
  var active: WorkoutSession? = null
  private const val FILE = "ritual_workout_active.json"
  private const val KEY_DONE = "workouts_done"

  fun persist(context: Context) {
    val s = active ?: return
    runCatching { File(context.filesDir, FILE).writeText(s.toJson().toString()) }
  }

  fun restore(context: Context): WorkoutSession? {
    if (active != null) return active
    val f = File(context.filesDir, FILE)
    if (!f.exists()) return null
    active = runCatching { WorkoutSession.fromJson(JSONObject(f.readText())) }.getOrNull()
    return active
  }

  fun clear(context: Context) {
    active = null
    File(context.filesDir, FILE).delete()
  }

  /** Finalise the active session: queue its summary for the app and forget it. */
  @Synchronized
  fun finish(context: Context): JSONObject? {
    val s = active ?: restore(context) ?: return null
    val summary = s.summary()
    // Ignore accidental taps: under 30 seconds and barely any movement.
    if (s.movingMs() >= 30_000 || s.distance >= 50) {
      val p = StepLedger.prefs(context)
      val arr = JSONArray(p.getString(KEY_DONE, "[]"))
      arr.put(summary)
      p.edit().putString(KEY_DONE, arr.toString()).apply()
    }
    clear(context)
    return summary
  }

  @Synchronized
  fun consumeDone(context: Context): JSONArray {
    val p = StepLedger.prefs(context)
    val arr = JSONArray(p.getString(KEY_DONE, "[]"))
    p.edit().putString(KEY_DONE, "[]").apply()
    return arr
  }
}

/** Google's encoded polyline format + Douglas–Peucker simplification. */
object Polyline {
  fun encode(points: List<DoubleArray>): String {
    val sb = StringBuilder()
    var lastLat = 0L
    var lastLon = 0L
    for (p in points) {
      val lat = Math.round(p[0] * 1e5)
      val lon = Math.round(p[1] * 1e5)
      encodeValue(lat - lastLat, sb)
      encodeValue(lon - lastLon, sb)
      lastLat = lat
      lastLon = lon
    }
    return sb.toString()
  }

  private fun encodeValue(v: Long, sb: StringBuilder) {
    var value = if (v < 0) (v shl 1).inv() else (v shl 1)
    while (value >= 0x20L) {
      sb.append(((0x20L or (value and 0x1fL)) + 63L).toInt().toChar())
      value = value shr 5
    }
    sb.append((value + 63L).toInt().toChar())
  }

  /** Simplify to at most `maxPoints`, raising the tolerance until it fits. */
  fun simplify(points: List<DoubleArray>, maxPoints: Int): List<DoubleArray> {
    if (points.size <= 2) return points
    var epsilon = 3.0
    var out = points
    while (true) {
      out = dp(points, epsilon)
      if (out.size <= maxPoints) return out
      epsilon *= 1.6
    }
  }

  private fun dp(points: List<DoubleArray>, epsilon: Double): List<DoubleArray> {
    val keep = BooleanArray(points.size)
    keep[0] = true
    keep[points.size - 1] = true
    val stack = ArrayDeque<IntArray>()
    stack.add(intArrayOf(0, points.size - 1))
    val lat0 = Math.toRadians(points[0][0])
    fun xy(p: DoubleArray) = doubleArrayOf(p[1] * 111320.0 * cos(lat0), p[0] * 110540.0)
    while (stack.isNotEmpty()) {
      val (a, b) = stack.removeLast().let { it[0] to it[1] }
      if (b - a < 2) continue
      val pa = xy(points[a])
      val pb = xy(points[b])
      var maxD = 0.0
      var idx = -1
      for (i in a + 1 until b) {
        val d = perpendicular(xy(points[i]), pa, pb)
        if (d > maxD) {
          maxD = d
          idx = i
        }
      }
      if (maxD > epsilon && idx > 0) {
        keep[idx] = true
        stack.add(intArrayOf(a, idx))
        stack.add(intArrayOf(idx, b))
      }
    }
    return points.filterIndexed { i, _ -> keep[i] }
  }

  private fun perpendicular(p: DoubleArray, a: DoubleArray, b: DoubleArray): Double {
    val dx = b[0] - a[0]
    val dy = b[1] - a[1]
    val len = sqrt(dx * dx + dy * dy)
    if (len == 0.0) return sqrt((p[0] - a[0]) * (p[0] - a[0]) + (p[1] - a[1]) * (p[1] - a[1]))
    return abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / len
  }
}
