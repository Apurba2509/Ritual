package expo.modules.ritualsensing

import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.net.Uri
import android.os.Build
import android.os.Process
import android.provider.Settings
import android.util.Base64
import android.view.inputmethod.InputMethodManager
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.util.Calendar

/**
 * Screen time from Android's own usage log (UsageStatsManager). The OS records app switches,
 * screen on/off and unlocks whether or not Ritual is running, so nothing has to poll: we read the
 * log when asked, and cache finished days so history outlives the OS's few-day retention.
 *
 * Needs "Usage access" (a special permission the person grants in Settings). Nothing leaves the
 * phone.
 */
object ScreenTime {
  private const val PREFS = "ritual_screen"
  // v2: bounded fallback. Older cached days ("day_") are ignored and pruned.
  private const val DAY_PREFIX = "d2_"
  private const val LEGACY_PREFIX = "day_"
  private const val KEY_ENABLED = "enabled"
  private const val KEY_LAST_CACHE = "last_cache_day"
  private const val KEEP_DAYS = 60

  fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun hasAccess(context: Context): Boolean {
    val ops = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
    val mode =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        ops.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
      } else {
        @Suppress("DEPRECATION")
        ops.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
      }
    return mode == AppOpsManager.MODE_ALLOWED
  }

  fun isEnabled(context: Context) = prefs(context).getBoolean(KEY_ENABLED, false)

  fun setEnabled(context: Context, on: Boolean) {
    prefs(context).edit().putBoolean(KEY_ENABLED, on).apply()
    if (on) StepWorker.schedule(context)
    else if (!StepLedger.prefs(context).getBoolean(BootReceiver.KEY_STEPS_ENABLED, false)) StepWorker.cancel(context)
  }

  fun openAccessSettings(context: Context) {
    val withPkg = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
      .setData(Uri.parse("package:${context.packageName}"))
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    runCatching { context.startActivity(withPkg) }.onFailure {
      context.startActivity(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
  }

  // ── Which windows are "apps" ────────────────────────────────────────────

  private var homeCache: Set<String>? = null
  private val launchable = HashMap<String, Boolean>()

  fun homePackages(context: Context): Set<String> =
    homeCache ?: context.packageManager
      .queryIntentActivities(Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME), PackageManager.MATCH_DEFAULT_ONLY)
      .map { it.activityInfo.packageName }
      .toSet()
      .also { homeCache = it }

  private fun keyboards(context: Context): Set<String> =
    (context.getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager)
      .enabledInputMethodList.map { it.packageName }.toSet()

  /** A real, user-facing app (not a keyboard, the status bar or an overlay). */
  @Synchronized
  fun isApp(context: Context, pkg: String): Boolean =
    launchable.getOrPut(pkg) {
      pkg != "com.android.systemui" &&
        pkg !in keyboards(context) &&
        context.packageManager.getLaunchIntentForPackage(pkg) != null
    }

  // ── One day ─────────────────────────────────────────────────────────────

  private class Acc {
    var totalMs = 0L
    val appMs = HashMap<String, Long>()
    val opens = HashMap<String, Int>()
    val hourly = LongArray(24)
    var unlocks = 0
    var screenOns = 0
    var firstUnlockAt = 0L
    var lastUseAt = 0L
    var longestMs = 0L
  }

  /** Usage between [start, end), reconstructed from the event log. */
  fun day(context: Context, start: Long, end: Long, now: Long = System.currentTimeMillis()): JSONObject {
    val usm = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
    val home = homePackages(context)
    val acc = Acc()
    val stop = minOf(end, now)

    fun close(pkg: String, from: Long, to: Long) {
      val s = maxOf(from, start)
      val e = minOf(to, stop)
      if (e <= s || pkg in home || !isApp(context, pkg)) return
      val ms = e - s
      acc.totalMs += ms
      acc.appMs[pkg] = (acc.appMs[pkg] ?: 0L) + ms
      acc.lastUseAt = maxOf(acc.lastUseAt, e)
      acc.longestMs = maxOf(acc.longestMs, ms)
      // Spread across hour buckets.
      val cal = Calendar.getInstance()
      var t = s
      while (t < e) {
        cal.timeInMillis = t
        val hour = cal.get(Calendar.HOUR_OF_DAY)
        cal.set(Calendar.MINUTE, 0); cal.set(Calendar.SECOND, 0); cal.set(Calendar.MILLISECOND, 0)
        cal.add(Calendar.HOUR_OF_DAY, 1)
        val next = minOf(cal.timeInMillis, e)
        acc.hourly[hour] += next - t
        t = next
      }
    }

    // Look back a little so a session that started before midnight is attributed correctly.
    val events = usm.queryEvents(start - 3 * 3_600_000L, stop)
    val ev = UsageEvents.Event()
    var current: String? = null
    var currentAt = 0L
    var lastPaused: String? = null
    var lastPausedAt = 0L

    while (events.hasNextEvent()) {
      events.getNextEvent(ev)
      val t = ev.timeStamp
      val pkg = ev.packageName ?: continue
      when (ev.eventType) {
        UsageEvents.Event.ACTIVITY_RESUMED -> {
          if (current != null && current != pkg) close(current!!, currentAt, t)
          if (current != pkg) {
            // Moving between screens of the same app isn't a new open.
            val sameApp = pkg == lastPaused && t - lastPausedAt < 2_000
            if (!sameApp && t >= start && pkg !in home && isApp(context, pkg)) acc.opens[pkg] = (acc.opens[pkg] ?: 0) + 1
            current = pkg
            currentAt = t
          }
        }
        UsageEvents.Event.ACTIVITY_PAUSED -> {
          if (pkg == current) {
            close(pkg, currentAt, t)
            current = null
          }
          lastPaused = pkg
          lastPausedAt = t
        }
        else -> {
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            when (ev.eventType) {
              UsageEvents.Event.SCREEN_NON_INTERACTIVE, UsageEvents.Event.KEYGUARD_SHOWN -> {
                current?.let { close(it, currentAt, t) }
                current = null
              }
              UsageEvents.Event.KEYGUARD_HIDDEN -> if (t >= start) {
                acc.unlocks++
                if (acc.firstUnlockAt == 0L) acc.firstUnlockAt = t
              }
              UsageEvents.Event.SCREEN_INTERACTIVE -> if (t >= start) acc.screenOns++
            }
          }
        }
      }
    }
    current?.let { close(it, currentAt, stop) }

    // Some phones leave the event log empty while Android's own daily totals are fine. Fall back to
    // those, but only buckets that sit inside this day: Android's buckets don't start at midnight,
    // and a bucket that spills into other days would inflate the numbers.
    var estimated = false
    if (acc.totalMs == 0L) {
      val buckets = runCatching { usm.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, start, stop) }.getOrNull()
      buckets
        ?.filter { it.firstTimeStamp >= start - 3_600_000L && it.lastTimeStamp <= stop + 60_000L }
        ?.forEach { st ->
          val pkg = st.packageName
          val ms = st.totalTimeInForeground
          if (ms <= 0 || pkg in home || !isApp(context, pkg)) return@forEach
          acc.appMs[pkg] = (acc.appMs[pkg] ?: 0L) + ms
          acc.lastUseAt = maxOf(acc.lastUseAt, st.lastTimeUsed)
          estimated = true
        }
      // Never more than the time that has actually passed.
      acc.totalMs = minOf(acc.appMs.values.sum(), stop - start)
    }

    val apps = JSONArray()
    acc.appMs.entries.sortedByDescending { it.value }.take(40).forEach { (pkg, ms) ->
      apps.put(JSONObject().put("pkg", pkg).put("ms", ms).put("opens", acc.opens[pkg] ?: 0))
    }
    return JSONObject()
      .put("day", StepLedger.dayKey(start))
      .put("totalMs", acc.totalMs)
      // Older phones have no unlock events; screen-ons are the closest proxy for pickups.
      .put("pickups", if (acc.unlocks > 0) acc.unlocks else acc.screenOns)
      .put("firstPickupAt", acc.firstUnlockAt)
      .put("lastUseAt", acc.lastUseAt)
      .put("longestMs", acc.longestMs)
      .put("hourly", JSONArray(acc.hourly.toList()))
      .put("apps", apps)
      .put("final", end <= now)
      .put("estimated", estimated)
  }

  private fun dayStart(daysAgo: Int): Long =
    Calendar.getInstance().apply {
      set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0); set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0)
      add(Calendar.DAY_OF_YEAR, -daysAgo)
    }.timeInMillis

  private fun dayEnd(daysAgo: Int): Long =
    Calendar.getInstance().apply {
      timeInMillis = dayStart(daysAgo)
      add(Calendar.DAY_OF_YEAR, 1)
    }.timeInMillis

  /** Today live, earlier days from the cache (computed and cached on first read). */
  fun days(context: Context, count: Int): JSONArray {
    val out = JSONArray()
    if (!hasAccess(context)) return out
    val p = prefs(context)
    for (i in (count - 1) downTo 0) {
      val key = DAY_PREFIX + StepLedger.dayKey(dayStart(i))
      if (i > 0) {
        val cached = p.getString(key, null)
        if (cached != null) {
          out.put(JSONObject(cached)); continue
        }
      }
      val d = day(context, dayStart(i), dayEnd(i))
      // Only cache days that had data: the OS log may not reach that far back.
      if (i > 0 && d.getLong("totalMs") > 0) p.edit().putString(key, d.toString()).apply()
      out.put(d)
    }
    return out
  }

  /** Called by the background worker: cache yesterday & co. once a day, prune old days. */
  fun cacheFinishedDays(context: Context) {
    if (!isEnabled(context) || !hasAccess(context)) return
    val p = prefs(context)
    val today = StepLedger.dayKey(System.currentTimeMillis())
    if (p.getString(KEY_LAST_CACHE, null) == today) return
    for (i in 1..7) {
      val key = DAY_PREFIX + StepLedger.dayKey(dayStart(i))
      if (p.contains(key)) continue
      val d = day(context, dayStart(i), dayEnd(i))
      if (d.getLong("totalMs") > 0) p.edit().putString(key, d.toString()).apply()
    }
    val floor = StepLedger.dayKey(dayStart(KEEP_DAYS))
    val edit = p.edit()
    p.all.keys
      .filter { it.startsWith(LEGACY_PREFIX) || (it.startsWith(DAY_PREFIX) && it.removePrefix(DAY_PREFIX) < floor) }
      .forEach { edit.remove(it) }
    edit.putString(KEY_LAST_CACHE, today).apply()
  }

  /** Every app with a launcher icon (visible thanks to the <queries> LAUNCHER declaration). */
  fun launchablePackages(context: Context): List<String> =
    context.packageManager
      .queryIntentActivities(Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER), 0)
      .map { it.activityInfo.packageName }
      .filter { it != context.packageName }
      .distinct()

  // ── App labels, icons, categories ───────────────────────────────────────

  private val KNOWN_DISTRACTING = setOf(
    "com.instagram.android", "com.zhiliaoapp.musically", "com.ss.android.ugc.trill", "com.snapchat.android",
    "com.google.android.youtube", "com.twitter.android", "com.facebook.katana", "com.facebook.lite",
    "com.reddit.frontpage", "com.pinterest", "tv.twitch.android.app", "com.netflix.mediaclient",
    "in.mohalla.sharechat", "com.linkedin.android", "com.discord", "com.tumblr", "com.instagram.barcelona",
    "com.bereal.ft", "com.amazon.avod.thirdpartyclient", "in.startv.hotstar", "com.moj.android",
  )

  /** Talking to people isn't the problem; feeds are. Never suggest these by default. */
  private val COMMUNICATION = setOf(
    "com.google.android.apps.messaging", "com.android.mms", "com.samsung.android.messaging",
    "com.google.android.contacts", "com.android.contacts", "com.samsung.android.app.contacts",
    "com.google.android.dialer", "com.android.dialer", "com.google.android.gm",
    "com.whatsapp", "org.telegram.messenger", "org.thoughtcrime.securesms",
  )

  private fun categoryOf(info: ApplicationInfo): String =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      when (info.category) {
        ApplicationInfo.CATEGORY_SOCIAL -> "social"
        ApplicationInfo.CATEGORY_VIDEO -> "video"
        ApplicationInfo.CATEGORY_GAME -> "game"
        ApplicationInfo.CATEGORY_NEWS -> "news"
        ApplicationInfo.CATEGORY_AUDIO -> "audio"
        ApplicationInfo.CATEGORY_IMAGE -> "image"
        ApplicationInfo.CATEGORY_MAPS -> "maps"
        ApplicationInfo.CATEGORY_PRODUCTIVITY -> "productivity"
        else -> "other"
      }
    } else "other"

  fun appInfo(context: Context, pkgs: List<String>, withIcons: Boolean): JSONArray {
    val pm = context.packageManager
    val out = JSONArray()
    for (pkg in pkgs) {
      val info = runCatching { pm.getApplicationInfo(pkg, 0) }.getOrNull() ?: continue
      val category = categoryOf(info)
      val o = JSONObject()
        .put("pkg", pkg)
        .put("label", pm.getApplicationLabel(info).toString())
        .put("category", category)
        .put(
          "distracting",
          pkg in KNOWN_DISTRACTING ||
            (category in setOf("social", "video", "game") &&
              pkg !in COMMUNICATION &&
              // Preinstalled apps (Contacts, Messages…) only count when we know them by name.
              info.flags and ApplicationInfo.FLAG_SYSTEM == 0),
        )
      if (withIcons) runCatching { o.put("icon", iconPng(pm, pkg)) }
      out.put(o)
    }
    return out
  }

  private val iconCache = HashMap<String, String>()

  private fun iconPng(pm: PackageManager, pkg: String): String =
    iconCache.getOrPut(pkg) {
      val d = pm.getApplicationIcon(pkg)
      val size = 96
      val bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
      val c = Canvas(bmp)
      d.setBounds(0, 0, size, size)
      d.draw(c)
      val bytes = ByteArrayOutputStream().also { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) }.toByteArray()
      "data:image/png;base64," + Base64.encodeToString(bytes, Base64.NO_WRAP)
    }
}
