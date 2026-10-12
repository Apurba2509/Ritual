package expo.modules.ritualsensing

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.PowerManager
import android.provider.Settings
import androidx.core.content.ContextCompat
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONArray
import org.json.JSONObject

class NoSensingPermission :
  CodedException("Allow Physical activity or Location so Ritual can record this workout.")

/**
 * JS bridge for on-device sensing:
 *  - background step counting (hardware step counter + WorkManager), offline, app closed
 *  - automatic walk / run / ride detection (Activity Recognition transitions)
 *  - a workout recorder running as a foreground service (GPS + barometer + steps)
 */
class RitualSensingModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("RitualSensing")

    Function("capabilities") {
      mapOf(
        "stepCounter" to Sensors.hasStepCounter(context),
        "barometer" to Sensors.hasBarometer(context),
        "activityPermission" to Sensors.canReadActivity(context),
        "locationPermission" to Sensors.canUseLocation(context),
        "stepsEnabled" to StepLedger.prefs(context).getBoolean(BootReceiver.KEY_STEPS_ENABLED, false),
        "activityDetectionEnabled" to ActivityDetection.isEnabled(context),
        "batteryUnrestricted" to isIgnoringBatteryOptimizations(),
        "lastStepSnapshotAt" to StepLedger.lastSnapshotAt(context).toDouble(),
        "workoutActive" to (WorkoutStore.active != null),
        "usageAccess" to ScreenTime.hasAccess(context),
        "screenTimeEnabled" to ScreenTime.isEnabled(context),
        "pauseServiceEnabled" to Gate.serviceEnabled(context),
        "sdk" to android.os.Build.VERSION.SDK_INT,
        "manufacturer" to android.os.Build.MANUFACTURER,
      )
    }

    // ── Steps ──────────────────────────────────────────────────────────────

    AsyncFunction("enableStepTracking") Coroutine { ->
      if (!Sensors.hasStepCounter(context) || !Sensors.canReadActivity(context)) return@Coroutine false
      StepLedger.prefs(context).edit().putBoolean(BootReceiver.KEY_STEPS_ENABLED, true).apply()
      StepWorker.schedule(context)
      Sensors.snapshot(context)
      true
    }

    Function("disableStepTracking") {
      StepLedger.prefs(context).edit().putBoolean(BootReceiver.KEY_STEPS_ENABLED, false).apply()
      // The worker also caches screen time; keep it while that's on.
      if (!ScreenTime.isEnabled(context)) StepWorker.cancel(context)
    }

    /** Read the counter now (so "today" is current), then return per-day totals. */
    AsyncFunction("dailySteps") Coroutine { days: Int ->
      Sensors.snapshot(context)
      StepLedger.daily(context, days)
    }

    // ── Activity detection ────────────────────────────────────────────────

    AsyncFunction("enableActivityDetection") Coroutine { ->
      ActivityDetection.start(context)
    }

    Function("disableActivityDetection") {
      ActivityDetection.stop(context)
    }

    Function("activityEvents") { sinceMs: Double ->
      ActivityDetection.events(context, sinceMs.toLong())
    }

    // ── Workouts ──────────────────────────────────────────────────────────

    Function("startWorkout") { type: String ->
      if (!Sensors.canUseLocation(context) && !Sensors.canReadActivity(context)) throw NoSensingPermission()
      ContextCompat.startForegroundService(context, WorkoutService.intent(context, WorkoutService.ACTION_START, type))
    }

    Function("pauseWorkout") {
      context.startService(WorkoutService.intent(context, WorkoutService.ACTION_PAUSE))
    }

    Function("resumeWorkout") {
      context.startService(WorkoutService.intent(context, WorkoutService.ACTION_RESUME))
    }

    /** Stop recording; the summary is queued for `consumeFinishedWorkouts` and also returned. */
    Function("finishWorkout") {
      val summary = WorkoutStore.finish(context)
      context.startService(WorkoutService.intent(context, WorkoutService.ACTION_STOP))
      summary?.let { toMap(it) }
    }

    Function("discardWorkout") {
      WorkoutStore.clear(context)
      context.startService(WorkoutService.intent(context, WorkoutService.ACTION_STOP))
    }

    Function("workoutState") {
      (WorkoutStore.active ?: WorkoutStore.restore(context))?.live()
    }

    Function("consumeFinishedWorkouts") {
      val arr = WorkoutStore.consumeDone(context)
      (0 until arr.length()).map { toMap(arr.getJSONObject(it)) }
    }

    // ── Screen time ───────────────────────────────────────────────────────

    Function("openUsageAccessSettings") {
      ScreenTime.openAccessSettings(context)
    }

    Function("setScreenTimeEnabled") { on: Boolean ->
      ScreenTime.setEnabled(context, on)
    }

    /** Per-day usage (today live, earlier days cached), oldest first. */
    AsyncFunction("screenDays") Coroutine { days: Int ->
      val arr = ScreenTime.days(context, days.coerceIn(1, 30))
      (0 until arr.length()).map { toMap(arr.getJSONObject(it)) }
    }

    /** Installed apps likely to pull you in (social, video, games), for guard suggestions. */
    AsyncFunction("distractingApps") Coroutine { withIcons: Boolean ->
      val all = ScreenTime.appInfo(context, ScreenTime.launchablePackages(context), false)
      val pkgs = (0 until all.length()).map { all.getJSONObject(it) }
        .filter { it.optBoolean("distracting") }
        .map { it.getString("pkg") }
      val arr = ScreenTime.appInfo(context, pkgs, withIcons)
      (0 until arr.length()).map { toMap(arr.getJSONObject(it)) }
    }

    AsyncFunction("appInfo") Coroutine { pkgs: List<String>, withIcons: Boolean ->
      val arr = ScreenTime.appInfo(context, pkgs, withIcons)
      (0 until arr.length()).map { toMap(arr.getJSONObject(it)) }
    }

    // ── Mindful pause ─────────────────────────────────────────────────────

    Function("setPauseConfig") { json: String ->
      Gate.setConfig(context, json)
    }

    Function("pauseEvents") { sinceMs: Double ->
      val arr = Gate.events(context, sinceMs.toLong())
      (0 until arr.length()).map { toMap(arr.getJSONObject(it)) }
    }

    Function("openAccessibilitySettings") {
      context.startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    /** App info page — where Android 13+ hides "Allow restricted settings" for sideloaded apps. */
    Function("openAppDetails") {
      context.startActivity(
        Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
          .setData(Uri.parse("package:${context.packageName}"))
          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
      )
    }

    Function("previewPause") { pkg: String ->
      PauseActivity.launch(context, pkg, PauseActivity.REASON_OPEN, preview = true)
    }

    // ── Reliability ───────────────────────────────────────────────────────

    /**
     * Xiaomi, OPPO/realme/OnePlus, Vivo, Huawei/Honor and others add their own "autostart" switch
     * on top of Android's battery settings, and kill background work without it. Try the known
     * screens; fall back to App info.
     */
    Function("openAutostartSettings") {
      val candidates = listOf(
        "com.miui.securitycenter" to "com.miui.permcenter.autostart.AutoStartManagementActivity",
        "com.coloros.safecenter" to "com.coloros.safecenter.permission.startup.StartupAppListActivity",
        "com.coloros.safecenter" to "com.coloros.safecenter.startupapp.StartupAppListActivity",
        "com.oplus.safecenter" to "com.oplus.safecenter.permission.startup.StartupAppListActivity",
        "com.oppo.safe" to "com.oppo.safe.permission.startup.StartupAppListActivity",
        "com.vivo.permissionmanager" to "com.vivo.permissionmanager.activity.BgStartUpManagerActivity",
        "com.iqoo.secure" to "com.iqoo.secure.ui.phoneoptimize.BgStartUpManager",
        "com.huawei.systemmanager" to "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity",
        "com.huawei.systemmanager" to "com.huawei.systemmanager.optimize.process.ProtectActivity",
        "com.hihonor.systemmanager" to "com.hihonor.systemmanager.startupmgr.ui.StartupNormalAppListActivity",
        "com.samsung.android.lool" to "com.samsung.android.sm.battery.ui.BatteryActivity",
        "com.asus.mobilemanager" to "com.asus.mobilemanager.autostart.AutoStartActivity",
        "com.letv.android.letvsafe" to "com.letv.android.letvsafe.AutobootManageActivity",
      )
      val opened = candidates.any { (pkg, cls) ->
        runCatching {
          context.startActivity(
            Intent().setComponent(android.content.ComponentName(pkg, cls)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
          )
        }.isSuccess
      }
      if (!opened) {
        context.startActivity(
          Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
            .setData(Uri.parse("package:${context.packageName}"))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
        )
      }
      opened
    }

    Function("openBatterySettings") {
      val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
        .setData(Uri.parse("package:${context.packageName}"))
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      runCatching { context.startActivity(intent) }.onFailure {
        context.startActivity(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      }
    }
  }

  private fun isIgnoringBatteryOptimizations(): Boolean {
    val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
    return pm.isIgnoringBatteryOptimizations(context.packageName)
  }

  private fun toMap(o: JSONObject): Map<String, Any?> =
    o.keys().asSequence().associateWith { key ->
      when (val v = o.get(key)) {
        JSONObject.NULL -> null
        is JSONArray -> (0 until v.length()).map { i ->
          when (val x = v.get(i)) {
            is JSONObject -> toMap(x)
            is Int -> x.toDouble()
            is Long -> x.toDouble()
            else -> x
          }
        }
        is JSONObject -> toMap(v)
        is Int -> v.toDouble()
        is Long -> v.toDouble()
        else -> v
      }
    }
}
