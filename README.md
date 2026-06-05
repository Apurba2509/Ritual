# 🌙 Ritual

A premium, offline-first, highly-animated habit tracking application built with React Native and Expo. 

Ritual goes beyond basic checklists by combining ultra-fast local storage, production-grade offline sync, beautiful 120fps animations, and a powerful gamification engine to keep you accountable.

## ✨ Features

- ⚡️ **Zero-Latency Offline First Engine**: All reads and writes happen instantly using `react-native-mmkv`. Data syncing happens silently in the background via TanStack Query and Supabase.
- 🎨 **Premium Aesthetics**: A dark-mode first design system featuring glassmorphism, tailored color palettes, and custom typography.
- 📈 **Skia Analytics**: Beautiful, high-performance data visualization including custom heatmaps built entirely in `React Native Skia` and charts via `Victory Native XL`.
- 🪄 **Fluid 120fps Physics**: Satisfying micro-interactions, spring-physics scale animations, and confetti celebrations powered by `React Native Reanimated 3`.
- 🌍 **Social Challenges**: Participate in community challenges (like 75 Hard) with real-time leaderboards and check-in feeds.
- 📸 **Cloud Media**: Direct, secure, unsigned image uploads for habit check-ins via Cloudinary.

## 🛠️ Tech Stack

- **Framework**: [Expo SDK 51](https://expo.dev/) (React Native) + Expo Router v3
- **Language**: TypeScript (Strict Mode)
- **Styling**: NativeWind v4 (Tailwind CSS)
- **Animations**: React Native Reanimated 3 + React Native Gesture Handler
- **Data Visualization**: React Native Skia + Victory Native XL
- **State Management**: Zustand (Client) + TanStack Query v5 (Server State)
- **Local Database**: react-native-mmkv
- **Backend**: Supabase (Auth + PostgreSQL + Realtime)
- **Media**: Cloudinary
- **Lists**: `@shopify/flash-list` for extreme performance

## 🚀 Getting Started

### Prerequisites
- Node.js
- Expo CLI (`npm install -g expo-cli`)
- A physical Android/iOS device or an emulator.

### Installation

1. **Clone the repository** (if applicable) or navigate to the project directory.
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Environment Setup**:
   Create a `.env` file in the root directory and add your credentials:
   ```env
   EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
   EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET=your_unsigned_preset
   ```

4. **Start the app**:
   ```bash
   npx expo start -c
   ```
   Press `a` to open on Android, or `i` to open on iOS.

## 🏗️ Architecture Highlights

### The Sync Engine
Ritual is built on an aggressive offline-first architecture. 
1. User completes a habit.
2. `Zustand` updates the UI instantly and persists to `react-native-mmkv`. 
3. The change is added to an internal Sync Queue.
4. `TanStack Query` acts as the bridge, draining the queue and pushing the payload to `Supabase` when network connectivity is available.

### Gamification & Physics
Every interaction in Ritual is designed to feel satisfying. Tapping a habit card triggers a Reanimated spring physics calculation that scales the card down and back up while interpolating the background color. Milestones trigger a custom Skia canvas overlay rendering confetti particles.

---
*Built with ❤️ and a lot of caffeine.*
