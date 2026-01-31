# Bar System Guide

Visual guide for chord progression data structure.

## Bar Formats

### Simple Array (Legacy)
```json
["1", "5", "6m", "4"]
```
Renders as 4 bars, 1 chord each:
```
| 1 | 5 | 6m | 4 |
```

### Single Phrase (Standard)
```json
[["6m", "4", "5"], ["1"], ["5/7"], ["1"]]
```
Bar 1 has 3 chords:
```
| 6m 4 5 | 1 | 5/7 | 1 |
```

### Multi-Phrase (Verse/Chorus)
```json
[
  [["6m7"], ["6m7", "b6m7"], ["5m7"], ["1"]],
  [["4M7"], ["4M7"], ["3sus"], ["3"]]
]
```
Two lines:
```
| 6m7 | 6m7 b6m7 | 5m7 | 1 |
| 4M7 | 4M7 | 3sus | 3 |
```

## Progression ID Format

Used as key in progressionInfo.json:
- Bars separated by `-`
- Chords in same bar separated by `,`

Examples:
- `"6m-4-5-1"` → 4 bars, 1 chord each
- `"6m,4,5-1-5/7-1"` → Bar 1 has 3 chords
- `"1-5-6m,4-1"` → Bar 3 has 2 chords

## JSON Examples

### Full Progression Entry
```json
{
  "note": "6",
  "progressions": [
    {
      "chords": [["6m", "4", "5"], ["1"], ["5/7"], ["1"]],
      "theory": ["Theory explanation here"],
      "music": [
        {
          "artist": "Artist Name",
          "title": "Song Title",
          "part": "Chorus",
          "genre": "Jpop"
        }
      ]
    }
  ]
}
```

### Music Object Fields
- **title**: Song name
- **artist**: Artist/band
- **part**: verse, chorus, bridge, intro, outro
- **genre**: rock, pop, jazz, Jpop, Kpop, etc.
- **youtubeId**: Optional YouTube video ID
- **clipStart**: Optional start time in seconds
