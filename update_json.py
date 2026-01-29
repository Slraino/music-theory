#!/usr/bin/env python3
import json

with open('pages/json/chordProgression.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Process all progressions and their music entries
def add_youtube_fields(obj):
    if isinstance(obj, dict):
        # If this is a music entry with genre field, add youtubeId and clipStart
        if 'genre' in obj and 'artist' in obj and 'title' in obj:
            if 'youtubeId' not in obj:
                obj['youtubeId'] = ''
            if 'clipStart' not in obj:
                obj['clipStart'] = 0
        # Recursively process all values
        for value in obj.values():
            add_youtube_fields(value)
    elif isinstance(obj, list):
        for item in obj:
            add_youtube_fields(item)

add_youtube_fields(data)

with open('pages/json/chordProgression.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
    f.write('\n')

print('Successfully updated JSON with youtubeId and clipStart fields')
