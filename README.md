<p align="center">
  <img src="assets/brand/logo-dark.png" width="420" alt="ritual." />
</p>

<p align="center"><b>Habits that track themselves.</b></p>

<p align="center">
  Your phone counts the steps, notices the run, sees the commit, hears what you did, and checks the habit off.<br/>
  Offline, in the background, without you opening the app.
</p>

<p align="center">
  <a href="https://ritual-37ccf.web.app"><b>Live demo → ritual-37ccf.web.app</b></a>
</p>

<p align="center">
  <a href="https://github.com/Apurba2509/Ritual/actions/workflows/ci.yml"><img src="https://github.com/Apurba2509/Ritual/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <img src="https://img.shields.io/badge/Expo-SDK%2057-000?logo=expo" alt="Expo SDK 57" />
  <img src="https://img.shields.io/badge/React%20Native-0.86%20·%20New%20Arch-61DAFB?logo=react&logoColor=black" alt="React Native 0.86" />
  <img src="https://img.shields.io/badge/Kotlin-native%20module-7F52FF?logo=kotlin&logoColor=white" alt="Kotlin native module" />
  <img src="https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white" alt="TypeScript strict" />
  <img src="https://img.shields.io/badge/Firebase-Auth%20·%20Firestore%20·%20AI%20Logic-FFCA28?logo=firebase&logoColor=black" alt="Firebase" />
</p>

<p align="center">
  <img src="docs/screenshots/today.png" width="200" alt="Today: the day ring" />
  <img src="docs/screenshots/workout.png" width="200" alt="Workout recorder" />
  <img src="docs/screenshots/habit.png" width="200" alt="Habit detail" />
  <img src="docs/screenshots/insights.png" width="200" alt="Insights" />
</p>
<p align="center">
  <img src="docs/screenshots/welcome.png" width="200" alt="Welcome" />
  <img src="docs/screenshots/tracking.png" width="200" alt="What Ritual is tracking" />
  <img src="docs/screenshots/quick-log.png" width="200" alt="Log by voice or text" />
  <img src="docs/screenshots/profile.png" width="200" alt="Profile" />
</p>

---

## Why it's different

Every habit tracker has streaks. They all die the same way: you stop opening the app to tick boxes.
Ritual is built around one idea: **the best check-in is the one you never have to make.**

| Most habit apps | Ritual |
| --- | --- |
| You tap "done" | Your **phone's own sensors** do it: a hardware step counter read by a background worker, Android activity recognition for walks / runs / rides, and a GPS + barometer workout recorder. It works **with the app closed, with no internet, and even with no GPS** (distance falls back to steps × stride). |
| Steps need a second fitness app | Steps are counted **on the device by Ritual itself**; Health Connect is optional. |
| Coding habits are honour-system | **GitHub** contributions and **LeetCode** submissions complete coding habits, with a year of history back-filled. |
| Logging is typing into forms | **Say it**: "ran 5k and read 20 pages" → two check-ins (speech recognition → Gemini, with an on-device parser as fallback). |
| Reminders nag about things you already did | A **notification planner** rebuilds the schedule whenever data changes. Walk and the step reminder disappears; a "last call" only fires when a real streak is about to break. |
| You have to open the app | A **home-screen widget** shows the day ring and completes habits with one tap; on **Android 16** a live workout becomes a status-bar **Live Update**. |

## Feature tour

- **Today**: the *day ring*, one segment per habit that lights up as you go; a week strip; swipe a habit right to complete it; finished habits fold into a compact "Done" list; a live "Tracking" indicator that always tells you what the phone is sensing.
- **Phone sensing (Android, Kotlin)**:
  - **Step counter**: snapshotted every ~15 minutes by WorkManager, survives reboots, and splits steps across midnight.
  - **Activity recognition**: notices walks, runs and rides on its own. "Noticed today" shows exactly what it saw.
  - **Workout recorder**: a foreground service with route, pace, km splits, barometric elevation and steps. It has a live notification with Pause/Finish, becomes a Live Update on Android 16, survives the process being killed, and works offline.
