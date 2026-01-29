const fs = require('fs');
const path = require('path');

try {
    const filePath = path.join(__dirname, 'pages/json/chordProgression.json');
    const jsonStr = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(jsonStr);

    // Custom JSON stringification for compact format
    function stringifyCompact(obj, indent = 0, isInChords = false) {
        const spaces = ' '.repeat(indent);
        const nextSpaces = ' '.repeat(indent + 2);
        
        if (Array.isArray(obj)) {
            if (obj.length === 0) return '[]';
            
            // Check if all items are strings (simple chord array)
            if (obj.every(item => typeof item === 'string')) {
                return '[' + obj.map(item => JSON.stringify(item)).join(', ') + ']';
            }
            
            // Check if all items are arrays (nested chord array - keep inline)
            if (obj.every(item => Array.isArray(item))) {
                // Nested arrays should be inline - format like [["6m7"], ["6m7", "b6m7"], ["5m7"], ["1"]]
                return '[' + obj.map(item => stringifyCompact(item, 0, true)).join(', ') + ']';
            }
            
            // Music array - keep each entry on its own line
            if (obj.every(item => typeof item === 'object' && item !== null && 'artist' in item)) {
                return '[\n' + obj.map(item => nextSpaces + stringifyCompact(item, indent + 2)).join(',\n') + '\n' + spaces + ']';
            }
            
            // Regular array - normal formatting
            return '[\n' + obj.map(item => nextSpaces + stringifyCompact(item, indent + 2)).join(',\n') + '\n' + spaces + ']';
        } else if (obj !== null && typeof obj === 'object') {
            const keys = Object.keys(obj);
            if (keys.length === 0) return '{}';
            
            // Check if this is a music entry
            if ('artist' in obj && 'title' in obj) {
                // Keep music entry on one line
                return '{' + keys.map(k => ` "${k}": ${JSON.stringify(obj[k])}`).join(', ') + ' }';
            }
            
            // Regular object
            return '{' + keys.map(k => {
                const val = stringifyCompact(obj[k], indent + 2, k === 'chords');
                return `\n${nextSpaces}"${k}": ${val}`;
            }).join(',') + '\n' + spaces + '}';
        } else {
            return JSON.stringify(obj);
        }
    }

    const compactJson = stringifyCompact(data, 0) + '\n';
    fs.writeFileSync(filePath, compactJson, 'utf8');
    console.log('Successfully reformatted JSON to compact structure');
} catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
}
