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
      StepWorker.cancel(context)
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

    // ── Reliability ───────────────────────────────────────────────────────

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
        is JSONArray -> (0 until v.length()).map { v.get(it) }
        is Int -> v.toDouble()
        is Long -> v.toDouble()
        else -> v
      }
    }
}
