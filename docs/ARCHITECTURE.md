# Fantasia — Project Reference

> Read this before making changes. Owner is not a programmer — keep code simple.

## What It Is
Music theory SPA. Vanilla JS, Firebase auth/data, Web Audio API. Also available as Electron desktop app.

## File Map
```
index.html              ← All page sections live here (SPA shell)
src/scripts/app.js      ← Core: Router, DataService, SoundEffects, Settings (~1130 lines)
src/styles/app.css      ← Global styles, CSS variables, responsive
src/auth/               ← Firebase modules (ES6 imports, communicate via window.*)
  firebase-config.js    ← Firebase init, exports auth + db + Firestore functions
  auth.js               ← Google sign-in/out, getCurrentUser(), isSignedIn()
  auth-ui.js            ← Auth button UI, triggers cloud sync on login
  settings-sync.js      ← Sync audio settings to Firestore (window.cloudSync)
  profile.js            ← User profile + emoji avatar (window.renderProfilePage)
  chat.js               ← Real-time chat via Firestore (window.renderChatPage)
pages/js/               ← Page scripts (chordGenerator, chordProgression, musicTheory, progressInfo, pomodoro)
pages/css/              ← Page styles
pages/json/             ← Data files (chordProgression, musicTheory, progressionInfo, systemTransfer)
assets/audio/bgm/       ← Background music MP3s
server/server.js        ← Express dev server (port 3000)
electron/main.js        ← Electron desktop wrapper
electron/preload.js     ← Electron preload script
```

## Router
Hash-based SPA. Navigate: `window.router.navigate('page.html')` or `<a href="#page.html">`

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

## Window Bridge (ES6 modules ↔ regular scripts)
- `window.cloudSync` — settings-sync.js
- `window.renderProfilePage` / `window.loadUserProfile` — profile.js
- `window.renderChatPage` / `window.cleanupChat` — chat.js
- `window.router` — app.js

## Firestore Structure
```
users/{uid}/settings/audio    → { musicVolume, musicEnabled, sfxVolume, sfxEnabled }
users/{uid}/profile/info      → { displayName, bio, avatarEmoji, photoURL, email, joinedAt, lastSeen }
chatMessages/{id}             → { text, uid, displayName, photoURL, avatarEmoji, timestamp }
```

## CSS
Theme vars on `:root`: `--theme` (crimson), `--theme-secondary` (Salmon), `--bg`, `--bg-soft`, `--text`, `--text-lebal`, `--transition`

**Button exclusion pattern:** Global button styles use `:not()` chains. New icon buttons need their class added to all 3 button selectors in app.css (search `button:not(.back-btn)`).

Font scaling: 12px default → 14px@768 → 16px@1024 → 18px@1440

## Chord Progression JSON
```json
// Base format — flat array of degrees
"progression": ["6m", "4", "5", "1"]

// Multi-chord bar — nested array
"progression": ["1", ["2", "3"], "4", "5"]

// Song-specific override (in music object)
"progressionVariation": [
  ["6m7", ["6m7", "b6m7"], "5m7", "1"],
  ["4M7", "4M7", "3sus", "3"]
]
```
Code auto-splits 8+ bars into phrases of 4. Progression IDs: bars joined by `-`, multi-chord bars by `,` (e.g. `6m,4,5-1-5/7-1`).

## Adding a New Page
1. Add `<section id="myPage" style="display:none">` to index.html
2. Add route to `this.pages` in Router (app.js)
3. Add init call in `Router.initPage()`
4. Add cleanup in `Router.cleanupPage()` if needed
5. Create pages/js/ and pages/css/ files, link in index.html
6. Add nav card on home page

## How to Run
```bash
npm install
npm run dev              # Web: http://localhost:3000
npm run electron-dev     # Desktop app
npm run electron-build   # Build .exe installer → dist/
```

## Deploy
- **Web:** Push to GitHub → GitHub Pages auto-deploys
- **Desktop:** `npm run electron-build` → upload .exe to GitHub Releases
- Firebase features need `http://` (won't work from `file://`)
- Add GitHub Pages domain to Firebase Console → Auth → Authorized Domains
