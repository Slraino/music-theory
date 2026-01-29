const fs = require('fs');
const path = require('path');

try {
    const filePath = path.join(__dirname, 'pages/json/chordProgression.json');
    const jsonStr = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(jsonStr);

    // Add youtubeId and clipStart to all music entries
    function processData(obj) {
        if (Array.isArray(obj)) {
            obj.forEach(item => processData(item));
        } else if (obj && typeof obj === 'object') {
            // Check if this is a music entry
            if (obj.genre && obj.artist && obj.title) {
                if (!obj.youtubeId) obj.youtubeId = '';
                if (!obj.clipStart) obj.clipStart = 0;
            }
            // Recursively process nested objects
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    processData(obj[key]);
                }
            }
        }
    }

    processData(data);
    
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
    console.log('Successfully added youtubeId and clipStart fields to all music entries');
} catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
}
