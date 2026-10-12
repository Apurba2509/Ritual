package expo.modules.ritualsensing

import android.animation.ValueAnimator
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.res.ColorStateList
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Outline
import android.graphics.Paint
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.RippleDrawable
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.text.format.DateFormat
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.ViewOutlineProvider
import android.view.WindowInsets
import android.view.animation.AccelerateDecelerateInterpolator
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import android.window.OnBackInvokedDispatcher
import org.json.JSONObject
import java.util.Calendar
import kotlin.concurrent.thread

/**
 * The mindful pause. Shown over a guarded app the moment it opens.
 *
 * Built with plain Android views so it appears instantly, even when Ritual itself isn't running.
 * Closing is always one tap; continuing takes a breath first, and that breath gets longer each
 * time the same app is opened in a day.
 */
class PauseActivity : Activity() {
  private lateinit var pkg: String
  private var reason = REASON_OPEN
  private var preview = false
  private var decided = false
  private var purpose: String? = null
  private var breath: ValueAnimator? = null

  private val ink = Color.parseColor("#0B0B0C")
  private val surface = Color.parseColor("#1C1C1E")
  private val bone = Color.parseColor("#F4F4F1")
  private val muted = Color.parseColor("#8F8F8A")
  private val volt = Color.parseColor("#D4FF3F")

