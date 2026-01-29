// Chord Generator Page Script - Self-contained version
let chordGenerator;
let allProgressions = []; // Will be loaded from chordProgressions.json
let selectedKey = 'C'; // Default key
let showDegrees = true; // Toggle between degrees (1-7) and notes (C, D, E)
let substitutionData = null; // Chord substitution data
let currentBars = []; // Store current progression bars
let currentParents = []; // Store original parent chords for substitution reference
let lastProgressionIndex = -1; // Track last selected progression to avoid repeats
let isSubstituted = []; // Track which chords are substituted (true) or parent (false)
let bpm = 200; // Beats per minute (tempo control)

const KEYS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

// Inline ChordGenerator class with built-in data
class ChordGenerator {
    constructor() {
        this.noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        this.keySignatures = { 'C': 0, 'Db': 1, 'D': 2, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'Ab': 8, 'A': 9, 'Bb': 10, 'B': 11 };
        this.scaleFormula = [0, 2, 4, 5, 7, 9, 11]; // Major scale intervals
    }

    // Convert degree notation (e.g., "1", "4m", "5/7") to actual note
    degreeToNote(key, degreeNotation) {
        const rootIndex = this.keySignatures[key];
        if (rootIndex === undefined) return degreeNotation;

        // Parse degree notation (e.g., "5/7", "6m", "b7", "67")
        // Degrees are 1-7; everything after is treated as suffix/quality
        const match = degreeNotation.match(/^([b#]?)([1-7])(.*)$/);
        if (!match) return degreeNotation;

        const accidental = match[1]; // b or #
        const degree = parseInt(match[2]) - 1; // Convert to 0-based index
        const suffix = match[3]; // m, /7, etc.

        if (degree < 0 || degree >= this.scaleFormula.length) return degreeNotation;

        // Get the scale degree interval
        let interval = this.scaleFormula[degree];
        
        // Apply accidentals
        if (accidental === 'b') interval -= 1;
        if (accidental === '#') interval += 1;

        // Calculate final note
        const noteIndex = (rootIndex + interval) % 12;
        return this.noteNames[noteIndex] + suffix;
    }
}

// Normalize degree display for UI (e.g., 3dim -> 3o, 7hdim -> 7⌀, 1aug -> 1+)
function formatDegreeForDisplay(degree) {
    if (typeof degree !== 'string') return degree;
    return degree.replace('hdim', '⌀').replace('dim', 'o').replace('aug', '+');
}

// Helper function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize chord generator
async function initChordGenerator() {
    try {
        chordGenerator = new ChordGenerator();
        
        // Load progressions from chordProgressions.json
        const progressionData = await DataService.getChordProgressions();
        
        // Load substitution data from chordGenerator.json
        const chordGenData = await DataService.getChordGeneratorData();
        if (chordGenData && chordGenData.substitutions) {
            substitutionData = chordGenData;
        }
        
        // Extract all progressions from all groups
        allProgressions = [];
        progressionData.forEach(group => {
            if (group.progressions && Array.isArray(group.progressions)) {
                group.progressions.forEach(prog => {
                    if (prog.chords && Array.isArray(prog.chords)) {
                        // Check if this is a phrase structure (array of arrays of arrays)
                        const isPhrasedProgression = prog.chords.length > 0 && 
                            Array.isArray(prog.chords[0]) && 
                            prog.chords[0].length > 0 && 
                            Array.isArray(prog.chords[0][0]);
                        
                        if (isPhrasedProgression) {
                            // Multi-phrase format: [[["1"], ["4"]], [[["5"], ["6m"]]]]
                            // Already in phrase format
                            allProgressions.push({ phrases: prog.chords, music: prog.music || [] });
                        } else {
                            // Single phrase format
                            // Could be: ["1", "4", "5"] or [["1", "5m"], ["4"], ["5"]]
                            const bars = prog.chords.map(bar => Array.isArray(bar) ? bar : [bar]);
                            allProgressions.push({ phrases: [bars], music: prog.music || [] });
                        }
                    }
                });
            }
        });
        
        // Fallback if no progressions found
        if (allProgressions.length === 0) {
            allProgressions = [
                { phrases: [[['1'], ['4'], ['5'], ['1']]] },
                { phrases: [[['6m'], ['2m'], ['5'], ['1']]] }
            ];
        }
        
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
        <div class="key-selector">
            <div class="left-spacer"></div>
            <button class="refresh-btn refresh-btn" onclick="refreshChords()">🔄 Refresh</button>
            <div class="controls-right">
                <button class="toggle-btn" onclick="playProgression()" style="background: linear-gradient(135deg, #4CAF50 0%, #66BB6A 100%);">
                    ▶️ Play
                </button>
                <div>
                    <label>BPM:</label>
                    <input type="range" id="bpmSlider" min="60" max="200" value="200" 
                           oninput="updateBPM(this.value)" 
                           style="width: 80px; vertical-align: middle;">
                    <span id="bpmDisplay" style="font-size: 0.85em; color: #888;">200</span>
                </div>
                <div>
                    <label>Key:</label>
                    <select id="keySelect" onchange="changeKey(this.value)">
                        ${KEYS.map(key => `<option value="${key}" ${key === selectedKey ? 'selected' : ''}>${key}</option>`).join('')}
                    </select>
                </div>
                <button class="toggle-btn" onclick="toggleDisplay()">
                    ${showDegrees ? 'Show Notes' : 'Show Degrees'}
                </button>
            </div>
        </div>
        <div id="progressionDisplay" class="progression-grid"></div>
        <div id="generatorMusic" class="generator-music"></div>
    `;
}

// Change key handler
function changeKey(key) {
    selectedKey = key;
    refreshChords(); // Re-render current progression with new key
}

// Update BPM control
window.updateBPM = function(value) {
    bpm = parseInt(value);
    const display = document.getElementById('bpmDisplay');
    if (display) {
        display.textContent = value;
    }
}

// Toggle between degrees and notes
function toggleDisplay() {
    showDegrees = !showDegrees;
    renderChordGeneratorPage(); // Re-render to update button text
    refreshChords(); // Re-render current progression
}

function refreshChords() {
    if (allProgressions.length === 0) return;

    let randomIndex;
    
    // If there's only one progression, use it
    if (allProgressions.length === 1) {
        randomIndex = 0;
    } else {
        // Pick a random progression that's different from the last one
        do {
            randomIndex = Math.floor(Math.random() * allProgressions.length);
        } while (randomIndex === lastProgressionIndex);
    }
    
    lastProgressionIndex = randomIndex;
    const randomProgression = allProgressions[randomIndex];
    
    // Flatten phrases into bars and keep track of phrase structure
    currentBars = [];
    currentParents = [];
    isSubstituted = [];
    
    randomProgression.phrases.forEach(phrase => {
        phrase.forEach(bar => {
            currentBars.push(bar);
            const parents = bar.map(chord => getDiatonicParent(chord));
            currentParents.push(parents);
            // Mark as substituted if chord is different from its diatonic parent
            isSubstituted.push(bar.map((chord, idx) => chord !== parents[idx]));
        });
    });
    
    updateChordGrid(randomProgression.phrases);
    renderGeneratorMusic(randomProgression.music || []);
}

function renderGeneratorMusic(musicList) {
    const container = document.getElementById('generatorMusic');
    if (!container) return;

    if (!Array.isArray(musicList) || musicList.length === 0) {
        container.innerHTML = '<p class="detail-line" style="color: #888;">No music examples yet.</p>';
        return;
    }

    const artistMap = new Map();
    musicList.forEach(song => {
        if (!song) return;
        let artistDisplay = '';
        if (Array.isArray(song.artist)) {
            artistDisplay = song.artist.join(', ');
        } else if (song.artist) {
            artistDisplay = song.artist.trim();
        }
        const title = song.title ? song.title.trim() : '';
        const part = song.part ? song.part.trim() : '';
        if (!artistDisplay && !title) return;
        const key = artistDisplay || 'Unknown Artist';
        if (!artistMap.has(key)) artistMap.set(key, []);
        if (title) {
            const titleWithPart = part ? `${title} (${part})` : title;
            artistMap.get(key).push(titleWithPart);
        }
    });

    if (artistMap.size === 0) {
        container.innerHTML = '<p class="detail-line" style="color: #888;">No music examples yet.</p>';
        return;
    }

    let html = '';
    artistMap.forEach((titles, artist) => {
        const uniqueTitles = Array.from(new Set(titles));
        const line = uniqueTitles.length > 0
            ? `${escapeHtml(artist)} - ${escapeHtml(uniqueTitles.join(', '))}`
            : escapeHtml(artist);
        html += `<p class="detail-line music-example">${line}</p>`;
    });

    container.innerHTML = html;
}

// Get diatonic parent chord (handles slash chords and chromatic alterations)
function getDiatonicParent(chord) {
    // Handle slash chords - take only the part before the slash
    const baseChord = chord.split('/')[0];
    
    // Diatonic parent mapping for chromatic chords
    const diatonicParent = {
        'b2': '2m', 'b2m': '2m', 'b2o': '2m',
        'b3': '3m', 'b3m': '3m', 'b3o': '3m',
        '#4': '4', '#4o': '4',
        'b5': '5', 'b5m': '5', 'b5o': '5',
        'b6': '6m', 'b6m': '6m', 'b6o': '6m',
        'b7': '7o', 'b7m': '7o', 'b7o': '7o',
        // Diatonic chords map to themselves
        '1': '1', '1m': '1', '1o': '1',
        '2': '2m', '2m': '2m', '2o': '2m',
        '3': '3m', '3m': '3m', '3o': '3m',
        '4': '4', '4m': '4', '4o': '4',
        '5': '5', '5m': '5', '5o': '5',
        '6': '6m', '6m': '6m', '6o': '6m',
        '7': '7o', '7m': '7o', '7o': '7o'
    };
    
    return diatonicParent[baseChord] || baseChord;
}

function updateChordGrid(phrases) {
    const display = document.getElementById('progressionDisplay');
    if (!display) return;

    display.innerHTML = '';
    let barGlobalIndex = 0;

    phrases.forEach(phrase => {
        const phraseContainer = document.createElement('div');
        phraseContainer.className = 'phrase-container';

        // Collect refresh buttons for this phrase
        const refreshRow = document.createElement('div');
        refreshRow.className = 'refresh-row';
        refreshRow.style.gridTemplateColumns = `repeat(${phrase.length}, 1fr)`;

        phrase.forEach(bar => {
            const barIndex = barGlobalIndex++;
            const barDiv = document.createElement('div');
            barDiv.className = 'progression-bar';
            if (bar.length > 1) barDiv.classList.add('multi-chord');

            // One refresh cell per bar (can contain multiple buttons)
            const refreshCell = document.createElement('div');
            refreshCell.className = 'refresh-cell';

            bar.forEach((degree, chordIndex) => {
                const chordWrapper = document.createElement('div');
                chordWrapper.className = 'chord-wrapper';

                const chordDiv = document.createElement('div');
                chordDiv.className = 'chord-item';
                if (isSubstituted[barIndex][chordIndex]) chordDiv.classList.add('substituted');
                const displayText = showDegrees ? formatDegreeForDisplay(degree) : chordGenerator.degreeToNote(selectedKey, degree);
                chordDiv.textContent = displayText;
                chordDiv.title = 'Click to select a new chord';
                chordDiv.onclick = (e) => {
                    e.stopPropagation();
                    showChordSelector(chordWrapper, barIndex, chordIndex, degree);
                };

                chordWrapper.appendChild(chordDiv);
                barDiv.appendChild(chordWrapper);

                // Add refresh button for each chord to the refresh row
                const refreshIcon = document.createElement('button');
                refreshIcon.className = 'chord-refresh';
                refreshIcon.innerHTML = '🔄';
                refreshIcon.title = 'Substitute chord (same function)';
                refreshIcon.onclick = (e) => {
                    e.stopPropagation();
                    replaceWithSubstitute(barIndex, chordIndex, degree);
                };
                refreshCell.appendChild(refreshIcon);
            });

            phraseContainer.appendChild(barDiv);
            refreshRow.appendChild(refreshCell);
        });

        display.appendChild(phraseContainer);
        display.appendChild(refreshRow);
    });
}

// Show chord selector dropdown with all available chords
function showChordSelector(chordWrapper, barIndex, chordIndex, currentDegree) {
    // Remove any existing selectors
    document.querySelectorAll('.chord-selector').forEach(el => el.remove());
    
    if (!substitutionData) return;
    
    // Group chords by degree number with their types - using array to maintain order
    const chordGroups = [
        { degree: "1", types: ["1", "1m", "1o"] },
        { degree: "b2", types: ["b2", "b2m", "b2o"] },
        { degree: "2", types: ["2", "2m", "2o"] },
        { degree: "b3", types: ["b3", "b3m", "b3o"] },
        { degree: "3", types: ["3", "3m", "3o"] },
        { degree: "4", types: ["4", "4m"] },
        { degree: "#4", types: ["#4", "#4o"] },
        { degree: "5", types: ["5", "5m", "5o"] },
        { degree: "b6", types: ["b6", "b6m", "b6o"] },
        { degree: "6", types: ["6", "6m", "6o"] },
        { degree: "b7", types: ["b7", "b7m", "b7o"] },
        { degree: "7", types: ["7", "7m", "7o"] }
    ];
    
    const chordSelector = document.createElement('div');
    chordSelector.className = 'chord-selector';
    
    const degreeList = document.createElement('div');
    degreeList.className = 'degree-list';
    
    const typeList = document.createElement('div');
    typeList.className = 'type-list';
    
    // First level: show degree numbers
    chordGroups.forEach(group => {
        const degreeBtn = document.createElement('button');
        degreeBtn.textContent = group.degree;
        degreeBtn.className = 'degree-btn';
        degreeBtn.onmouseenter = () => {
            showChordTypes(typeList, group.types, barIndex, chordIndex);
        };
        degreeList.appendChild(degreeBtn);
    });
    
    chordSelector.appendChild(degreeList);
    chordSelector.appendChild(typeList);
    chordWrapper.appendChild(chordSelector);
    
    // Close on click outside
    setTimeout(() => {
        document.addEventListener('click', function closeSelector(e) {
            if (!chordSelector.contains(e.target)) {
                chordSelector.remove();
                document.removeEventListener('click', closeSelector);
            }
        });
    }, 0);
}

// Show chord type options for selected degree
function showChordTypes(typeList, chordTypes, barIndex, chordIndex) {
    // Clear and populate type list
    typeList.innerHTML = '';
    
    // Show chord type buttons
    chordTypes.forEach(degree => {
        const btn = document.createElement('button');
        const displayText = showDegrees ? degree : chordGenerator.degreeToNote(selectedKey, degree);
        btn.textContent = displayText;
        btn.className = 'type-btn';
        btn.onclick = () => {
            currentBars[barIndex][chordIndex] = degree;
            // Update parent if user manually selects a new diatonic chord
            const newParent = getDiatonicParent(degree);
            currentParents[barIndex][chordIndex] = newParent;
            // Mark as substituted if different from parent
            isSubstituted[barIndex][chordIndex] = (degree !== newParent);
            // Rebuild phrases from currentBars for display
            const phrases = [currentBars];
            updateChordGrid(phrases);
            // Remove the entire chord selector
            typeList.closest('.chord-selector').remove();
        };
        typeList.appendChild(btn);
    });
}

// Replace with a chord substitution (same function)
function replaceWithSubstitute(barIndex, chordIndex, currentDegree) {
    if (!substitutionData || !substitutionData.substitutions) {
        alert('Substitution data not loaded');
        return;
    }
    
    // Get the original parent chord for this position
    const parentDegree = currentParents[barIndex][chordIndex];
    
    const subs = substitutionData.substitutions[parentDegree];
    if (!subs) {
        alert(`No substitutions available for ${currentDegree}`);
        return;
    }
    
    // Combine all substitution types and include the parent chord itself
    let allSubs = [parentDegree, ...(subs.function || []), ...(subs.modal || []), ...(subs.tritone || [])];
    
    // Filter out the current chord to avoid repeating
    allSubs = allSubs.filter(sub => sub !== currentDegree);
    
    if (allSubs.length === 0) {
        alert(`No other substitutions available for ${currentDegree}`);
        return;
    }
    
    // Pick random substitution
    const newDegree = allSubs[Math.floor(Math.random() * allSubs.length)];
    currentBars[barIndex][chordIndex] = newDegree;
    
    // Mark as substituted if different from parent, otherwise mark as parent
    isSubstituted[barIndex][chordIndex] = (newDegree !== parentDegree);
    
    // Rebuild phrases from currentBars for display
    const phrases = [currentBars];
    updateChordGrid(phrases);
}

// Audio playback functionality
let audioContext = null;
let pianoSamples = {}; // Store loaded piano samples
let samplesLoaded = false;
let previousVoicing = null; // Track previous chord voicing for voice leading

// Piano sample notes (you'll need to add these files to assets/audio/piano/)
const sampleNotes = ['C3', 'E3', 'G3', 'C4', 'E4', 'G4', 'C5'];

async function loadPianoSamples() {
    if (samplesLoaded) return;
    
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    try {
        const loadPromises = sampleNotes.map(async (note) => {
            const response = await fetch(`../../assets/audio/piano/${note}.mp3`);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            pianoSamples[note] = audioBuffer;
        });
        
        await Promise.all(loadPromises);
        samplesLoaded = true;
        console.log('Piano samples loaded successfully');
    } catch (error) {
        console.warn('Piano samples not found, using synthesis fallback:', error);
        samplesLoaded = false;
    }
}

async function playProgression() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    if (currentBars.length === 0) return;
    
    // Reset voice leading for new progression
    previousVoicing = null;
    
    // Calculate bar duration from BPM (assuming 4/4 time)
    const barDuration = (60 / bpm) * 4; // 4 beats per bar
    let currentTime = audioContext.currentTime;
    
    currentBars.forEach((bar) => {
        const chordDuration = barDuration / bar.length; // Divide bar time evenly
        let barTime = currentTime;
        
        bar.forEach((degree) => {
            playChord(degree, barTime, chordDuration);
            barTime += chordDuration; // No gap between chords
        });
        currentTime += barDuration; // Move to next bar
    });
}

function playChord(degree, startTime, duration) {
    // Get actual notes for the chord
    const note = chordGenerator.degreeToNote(selectedKey, degree);
    
    // Extract bass note (root or slash bass)
    let bassNote;
    let mainChord = degree;
    
    if (degree.includes('/')) {
        // Split main chord and bass degree
        const parts = degree.split('/');
        mainChord = parts[0];
        const bassDegree = parts[1];
        
        // Convert bass degree to actual note (extract just degree number with accidentals, no quality)
        const bassDegreeMatch = bassDegree.match(/^[b#]?[1-7]/);
        if (bassDegreeMatch) {
            const cleanBassDegree = bassDegreeMatch[0];
            bassNote = chordGenerator.degreeToNote(selectedKey, cleanBassDegree);
            // Extract just the note name (remove any quality that got appended)
            const bassMatch = bassNote.match(/^[A-G][#b]?/);
            bassNote = bassMatch ? bassMatch[0] : bassNote;
        } else {
            // Fallback: try to extract note from bassDegree directly
            const bassMatch = bassDegree.match(/^[A-G][#b]?/);
            bassNote = bassMatch ? bassMatch[0] : getBassNote(note);
        }
    } else {
        bassNote = getBassNote(note);
    }
    
    const bassFreq = getNoteFrequency(bassNote, 3); // Bass in octave 3 (C3-B3)
    
    // Get chord tones (without bass)
    // Use the main chord (without slash) for voicing
    const chordTones = getChordTones(chordGenerator.degreeToNote(selectedKey, mainChord));
    
    // Apply voice leading to get smooth voicing
    const voicing = getClosestVoicing(chordTones, previousVoicing);
    previousVoicing = voicing;
    
    // Play bass note with synthesis
    playSynthNote(bassFreq, startTime, duration, 0.28);
    
    // Play voiced chord
    voicing.forEach(freq => {
        playSynthNote(freq, startTime, duration, 0.25);
    });
}

function playSampledNote(frequency, startTime, duration, volume = 0.3) {
    // Find closest sample and calculate pitch shift
    const closestSample = findClosestSample(frequency);
    if (!closestSample) return;
    
    const source = audioContext.createBufferSource();
    const gainNode = audioContext.createGain();
    
    source.buffer = pianoSamples[closestSample.note];
    source.playbackRate.setValueAtTime(closestSample.pitchRatio, startTime);
    
    // Piano envelope - faster fade for quicker transitions
    gainNode.gain.setValueAtTime(volume, startTime);
    gainNode.gain.setValueAtTime(volume, startTime + duration * 0.99);
    gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    
    source.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    source.start(startTime);
    source.stop(startTime + duration);
}

function findClosestSample(targetFreq) {
    const noteFrequencies = {
        'C3': 130.81, 'E3': 164.81, 'G3': 196.00,
        'C4': 261.63, 'E4': 329.63, 'G4': 392.00, 'C5': 523.25
    };
    
    let closestNote = null;
    let minDiff = Infinity;
    
    for (const [note, freq] of Object.entries(noteFrequencies)) {
        const diff = Math.abs(freq - targetFreq);
        if (diff < minDiff && pianoSamples[note]) {
            minDiff = diff;
            closestNote = note;
        }
    }
    
    if (!closestNote) return null;
    
    const pitchRatio = targetFreq / noteFrequencies[closestNote];
    return { note: closestNote, pitchRatio };
}

function playSynthNote(freq, startTime, duration, volume = 0.15) {
    // Synthesis fallback (piano-like sound)
    const oscillator1 = audioContext.createOscillator();
    const oscillator2 = audioContext.createOscillator();
    const oscillator3 = audioContext.createOscillator();
    
    const gainNode1 = audioContext.createGain();
    const gainNode2 = audioContext.createGain();
    const gainNode3 = audioContext.createGain();
    const masterGain = audioContext.createGain();
    
    oscillator1.type = 'triangle';
    oscillator2.type = 'sine';
    oscillator3.type = 'sine';
    
    oscillator1.frequency.setValueAtTime(freq, startTime);
    oscillator2.frequency.setValueAtTime(freq * 2, startTime);
    oscillator3.frequency.setValueAtTime(freq * 3, startTime);
    
    gainNode1.gain.setValueAtTime(0.5, startTime);
    gainNode2.gain.setValueAtTime(0.15, startTime);
    gainNode3.gain.setValueAtTime(0.05, startTime);
    
    masterGain.gain.setValueAtTime(0, startTime);
    masterGain.gain.linearRampToValueAtTime(volume, startTime + 0.01);
    masterGain.gain.setValueAtTime(volume, startTime + duration * 0.85);
    masterGain.gain.exponentialRampToValueAtTime(0.001, startTime + duration * 0.98);
    
    oscillator1.connect(gainNode1);
    oscillator2.connect(gainNode2);
    oscillator3.connect(gainNode3);
    
    gainNode1.connect(masterGain);
    gainNode2.connect(masterGain);
    gainNode3.connect(masterGain);
    masterGain.connect(audioContext.destination);
    
    oscillator1.start(startTime);
    oscillator2.start(startTime);
    oscillator3.start(startTime);
    
    oscillator1.stop(startTime + duration);
    oscillator2.stop(startTime + duration);
    oscillator3.stop(startTime + duration);
}

function getChordFrequencies(noteSymbol) {
    // Note to frequency mapping (middle octave)
    const noteFrequencies = {
        'C': 261.63, 'C#': 277.18, 'D': 293.66, 'D#': 311.13,
        'E': 329.63, 'F': 349.23, 'F#': 369.99, 'G': 392.00,
        'G#': 415.30, 'A': 440.00, 'A#': 466.16, 'B': 493.88
    };
    
    // Extract base note and quality
    const baseNote = noteSymbol.match(/^[A-G][#b]?/)?.[0] || 'C';
    const quality = noteSymbol.slice(baseNote.length);
    
    const rootFreq = noteFrequencies[baseNote] || 261.63;
    
    // Build chord based on quality
    if (quality.includes('m')) {
        // Minor: root, minor third, fifth
        return [rootFreq, rootFreq * Math.pow(2, 3/12), rootFreq * Math.pow(2, 7/12)];
    } else if (quality.includes('o') || quality.includes('dim')) {
        // Diminished: root, minor third, diminished fifth
        return [rootFreq, rootFreq * Math.pow(2, 3/12), rootFreq * Math.pow(2, 6/12)];
    } else if (quality.includes('+') || quality.includes('aug')) {
        // Augmented: root, major third, augmented fifth
        return [rootFreq, rootFreq * Math.pow(2, 4/12), rootFreq * Math.pow(2, 8/12)];
    } else if (quality.includes('7')) {
        // Seventh: root, major third, fifth, minor seventh
        return [rootFreq, rootFreq * Math.pow(2, 4/12), rootFreq * Math.pow(2, 7/12), rootFreq * Math.pow(2, 10/12)];
    } else {
        // Major: root, major third, fifth
        return [rootFreq, rootFreq * Math.pow(2, 4/12), rootFreq * Math.pow(2, 7/12)];
    }
}

// Voice Leading System

// Get bass note from chord symbol (always uses root, even for slash chords)
function getBassNote(chordSymbol) {
    // Check for slash chord (e.g., C/E or 1/3)
    if (chordSymbol.includes('/')) {
        const parts = chordSymbol.split('/');
        const bassNote = parts[1]; // The note after the slash
        // Extract just the note name (handle cases like "3m" or just "3")
        const bassMatch = bassNote.match(/^[A-G][#b]?/);
        return bassMatch ? bassMatch[0] : bassNote;
    }
    // Return root note (before slash or entire symbol)
    const rootMatch = chordSymbol.match(/^[A-G][#b]?/);
    return rootMatch ? rootMatch[0] : 'C';
}

// Get note frequency for specific octave
function getNoteFrequency(noteName, octave = 4) {
    const noteFrequencies = {
        'C': 16.35, 'C#': 17.32, 'Db': 17.32,
        'D': 18.35, 'D#': 19.45, 'Eb': 19.45,
        'E': 20.60, 'F': 21.83, 'F#': 23.12, 'Gb': 23.12,
        'G': 24.50, 'G#': 25.96, 'Ab': 25.96,
        'A': 27.50, 'A#': 29.14, 'Bb': 29.14,
        'B': 30.87
    };
    
    const baseFreq = noteFrequencies[noteName] || 16.35;
    return baseFreq * Math.pow(2, octave);
}

// Get chord tones as note names (without octave)
function getChordTones(chordSymbol) {
    // Remove slash chord bass if present
    const mainChord = chordSymbol.split('/')[0];
    
    // Extract root and quality
    const rootMatch = mainChord.match(/^[A-G][#b]?/);
    const root = rootMatch ? rootMatch[0] : 'C';
    const quality = mainChord.slice(root.length);
    
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const rootIndex = noteNames.findIndex(n => n === root || n === root.replace('b', '#'));
    
    if (rootIndex === -1) return [root];
    
    let intervals = [];
    
    // Determine intervals based on chord quality
    if (quality.includes('mM7') || quality === 'mM7') {
        intervals = [0, 3, 7, 11]; // Minor major 7th
    } else if (quality.includes('m7') || quality === 'm7') {
        intervals = [0, 3, 7, 10]; // Minor 7th
    } else if (quality.includes('maj7') || quality === 'M7' || quality === 'Δ7') {
        intervals = [0, 4, 7, 11]; // Major 7th
    } else if (quality.includes('7')) {
        intervals = [0, 4, 7, 10]; // Dominant 7th
    } else if (quality.includes('dim') || quality.includes('o')) {
        intervals = [0, 3, 6]; // Diminished
    } else if (quality.includes('m')) {
        intervals = [0, 3, 7]; // Minor
    } else if (quality.includes('aug') || quality.includes('+')) {
        intervals = [0, 4, 8]; // Augmented
    } else if (quality.includes('sus4')) {
        intervals = [0, 5, 7]; // Sus4
    } else if (quality.includes('sus2')) {
        intervals = [0, 2, 7]; // Sus2
    } else if (quality.includes('sus')) {
        intervals = [0, 5, 7]; // Sus (default to Sus4)
    } else if (quality.includes('add')) {
        // Handle add chords - start with major triad
        intervals = [0, 4, 7];
        
        // Parse what to add
        if (quality.includes('add2') || quality.includes('add9')) {
            if (!intervals.includes(2)) intervals.push(2);
        } else if (quality.includes('add#4')) {
            if (!intervals.includes(6)) intervals.push(6);
        } else if (quality.includes('add4')) {
            if (!intervals.includes(5)) intervals.push(5);
        } else if (quality.includes('add6')) {
            if (!intervals.includes(9)) intervals.push(9);
        } else if (quality.includes('add#5')) {
            if (!intervals.includes(8)) intervals.push(8);
        }
        
        // Handle removals (no3), (no5), etc.
        if (quality.includes('(no3)') || quality.includes('no3')) {
            intervals = intervals.filter(i => i !== 4);
        }
        if (quality.includes('(no5)') || quality.includes('no5')) {
            intervals = intervals.filter(i => i !== 7);
        }
        
        // Sort intervals
        intervals.sort((a, b) => a - b);
    } else {
        intervals = [0, 4, 7]; // Major
    }
    
    // Handle removals (no3), (no5), etc. for all chord types
    if (quality.includes('(no3)') || quality.includes('no3')) {
        intervals = intervals.filter(i => i !== 4 && i !== 3); // Remove both major and minor 3rd
    }
    if (quality.includes('(no5)') || quality.includes('no5')) {
        intervals = intervals.filter(i => i !== 7);
    }
    
    // Convert intervals to note names
    return intervals.map(interval => {
        const noteIndex = (rootIndex + interval) % 12;
        return noteNames[noteIndex];
    });
}

// Get all possible voicings of chord tones within range (C4-C6)
function getAllVoicings(chordTones) {
    const voicings = [];
    const minOctave = 4;
    const maxOctave = 5;
    
    // Generate all combinations of octaves for each chord tone
    function generateVoicings(tones, currentVoicing, toneIndex) {
        if (toneIndex === tones.length) {
            // Check if voicing is within reasonable range
            const freqs = currentVoicing.map(v => getNoteFrequency(v.note, v.octave));
            const minFreq = Math.min(...freqs);
            const maxFreq = Math.max(...freqs);
            
            // Keep voicings within 2 octaves (reasonable piano range)
            if (maxFreq / minFreq <= 4) {
                voicings.push(freqs);
            }
            return;
        }
        
        const tone = tones[toneIndex];
        for (let octave = minOctave; octave <= maxOctave; octave++) {
            generateVoicings(tones, [...currentVoicing, { note: tone, octave }], toneIndex + 1);
        }
    }
    
    generateVoicings(chordTones, [], 0);
    return voicings;
}

// Find closest voicing to previous chord (voice leading)
function getClosestVoicing(chordTones, previousVoicing) {
    if (!previousVoicing || previousVoicing.length === 0) {
        // First chord - use middle voicing (C4 octave)
        return chordTones.map(tone => getNoteFrequency(tone, 4));
    }
    
    const allVoicings = getAllVoicings(chordTones);
    
    if (allVoicings.length === 0) {
        // Fallback
        return chordTones.map(tone => getNoteFrequency(tone, 4));
    }
    
    // Find voicing with minimum total voice movement
    let bestVoicing = allVoicings[0];
    let minMovement = Infinity;
    
    for (const voicing of allVoicings) {
        const movement = calculateVoiceMovement(previousVoicing, voicing);
        if (movement < minMovement) {
            minMovement = movement;
            bestVoicing = voicing;
        }
    }
    
    return bestVoicing;
}

// Calculate total semitone movement between two voicings
function calculateVoiceMovement(voicing1, voicing2) {
    // Match voices using optimal assignment (simple greedy approach)
    const used = new Set();
    let totalMovement = 0;
    
    for (const freq1 of voicing1) {
        let minDist = Infinity;
        let closestIndex = -1;
        
        voicing2.forEach((freq2, index) => {
            if (!used.has(index)) {
                const semitones = Math.abs(12 * Math.log2(freq2 / freq1));
                if (semitones < minDist) {
                    minDist = semitones;
                    closestIndex = index;
                }
            }
        });
        
        if (closestIndex !== -1) {
            used.add(closestIndex);
            totalMovement += minDist;
        }
    }
    
    return totalMovement;
}
