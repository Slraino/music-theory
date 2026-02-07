# Fantasia — Music Theory Web App

## What Is This?

Fantasia is a music theory learning website. It runs in a web browser — no installation needed. Users can explore chord progressions, learn music theory, generate chords with audio playback, and use a pomodoro timer for practice sessions.

The owner is **not a programmer** — this project is built with AI assistance. These docs exist so any AI assistant can understand the full project and continue working on it accurately.

## Features

### 🎵 Core Music Tools
- **Chord Progression Explorer** — Browse 400+ chord progressions grouped by root note, with song examples (artist, title, genre, YouTube links)
- **Chord Generator** — Build and play chords with Web Audio synthesis, voice leading, and chord substitutions
- **Music Theory Lessons** — Educational content about scales, intervals, and harmony
- **Progression Info** — Detailed breakdowns of specific chord progressions
- **Pomodoro Timer** — Practice timer with customizable intervals

### 👤 User Features (Firebase)
- **Google Sign-In** — One-click login via Firebase Authentication
- **Settings Sync** — Sound/music volume preferences saved to the cloud, synced across devices
- **User Profile** — Editable display name, bio, and emoji avatar picker (30 emojis to choose from)
- **Global Chat Room** — Real-time chat with all users using Firestore, with a bad word filter

### 🎨 UI Features
- Dark theme with crimson accent color
- Background music player (shuffle, volume control)
- Hover/click sound effects via Web Audio API
- Responsive design (mobile to desktop)
- Single-page app with smooth navigation

## Tech Stack

| What | How |
|------|-----|
| Frontend | Vanilla HTML, CSS, JavaScript (no frameworks) |
| Audio | Web Audio API for sound effects and chord synthesis |
| Authentication | Firebase Auth (Google Sign-In) |
| Database | Firebase Firestore (real-time cloud database) |
| Hosting | GitHub Pages (static site) |
| Router | Custom SPA router (hash-based) |
| Storage | Cloud-only via Firestore (no localStorage or IndexedDB) |

## How to Run Locally

1. Open a terminal in the project folder
2. Run `node server/server.js`
3. Open `http://localhost:3000` in your browser

Or just open `index.html` with VS Code Live Server.

> **Note:** Firebase features (login, chat, sync) require `http://` — they won't work from `file://`.

## How to Deploy (GitHub Pages)

1. Push code to GitHub
2. Go to repository **Settings → Pages**
3. Set source to **main branch, root folder**
4. Your site will be at `https://yourusername.github.io/repo-name/`
5. **Important:** Add your GitHub Pages domain to Firebase Authorized Domains:
   - Firebase Console → Authentication → Settings → Authorized domains → Add domain

## Quick Links

- [ARCHITECTURE.md](ARCHITECTURE.md) — Full technical reference (for AI assistants)
- [BAR_SYSTEM_GUIDE.md](BAR_SYSTEM_GUIDE.md) — Chord progression JSON format explained visually
- [DEVELOPMENT_NOTES.md](DEVELOPMENT_NOTES.md) — How to add pages, patterns, and conventions
- [Owner Note.md](Owner%20Note.md) — Personal ideas and TODO list

## Firebase Project

- **Project:** Fantasia
- **Project ID:** `fantasia-3c631`
- **Console:** https://console.firebase.google.com/project/fantasia-3c631
- **Auth:** Google Sign-In enabled
- **Database:** Firestore (security rules in `firestore.rules`)
- **API key is public by design** — Firebase security is enforced through Firestore Security Rules and Authorized Domains, not by hiding the key
