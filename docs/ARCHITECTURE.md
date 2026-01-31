# Music Website Architecture

## Overview

A single-page application (SPA) for exploring music theory, chord progressions, and chord generation with audio playback.

## Core Components

### app.js - Core Application

**AppConfig** - Central configuration object:
```javascript
AppConfig = {
    // Audio: DEFAULT_MUSIC_VOLUME, SFX frequencies, durations
    // Database: DB_NAME, DB_VERSION
}
```

**DataService** - Session-only cache for JSON content:
- Fetches and caches JSON files in memory
- Methods: `getChordProgressions()`, `getMusicTheory()`, `getProgressionInfo()`, `getChordGeneratorData()`, `getSystemTransfer()`
- No persistence - fresh fetch each session

**MusicTheoryDB** - IndexedDB wrapper for user preferences:
- Stores: volume, SFX settings, last visited page
- Auto-recovers from version errors with `_handleVersionError()`
- Methods: `getSetting()`, `saveSetting()`, `loadSettings()`

**SoundEffects** - Audio feedback system:
- Uses Web Audio API for hover/click sounds
- Loads settings from IndexedDB on init
- Configurable frequencies and volumes via AppConfig

**Router** - Hash-based SPA navigation:
- Shows/hides page sections based on URL hash
- Calls page init functions on navigation
- Calls `cleanupChordGenerator()` on page exit
- Manages back button visibility

### chordGenerator.js - Chord Generator Page

**ChordGenConfig** - Page-specific configuration:
```javascript
ChordGenConfig = {
    // Audio: BASS_VOLUME, CHORD_VOLUME, SYNTH_VOLUME
    // Voice leading: MIN_OCTAVE, MAX_OCTAVE, BASS_OCTAVE
    // UI: INDICATOR_THROTTLE (~60fps)
    // Defaults: DEFAULT_KEY, DEFAULT_BPM
}
```

**ChordGenState** - Centralized state object:
- Stores all page state variables
- Includes UI state (indicators, tooltips, selector state)

**Key Features**:
- Voice leading algorithm for smooth chord transitions
- Web Audio synthesis with harmonics
- Floating +/− indicator for chord manipulation
- Chord selector popup for substitutions
- BPM control and playback

**Cleanup**: `cleanupChordGenerator()` - Resets state, removes event listeners, stops audio

## Data Flow

```
JSON Files (pages/json/)
    ↓ fetch
DataService (session cache)
    ↓ return cached
Page Components
    ↓ render
UI

User Preferences
    ↓ save/load
MusicTheoryDB (IndexedDB)
```

## JSON Data Files

### chordProgression.json
400+ chord progressions grouped by root note:
```json
[
  {
    "note": "6",
    "progressions": [
      {
        "chords": [["6m", "4", "5"], ["1"], ["5/7"], ["1"]],
        "theory": ["Optional notes"],
        "music": [{ "artist": "", "title": "", "part": "", "genre": "" }]
      }
    ]
  }
]
```

**Bar Format**:
- Simple: `["1", "5", "6m", "4"]` - 1 chord per bar
- Single phrase: `[["6m", "4"], ["5"], ["1"]]` - Multiple chords in bar 1
- Multi-phrase: `[[["6m"], ["4"]], [["5"], ["1"]]]` - Multiple phrases

### systemTransfer.json
Music theory rules used by chord generator:
- `chordIntervals`: Interval patterns for each chord type
- `chordSubstitutions`: Substitution mappings per degree
- `defaultDegrees`: Default chord qualities for scale degrees

### Other JSON Files
- **chordGenerator.json**: Chord formulas, note names
- **musicTheory.json**: Educational content array
- **progressionInfo.json**: Additional progression details by ID

## Storage

**Session Only (DataService)**:
- JSON file content
- Cleared on page refresh

**Persistent (IndexedDB)**:
- Music volume
- SFX enabled/muted
- Last visited page

## Page Structure

```
index.html
├── #home              → Landing page
├── #chord-generator   → initChordGenerator()
├── #chord-progression → initChordProgression()
├── #music-theory      → initMusicTheory()
└── #progression-info  → initProgressInfo()
```

## File Structure

```
├── index.html                 # SPA container
├── src/
│   ├── scripts/app.js         # Core: DataService, Router, DB, Settings
│   └── styles/app.css         # Global styles
├── pages/
│   ├── css/                   # Page-specific styles
│   ├── js/                    # Page-specific logic
│   └── json/                  # Content data
├── assets/
│   ├── audio/bgm/             # Background music
│   └── audio/piano/           # Piano samples
└── server/server.js           # Dev server
```

## Key Patterns

### Config Objects
All magic numbers extracted to config objects at file top:
- `AppConfig` in app.js
- `ChordGenConfig` in chordGenerator.js

### Error Handling
- Audio playback wrapped in try-catch
- IndexedDB has version error recovery
- Fallback data when JSON fetch fails

### Cleanup
- `cleanupChordGenerator()` called on page exit
- Stops audio, removes listeners, resets state
- Prevents memory leaks on SPA navigation

### Performance
- DOM query caching in mousemove handlers
- RAF throttling for UI updates (~60fps)
- Session-only cache avoids redundant fetches
