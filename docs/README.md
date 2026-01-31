# Music Website Documentation

## Quick Links

- [ARCHITECTURE.md](ARCHITECTURE.md) - System design, data flow, components
- [BAR_SYSTEM_GUIDE.md](BAR_SYSTEM_GUIDE.md) - Chord progression JSON format
- [DEVELOPMENT_NOTES.md](DEVELOPMENT_NOTES.md) - Adding pages, patterns, utilities

## Project Summary

Single-page application for music theory education with:
- Chord progression explorer (400+ progressions)
- Chord generator with audio playback
- Music theory lessons
- Voice leading and substitution support

## Tech Stack

- Vanilla JavaScript (no frameworks)
- Web Audio API for synthesis
- IndexedDB for user preferences
- Custom SPA router

## Key Files

```
src/scripts/app.js      → Core: Router, DataService, DB, Settings
pages/js/chordGenerator.js → Chord generator with audio
pages/json/*.json       → All content data
```
