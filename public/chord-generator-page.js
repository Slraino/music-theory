// Chord Generator Page Script for SPA
let chordGenerator;
let currentProgression = [];

const PROGRESSIONS = [
    '1-4-5-1',
    '6m-2m-5-1',
    '2m-5-1-1',
    '1-6m-2m-5',
    '1-5-6m-4'
];

const KEYS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

// Fetch music theory data from JSON
async function loadMusicData() {
    const response = await fetch('music-theory-data.json');
    if (!response.ok) {
        throw new Error(`Failed to load music-theory-data.json: ${response.status}`);
    }
    return response.json();
}

// Initialize chord generator
async function initChordGenerator() {
    try {
        const data = await loadMusicData();
        chordGenerator = new ChordGenerator(data);
        renderChordGeneratorPage();
        refreshChords();
    } catch (error) {
        console.error('Failed to initialize chord generator:', error);
        const container = document.querySelector('#chordGeneratorPage .generator-container');
        if (container) {
            container.innerHTML = `<p style="color:#ff6b6b; text-align:center;">Failed to load chord data. ${error.message}</p>`;
        }
    }
}

// Render the chord generator page content
function renderChordGeneratorPage() {
    const container = document.querySelector('#chordGeneratorPage .generator-container');
    if (!container) return;

    container.innerHTML = `
        <style>
            .chord-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-top: 6px; }
            .chord-card { background: rgba(0,0,0,0.45); border: 1px solid #dc143c; border-radius: 14px; padding: 24px 18px; text-align: center; min-height: 140px; display: flex; align-items: center; justify-content: center; }
            .chord-symbol { font-size: 2.6em; font-weight: 700; color: #ffd6d6; letter-spacing: 0.5px; }
            .chord-notes { display: none; }
            .refresh-row { display: flex; justify-content: center; margin-top: 18px; }
            .refresh-btn { padding: 12px 22px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border: none; border-radius: 10px; color: #fff; font-weight: 700; cursor: pointer; box-shadow: 0 5px 12px rgba(102,126,234,0.35); transition: transform 0.2s ease, box-shadow 0.2s ease; }
            .refresh-btn:hover { transform: translateY(-2px); box-shadow: 0 7px 16px rgba(102,126,234,0.45); }
            .mini-label { text-align: center; color: #ffc0cb; margin-top: 6px; font-size: 0.95em; }
        </style>

        <div id="chordGrid" class="chord-grid" style="background: rgba(0,0,0,0.35); padding: 12px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.05);">
            <div class="chord-card"><div class="chord-symbol">--</div><div class="chord-notes">--</div></div>
            <div class="chord-card"><div class="chord-symbol">--</div><div class="chord-notes">--</div></div>
            <div class="chord-card"><div class="chord-symbol">--</div><div class="chord-notes">--</div></div>
            <div class="chord-card"><div class="chord-symbol">--</div><div class="chord-notes">--</div></div>
        </div>
        <div class="refresh-row">
            <button class="refresh-btn" onclick="refreshChords()">🔄 Refresh</button>
        </div>
    `;
}

function refreshChords() {
    if (!chordGenerator) return;

    const key = KEYS[Math.floor(Math.random() * KEYS.length)];
    const progression = PROGRESSIONS[Math.floor(Math.random() * PROGRESSIONS.length)];
    const degrees = progression.split(/\s*-\s*/).map(d => {
        const trimmed = d.trim();
        const match = trimmed.match(/^([b#]?\d+)/);
        return match ? match[1] : trimmed;
    });

    try {
        const chords = chordGenerator.generateProgression(key, progression);
        currentProgression = chords;
        updateChordGrid(chords.slice(0, 4), degrees.slice(0, 4), key, progression);
    } catch (err) {
        console.error('Failed to refresh chords', err);
    }
}

function formatDegreeSymbol(degree, chord) {
    const typeMap = { dim: '°', dim7: '°7', hdim: 'ø', aug: '+' };
    const displayType = typeMap[chord.type] || chord.type || '';
    const ext = chord.extensions && chord.extensions.length ? chord.extensions.join('') : '';
    return `${degree}${displayType}${ext}`;
}

function updateChordGrid(chords, degrees, key, progression) {
    const grid = document.getElementById('chordGrid');
    if (!grid) return;

    const cards = grid.querySelectorAll('.chord-card');
    chords.forEach((ch, idx) => {
        const card = cards[idx];
        if (!card) return;
        const degreeLabel = degrees[idx] || '';
        card.querySelector('.chord-symbol').textContent = formatDegreeSymbol(degreeLabel, ch);
        card.querySelector('.chord-notes').textContent = '';
    });

    for (let i = chords.length; i < cards.length; i++) {
        cards[i].querySelector('.chord-symbol').textContent = '--';
        cards[i].querySelector('.chord-notes').textContent = '';
    }

}
