package expo.modules.ritualsensing

import android.content.Context
import android.content.SharedPreferences
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

/**
 * Turns the hardware step counter (cumulative steps since boot, counted by the sensor hub even
 * while the app is closed) into per-day totals.
 *
 * Every snapshot stores the raw counter. The difference to the previous snapshot is attributed to
 * the days in between, split by time if a midnight passed. A counter lower than the previous one
 * means the phone rebooted (the counter restarts at zero).
 */
object StepLedger {
  private const val PREFS = "ritual_sensing"
  private const val KEY_LAST = "steps_counter_last"
  private const val KEY_LAST_AT = "steps_counter_at"
  private const val DAY_PREFIX = "steps_day_"
  /** More than this between two snapshots is a sensor glitch, not walking. */
  private const val MAX_PLAUSIBLE_DELTA = 80_000f

  fun prefs(context: Context): SharedPreferences = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun dayKey(ms: Long): String = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date(ms))

  @Synchronized
  fun record(context: Context, counter: Float, now: Long = System.currentTimeMillis()) {
    val p = prefs(context)
    val last = p.getFloat(KEY_LAST, -1f)
    val lastAt = p.getLong(KEY_LAST_AT, 0L)
    val edit = p.edit()
    if (last >= 0f && lastAt in 1 until now) {
      val delta = if (counter >= last) counter - last else counter
      if (delta > 0f && delta < MAX_PLAUSIBLE_DELTA) distribute(p, edit, delta, lastAt, now)
    }
    edit.putFloat(KEY_LAST, counter).putLong(KEY_LAST_AT, now)
    pruneOldDays(p, edit, now)
    edit.apply()
  }

  /** Spread `steps` over [from, to], cutting at each local midnight. */
  private fun distribute(p: SharedPreferences, edit: SharedPreferences.Editor, steps: Float, from: Long, to: Long) {
    val total = (to - from).toDouble()
    var cursor = from
    while (cursor < to) {
      val cal = Calendar.getInstance().apply {
        timeInMillis = cursor
        add(Calendar.DAY_OF_YEAR, 1)
        set(Calendar.HOUR_OF_DAY, 0)
        set(Calendar.MINUTE, 0)
        set(Calendar.SECOND, 0)
        set(Calendar.MILLISECOND, 0)
      }
      val segmentEnd = minOf(cal.timeInMillis, to)
      val share = steps * ((segmentEnd - cursor) / total).toFloat()
      val key = DAY_PREFIX + dayKey(cursor)
      edit.putFloat(key, p.getFloat(key, 0f) + share)
      cursor = segmentEnd
    }
  }

  private fun pruneOldDays(p: SharedPreferences, edit: SharedPreferences.Editor, now: Long) {
    val cutoff = dayKey(now - 120L * 24 * 3600 * 1000)
    for (key in p.all.keys) {
      if (key.startsWith(DAY_PREFIX) && key.removePrefix(DAY_PREFIX) < cutoff) edit.remove(key)
    }
  }

  /** Per-day totals for the last `days` days (only days with steps). */
  fun daily(context: Context, days: Int): Map<String, Double> {
    val p = prefs(context)
    val from = dayKey(System.currentTimeMillis() - (days.toLong() - 1) * 24 * 3600 * 1000)
    val out = mutableMapOf<String, Double>()
    for ((key, value) in p.all) {
      if (!key.startsWith(DAY_PREFIX)) continue
      val day = key.removePrefix(DAY_PREFIX)
      if (day >= from && value is Float && value >= 1f) out[day] = Math.round(value).toDouble()
    }
    return out
  }

  fun hasBaseline(context: Context): Boolean = prefs(context).getFloat(KEY_LAST, -1f) >= 0f

  /** When the counter was last read (0 = never). */
  fun lastSnapshotAt(context: Context): Long = prefs(context).getLong(KEY_LAST_AT, 0L)
}
