package expo.modules.ritualsensing

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import androidx.core.content.ContextCompat
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull
import kotlin.coroutines.resume

object Sensors {
  fun manager(context: Context) = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager

  fun hasStepCounter(context: Context) = manager(context).getDefaultSensor(Sensor.TYPE_STEP_COUNTER) != null

  fun hasBarometer(context: Context) = manager(context).getDefaultSensor(Sensor.TYPE_PRESSURE) != null

  fun canReadActivity(context: Context): Boolean =
    Build.VERSION.SDK_INT < Build.VERSION_CODES.Q ||
      ContextCompat.checkSelfPermission(context, Manifest.permission.ACTIVITY_RECOGNITION) ==
        PackageManager.PERMISSION_GRANTED

  fun canUseLocation(context: Context): Boolean =
    ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) ==
      PackageManager.PERMISSION_GRANTED

  /**
   * One-shot read of the cumulative step counter. The sensor reports its current value right
   * after a listener registers; returns null if there is no sensor, no permission, or no reading.
   */
  suspend fun readStepCounter(context: Context, timeoutMs: Long = 4000): Float? {
    if (!canReadActivity(context)) return null
    val sm = manager(context)
    val sensor = sm.getDefaultSensor(Sensor.TYPE_STEP_COUNTER) ?: return null
    return withTimeoutOrNull(timeoutMs) {
      suspendCancellableCoroutine { cont ->
        val listener = object : SensorEventListener {
          override fun onSensorChanged(event: SensorEvent) {
            sm.unregisterListener(this)
            if (cont.isActive) cont.resume(event.values[0])
          }

          override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit
        }
        sm.registerListener(listener, sensor, SensorManager.SENSOR_DELAY_NORMAL)
        cont.invokeOnCancellation { sm.unregisterListener(listener) }
      }
    }
  }

  suspend fun snapshot(context: Context): Boolean {
    val value = readStepCounter(context) ?: return false
    StepLedger.record(context, value)
    return true
  }
}
