# Architecture Reference

> This document is the **primary reference for AI assistants** working on this project.
> Read this first before making any changes. Everything here reflects the actual current state.

---

## Project Overview

**Fantasia** is a single-page application (SPA) for music theory education. It uses vanilla JavaScript (no frameworks), Firebase for auth and data, and Web Audio API for sound.

**Owner is not a programmer.** All code is AI-assisted. Keep code simple, well-commented, and avoid unnecessary abstractions.

---

## File Structure

```
fantasia/
├── index.html                      # Main SPA shell — all page sections live here
├── firestore.rules                 # Firestore security rules (copy to Firebase Console)
├── .env                            # Local dev config (gitignored, no secrets)
├── .gitignore                      # Standard ignores (node_modules, .env, etc.)
├── package.json                    # Dev server dependency
│
├── src/
│   ├── scripts/
│   │   └── app.js                  # Core: AppConfig, DataService, Router, SoundEffects, Settings
│   ├── styles/
│   │   └── app.css                 # Global styles, CSS variables, top bar, buttons, responsive
│   └── auth/
│       ├── firebase-config.js      # Firebase init, exports auth + Firestore functions
│       ├── auth.js                 # Google sign-in/out, auth state listener
│       ├── auth-ui.js              # Auth button UI, triggers cloud sync on login
│       ├── settings-sync.js        # Save/load user settings to Firestore
│       ├── profile.js              # User profile page, emoji avatar picker
│       └── chat.js                 # Global chat room, bad word filter, real-time messages
│
├── pages/
│   ├── css/                        # Page-specific stylesheets
│   │   ├── chordGenerator.css
│   │   ├── chordProgression.css
│   │   ├── musicTheory.css
│   │   ├── progressionInfo.css
│   │   ├── pomodoro.css
│   │   ├── profile.css             # Profile card, emoji picker grid
│   │   └── chat.css                # Chat room, message bubbles, input
│   ├── js/                         # Page-specific JavaScript
│   │   ├── chordGenerator.js       # Chord generator with Web Audio synthesis
│   │   ├── chordProgression.js     # Chord progression browser
│   │   ├── musicTheory.js          # Music theory lessons
│   │   ├── progressInfo.js         # Progression detail view
│   │   └── pomodoro.js             # Pomodoro timer
│   └── json/                       # Content data
│       ├── chordProgression.json   # 400+ progressions grouped by root note
│       ├── musicTheory.json        # Theory lesson content
│       ├── progressionInfo.json    # Progression details keyed by ID
│       └── systemTransfer.json     # Chord intervals, substitutions, default degrees
│
├── assets/
│   ├── audio/bgm/                  # Background music MP3 files
│   └── image/                      # Background image
│
├── server/
│   └── server.js                   # Simple Node.js dev server (port 3000)
│
├── docs/                           # Documentation (you are here)
│
├── compact_json.js                 # Utility: minifies JSON files
├── update_json.js                  # Utility: batch update JSON entries
└── update_json.py                  # Utility: Python version of above
```

---

## Core JavaScript (src/scripts/app.js)

This is the main file (~1130 lines). It contains everything the SPA needs to run.

### AppConfig
Central configuration object. All magic numbers are here:
- Audio defaults (volumes, fade steps, durations)
- Sound effect frequencies and durations
- No database config (IndexedDB was removed — cloud only now)

### DataService
Session-only cache for JSON content. Fetches JSON files once per session and caches in memory.
- `getChordProgressions()` → `chordProgression.json`
- `getMusicTheory()` → `musicTheory.json`
- `getProgressionInfo()` → `progressionInfo.json`
- `getChordGeneratorData()` → `systemTransfer.json`
- `getSystemTransfer()` → `systemTransfer.json`
- No persistence — fresh fetch each session

### Router
Custom hash-based SPA router. Shows/hides `<section>` elements based on URL.

**Registered pages:**
| Route | Section ID | Init Function |
|-------|-----------|---------------|
| `index.html` | `home` | — |
| `chord-progression.html` | `chordProgression` | `initChordProgression()` |
| `progression-info.html` | `progressionInfo` | `initProgressInfo()` |
| `music-theory.html` | `musicTheory` | `initMusicTheory()` |
| `chord-generator.html` | `chordGenerator` | `initChordGenerator()` |
| `pomodoro.html` | `pomodoro` | `initPomodoro()` |
| `profile.html` | `profile` | `window.renderProfilePage()` |
| `chat.html` | `chat` | `window.renderChatPage()` |

**Navigation:** `window.router.navigate('page.html')` or `<a href="#page.html">`

**Cleanup:** Router calls `cleanupChordGenerator()` on exit and `window.cleanupChat()` for chat page.

**Back button:** Shown on all pages except home. Positioned inside the header.

### SoundEffects
Web Audio API sound effects (hover chirps, click sounds). Also manages background music:
- Loads and plays random BGM tracks from `assets/audio/bgm/`
- Volume/mute controls in the settings panel
- `applyCloudSettings(settings)` — applies cloud-synced settings after login

