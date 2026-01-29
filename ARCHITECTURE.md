# Music Website Architecture

## Data Management Strategy

### Hybrid Approach (Option 2: Separate JSON Files)
- **Content Data (JSON)**: Always fetched from JSON files - all users see the same content
  - `pages/json/chordProgression.json` - Chord patterns organized by root note
  - `pages/json/progressionInfo.json` - Theory explanations and music examples indexed by progression ID
  - `pages/json/musicTheory.json` - Music theory educational content
- **User Preferences**: Stored persistently in IndexedDB/localStorage
  - Volume settings
  - Theme preferences
  - Any user-specific settings

### Data Service (Session Cache)
- JSON content is cached in memory only during the session
- Cache is cleared on page refresh/reload
- Ensures all users see identical, up-to-date content from the source files
- Methods:
  - `DataService.getChordProgressions()` - Returns chord progressions
  - `DataService.getProgressionInfo()` - Returns progression details (theory + music examples)
  - `DataService.getMusicTheory()` - Returns music theory content

### Storage Layers
1. **IndexedDB v2** (Primary for preferences)
   - Database: "MusicTheoryDB"
   - Store: "settings" (user preferences only)
   
2. **localStorage** (Fallback for preferences)
   - Used when IndexedDB is unavailable
   - Stores same preference data as IndexedDB

3. **Memory Cache** (DataService)
   - Session-only cache for JSON content
   - Reduces redundant fetch requests within a session

## JSON File Structure

### chordProgression.json
Contains chord patterns organized by root note with **bar-based structure**:

```json
[
  {
    "note": "6",
    "progressions": [
      {
        "chords": [
          ["6m"],           // Bar 1: 1 chord
          ["4"],            // Bar 2: 1 chord
          ["5"],            // Bar 3: 1 chord
          ["1"]             // Bar 4: 1 chord
        ]
      },
      {
        "chords": [
          ["6m", "4", "5"], // Bar 1: 3 chords
          ["1"],            // Bar 2: 1 chord
          ["5/7"],          // Bar 3: 1 chord
          ["1"]             // Bar 4: 1 chord
        ]
      }
    ]
  }
]
```

**Format Rules:**
- `chords` is an **array of bars**
- Each bar is an **array of chords**
- Default: 1 chord per bar `[["1"], ["5"], ["6m"], ["4"]]`
- Variable: Multiple chords in a bar `[["1", "5m", "17"], ["4"], ["5"], ["6m"]]`
- Backward compatible: Simple arrays like `["1", "5", "6m", "4"]` also work (treated as 1 chord per bar)

### progressionInfo.json
Contains theory and music examples indexed by progression ID:

```json
{
  "6m-4-5-1": {
    "theory": "This is the famous vi-IV-I-V progression...",
    "music": [
      {
        "title": "Let It Be",
        "artist": "The Beatles",
        "part": "verse",
        "genre": "rock"
      }
    ]
  },
  "6m,4,5-1-5/7-1": {
    "theory": "Example with 3 chords in first bar",
    "music": []
  }
}
```

**Progression ID format**: 
- Bars separated by hyphens `-`
- Multiple chords in same bar separated by commas `,`
- Examples:
  - `"6m-4-5-1"` = 4 bars, 1 chord each
  - `"6m,4,5-1-5/7-1"` = Bar 1 has 3 chords, bars 2-4 have 1 chord each
  - `"1-5-6m,4-1"` = Bars 1-2 have 1 chord, bar 3 has 2 chords, bar 4 has 1 chord

### Music Object Fields

- **title** (string): The song name
- **artist** (string): The artist or band name
- **part** (string): Which part of the song uses this progression
  - Examples: "verse", "chorus", "bridge", "intro", "outro", "full song"
- **genre** (string): Music genre for filtering and categorization
  - Examples: "rock", "pop", "jazz", "blues", "classical", "country", "r&b", "soul"

### Usage Notes

- Some chord progressions may have no theory/music examples (empty object in progressionInfo.json)
- Some may have theory only or music examples only
- Some may have multiple examples (`music: [...]` with many items)
- The genre field can be used for filtering/searching in the future
- The part field helps users understand which section of the song to reference

## Page Usage

### Chord Progression Page
- Displays list of all chord progressions from `chordProgression.json`
- Shows chord patterns grouped by root note
- Clicking a progression navigates to Progression Info page

### Progression Info Page
- Shows detailed information for a selected progression
- Loads data from `progressionInfo.json` based on progression ID
- Displays:
  - **Theory section**: Educational explanation of the progression
  - **Music Examples section**: Real songs that use this progression (title, artist, part, genre)

## SPA Architecture

This is a true Single Page Application (SPA):
- **Single HTML file**: `index.html` contains all page sections
- **Router**: Custom Router class shows/hides sections based on URL hash
- **No page reloads**: Navigation is handled client-side
- **Legacy files**: Old HTML files in `pages/html/` have been deleted (not needed)

### Page Structure

```
index.html (contains all sections)
├── #home (default)
├── #chord-generator
├── #chord-progression
├── #music-theory
└── #progression-info
```

Each section is a `<div>` that is shown/hidden by the router.
