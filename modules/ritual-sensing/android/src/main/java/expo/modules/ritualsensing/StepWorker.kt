package expo.modules.ritualsensing

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit

/**
 * Wakes up every ~15 minutes (even with the app closed) to snapshot the step counter, and once a
 * day to cache finished screen-time days. Both are cheap reads of data the OS already keeps, so a
 * worker that an aggressive battery manager delays only catches up later; nothing is lost.
 */
class StepWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
  override suspend fun doWork(): Result {
    val ctx = applicationContext
    if (StepLedger.prefs(ctx).getBoolean(BootReceiver.KEY_STEPS_ENABLED, false)) Sensors.snapshot(ctx)
    runCatching { ScreenTime.cacheFinishedDays(ctx) }
    return Result.success()
  }

  companion object {
    private const val NAME = "ritual-step-snapshots"

    fun schedule(context: Context) {
      val request = PeriodicWorkRequestBuilder<StepWorker>(15, TimeUnit.MINUTES).build()
      WorkManager.getInstance(context)
        .enqueueUniquePeriodicWork(NAME, ExistingPeriodicWorkPolicy.KEEP, request)
    }

    fun cancel(context: Context) {
      WorkManager.getInstance(context).cancelUniqueWork(NAME)
    }
  }
}
