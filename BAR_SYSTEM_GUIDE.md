# Bar-Based Chord Progression System

## Visual Examples

### Example 1: Default - 1 chord per bar
```
Visual: [ 6m ] | [ 4 ] | [ 5 ] | [ 1 ]

JSON:
{
  "chords": [
    ["6m"],
    ["4"],
    ["5"],
    ["1"]
  ]
}

Progression ID: "6m-4-5-1"
```

### Example 2: 3 chords in first bar
```
Visual: [ 6m 4 5 ] | [ 1 ] | [ 5/7 ] | [ 1 ]

JSON:
{
  "chords": [
    ["6m", "4", "5"],
    ["1"],
    ["5/7"],
    ["1"]
  ]
}

Progression ID: "6m,4,5-1-5/7-1"
```

### Example 3: Mixed - variable chords per bar
```
Visual: [ 6m 3m ] | [ 4 ] | [ 1 ] | [ 5 ]

JSON:
{
  "chords": [
    ["6m", "3m"],
    ["4"],
    ["1"],
    ["5"]
  ]
}

Progression ID: "6m,3m-4-1-5"
```

### Example 4: Complex - different groupings
```
Visual: [ 1 ] | [ 5m 17 ] | [ 4 ] | [ 6m 4 ]

JSON:
{
  "chords": [
    ["1"],
    ["5m", "17"],
    ["4"],
    ["6m", "4"]
  ]
}

Progression ID: "1-5m,17-4-6m,4"
```

## CSS Rendering

The system automatically:
- Renders each bar as a `.progression-bar` div
- Adds `.multi-chord` class when bar has 2+ chords
- Adjusts font size for multi-chord bars
- Shows visual bar separators ( | )

## Backward Compatibility

Simple arrays still work:
```json
{
  "chords": ["6m", "4", "5", "1"]
}
```
Treated as: `[["6m"], ["4"], ["5"], ["1"]]`

## How to Add New Progressions

1. **Add to chordProgression.json:**
```json
{
  "note": "6",
  "progressions": [
    {
      "chords": [
        ["6m", "4", "5"],
        ["1"],
        ["5/7"],
        ["1"]
      ]
    }
  ]
}
```

2. **Add details to progressionInfo.json** (optional):
```json
{
  "6m,4,5-1-5/7-1": {
    "theory": "This progression has 3 chords in the first bar...",
    "music": [
      {
        "title": "Song Name",
        "artist": "Artist Name",
        "part": "verse",
        "genre": "rock"
      }
    ]
  }
}
```

The progression ID is auto-generated from the chord structure!
