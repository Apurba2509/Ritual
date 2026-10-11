package expo.modules.ritualsensing

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit

/** Wakes up every ~15 minutes (even with the app closed) to snapshot the step counter. */
class StepWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
  override suspend fun doWork(): Result {
    Sensors.snapshot(applicationContext)
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
