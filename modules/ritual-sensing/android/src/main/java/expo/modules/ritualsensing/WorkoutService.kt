package expo.modules.ritualsensing

import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import java.util.Locale

/**
 * Records a workout in the background: GPS route, barometric elevation and steps, with a live
 * notification. Keeps running with the screen off or the app swiped away, and works with no
 * internet at all (GPS is satellite-based; maps are not needed to record).
 */
class WorkoutService : Service() {
  private lateinit var fused: FusedLocationProviderClient
  private val handler = Handler(Looper.getMainLooper())
  private var wakeLock: PowerManager.WakeLock? = null
  private var sensorsOn = false
  private var lastPersist = 0L

  private val locationCallback = object : LocationCallback() {
    override fun onLocationResult(result: LocationResult) {
      val s = WorkoutStore.active ?: return
      result.locations.forEach { s.onLocation(it) }
    }
  }

  private val sensorListener = object : SensorEventListener {
    override fun onSensorChanged(event: SensorEvent) {
      val s = WorkoutStore.active ?: return
      when (event.sensor.type) {
        Sensor.TYPE_PRESSURE -> s.onPressure(event.values[0])
        Sensor.TYPE_STEP_COUNTER -> s.onStepCounter(event.values[0])
      }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit
  }

  private val ticker = object : Runnable {
    override fun run() {
      updateNotification()
      val now = System.currentTimeMillis()
      if (now - lastPersist > 20_000) {
        WorkoutStore.persist(this@WorkoutService)
        lastPersist = now
      }
      handler.postDelayed(this, 3000)
    }
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    fused = LocationServices.getFusedLocationProviderClient(this)
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_START -> {
        if (WorkoutStore.active == null) WorkoutStore.active = WorkoutSession.create(intent.getStringExtra(EXTRA_TYPE) ?: "walk")
        goForeground()
        startSensors()
      }
      ACTION_PAUSE -> {
        WorkoutStore.active?.pause()
        WorkoutStore.persist(this)
        updateNotification()
      }
      ACTION_RESUME -> {
        WorkoutStore.active?.resume()
        updateNotification()
      }
      ACTION_FINISH -> {
        WorkoutStore.finish(this)
        shutdown()
      }
      ACTION_STOP -> shutdown()
      else -> {
        // Restarted by the system after the process died: pick the session back up.
        if (WorkoutStore.restore(this) != null) {
          goForeground()
          startSensors()
        } else {
          shutdown()
        }
      }
    }
    return START_STICKY
  }