### initSettingsPanel()
Sets up the settings panel (⚙️ button), chat button (💬), and all volume/SFX controls.
- Settings panel toggles with the ⚙️ button
- Chat button navigates to `chat.html`
- Volume sliders save to cloud via `window.cloudSync.saveSettingToCloud()`

### Module Bridge Pattern
Firebase modules (`src/auth/`) use ES6 `import/export`. The main `app.js` is loaded as a regular script. They communicate via `window`:
- `window.cloudSync` — exposed by `settings-sync.js` for saving/loading settings
- `window.renderProfilePage` — exposed by `profile.js`
- `window.renderChatPage` / `window.cleanupChat` — exposed by `chat.js`
- `window.router` — exposed by `app.js` so auth modules can navigate
- `window.loadUserProfile` — exposed by `profile.js` for chat avatar lookup

---

## Firebase Modules (src/auth/)

All Firebase modules use ES6 imports from CDN (`https://www.gstatic.com/firebasejs/10.8.0/`).
They are loaded via a `<script type="module">` block at the bottom of `index.html`.

### firebase-config.js
Initializes Firebase app, exports `auth`, `db` (Firestore), `googleProvider`, and all needed Firestore functions (`doc`, `getDoc`, `setDoc`, `collection`, `addDoc`, `query`, `orderBy`, `limit`, `onSnapshot`, `serverTimestamp`, `Timestamp`, `updateDoc`).

### auth.js
- `signInWithGoogle()` — Google popup sign-in
- `signOutUser()` — Signs out
- `initAuthListener(callback)` — Listens to auth state changes via `onAuthStateChanged`
- `getCurrentUser()` / `isSignedIn()` — Get current auth state
- Internal `currentUser` variable tracked by the listener

### auth-ui.js
- `initAuthUI()` — Called on page load, sets up auth state listener
- On login: triggers `window.cloudSync.onLoginSync()` → applies cloud settings
- When signed in: Shows user's avatar emoji (if set) or Google photo in the top bar auth button. Click navigates to profile page.
- When signed out: Shows 👤 icon. Click opens Google sign-in popup.

### settings-sync.js
Syncs audio settings to Firestore when logged in.
- `saveSettingToCloud(key, value)` — Saves one setting
- `saveAllSettingsToCloud(settings)` — Saves all settings at once
- `loadSettingsFromCloud()` — Loads settings from Firestore
- `onLoginSync()` — Called after login, loads cloud settings
- **Firestore path:** `users/{uid}/settings/audio`
- **Synced keys:** `musicVolume`, `musicEnabled`, `sfxVolume`, `sfxEnabled`
- Exposed via `window.cloudSync` for non-module scripts

### profile.js
User profile page with Firestore persistence.
- `loadUserProfile()` — Loads profile from Firestore, creates default from Google account if none exists
- `saveUserProfile(updates)` — Saves profile changes (name, bio, avatarEmoji)
- `renderProfilePage()` — Renders the full profile page UI
- **Emoji avatar picker:** 30 emoji options in a grid. Click avatar to open picker. Choice saved as `avatarEmoji` field.
- "Use Google Photo" button resets avatar to Google profile picture
- Sign out button on profile page
- **Firestore path:** `users/{uid}/profile/info`
- **Fields:** `displayName`, `bio`, `avatarEmoji`, `photoURL`, `email`, `joinedAt`, `lastSeen`

### chat.js
Real-time global chat room using Firestore.
- `renderChatPage()` — Renders chat UI with message list and input
- `sendMessage()` — Sends a message (filtered through bad word filter first)
- `startMessageListener()` — Starts Firestore `onSnapshot` listener for real-time updates
- `stopMessageListener()` — Cleanup function, called when leaving chat page
- **Bad word filter:** ~40 common profanity words checked via regex. Matched words are censored to first letter + asterisks (e.g. `f***`). Filter runs client-side before saving to Firestore.
- **Avatar emoji in messages:** When sending, loads user's profile to get `avatarEmoji`. Displayed next to message in chat. Falls back to Google photo if no emoji set.
- **Firestore collection:** `chatMessages` (global — all users see same messages)
- **Message fields:** `text`, `uid`, `displayName`, `photoURL`, `avatarEmoji`, `timestamp`
- **Limit:** 50 most recent messages loaded

---

## Firestore Data Structure

```
Firestore
├── users/
│   └── {uid}/
│       ├── settings/
│       │   └── audio          # { musicVolume, musicEnabled, sfxVolume, sfxEnabled }
│       └── profile/
│           └── info           # { displayName, bio, avatarEmoji, photoURL, email, joinedAt, lastSeen }
└── chatMessages/
    └── {messageId}            # { text, uid, displayName, photoURL, avatarEmoji, timestamp }
```

### Security Rules (firestore.rules)
- Users can only read/write their own `users/{uid}/` data
- Chat messages: any authenticated user can read; create requires auth + uid match + text ≤ 300 chars; delete only by author
- **Rules must be copied to Firebase Console → Firestore → Rules** manually

---