- **Auto-tracking**: phone sensors, GitHub, LeetCode and Health Connect, with history back-filled so streaks start where you already are.
- **Log by voice or text**: speech-to-text with live partial results, interpreted by Gemini into check-ins you confirm.
- **Notifications that coach**: three intensities (Calm / Balanced / Coach), smart nudges for habits without a time, an afternoon walk push when steps are behind, quiet hours, Done / Snooze buttons right in the notification, and alerts when a habit completes itself in the background.
- **Insights**: consistency with a trend line, year heatmap, weekday strengths, mood links and an AI weekly review.
- **Gamification**: XP and levels derived from history, 21 achievements with tiered medals, and brand-dark share cards for milestones.
- **Social**: friends by username, a live feed with kudos, nudges, weekly leaderboards and group challenges.
- **Accounts**: one-tap **Google sign-in** (photo and name come from Google), email/password, a guest mode with sample data, account deletion that erases everything.
- **Adaptive**: phones, tall phones, foldables, tablets and landscape. On desktop web the app runs inside a phone frame next to a short pitch.

## Architecture

```mermaid
flowchart LR
  subgraph Android["Android (Kotlin module: modules/ritual-sensing)"]
    SC[Step counter<br/>WorkManager snapshots] --> Ledger[(Step ledger)]
    AR[Activity Recognition<br/>transition receiver] --> Events[(Activity log)]
    WS[WorkoutService<br/>GPS · barometer · steps] --> Done[(Finished workouts)]
    Boot[Boot / shutdown receiver] --> SC
  end
  subgraph JS["App (TypeScript)"]
    Domain[Pure domain<br/>streaks · XP · activity · notification planner]
    Engine[Auto-tracking engine] --> Domain
    Store[(Zustand + MMKV<br/>local-first)] --> Outbox[[Outbox]]
    BG[Background task<br/>every ~15 min] --> Engine
    Widget[Home-screen widget<br/>headless task]
  end
  Ledger --> Engine
  Events --> Engine
  Done --> Engine
  Engine --> Store
  Widget --> Store
  Outbox -- batched writes --> FS[(Firestore)]
  FS -- realtime, last-write-wins --> Store
  JS -- voice / text → JSON --> AI[Gemini via Firebase AI Logic]
```

**Engineering decisions worth reading**

- **Collect natively, interpret in TypeScript.** The Kotlin module only records raw signals (counter readings, activity transitions, GPS fixes). All interpretation (per-day minutes, distance, deduplicating a detected run against a recorded one, splitting across midnight) lives in `src/domain/activity.ts` as pure, unit-tested functions.
- **The step counter is cumulative since boot**, so nothing is lost while the app sleeps; the worker only has to read it. A lower reading means a reboot, and a shutdown receiver saves the last value.
- **Honest distance.** GPS fixes are filtered for accuracy, jitter and impossible speeds; if GPS never becomes reliable (indoors, treadmill), distance comes from steps × a cadence-based stride, and the UI says so.
- **Local-first sync.** Every change lands in MMKV instantly; an outbox drains to Firestore in batches with back-off, and realtime listeners stream other devices' changes back. Conflicts resolve last-write-wins on a monotonic clock, and deletes are tombstones.
- **Derived gamification.** Streaks, XP, levels and achievements are pure functions of history, so devices can't disagree and back-filled data earns the right XP.
- **Planned notifications.** `planNotifications()` is a pure function from habits, history and settings to the exact schedule for the next week, deduplicated, quiet-hours aware and tested.
- **Secure by default.** Firestore rules validate every collection (owner-only private data, transactional usernames, enforced friendship transitions, own-kudos-only, ±1 challenge counters) and are tested against the emulator. The Gemini key never ships (Firebase AI Logic proxies it).

## Tech stack

