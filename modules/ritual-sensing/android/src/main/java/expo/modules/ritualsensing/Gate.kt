package expo.modules.ritualsensing

import android.content.ComponentName
import android.content.Context
import android.provider.Settings
import org.json.JSONArray
import org.json.JSONObject
import java.util.Calendar

/**
 * The mindful pause: before an app you chose to guard opens, Ritual shows a short breathing
 * screen and asks what you came for. Not a block (you can always continue) but enough friction
 * to turn an automatic reach into a decision. Friction grows with each open in a day, relaxes
 * during "catch-up" windows (so FOMO has a scheduled outlet) and tightens at bedtime.
 *
 * State lives in SharedPreferences so the accessibility service and the pause screen work with
 * the app closed; JS writes the config and reads the event log.
 */
object Gate {
  private const val PREFS = "ritual_gate"
  private const val KEY_CONFIG = "config"
  private const val KEY_EVENTS = "events"
  private const val KEY_ALLOW = "allow"
  private const val MAX_EVENTS = 800

  data class Window(val start: Int, val end: Int) {
    fun contains(minute: Int) = if (start <= end) minute in start until end else minute >= start || minute < end
  }

  data class Swap(val habitId: String, val name: String, val label: String)

  data class Config(
    val enabled: Boolean,
    val apps: Set<String>,
    val catchups: List<Window>,
    val bedtime: Window?,
    val allowMinutes: Int,
    val swap: Swap?,
  )

  fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  private fun minutes(hhmm: String): Int {
    val (h, m) = hhmm.split(":").map { it.toInt() }
    return h * 60 + m
  }

  fun config(context: Context): Config {
    val raw = prefs(context).getString(KEY_CONFIG, null) ?: return Config(false, emptySet(), emptyList(), null, 5, null)
    return runCatching {
      val o = JSONObject(raw)
      val apps = o.optJSONArray("apps")?.let { a -> (0 until a.length()).map { a.getString(it) }.toSet() } ?: emptySet()
      val catchups = o.optJSONArray("catchups")?.let { a ->
        (0 until a.length()).map { a.getJSONObject(it) }.map { Window(minutes(it.getString("start")), minutes(it.getString("end"))) }
      } ?: emptyList()
      val bed = o.optJSONObject("bedtime")?.takeIf { it.optBoolean("enabled") }
        ?.let { Window(minutes(it.getString("start")), minutes(it.getString("end"))) }
      val swap = o.optJSONObject("swap")?.let { Swap(it.getString("habitId"), it.getString("name"), it.getString("label")) }
      Config(o.optBoolean("enabled"), apps, catchups, bed, o.optInt("allowMinutes", 5).coerceIn(1, 60), swap)
    }.getOrElse { Config(false, emptySet(), emptyList(), null, 5, null) }
  }

  fun setConfig(context: Context, json: String) {
    prefs(context).edit().putString(KEY_CONFIG, json).apply()
  }

  private fun minuteOfDay(now: Long): Int {
    val c = Calendar.getInstance().apply { timeInMillis = now }
    return c.get(Calendar.HOUR_OF_DAY) * 60 + c.get(Calendar.MINUTE)
  }

  fun inCatchup(cfg: Config, now: Long) = cfg.catchups.any { it.contains(minuteOfDay(now)) }
  fun atBedtime(cfg: Config, now: Long) = cfg.bedtime?.contains(minuteOfDay(now)) == true

  /** Minutes from now to the start of the next catch-up window, if any today/tonight. */
  fun nextCatchupStart(cfg: Config, now: Long): Int? {
    val m = minuteOfDay(now)
    return cfg.catchups.map { it.start }.map { s -> if (s > m) s else s + 24 * 60 }.minOrNull()?.let { it % (24 * 60) }
  }

  fun allowedUntil(context: Context, pkg: String): Long =
    runCatching { JSONObject(prefs(context).getString(KEY_ALLOW, "{}")!!).optLong(pkg, 0L) }.getOrDefault(0L)

  fun allow(context: Context, pkg: String, until: Long) {
    val o = runCatching { JSONObject(prefs(context).getString(KEY_ALLOW, "{}")!!) }.getOrDefault(JSONObject())
    o.put(pkg, until)
    prefs(context).edit().putString(KEY_ALLOW, o.toString()).apply()
  }

  fun shouldPause(context: Context, pkg: String, now: Long = System.currentTimeMillis()): Boolean {
    val cfg = config(context)
    if (!cfg.enabled || pkg !in cfg.apps) return false
    if (allowedUntil(context, pkg) > now) return false
    return !inCatchup(cfg, now)
  }

  // ── Event log ───────────────────────────────────────────────────────────

  fun record(context: Context, type: String, pkg: String, extra: JSONObject? = null) {
    synchronized(this) {
      val p = prefs(context)
      val arr = runCatching { JSONArray(p.getString(KEY_EVENTS, "[]")) }.getOrDefault(JSONArray())
      val e = (extra ?: JSONObject()).put("t", System.currentTimeMillis()).put("type", type).put("pkg", pkg)
      arr.put(e)
      val trimmed = if (arr.length() > MAX_EVENTS) JSONArray((arr.length() - MAX_EVENTS until arr.length()).map { arr.get(it) }) else arr
      p.edit().putString(KEY_EVENTS, trimmed.toString()).apply()
    }
  }

  fun events(context: Context, since: Long): JSONArray {
    val arr = runCatching { JSONArray(prefs(context).getString(KEY_EVENTS, "[]")) }.getOrDefault(JSONArray())
    val out = JSONArray()
    for (i in 0 until arr.length()) {
      val e = arr.getJSONObject(i)
      if (e.optLong("t") >= since) out.put(e)
    }
    return out
  }

  private fun startOfToday(): Long =
    Calendar.getInstance().apply {
      set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0); set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0)
    }.timeInMillis

  fun countToday(context: Context, type: String, pkg: String? = null): Int {
    val arr = events(context, startOfToday())
    var n = 0
    for (i in 0 until arr.length()) {
      val e = arr.getJSONObject(i)
      if (e.optString("type") == type && (pkg == null || e.optString("pkg") == pkg)) n++
    }
    return n
  }

  /** 3 seconds the first time; each further open that day adds two, up to 12 (15 at bedtime). */
  fun breathSeconds(opensToday: Int, bedtime: Boolean): Int {
    val base = (3 + 2 * (opensToday - 1).coerceAtLeast(0)).coerceIn(3, 12)
    return if (bedtime) (base + 3).coerceAtMost(15) else base
  }

  // ── Accessibility service status ────────────────────────────────────────

  fun serviceEnabled(context: Context): Boolean {
    val flat = Settings.Secure.getString(context.contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES) ?: return false
    val me = ComponentName(context, GateService::class.java)
    return flat.split(':').any { ComponentName.unflattenFromString(it) == me }
  }
}
