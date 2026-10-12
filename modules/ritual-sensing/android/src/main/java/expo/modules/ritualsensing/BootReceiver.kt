package expo.modules.ritualsensing

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/**
 * Keeps background sensing alive across reboots and app updates, and saves the step counter
 * right before shutdown (it resets to zero on boot).
 */
class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val pending = goAsync()
    CoroutineScope(Dispatchers.Default).launch {
      try {
        val prefs = StepLedger.prefs(context)
        when (intent.action) {
          Intent.ACTION_SHUTDOWN -> Sensors.snapshot(context)
          else -> {
            if (prefs.getBoolean(KEY_STEPS_ENABLED, false)) {
              StepWorker.schedule(context)
              Sensors.snapshot(context)
            }
            if (ScreenTime.isEnabled(context)) StepWorker.schedule(context)
            if (ActivityDetection.isEnabled(context)) ActivityDetection.start(context)
          }
        }
      } finally {
        pending.finish()
      }
    }
  }

  companion object {
    const val KEY_STEPS_ENABLED = "steps_enabled"
  }
}