## CSS Architecture (src/styles/app.css)

### CSS Variables (defined on `:root`)
| Variable | Default | Purpose |
|----------|---------|---------|
| `--theme` | `crimson` | Primary accent color |
| `--theme-secondary` | `Salmon` | Secondary accent |
| `--bg` | `#121212` | Background |
| `--bg-soft` | `#1a1a1a` | Card backgrounds |
| `--bg-shadow` | `#0e0e0e` | Shadow color |
| `--bg-soft-shadow` | `0 0 5px ...` | Box shadow value |
| `--text` | `#e0e0e0` | Primary text |
| `--text-lebal` | `#a0a0a0` | Label/muted text |
| `--text-glow` | `0 0 3px ...` | Text shadow glow |
| `--transition` | `0.2s ease` | Standard transition |

### Responsive Font Scaling
Root font size scales up via media queries:
- Default: `12px`
- ≥768px: `14px`
- ≥1024px: `16px`
- ≥1440px: `18px`

### Top Bar
Fixed at top, appears on hover. Uses `justify-content: space-between`:
- **Left group** (`.top-bar-left`): 💬 chat button
- **Right group** (`.top-bar-right`): ⚙️ settings button, auth container (login/avatar)

### Button Exclusion Pattern
Global `button` styles apply crimson background to all buttons EXCEPT special icon buttons. This is done with `:not()` chains:
```css
button:not(.back-btn):not(.settings-btn):not(.settings-close-btn):not(.sound-btn):not(.icon-btn):not(.phrase-remove-btn):not(.chord-control-btn):not(.phrase-nav-icon):not(.auth-btn):not(.chat-btn) { ... }
```
**If you add a new icon-style button**, add its class to ALL THREE button selectors (base, primary, hover) to prevent it from getting the red background.

### Navigation Cards
Homepage nav cards are responsive grid items:
- Default: `115px` width
- ≥768px: `160px`
- ≥1024px: `200px`

---

## HTML Structure (index.html)

Single HTML file with all page sections. Only one section visible at a time (controlled by Router).

```html
<div class="container">
    <!-- Top Bar -->
    <div class="top-bar">
        <div class="top-bar-left">💬 chat button</div>
        <div class="top-bar-right">⚙️ settings + auth container</div>
    </div>

    <!-- Floating Title -->
    <div class="floating-title">✧ Fantasia ✧</div>

    <!-- Settings Panel (overlay) -->
    <div id="settingsPanel">...</div>

    <!-- Page Sections (only one visible at a time) -->
    <section id="home">Homepage with nav cards</section>
    <section id="chordProgression" style="display:none">...</section>
    <section id="progressionInfo" style="display:none">...</section>
    <section id="musicTheory" style="display:none">...</section>
    <section id="chordGenerator" style="display:none">...</section>
    <section id="pomodoro" style="display:none">...</section>
    <section id="profile" style="display:none">...</section>
    <section id="chat" style="display:none">...</section>
</div>

<!-- Scripts -->
<script src="app.js"></script>
<script src="page scripts..."></script>
<script type="module">Firebase modules</script>
```

### Script Loading Order
1. `app.js` (regular script) — Core SPA, router, settings
2. Page scripts (`chordGenerator.js`, etc.) — Regular scripts
3. Firebase module block (`<script type="module">`) — Imports and initializes auth-ui, exposes `window.cloudSync`

---

## Data Flow

```
                    ┌─────────────┐
                    │  JSON Files │  (pages/json/)
                    └──────┬──────┘
                           │ fetch (once per session)
                    ┌──────▼──────┐
                    │ DataService │  (in-memory cache)
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │ Page Scripts │  (render UI)
                    └─────────────┘

   ┌──────────────┐          ┌─────────────────┐
   │ Google Login  │ ──────▶ │  Firebase Auth   │
   └──────────────┘          └────────┬─────────┘
                                      │
              ┌───────────────────────▼──────────────────────┐
              │              Firestore                        │
              │  users/{uid}/settings/audio ← Settings Sync   │
              │  users/{uid}/profile/info  ← Profile + Avatar │
              │  chatMessages/             ← Global Chat      │
              └──────────────────────────────────────────────┘
```

---

## Key Patterns & Conventions

### Config Objects
All magic numbers go in config objects at the top of their file:
- `AppConfig` in `app.js`
- `ChordGenConfig` in `chordGenerator.js`

### Cleanup on Navigation
When the router navigates away from a page, it calls cleanup functions:
- `cleanupChordGenerator()` — Stops audio, clears timers, removes listeners
- `window.cleanupChat()` — Unsubscribes from Firestore listener

### Error Handling
- Audio playback wrapped in try-catch (browsers may block autoplay)
- Fetch calls have fallback data on failure
- Firebase operations silently catch errors and log warnings

### Version Cache Busting
CSS and JS files use `?v=X.X` query params in `index.html` to bust browser cache. Bump the version number when you change a file.

Current versions: `app.css?v=3.0`, `app.js?v=2.4`, `profile.css?v=1.1`, `chat.css?v=1.1`