  private fun goForeground() {
    var types = 0
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && Sensors.canUseLocation(this)) {
      types = types or ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE && Sensors.canReadActivity(this)) {
      types = types or ServiceInfo.FOREGROUND_SERVICE_TYPE_HEALTH
    }
    ServiceCompat.startForeground(this, NOTIFICATION_ID, buildNotification(), types)
  }

  @SuppressLint("MissingPermission", "WakelockTimeout")
  private fun startSensors() {
    if (sensorsOn) return
    sensorsOn = true
    val sm = Sensors.manager(this)
    sm.getDefaultSensor(Sensor.TYPE_PRESSURE)?.let {
      sm.registerListener(sensorListener, it, SensorManager.SENSOR_DELAY_NORMAL)
    }
    if (Sensors.canReadActivity(this)) {
      sm.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)?.let {
        sm.registerListener(sensorListener, it, SensorManager.SENSOR_DELAY_NORMAL)
      }
    }
    if (Sensors.canUseLocation(this)) {
      val request = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 2000)
        .setMinUpdateIntervalMillis(1000)
        .setWaitForAccurateLocation(false)
        .build()
      fused.requestLocationUpdates(request, locationCallback, Looper.getMainLooper())
    }
    val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
    wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "ritual:workout").apply {
      acquire(8 * 60 * 60 * 1000L)
    }
    handler.post(ticker)
  }

  private fun shutdown() {
    handler.removeCallbacks(ticker)
    if (sensorsOn) {
      Sensors.manager(this).unregisterListener(sensorListener)
      fused.removeLocationUpdates(locationCallback)
      sensorsOn = false
    }
    wakeLock?.let { if (it.isHeld) it.release() }
    wakeLock = null
    ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
    stopSelf()
  }

  override fun onDestroy() {
    WorkoutStore.persist(this)
    handler.removeCallbacks(ticker)
    super.onDestroy()
  }

  // ── Notification ──────────────────────────────────────────────────────────

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val nm = getSystemService(NotificationManager::class.java)
    if (nm.getNotificationChannel(CHANNEL) == null) {
      nm.createNotificationChannel(
        NotificationChannel(CHANNEL, "Workout in progress", NotificationManager.IMPORTANCE_LOW).apply {
          description = "Live distance, time and pace while Ritual records a workout"
          setShowBadge(false)
        },
      )
    }
  }

  private fun action(action: String, code: Int): PendingIntent =
    PendingIntent.getService(
      this,
      code,
      Intent(this, WorkoutService::class.java).setAction(action),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

  private fun buildNotification(): Notification {
    ensureChannel()
    val s = WorkoutStore.active
    val open = packageManager.getLaunchIntentForPackage(packageName)?.apply {
      data = Uri.parse("ritual://workout")
      flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_NEW_TASK
    }
    val contentIntent = open?.let {
      PendingIntent.getActivity(this, 0, it, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }
    val icon = resources.getIdentifier("notification_icon", "drawable", packageName).takeIf { it != 0 }
      ?: applicationInfo.icon
    val title = if (s == null) "Workout" else "${label(s.type)} · ${clock(s.movingMs() / 1000)}${if (s.paused) " · paused" else ""}"
    val text = if (s == null) "" else buildString {
      append(String.format(Locale.US, "%.2f km", s.distance / 1000))
      s.currentPace()?.let { append(" · ${pace(it)}/km") }
      if (s.elevationGain >= 1) append(" · ↑${Math.round(s.elevationGain)} m")
      if (s.steps > 0 && s.type != "ride") append(" · ${Math.round(s.steps)} steps")
    }
    if (s != null && Build.VERSION.SDK_INT >= 36) return buildLiveUpdate(s, icon, title, text, contentIntent)
    return NotificationCompat.Builder(this, CHANNEL)
      .setSmallIcon(icon)
      .setColor(0xFFD4FF3F.toInt())
      .setContentTitle(title)
      .setContentText(text)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setSilent(true)
      .setCategory(NotificationCompat.CATEGORY_WORKOUT)
      .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
      .setContentIntent(contentIntent)
      .addAction(
        0,
        if (s?.paused == true) "Resume" else "Pause",
        action(if (s?.paused == true) ACTION_RESUME else ACTION_PAUSE, 1),
      )
      .addAction(0, "Finish", action(ACTION_FINISH, 2))
      .build()
  }

  /**
   * Android 16 "Live Update": a progress-style notification that the system can promote to a chip
   * in the status bar, showing distance toward a goal at a glance (km segments, volt fill).
   */
  @androidx.annotation.RequiresApi(36)
  private fun buildLiveUpdate(
    s: WorkoutSession,
    icon: Int,
    title: String,
    text: String,
    contentIntent: PendingIntent?,
  ): Notification {
    val goalKm = when (s.type) {
      "run" -> maxOf(5, Math.ceil(s.distance / 1000).toInt())
      "ride" -> maxOf(20, Math.ceil(s.distance / 1000).toInt())
      else -> maxOf(3, Math.ceil(s.distance / 1000).toInt())
    }
    val volt = 0xFFD4FF3F.toInt()
    val style = Notification.ProgressStyle()
      .setStyledByProgress(true)
      .setProgressSegments(List(goalKm) { Notification.ProgressStyle.Segment(1000).setColor(volt) })
      .setProgress(minOf(s.distance, goalKm * 1000.0).toInt())
    val pauseLabel = if (s.paused) "Resume" else "Pause"
    val builder = Notification.Builder(this, CHANNEL)
      .setSmallIcon(icon)
      .setColor(volt)
      .setContentTitle(title)
      .setContentText(text)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setCategory(Notification.CATEGORY_WORKOUT)
      .setForegroundServiceBehavior(Notification.FOREGROUND_SERVICE_IMMEDIATE)
      .setStyle(style)
      .setContentIntent(contentIntent)
      .addAction(Notification.Action.Builder(null, pauseLabel, action(if (s.paused) ACTION_RESUME else ACTION_PAUSE, 1)).build())
      .addAction(Notification.Action.Builder(null, "Finish", action(ACTION_FINISH, 2)).build())
    // Ask for promotion to a status-bar Live Update chip (newer platform builds); ignore where absent.
    runCatching {
      Notification.Builder::class.java.getMethod("setRequestPromotedOngoing", Boolean::class.javaPrimitiveType)
        .invoke(builder, true)
    }
    runCatching {
      Notification.Builder::class.java.getMethod("setShortCriticalText", CharSequence::class.java)
        .invoke(builder, String.format(Locale.US, "%.1f km", s.distance / 1000))
    }
    return builder.build()
  }

  private fun updateNotification() {
    if (WorkoutStore.active == null) return
    getSystemService(NotificationManager::class.java).notify(NOTIFICATION_ID, buildNotification())
  }

  companion object {
    const val ACTION_START = "expo.modules.ritualsensing.START"
    const val ACTION_PAUSE = "expo.modules.ritualsensing.PAUSE"
    const val ACTION_RESUME = "expo.modules.ritualsensing.RESUME"
    const val ACTION_FINISH = "expo.modules.ritualsensing.FINISH"
    const val ACTION_STOP = "expo.modules.ritualsensing.STOP"
    const val EXTRA_TYPE = "type"
    private const val CHANNEL = "ritual_workout"
    private const val NOTIFICATION_ID = 4108

    fun label(type: String) = when (type) {
      "run" -> "Run"
      "ride" -> "Ride"
      else -> "Walk"
    }

    fun clock(totalSec: Long): String {
      val h = totalSec / 3600
      val m = (totalSec % 3600) / 60
      val s = totalSec % 60
      return if (h > 0) String.format(Locale.US, "%d:%02d:%02d", h, m, s) else String.format(Locale.US, "%d:%02d", m, s)
    }

    fun pace(secPerKm: Double): String {
      val total = Math.round(secPerKm)
      return String.format(Locale.US, "%d'%02d\"", total / 60, total % 60)
    }

    fun intent(context: Context, action: String, type: String? = null) =
      Intent(context, WorkoutService::class.java).setAction(action).apply { type?.let { putExtra(EXTRA_TYPE, it) } }
  }
}