  private val bold by lazy { font("fonts/InterTight_700Bold.ttf", Typeface.DEFAULT_BOLD) }
  private val medium by lazy { font("fonts/InterTight_500Medium.ttf", Typeface.DEFAULT) }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    window.decorView.setBackgroundColor(ink)
    if (Build.VERSION.SDK_INT >= 33) {
      onBackInvokedDispatcher.registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT) { closeApp() }
    }
    bind(getIntent())
  }

  override fun onNewIntent(newIntent: Intent) {
    super.onNewIntent(newIntent)
    breath?.cancel()
    decided = false
    purpose = null
    bind(newIntent)
  }

  @Deprecated("Pre-Android 13 back handling")
  override fun onBackPressed() = closeApp()

  override fun onStop() {
    super.onStop()
    // Left without choosing (home button, notification…): the app didn't open, so that's a win too.
    if (!decided && !preview && !isChangingConfigurations) {
      decided = true
      Gate.record(this, "left", pkg)
    }
  }

  override fun onDestroy() {
    breath?.cancel()
    super.onDestroy()
  }

  private fun bind(i: Intent) {
    pkg = i.getStringExtra(EXTRA_PKG) ?: run { finish(); return }
    reason = i.getStringExtra(EXTRA_REASON) ?: REASON_OPEN
    preview = i.getBooleanExtra(EXTRA_PREVIEW, false)

    val cfg = Gate.config(this)
    val now = System.currentTimeMillis()
    val bedtime = Gate.atBedtime(cfg, now)
    if (!preview) Gate.record(this, if (reason == REASON_TIMES_UP) "timesup" else "shown", pkg)
    val opens = if (preview) 1 else Gate.countToday(this, "shown", pkg).coerceAtLeast(1)
    val wins = Gate.countToday(this, "closed") + Gate.countToday(this, "left") + Gate.countToday(this, "swap")
    val seconds = Gate.breathSeconds(opens, bedtime)

    val label = runCatching { packageManager.getApplicationLabel(packageManager.getApplicationInfo(pkg, 0)).toString() }
      .getOrDefault("this app")
    val icon = runCatching { packageManager.getApplicationIcon(pkg) }.getOrNull()

    // ── Layout ──
    val root = FrameLayout(this)
    root.setOnApplyWindowInsetsListener { v, insets ->
      val bars =
        if (Build.VERSION.SDK_INT >= 30) insets.getInsets(WindowInsets.Type.systemBars())
        else null
      @Suppress("DEPRECATION")
      v.setPadding(
        bars?.left ?: insets.systemWindowInsetLeft,
        bars?.top ?: insets.systemWindowInsetTop,
        bars?.right ?: insets.systemWindowInsetRight,
        bars?.bottom ?: insets.systemWindowInsetBottom,
      )
      insets
    }
    val col = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER_HORIZONTAL
      setPadding(dp(28), dp(24), dp(28), dp(24))
    }
    root.addView(col, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))

    // App identity
    val appRow = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
    val iconView = ImageView(this).apply {
      setImageDrawable(icon)
      outlineProvider = object : ViewOutlineProvider() {
        override fun getOutline(view: View, outline: Outline) = outline.setRoundRect(0, 0, view.width, view.height, dp(12).toFloat())
      }
      clipToOutline = true
    }
    appRow.addView(iconView, LinearLayout.LayoutParams(dp(40), dp(40)))
    val appText = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(dp(12), 0, 0, 0) }
    appText.addView(text(label, 17f, bone, bold))
    val usage = text(ordinal(opens) + " open today", 13f, muted, medium)
    appText.addView(usage)
    appRow.addView(appText)
    if (preview) appRow.addView(pill("Preview"), LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { leftMargin = dp(12) })
    col.addView(appRow, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))

    col.addView(View(this), LinearLayout.LayoutParams(1, 0, 1f))

    // Breathing circle
    val breathBox = FrameLayout(this)
    val circle = BreathView(this, volt)
    breathBox.addView(circle, FrameLayout.LayoutParams(dp(220), dp(220), Gravity.CENTER))
    val breathLabel = text("Breathe in", 16f, bone, medium).apply { gravity = Gravity.CENTER }
    breathBox.addView(breathLabel, FrameLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.CENTER))
    col.addView(breathBox, LinearLayout.LayoutParams(dp(220), dp(220)).apply { gravity = Gravity.CENTER_HORIZONTAL })

    // Message
    val headline = when {
      reason == REASON_TIMES_UP -> "Your ${cfg.allowMinutes} minutes are up."
      bedtime -> "It's ${DateFormat.getTimeFormat(this).format(now)}.\nSleep is a habit too."
      opens >= 4 -> "Back again. Take a breath."
      else -> "Take one breath first."
    }
    col.addView(text(headline, 26f, bone, bold).apply { gravity = Gravity.CENTER; setPadding(0, dp(28), 0, dp(8)) },
      LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
    val body = StringBuilder(
      if (opens > 1) "You've opened $label $opens times today." else "Is opening $label something you decided to do?",
    )
    // A set time to catch up takes the edge off FOMO. Not at bedtime, though: then sleep wins.
    if (!bedtime) Gate.nextCatchupStart(cfg, now)?.let { m ->
      val nowMin = Calendar.getInstance().run { get(Calendar.HOUR_OF_DAY) * 60 + get(Calendar.MINUTE) }
      val cal = Calendar.getInstance().apply { set(Calendar.HOUR_OF_DAY, m / 60); set(Calendar.MINUTE, m % 60) }
      val time = DateFormat.getTimeFormat(this).format(cal.time)
      body.append("\nNext catch-up ${if (m <= nowMin) "tomorrow at" else "at"} $time. Nothing will be missed.")
    }
    col.addView(text(body.toString(), 15f, muted, medium).apply { gravity = Gravity.CENTER; setLineSpacing(0f, 1.25f) },
      LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))

    col.addView(View(this), LinearLayout.LayoutParams(1, 0, 1f))

    // Intention + continue (revealed after the breath)
    val later = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; alpha = 0f; visibility = View.INVISIBLE }
    later.addView(text("What's it for?", 13f, muted, medium).apply { setPadding(0, 0, 0, dp(8)) })
    val chips = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
    val swapButton = cfg.swap?.let { s ->
      linkButton("${s.label} instead") { doSwap(s) }
    }
    listOf("Reply to someone", "One thing", "Just scrolling").forEachIndexed { idx, t ->
      val chip = chip(t)
      chip.setOnClickListener {
        purpose = t
        for (c in 0 until chips.childCount) chips.getChildAt(c).isSelected = chips.getChildAt(c) === chip
        restyleChips(chips)
        if (t == "Just scrolling") swapButton?.setTextColor(volt)
      }
      chips.addView(chip, LinearLayout.LayoutParams(0, dp(40), 1f).apply { if (idx > 0) leftMargin = dp(8) })
    }
    later.addView(chips)
    val openBtn = button(
      if (reason == REASON_TIMES_UP) "${cfg.allowMinutes} more minutes" else "Open for ${cfg.allowMinutes} min",
      filled = false,
    ) { openApp(cfg.allowMinutes) }
    later.addView(openBtn, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(52)).apply { topMargin = dp(14) })
    col.addView(later, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))

    val closeBtn = button("Close $label", filled = true) { closeApp() }
    col.addView(closeBtn, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(56)).apply { topMargin = dp(10) })
    swapButton?.let { col.addView(it, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(44)).apply { topMargin = dp(4) }) }
    if (wins > 0) {
      col.addView(text("You've chosen not to open it $wins time${if (wins > 1) "s" else ""} today.", 12f, muted, medium)
        .apply { gravity = Gravity.CENTER; setPadding(0, dp(10), 0, 0) },
        LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
    }

    setContentView(root)

    // How long so far today (off the main thread; the usage log can be large).
    if (ScreenTime.hasAccess(this)) {
      thread(name = "ritual-pause-usage") {
        val start = Calendar.getInstance().apply {
          set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0); set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0)
        }.timeInMillis
        val day = runCatching { ScreenTime.day(this, start, start + 86_400_000L) }.getOrNull() ?: return@thread
        val apps = day.optJSONArray("apps") ?: return@thread
        var ms = 0L
        for (k in 0 until apps.length()) if (apps.getJSONObject(k).optString("pkg") == pkg) ms = apps.getJSONObject(k).optLong("ms")
        val mins = (ms / 60_000L).toInt()
        if (mins > 0) runOnUiThread { usage.text = "${ordinal(opens)} open today · ${duration(mins)} so far" }
      }
    }

    // The breath. With system animations off, skip straight to the choice.
    val animate = Build.VERSION.SDK_INT < 26 || ValueAnimator.areAnimatorsEnabled()
    if (!animate) {
      circle.level = 0.25f
      breathLabel.text = "Your call"
      reveal(later)
      return
    }
    breath = ValueAnimator.ofFloat(0f, 1f).apply {
      duration = seconds * 1000L
      interpolator = AccelerateDecelerateInterpolator()
      addUpdateListener {
        val f = it.animatedValue as Float
        // In for the first 45%, hold, then out.
        circle.level = when {
          f < 0.45f -> f / 0.45f
          f < 0.55f -> 1f
          else -> 1f - (f - 0.55f) / 0.45f * 0.6f
        }
        breathLabel.text = when {
          f < 0.45f -> "Breathe in"
          f < 0.55f -> "Hold"
          else -> "and out"
        }
      }
      doOnEnd {
        settle(circle, breathLabel)
        reveal(later)
      }
      start()
    }
  }

  private fun ValueAnimator.doOnEnd(block: () -> Unit) =
    addListener(object : android.animation.AnimatorListenerAdapter() {
      override fun onAnimationEnd(animation: android.animation.Animator) = block()
    })

  /** After the breath the circle eases down and hands the decision back. */
  private fun settle(circle: BreathView, label: TextView) {
    ValueAnimator.ofFloat(circle.level, 0.25f).apply {
      duration = 420
      interpolator = AccelerateDecelerateInterpolator()
      addUpdateListener { circle.level = it.animatedValue as Float }
      start()
    }
    label.text = "Your call"
    label.alpha = 0f
    label.animate().alpha(1f).setDuration(300).start()
  }

  private fun reveal(v: View) {
    v.visibility = View.VISIBLE
    v.translationY = dp(10).toFloat()
    v.animate().alpha(1f).translationY(0f).setDuration(220).start()
  }

  // ── Decisions ───────────────────────────────────────────────────────────

  private fun closeApp() {
    if (!decided && !preview) Gate.record(this, "closed", pkg, purpose?.let { JSONObject().put("intent", it) })
    decided = true
    if (!preview) {
      startActivity(Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
    finish()
  }

  private fun openApp(minutes: Int) {
    decided = true
    if (!preview) {
      val until = System.currentTimeMillis() + minutes * 60_000L
      Gate.allow(this, pkg, until)
      Gate.record(this, "opened", pkg, JSONObject().put("minutes", minutes).apply { purpose?.let { put("intent", it) } })
      GateService.instance?.scheduleExpiry(pkg, until)
    }
    finish()
  }

  private fun doSwap(s: Gate.Swap) {
    decided = true
    if (!preview) Gate.record(this, "swap", pkg, JSONObject().put("habitId", s.habitId))
    runCatching {
      startActivity(
        Intent(Intent.ACTION_VIEW, Uri.parse("ritual://focus/${s.habitId}?minutes=2"))
          .setPackage(packageName)
          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
      )
    }
    finish()
  }

  // ── Little view helpers ─────────────────────────────────────────────────

  private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()

  private fun font(path: String, fallback: Typeface): Typeface =
    runCatching { Typeface.createFromAsset(assets, path) }.getOrDefault(fallback)

  private fun text(s: String, size: Float, color: Int, face: Typeface) = TextView(this).apply {
    text = s
    textSize = size
    setTextColor(color)
    typeface = face
    includeFontPadding = false
  }

  private fun rounded(color: Int, radius: Int, stroke: Int? = null) = GradientDrawable().apply {
    setColor(color)
    cornerRadius = radius.toFloat()
    stroke?.let { setStroke(dp(1), it) }
  }

  private fun button(label: String, filled: Boolean, onClick: () -> Unit) = TextView(this).apply {
    text = label
    textSize = 16f
    typeface = bold
    gravity = Gravity.CENTER
    setTextColor(if (filled) ink else bone)
    val bg = rounded(if (filled) volt else Color.TRANSPARENT, dp(28), if (filled) null else Color.parseColor("#3A3A3D"))
    background = RippleDrawable(ColorStateList.valueOf(Color.argb(40, 255, 255, 255)), bg, rounded(Color.WHITE, dp(28)))
    isClickable = true
    setOnClickListener { onClick() }
  }

  private fun linkButton(label: String, onClick: () -> Unit) = TextView(this).apply {
    text = label
    textSize = 15f
    typeface = medium
    gravity = Gravity.CENTER
    setTextColor(bone)
    isClickable = true
    setOnClickListener { onClick() }
  }

  private fun chip(label: String) = TextView(this).apply {
    text = label
    textSize = 13f
    typeface = medium
    gravity = Gravity.CENTER
    maxLines = 1
    setTextColor(bone)
    background = rounded(surface, dp(20))
    isClickable = true
  }

  private fun restyleChips(row: LinearLayout) {
    for (i in 0 until row.childCount) {
      val c = row.getChildAt(i) as TextView
      c.background = rounded(if (c.isSelected) bone else surface, dp(20))
      c.setTextColor(if (c.isSelected) ink else bone)
    }
  }

  private fun pill(label: String) = text(label, 11f, ink, bold).apply {
    setPadding(dp(8), dp(3), dp(8), dp(3))
    background = rounded(volt, dp(10))
  }

  private fun ordinal(n: Int): String {
    val suffix = if (n % 100 in 11..13) "th" else when (n % 10) { 1 -> "st"; 2 -> "nd"; 3 -> "rd"; else -> "th" }
    return "$n$suffix"
  }

  private fun duration(mins: Int) = if (mins < 60) "$mins min" else "${mins / 60}h ${mins % 60}m"

  /** A soft volt circle that grows and shrinks with the breath. */
  private class BreathView(context: Context, private val color: Int) : View(context) {
    var level = 0f
      set(v) {
        field = v
        invalidate()
      }
    private val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.FILL }
    private val ring = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE }

    override fun onDraw(canvas: Canvas) {
      val cx = width / 2f
      val cy = height / 2f
      val max = minOf(cx, cy) - 4f
      val r = max * (0.45f + 0.55f * level)
      fill.color = Color.argb((18 + 24 * level).toInt(), Color.red(color), Color.green(color), Color.blue(color))
      canvas.drawCircle(cx, cy, r, fill)
      ring.color = color
      ring.strokeWidth = resources.displayMetrics.density * 2.5f
      canvas.drawCircle(cx, cy, r, ring)
    }
  }

  companion object {
    const val EXTRA_PKG = "pkg"
    const val EXTRA_REASON = "reason"
    const val EXTRA_PREVIEW = "preview"
    const val REASON_OPEN = "open"
    const val REASON_TIMES_UP = "timesup"

    fun launch(context: Context, pkg: String, reason: String, preview: Boolean = false) {
      context.startActivity(
        Intent(context, PauseActivity::class.java)
          .putExtra(EXTRA_PKG, pkg)
          .putExtra(EXTRA_REASON, reason)
          .putExtra(EXTRA_PREVIEW, preview)
          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_NO_ANIMATION),
      )
    }
  }
}