| Layer | Tech |
| --- | --- |
| App | Expo SDK 57 · React Native 0.86 (New Architecture) · React 19.2 · TypeScript (strict) |
| Native | Kotlin Expo module: SensorManager, WorkManager, Play Services Activity Recognition & Fused Location, foreground service, Android 16 `ProgressStyle` Live Updates |
| Navigation | expo-router (typed, protected routes) |
| State | Zustand 5 · react-native-mmkv 4 (Nitro) |
| Motion | Reanimated 4 · Gesture Handler (swipe-to-complete) · react-native-svg |
| Backend | Firebase Auth (Google + email) · Cloud Firestore · Firebase Hosting |
| AI | Gemini 3.5 Flash-Lite / Flash via Firebase AI Logic (schema-constrained JSON) · on-device fallback parser · speech recognition |
| Platform | expo-notifications (actions, channels) · expo-background-task · react-native-android-widget · Health Connect |
| Design | Custom "Volt" brand system: Inter Tight + Geist Mono, Phosphor icons, ink / bone / volt palette |
| Quality | Vitest (domain, activity, notification planner, sync) · Firestore rules tests on the emulator · strict `tsc` · Prettier · GitHub Actions |

## Project structure

```
modules/ritual-sensing/   # Kotlin: step ledger, activity recognition, workout service, Live Updates
src/
  app/                    # screens (expo-router)
  domain/                 # pure TS: dates, streaks, XP, achievements, insights, activity, notification planner (+ tests)
  data/                   # store, sync engine, session, auth, identity
  features/
    sensing/              # JS side of phone sensing: tracking status, workout recorder UI, background task
    today/                # day ring, week bars
    ai/                   # Gemini features, voice input
    habits/ integrations/ notifications/ social/ gamification/ auth/
  widget/                 # Android home-screen widget (headless task)
  ui/                     # design system
firestore.rules · tests/rules/ · scripts/
```

## Getting started

**Requirements:** Node 20+, JDK 17+, Android Studio with an emulator or a phone with USB debugging.

```bash
npm install
cp .env.example .env        # Firebase, Google sign-in and Cloudinary values
npm run check               # type-check + unit tests
npx expo run:android        # builds the dev client with the native modules
```

Without any `.env` values the app still runs fully on-device (accounts, social and AI switch off).

### Firebase

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com), **Add app → Web**, and copy the config into `.env`.
2. **Authentication → Sign-in method**: enable **Email/Password** and **Google**.
3. **Firestore → Create database**, then `npm run deploy:rules`.
4. **AI Logic → Get started → Gemini Developer API.**

### Google sign-in on Android

1. In Firebase **Authentication → Sign-in method → Google**, copy the **Web client ID** into `.env` as `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`.
2. **Project settings → Add app → Android**, package `com.genzboy.Ritual`, and add the **SHA-1** of your signing key:
   - debug builds: `keytool -list -v -keystore android/app/debug.keystore -alias androiddebugkey -storepass android -keypass android`
   - EAS builds: `eas credentials` → Android → SHA-1
3. Rebuild the app. (On the web, Google sign-in works with no extra setup.)

### Cloudinary (photos and avatars)

Create an **unsigned** upload preset and set `EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME` / `EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET`.

### Web demo and APK

```bash
npm run deploy:web          # export + Firebase Hosting
npm run build:apk           # EAS preview APK
```

## Testing

| Suite | Covers | Command |
| --- | --- | --- |
| Domain | Dates/DST, streaks, rest days, XP & levels, insights, NL parser | `npm test` |
| Activity | Transition pairing, de-duplicating detected vs recorded workouts, midnight splits, unit mapping, polyline decoding | `npm test` |
| Notification planner | Calm / Balanced / Coach plans, done habits drop out, quiet hours, last calls, walk nudges, no stacking | `npm test` |
| Sync | Outbox, tombstones, last-write-wins, ack versions, guest → account migration | `npm test` |
| Security rules | 20 attack scenarios against the Firestore emulator | `npm run test:rules` |

## Roadmap

- iOS: HealthKit, Core Motion pedometer, Live Activities and widgets
- Push nudges between friends via Cloud Functions + FCM
- Screen-time habits via Android UsageStats
- Wear OS tile

---

Built by **Apurba Das** · MIT License
