package expo.modules.ritualsensing

import android.accessibilityservice.AccessibilityService
import android.os.Handler
import android.os.Looper
import android.view.accessibility.AccessibilityEvent

/**
 * Notices when a guarded app comes to the front and shows the mindful pause.
 *
 * Deliberately minimal (and cheap on battery): it only listens for window changes, never reads
 * what's on screen (canRetrieveWindowContent = false), never sees text, and does nothing for
 * apps that aren't guarded. It's event-driven: there's no polling and no wake lock.
 */
class GateService : AccessibilityService() {
  private val handler = Handler(Looper.getMainLooper())
  private var foreground: String? = null
  private var expiry: Runnable? = null

  override fun onServiceConnected() {
    instance = this
  }

  override fun onDestroy() {
    if (instance === this) instance = null
    handler.removeCallbacksAndMessages(null)
    super.onDestroy()
  }

  override fun onAccessibilityEvent(event: AccessibilityEvent) {
    if (event.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return
    val pkg = event.packageName?.toString() ?: return
    // Our own screens (including the pause itself) never change what "the app in front" is.
    if (pkg == packageName) return
    val isHome = pkg in ScreenTime.homePackages(this)
    if (!isHome && !ScreenTime.isApp(this, pkg)) return // keyboards, status bar, overlays
    if (pkg == foreground) return
    foreground = pkg
    if (!isHome && Gate.shouldPause(this, pkg)) PauseActivity.launch(this, pkg, PauseActivity.REASON_OPEN)
  }

  override fun onInterrupt() = Unit

  /** When an allowance runs out and the app is still in front, pause again. */
  fun scheduleExpiry(pkg: String, at: Long) {
    expiry?.let { handler.removeCallbacks(it) }
    val r = Runnable {
      if (foreground == pkg && Gate.config(this).enabled && pkg in Gate.config(this).apps) {
        PauseActivity.launch(this, pkg, PauseActivity.REASON_TIMES_UP)
      }
    }
    expiry = r
    handler.postDelayed(r, (at - System.currentTimeMillis()).coerceAtLeast(1_000L))
  }

  companion object {
    @Volatile
    var instance: GateService? = null
  }
}
