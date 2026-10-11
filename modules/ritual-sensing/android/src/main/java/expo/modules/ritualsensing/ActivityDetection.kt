package expo.modules.ritualsensing

import android.annotation.SuppressLint
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.SystemClock
import com.google.android.gms.location.ActivityRecognition
import com.google.android.gms.location.ActivityTransition
import com.google.android.gms.location.ActivityTransitionRequest
import com.google.android.gms.location.ActivityTransitionResult
import com.google.android.gms.location.DetectedActivity
import kotlinx.coroutines.suspendCancellableCoroutine
import org.json.JSONArray
import org.json.JSONObject
import kotlin.coroutines.resume

/**
 * Google's Activity Recognition Transition API: the OS tells us when the person starts or stops
 * walking, running or cycling — no GPS, no network, and the app doesn't need to be running.
 * Events are appended to a small local log the app reads on its next launch.
 */
object ActivityDetection {
  private const val ACTION = "expo.modules.ritualsensing.ACTIVITY_TRANSITIONS"
  private const val KEY_ENABLED = "ar_enabled"
  private const val KEY_EVENTS = "ar_events"
  private const val MAX_EVENTS = 600

  private val TYPES = listOf(DetectedActivity.WALKING, DetectedActivity.RUNNING, DetectedActivity.ON_BICYCLE)

  private fun pendingIntent(context: Context): PendingIntent {
    val intent = Intent(context, TransitionReceiver::class.java).setAction(ACTION)
    // The system writes the result into the intent, so it must be mutable on Android 12+.
    val flags = PendingIntent.FLAG_UPDATE_CURRENT or
      (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_MUTABLE else 0)
    return PendingIntent.getBroadcast(context, 4107, intent, flags)
  }

  fun isEnabled(context: Context) = StepLedger.prefs(context).getBoolean(KEY_ENABLED, false)

  @SuppressLint("MissingPermission")
  suspend fun start(context: Context): Boolean {
    if (!Sensors.canReadActivity(context)) return false
    val transitions = TYPES.flatMap { type ->
      listOf(ActivityTransition.ACTIVITY_TRANSITION_ENTER, ActivityTransition.ACTIVITY_TRANSITION_EXIT).map {
        ActivityTransition.Builder().setActivityType(type).setActivityTransition(it).build()
      }
    }
    val ok = suspendCancellableCoroutine { cont ->
      ActivityRecognition.getClient(context)
        .requestActivityTransitionUpdates(ActivityTransitionRequest(transitions), pendingIntent(context))
        .addOnSuccessListener { if (cont.isActive) cont.resume(true) }
        .addOnFailureListener { if (cont.isActive) cont.resume(false) }
    }
    if (ok) StepLedger.prefs(context).edit().putBoolean(KEY_ENABLED, true).apply()
    return ok
  }

  @SuppressLint("MissingPermission")
  fun stop(context: Context) {
    StepLedger.prefs(context).edit().putBoolean(KEY_ENABLED, false).apply()
    if (Sensors.canReadActivity(context)) {
      ActivityRecognition.getClient(context).removeActivityTransitionUpdates(pendingIntent(context))
    }
  }

  @Synchronized
  fun append(context: Context, items: List<JSONObject>) {
    if (items.isEmpty()) return
    val p = StepLedger.prefs(context)
    val arr = JSONArray(p.getString(KEY_EVENTS, "[]"))
    items.forEach { arr.put(it) }
    val start = maxOf(0, arr.length() - MAX_EVENTS)
    val trimmed = JSONArray()
    for (i in start until arr.length()) trimmed.put(arr.get(i))
    p.edit().putString(KEY_EVENTS, trimmed.toString()).apply()
  }

  fun events(context: Context, sinceMs: Long): List<Map<String, Any>> {
    val arr = JSONArray(StepLedger.prefs(context).getString(KEY_EVENTS, "[]"))
    val out = mutableListOf<Map<String, Any>>()
    for (i in 0 until arr.length()) {
      val o = arr.getJSONObject(i)
      val t = o.getLong("t")
      if (t >= sinceMs) out.add(mapOf("type" to o.getString("type"), "enter" to o.getBoolean("enter"), "t" to t.toDouble()))
    }
    return out
  }

  fun typeName(type: Int) = when (type) {
    DetectedActivity.WALKING -> "walk"
    DetectedActivity.RUNNING -> "run"
    DetectedActivity.ON_BICYCLE -> "ride"
    else -> "other"
  }
}

class TransitionReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (!ActivityTransitionResult.hasResult(intent)) return
    val result = ActivityTransitionResult.extractResult(intent) ?: return
    val nowWall = System.currentTimeMillis()
    val nowElapsed = SystemClock.elapsedRealtimeNanos()
    val items = result.transitionEvents.map { e ->
      val t = nowWall - (nowElapsed - e.elapsedRealTimeNanos) / 1_000_000
      JSONObject()
        .put("type", ActivityDetection.typeName(e.activityType))
        .put("enter", e.transitionType == ActivityTransition.ACTIVITY_TRANSITION_ENTER)
        .put("t", t)
    }
    ActivityDetection.append(context, items)
  }
}
