// Chord Generator Page Script - Self-contained version

// ==================== CONFIGURATION ====================
const ChordGenConfig = {
    // Audio settings
    BASS_VOLUME: 0.28,
    CHORD_VOLUME: 0.25,
    SYNTH_VOLUME: 0.15,
    ATTACK_TIME: 0.01,
    RELEASE_START: 0.85,
    RELEASE_END: 0.98,
    MIN_GAIN: 0.001,
    
    // Oscillator harmonics
    HARMONIC_1_GAIN: 0.5,
    HARMONIC_2_GAIN: 0.15,
    HARMONIC_3_GAIN: 0.05,
    
    // Voice leading
    MIN_OCTAVE: 4,
    MAX_OCTAVE: 5,
    BASS_OCTAVE: 3,
    MAX_VOICING_RANGE: 4, // Max frequency ratio between highest and lowest note
    
    // UI throttling
    INDICATOR_THROTTLE: 16, // ~60fps
    
    // Default values
    DEFAULT_KEY: 'C',
    DEFAULT_BPM: 200,
    MIN_BPM: 60,
    MAX_BPM: 200
};

// ==================== STATE ====================
const ChordGenState = {
    chordGenerator: null,
    allProgressions: [],
    selectedKey: ChordGenConfig.DEFAULT_KEY,
    showDegrees: true,
    substitutionData: null,
    systemTransferData: null,
    currentBars: [],
    currentParents: [],
    lastProgressionIndex: -1,
    isSubstituted: [],
    bpm: ChordGenConfig.DEFAULT_BPM,
    audioContext: null,
    previousVoicing: null,
    
    // UI state
    addIndicator: null,
    indicatorRAF: null,
    lastIndicatorUpdate: 0,
    chordSelectorOpen: false,
    previewTooltip: null,
    disabledTooltip: null
};

// Legacy globals for backward compatibility
let chordGenerator;
let allProgressions = [];
let selectedKey = 'C';
let showDegrees = true;
let substitutionData = null;
let systemTransferData = null;
let currentBars = [];
let currentParents = [];
let lastProgressionIndex = -1;
let isSubstituted = [];
let bpm = 200;

const KEYS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

// Inline ChordGenerator class with built-in data
class ChordGenerator {
    constructor() {
        this.noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        this.keySignatures = { 'C': 0, 'Db': 1, 'D': 2, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'Ab': 8, 'A': 9, 'Bb': 10, 'B': 11 };
        this.scaleFormula = [0, 2, 4, 5, 7, 9, 11]; // Major scale intervals
        this.systemTransfer = null;
        this.degreeSemitoneMap = null;
    }

    setSystemTransfer(data) {
        this.systemTransfer = data || null;
        this.degreeSemitoneMap = buildDegreeSemitoneMap(data?.defaultDegrees);
    }

    // Convert degree notation (e.g., "1", "4m", "5/7") to actual note
    degreeToNote(key, degreeNotation) {
        const rootIndex = this.keySignatures[key];
        if (rootIndex === undefined) return degreeNotation;

        // Parse degree notation (e.g., "5/7", "6m", "b7", "67")
        // Degrees are 1-7; everything after is treated as suffix/quality
        const match = degreeNotation.match(/^(bb|##|b|#)?([1-7])(.*)$/);
        if (!match) return degreeNotation;

        const accidental = match[1]; // b or #
        const degree = parseInt(match[2]) - 1; // Convert to 0-based index
        const suffix = match[3]; // m, /7, etc.

        if (degree < 0 || degree >= this.scaleFormula.length) return degreeNotation;

        // Get the scale degree interval
        let interval = null;

        if (this.degreeSemitoneMap) {
            const base = this.degreeSemitoneMap.get(String(degree + 1));
            if (base !== undefined) {
                const adjustment = getAccidentalAdjustment(accidental, this.systemTransfer);
                interval = base + adjustment;
            }
        }

        if (interval === null) {
            interval = this.scaleFormula[degree];
            if (accidental === 'b') interval -= 1;
            if (accidental === '#') interval += 1;
        }

        // Calculate final note
        const noteIndex = (rootIndex + interval) % 12;
        return this.noteNames[noteIndex] + suffix;
    }
}

function buildDegreeSemitoneMap(defaultDegrees) {
    if (!Array.isArray(defaultDegrees)) return null;
    const map = new Map();
    defaultDegrees.forEach(entry => {
        if (!entry || entry.degree === undefined || entry.system === undefined) return;
        map.set(String(entry.degree), entry.system);
    });
    return map;
}

function getAccidentalAdjustment(accidental, systemTransfer) {
    if (!accidental) return 0;
    const algo = systemTransfer?.accidentalsAlgorithm;
    if (Array.isArray(algo)) {
        const match = algo.find(a => a.accidental === accidental);
        if (match && typeof match.adjustment === 'number') return match.adjustment;
    }
    if (accidental === 'b') return -1;
    if (accidental === '#') return 1;
    if (accidental === 'bb') return -2;
    if (accidental === '##') return 2;
    return 0;
}

function getDegreeIntervalFromSystemTransfer(degreeToken) {
    if (!systemTransferData || !systemTransferData.defaultDegrees) return null;
    const match = String(degreeToken).match(/^(bb|##|b|#)?(\d+)$/);
    if (!match) return null;
    const accidental = match[1] || '';
    const degree = match[2];
    const map = buildDegreeSemitoneMap(systemTransferData.defaultDegrees);
    if (!map) return null;
    const base = map.get(degree);
    if (base === undefined) return null;
    const adjustment = getAccidentalAdjustment(accidental, systemTransferData);
    const interval = base + adjustment;
    return ((interval % 12) + 12) % 12;
}

// Convert degree formula from systemTransfer (e.g., ["1", "b3", "5"]) to intervals (e.g., [0, 3, 7])
function formulaToIntervals(formula) {
    if (!Array.isArray(formula)) return null;
    const intervals = [];
    
    formula.forEach(degreeStr => {
        const interval = getDegreeIntervalFromSystemTransfer(degreeStr);
        if (interval !== null) {
            intervals.push(interval);
        }
    });
    
    return intervals.length > 0 ? intervals : null;
}

// Apply omissions (no3, no5, etc.) from systemTransfer.json
function applyOmissionsToIntervals(intervals, quality) {
    if (!quality) return intervals;
    
    let result = [...intervals];
    
    // Check systemTransfer for omitted intervals first
    if (systemTransferData && systemTransferData.chordIntervals && systemTransferData.chordIntervals.omitted) {
        const omitted = systemTransferData.chordIntervals.omitted;
        
        // Check for each omission rule
        for (const [omissionKey, omissionRule] of Object.entries(omitted)) {
            // Check if quality contains this omission (e.g., "no3" or "(no3)")
            if (quality.includes(omissionKey) || quality.includes(`(${omissionKey})`)) {
                // Remove the intervals specified in the rule
                if (omissionRule.remove && Array.isArray(omissionRule.remove)) {
                    result = result.filter(i => !omissionRule.remove.includes(i));
                }
            }
        }
        return result;
    }
    
    // Fallback: hardcoded removal logic
    if (quality.includes('(no3)') || quality.includes('no3')) {
        result = result.filter(i => i !== 4 && i !== 3); // Remove both major and minor 3rd
    }
    if (quality.includes('(no5)') || quality.includes('no5')) {
        result = result.filter(i => i !== 7);
    }
    
    return result;
}

// Look up chord intervals from systemTransfer.json
function getChordIntervalsFromSystemTransfer(quality) {
    if (!systemTransferData || !systemTransferData.chordIntervals) return null;
    
    const intervals = systemTransferData.chordIntervals;
    
    // Collect all chord symbols with their formulas, sorted by symbol length (longest first)
    // This ensures "m7" matches before "m", "69" before "6", etc.
    const allChords = [];
    
    // Add sevenths (highest priority for matching)
    if (intervals.sevenths) {
        intervals.sevenths.forEach(c => allChords.push({ symbol: c.symbol, formula: c.formula, type: 'seventh' }));
    }
    // Add sixths
    if (intervals.sixths) {
        intervals.sixths.forEach(c => allChords.push({ symbol: c.symbol, formula: c.formula, type: 'sixth' }));
    }
    // Add triads
    if (intervals.triads) {
        intervals.triads.forEach(c => allChords.push({ symbol: c.symbol, formula: c.formula, type: 'triad' }));
    }
    
    // Sort by symbol length descending (longer symbols match first to avoid false positives)
    allChords.sort((a, b) => b.symbol.length - a.symbol.length);
    
    // Check for exact match first
    for (const chord of allChords) {
        if (quality === chord.symbol) {
            return formulaToIntervals(chord.formula);
        }
    }
    
    // Check for includes match (quality contains the symbol)
    for (const chord of allChords) {
        if (quality.includes(chord.symbol)) {
            return formulaToIntervals(chord.formula);
        }
    }
    
    // Check suspended chords separately (they modify structure)
    if (intervals.suspended) {
        // Sort suspended by key length (sus4 before sus)
        const susTypes = Object.entries(intervals.suspended).sort((a, b) => b[0].length - a[0].length);
        for (const [susType, susRule] of susTypes) {
            if (quality.includes(susType)) {
                const replaceInterval = getDegreeIntervalFromSystemTransfer(susRule.with);
                if (replaceInterval !== null) {
                    return [0, replaceInterval, 7]; // Root, sus note, fifth
                }
            }
        }
    }
    
    return null;
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
        
        // Load progressions from chordProgression.json
        const progressionData = await DataService.getChordProgressions();
        
        // Load system transfer rules from systemTransfer.json
        const systemTransfer = await DataService.getSystemTransfer();
        if (systemTransfer && typeof systemTransfer === 'object') {
            systemTransferData = systemTransfer;
            chordGenerator.setSystemTransfer(systemTransfer);
            
            // Extract substitution data from systemTransfer
            if (systemTransfer.chordSubstitutions && systemTransfer.chordSubstitutions.substitutions) {
                substitutionData = systemTransfer.chordSubstitutions;
            }
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
                <button id="generatorPreviewToggle" class="toggle-btn" onclick="toggleGeneratorPreview()" style="background: linear-gradient(135deg, #666 0%, #888 100%);">
                    🚫 Preview
                </button>
            </div>
        </div>
        <div id="progressionDisplay" class="progression-grid"></div>
        <div id="generatorMusic" class="generator-music"></div>
    `;
    
    // Setup tooltip on preview button
    window.setupPreviewButtonTooltip();
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

// Toggle generator preview on/off
window.toggleGeneratorPreview = function() {
    const btn = document.getElementById('generatorPreviewToggle');
    if (btn) {
        // Toggle the state (default is false/disabled)
        window.generatorPreviewEnabled = !window.generatorPreviewEnabled;
        // Also update the global videoPreviewEnabled used by setBackgroundPreview
        window.videoPreviewEnabled = window.generatorPreviewEnabled;
        
        if (window.generatorPreviewEnabled) {
            btn.style.background = 'linear-gradient(135deg, #FF6B6B 0%, #FF8A80 100%)';
            btn.textContent = '🎬 Preview';
        } else {
            btn.style.background = 'linear-gradient(135deg, #666 0%, #888 100%)';
            btn.textContent = '🚫 Preview';
            // Clear any active preview when disabling
            if (window.clearBackgroundPreview) {
                window.clearBackgroundPreview();
            }
        }
    }
}

// Add tooltip to preview button
window.setupPreviewButtonTooltip = function() {
    const btn = document.getElementById('generatorPreviewToggle');
    if (!btn) return;
    
    let tooltip = null;
    
    btn.addEventListener('mouseenter', function() {
        if (window.generatorPreviewEnabled !== true) {
            if (!tooltip) {
                tooltip = document.createElement('div');
                tooltip.style.cssText = `
                    position: fixed;
                    background: rgba(0, 0, 0, 0.95);
                    color: #fff;
                    padding: 10px 14px;
                    border-radius: 4px;
                    font-size: 0.9em;
                    z-index: 10000;
                    pointer-events: none;
                    white-space: nowrap;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.5);
                `;
                tooltip.textContent = '▶ Enable if YouTube Premium or no Ads';
                document.body.appendChild(tooltip);
            }
            
            const rect = btn.getBoundingClientRect();
            tooltip.style.left = (rect.left + rect.width / 2 - 80) + 'px';
            tooltip.style.top = (rect.top - 40) + 'px';
            tooltip.style.display = 'block';
        }
    });
    
    btn.addEventListener('mouseleave', function() {
        if (tooltip) {
            tooltip.style.display = 'none';
        }
    });
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

// Check if current progression matches any in the database and show music examples
function checkAndShowMusicExamples() {
    if (!allProgressions || allProgressions.length === 0) {
        renderGeneratorMusic([]);
        return;
    }

    // Flatten currentBars into a single array for comparison
    const currentChords = currentBars.flat(Infinity).filter(c => c && typeof c === 'string');
    
    // Search through all progressions for a match
    let matchedMusic = [];
    
    // allProgressions has been transformed to { phrases: [...], music: [...] }
    for (const prog of allProgressions) {
        // Get chords from phrases structure
        let progChords = [];
        
        if (prog.phrases && Array.isArray(prog.phrases)) {
            // Flatten all phrases into a single chord array
            progChords = prog.phrases.flat(Infinity).filter(c => c && typeof c === 'string');
        }
        
        // Compare chord arrays
        if (progChords.length === currentChords.length) {
            const isMatch = progChords.every((chord, idx) => chord === currentChords[idx]);
            
            if (isMatch) {
                if (prog.music && prog.music.length > 0) {
                    matchedMusic = prog.music;
                    break;
                }
            }
        }
    }
    
    renderGeneratorMusic(matchedMusic);
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
        const youtubeId = song.youtubeId ? song.youtubeId.trim() : '';
        const clipStart = song.clipStart ? parseInt(song.clipStart) : 0;
        if (!artistDisplay && !title) return;
        const key = artistDisplay || 'Unknown Artist';
        if (!artistMap.has(key)) artistMap.set(key, []);
        if (title) {
            artistMap.get(key).push({ title, part, youtubeId, clipStart });
        }
    });

    if (artistMap.size === 0) {
        container.innerHTML = '<p class="detail-line" style="color: #888;">No music examples yet.</p>';
        return;
    }

    let html = '';
    artistMap.forEach((titles, artist) => {
        const seen = new Set();
        const titleLinks = [];
        
        titles.forEach(item => {
            const titleWithPart = item.part ? `${item.title} (${item.part})` : item.title;
            const key = `${titleWithPart}::${item.youtubeId || ''}`;
            if (seen.has(key)) return;
            seen.add(key);

            const safeTitle = escapeHtml(titleWithPart);
            if (!item.youtubeId) {
                titleLinks.push(safeTitle);
                return;
            }
            
            const iframeUrl = buildYoutubeEmbedUrl(item.youtubeId, item.clipStart || 0, false);
            const tooltipId = `tooltip-${Math.random().toString(36).substr(2, 9)}`;
            
            // Create link with separate tooltip in document
            titleLinks.push(`<a class="music-link" data-tooltip="${tooltipId}" data-video-id="${item.youtubeId}" data-start="${item.clipStart || 0}">${safeTitle}</a>`);
            html += `<div class="music-tooltip" id="${tooltipId}" style="display: none;">
                <iframe width="560" height="315" src="${escapeHtml(iframeUrl)}" 
                    title="${safeTitle}" frameborder="0" 
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    allowfullscreen></iframe>
            </div>`;
        });

        const line = titleLinks.length > 0
            ? `${escapeHtml(artist)} - ${titleLinks.join(', ')}`
            : escapeHtml(artist);
        html += `<p class="detail-line music-example">${line}</p>`;
    });

    container.innerHTML = html;
    setupGeneratorMusicHoverHandlers(container);
}

function setupGeneratorMusicHoverHandlers(container) {
    if (!container || container.dataset.musicHoverBound === 'true') return;
    container.dataset.musicHoverBound = 'true';

    let currentVideoId = null;
    let disabledTooltip = null;

    const handleMouseOver = (event) => {
        const link = event.target.closest('.music-link');
        if (!link || !container.contains(link)) return;

        // Check if preview is enabled in chord generator (default is disabled)
        if (window.generatorPreviewEnabled !== true) {
            // Show disabled tooltip
            if (!disabledTooltip) {
                disabledTooltip = document.createElement('div');
                disabledTooltip.className = 'preview-disabled-tooltip';
                disabledTooltip.textContent = '▶ Enable if YouTube Premium or no Ads';
                disabledTooltip.style.cssText = `
                    position: fixed;
                    background: rgba(0, 0, 0, 0.95);
                    color: #fff;
                    padding: 10px 14px;
                    border-radius: 4px;
                    font-size: 0.9em;
                    z-index: 10000;
                    pointer-events: none;
                    white-space: nowrap;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.5);
                `;
                document.body.appendChild(disabledTooltip);
            }
            
            const rect = link.getBoundingClientRect();
            const left = rect.left + rect.width / 2 - 80;
            const top = rect.top - 40;
            disabledTooltip.style.left = left + 'px';
            disabledTooltip.style.top = top + 'px';
            disabledTooltip.style.display = 'block';
            return;
        }

        if (disabledTooltip) {
            disabledTooltip.style.display = 'none';
        }

        const videoId = link.dataset.videoId;
        const clipStart = link.dataset.start || '0';

        if (typeof window.setBackgroundPreview === 'function') {
            window.setBackgroundPreview(videoId, clipStart);
            currentVideoId = videoId;
        }
    };

    const handleMouseOut = (event) => {
        // Hide tooltip on mouseout
        if (disabledTooltip) {
            disabledTooltip.style.display = 'none';
        }
        
        // Clear video preview when not hovering
        if (typeof window.clearBackgroundPreview === 'function') {
            window.clearBackgroundPreview();
        }
    };

    container.addEventListener('mouseover', handleMouseOver);
    container.addEventListener('mouseout', handleMouseOut);

    container._musicHoverHandlers = { handleMouseOver, handleMouseOut };
}

function buildYoutubeEmbedUrl(videoId, clipStart = 0, autoplay = false) {
    if (!videoId) return '';
    const autoplayParam = autoplay ? '1' : '0';
    return `https://www.youtube.com/embed/${videoId}?start=${clipStart}&autoplay=${autoplayParam}`;
}

function cleanupGeneratorMusicHoverHandlers(container) {
    if (!container || !container._musicHoverHandlers) return;
    const { handleMouseOver, handleMouseOut } = container._musicHoverHandlers;
    container.removeEventListener('mouseover', handleMouseOver);
    container.removeEventListener('mouseout', handleMouseOut);
    delete container._musicHoverHandlers;
    delete container.dataset.musicHoverBound;
}

// Get diatonic parent chord (handles slash chords and chromatic alterations)
function getDiatonicParent(chord) {
    // Handle slash chords - take only the part before the slash
    const baseChord = chord.split('/')[0];
    
    // Extract degree (without quality) using regex
    const degreeMatch = baseChord.match(/^([b#]?[1-7])/);
    if (!degreeMatch) return baseChord;
    
    const degree = degreeMatch[1];
    
    // Use systemTransfer substitutions to find diatonic parent
    if (substitutionData?.substitutions) {
        // Check if this degree has a parent in substitutions
        for (const [parent, subs] of Object.entries(substitutionData.substitutions)) {
            // Check if current degree is a substitution of this parent
            const allSubs = [...(subs.modal || []), ...(subs.tritone || [])];
            if (allSubs.some(sub => sub.startsWith(degree))) {
                return parent;
            }
        }
    }
    
    // Fallback: hardcoded mapping for common chromatic alterations
    const diatonicMap = {
        'b2': '2m', '#1': '2m',
        'b3': '3m', '#2': '3m',
        '#4': '4', 'b5': '5',
        'b6': '6m', '#5': '6m',
        'b7': '7o', '#6': '7o'
    };
    
    const parent = diatonicMap[degree];
    if (parent) {
        // Return parent with same quality if possible
        const quality = baseChord.slice(degree.length);
        return parent.replace(/[mo]$/, '') + quality || parent;
    }
    
    return baseChord;
}

// Floating add indicator that follows mouse
let addIndicator = null;
let indicatorRAF = null;
let lastIndicatorUpdate = 0;
let chordSelectorOpen = false; // Track if chord selector is open

function createAddIndicator() {
    if (!addIndicator) {
        addIndicator = document.createElement('div');
        addIndicator.className = 'add-indicator';
        addIndicator.innerHTML = '+';
        addIndicator.style.cssText = `
            position: fixed;
            width: 1.5rem;
            height: 1.5rem;
            background: #222;
            color: var(--brand, #6c5ce7);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.2em;
            font-weight: bold;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.15s;
            z-index: 10000;
            box-shadow: 0 2px 8px rgba(0,0,0,0.4);
            will-change: transform, opacity;
        `;
        document.body.appendChild(addIndicator);
    }
    return addIndicator;
}

function showAddIndicator(x, y) {
    showIndicator(x, y, 'add');
}

function showRemoveIndicator(x, y) {
    showIndicator(x, y, 'remove');
}

// Unified indicator function
function showIndicator(x, y, type = 'add') {
    if (chordSelectorOpen) return;
    
    const now = performance.now();
    if (now - lastIndicatorUpdate < ChordGenConfig.INDICATOR_THROTTLE) return;
    lastIndicatorUpdate = now;
    
    if (indicatorRAF) return;
    indicatorRAF = requestAnimationFrame(() => {
        const indicator = createAddIndicator();
        indicator.innerHTML = type === 'remove' ? '−' : '+';
        indicator.style.transform = `translate(${x - 12}px, ${y - 12}px)`;
        indicator.style.left = '0';
        indicator.style.top = '0';
        indicator.style.opacity = '1';
        indicatorRAF = null;
    });
}

function hideAddIndicator() {
    if (indicatorRAF) {
        cancelAnimationFrame(indicatorRAF);
        indicatorRAF = null;
    }
    if (addIndicator) {
        addIndicator.style.opacity = '0';
    }
}

function updateChordGrid(phrases) {
    const display = document.getElementById('progressionDisplay');
    if (!display) return;

    display.innerHTML = '';
    let barGlobalIndex = 0;

    phrases.forEach(phrase => {
        const phraseContainer = document.createElement('div');
        phraseContainer.className = 'phrase-container';

        // Controls row below the phrase (refresh buttons only)
        const controlsRow = document.createElement('div');
        controlsRow.className = 'controls-row';

        phrase.forEach(bar => {
            const barIndex = barGlobalIndex++;
            const barDiv = document.createElement('div');
            barDiv.className = 'progression-bar';
            barDiv.dataset.barIndex = barIndex;
            if (bar.length > 1) barDiv.classList.add('multi-chord');

            // Track mouse position for insert location
            let insertPosition = bar.length;
            let cachedChordWrappers = null; // Cache DOM query
            
            barDiv.onmousemove = (e) => {
                const mouseX = e.clientX;
                
                // Cache chord wrappers query (invalidated when bar content changes)
                if (!cachedChordWrappers) {
                    cachedChordWrappers = barDiv.querySelectorAll('.chord-wrapper');
                }
                
                insertPosition = cachedChordWrappers.length;
                
                for (let i = 0; i < cachedChordWrappers.length; i++) {
                    const chordRect = cachedChordWrappers[i].getBoundingClientRect();
                    const chordCenter = chordRect.left + chordRect.width / 2;
                    
                    if (mouseX < chordCenter) {
                        insertPosition = i;
                        break;
                    }
                }
                
                showAddIndicator(e.clientX, e.clientY);
            };
            
            barDiv.onmouseleave = () => {
                hideAddIndicator();
            };

            // Single click on bar to add chord at mouse position
            barDiv.onclick = (e) => {
                // Only add if clicking on bar background, not on a chord
                if (e.target === barDiv || e.target.classList.contains('progression-bar')) {
                    addChordToBar(barIndex, insertPosition);
                }
            };
            
            // Prevent context menu on bar
            barDiv.oncontextmenu = (e) => {
                e.preventDefault();
            };

            // Controls cell for this bar
            const controlsCell = document.createElement('div');
            controlsCell.className = 'controls-cell';

            bar.forEach((degree, chordIndex) => {
                const chordWrapper = document.createElement('div');
                chordWrapper.className = 'chord-wrapper';

                const chordDiv = document.createElement('div');
                chordDiv.className = 'chord-item';
                if (isSubstituted[barIndex] && isSubstituted[barIndex][chordIndex]) {
                    chordDiv.classList.add('substituted');
                }
                const displayText = showDegrees ? degree : chordGenerator.degreeToNote(selectedKey, degree);
                chordDiv.textContent = displayText;
                chordDiv.title = 'Click: remove | Right-click: change chord';
                
                // Show - indicator when hovering over chord
                chordDiv.onmouseenter = () => {
                    // Get chord position for indicator
                    const rect = chordDiv.getBoundingClientRect();
                    showRemoveIndicator(rect.right + 8, rect.top + rect.height / 2);
                };
                
                chordDiv.onmousemove = (e) => {
                    showRemoveIndicator(e.clientX, e.clientY);
                };
                
                chordDiv.onmouseleave = () => {
                    hideAddIndicator();
                };
                
                // Single click to remove chord
                chordDiv.onclick = (e) => {
                    e.stopPropagation();
                    removeChordFromBar(barIndex, chordIndex);
                };
                
                // Right-click to open chord selector
                chordDiv.oncontextmenu = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    showChordSelector(chordWrapper, barIndex, chordIndex, degree);
                };

                chordWrapper.appendChild(chordDiv);
                barDiv.appendChild(chordWrapper);

                // Refresh button for this chord (in controls row)
                const refreshBtn = document.createElement('button');
                refreshBtn.className = 'chord-control-btn';
                refreshBtn.innerHTML = '🔄';
                refreshBtn.title = 'Substitute chord (same function)';
                refreshBtn.onclick = (e) => {
                    e.stopPropagation();
                    replaceWithSubstitute(barIndex, chordIndex, degree);
                };
                controlsCell.appendChild(refreshBtn);
            });

            phraseContainer.appendChild(barDiv);
            controlsRow.appendChild(controlsCell);
        });

        display.appendChild(phraseContainer);
        display.appendChild(controlsRow);
    });
}

// Add a new chord to a bar
function addChordToBar(barIndex, insertPosition = null) {
    if (!currentBars[barIndex]) return;
    
    // If no position specified, add to end
    if (insertPosition === null || insertPosition >= currentBars[barIndex].length) {
        currentBars[barIndex].push('1');
        currentParents[barIndex].push('1');
        isSubstituted[barIndex].push(false);
    } else {
        // Insert at specific position
        currentBars[barIndex].splice(insertPosition, 0, '1');
        currentParents[barIndex].splice(insertPosition, 0, '1');
        isSubstituted[barIndex].splice(insertPosition, 0, false);
    }
    
    // Rebuild display
    const phrases = [currentBars];
    updateChordGrid(phrases);
    checkAndShowMusicExamples();
}

// Remove a chord from a bar
function removeChordFromBar(barIndex, chordIndex) {
    if (!currentBars[barIndex] || currentBars[barIndex].length <= 1) return;
    
    currentBars[barIndex].splice(chordIndex, 1);
    currentParents[barIndex].splice(chordIndex, 1);
    isSubstituted[barIndex].splice(chordIndex, 1);
    
    // Rebuild display
    const phrases = [currentBars];
    updateChordGrid(phrases);
    checkAndShowMusicExamples();
}

// Show chord selector dropdown with all available chords
function showChordSelector(chordWrapper, barIndex, chordIndex, currentDegree) {
    // Remove any existing selectors
    document.querySelectorAll('.chord-selector').forEach(el => el.remove());
    
    // Hide the add/remove indicator and set flag
    hideAddIndicator();
    chordSelectorOpen = true;
    
    if (!substitutionData) return;
    
    // Generate chord groups dynamically from systemTransfer or use defaults
    let chordGroups = [];
    
    if (substitutionData?.substitutions) {
        // Build from substitution data (diatonic degrees and their substitutions)
        const degreesSet = new Set();
        
        // Add all diatonic degrees
        Object.keys(substitutionData.substitutions).forEach(deg => degreesSet.add(deg.match(/^[b#]?[1-7]/)?.[0]));
        
        // Add common chromatic alterations
        Object.values(substitutionData.substitutions).forEach(subs => {
            [...(subs.modal || []), ...(subs.tritone || [])].forEach(sub => {
                const deg = sub.match(/^[b#]?[1-7]/)?.[0];
                if (deg) degreesSet.add(deg);
            });
        });
        
        // Sort degrees: 1, b2, 2, b3, 3, 4, #4, 5, b6, 6, b7, 7
        const degreeOrder = ['1', 'b2', '2', 'b3', '3', '4', '#4', '5', 'b6', '6', 'b7', '7'];
        const sortedDegrees = degreeOrder.filter(d => degreesSet.has(d));
        
        // Generate types for each degree (major, minor, diminished)
        chordGroups = sortedDegrees.map(degree => ({
            degree,
            types: [degree, degree + 'm', degree + 'o'].filter(type => {
                // Filter out uncommon combinations like "4o" unless they exist in data
                if (degree === '4' && type.endsWith('o')) return false;
                return true;
            })
        }));
    }
    
    // Fallback to hardcoded groups if no substitution data
    if (chordGroups.length === 0) {
        chordGroups = [
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
    }
    
    const chordSelector = document.createElement('div');
    chordSelector.className = 'chord-selector';
    
    const degreeList = document.createElement('div');
    degreeList.className = 'degree-list';
    
    const typeList = document.createElement('div');
    typeList.className = 'type-list';
    
    // First level: show degree numbers
    chordGroups.forEach((group, index) => {
        const degreeBtn = document.createElement('button');
        degreeBtn.textContent = group.degree;
        degreeBtn.className = 'degree-btn';
        degreeBtn.onmouseenter = () => {
            showChordTypes(typeList, group.types, barIndex, chordIndex);
        };
        // Show first group's types by default
        if (index === 0) {
            degreeBtn.classList.add('active');
            showChordTypes(typeList, group.types, barIndex, chordIndex);
        }
        degreeList.appendChild(degreeBtn);
    });
    
    chordSelector.appendChild(degreeList);
    chordSelector.appendChild(typeList);
    chordWrapper.appendChild(chordSelector);
    
    // Ensure selector is visible and on top
    chordSelector.style.zIndex = '10000';
    
    // Close on click outside (immediate, no timeout)
    const closeSelector = (e) => {
        if (!chordSelector.contains(e.target) && !chordWrapper.contains(e.target)) {
            chordSelector.remove();
            chordSelectorOpen = false;
            document.removeEventListener('click', closeSelector);
        }
    };
    document.addEventListener('click', closeSelector);
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
            // Check for matching progressions and show music examples
            checkAndShowMusicExamples();
            // Remove the entire chord selector
            chordSelectorOpen = false;
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
    
    // Check for matching progressions and show music examples
    checkAndShowMusicExamples();
}

// Audio playback functionality
let audioContext = null;
let previousVoicing = null; // Track previous chord voicing for voice leading

async function playProgression() {
    try {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        // Resume audio context if suspended (browser autoplay policy)
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }
        
        if (currentBars.length === 0) return;
        
        // Reset voice leading for new progression
        previousVoicing = null;
        
        // Calculate bar duration from BPM (assuming 4/4 time)
        const barDuration = (60 / bpm) * 4; // 4 beats per bar
        let currentTime = audioContext.currentTime;
        
        currentBars.forEach((bar) => {
            const chordDuration = barDuration / bar.length;
            let barTime = currentTime;
            
            bar.forEach((degree) => {
                playChord(degree, barTime, chordDuration);
                barTime += chordDuration;
            });
            currentTime += barDuration;
        });
    } catch (error) {
        console.error('Failed to play progression:', error);
    }
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
    
    const bassFreq = getNoteFrequency(bassNote, ChordGenConfig.BASS_OCTAVE);
    
    // Get chord tones (without bass)
    // Use the main chord (without slash) for voicing
    const chordTones = getChordTones(chordGenerator.degreeToNote(selectedKey, mainChord));
    
    // Apply voice leading to get smooth voicing
    const voicing = getClosestVoicing(chordTones, previousVoicing);
    previousVoicing = voicing;
    
    // Play bass note with synthesis
    playSynthNote(bassFreq, startTime, duration, ChordGenConfig.BASS_VOLUME);
    
    // Play voiced chord
    voicing.forEach(freq => {
        playSynthNote(freq, startTime, duration, ChordGenConfig.CHORD_VOLUME);
    });
}

function playSynthNote(freq, startTime, duration, volume = ChordGenConfig.SYNTH_VOLUME) {
    try {
        if (!audioContext) return;
        
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
        
        gainNode1.gain.setValueAtTime(ChordGenConfig.HARMONIC_1_GAIN, startTime);
        gainNode2.gain.setValueAtTime(ChordGenConfig.HARMONIC_2_GAIN, startTime);
        gainNode3.gain.setValueAtTime(ChordGenConfig.HARMONIC_3_GAIN, startTime);
        
        masterGain.gain.setValueAtTime(0, startTime);
        masterGain.gain.linearRampToValueAtTime(volume, startTime + ChordGenConfig.ATTACK_TIME);
        masterGain.gain.setValueAtTime(volume, startTime + duration * ChordGenConfig.RELEASE_START);
        masterGain.gain.exponentialRampToValueAtTime(ChordGenConfig.MIN_GAIN, startTime + duration * ChordGenConfig.RELEASE_END);
        
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
    } catch (error) {
        console.warn('Failed to play synth note:', error);
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
    let alterations = []; // Track alterations like #5, b9, etc.
    
    // Extract alterations from quality (e.g., M7#5 -> #5, m7b9 -> b9)
    const alterationMatches = quality.match(/(bb|##|b|#)([1-9])/g);
    if (alterationMatches) {
        alterationMatches.forEach(alt => {
            alterations.push(alt);
        });
    }
    
    // Determine intervals based on chord quality
    // Try systemTransfer first for data-driven approach
    const systemIntervals = getChordIntervalsFromSystemTransfer(quality);
    if (systemIntervals) {
        intervals = systemIntervals;
    }
    // Fallback to hardcoded values if systemTransfer not available or quality not found
    else if (quality.includes('mM7') || quality === 'mM7') {
        intervals = [0, 3, 7, 11]; // Minor major 7th
    } else if (quality.includes('m7') || quality === 'm7') {
        intervals = [0, 3, 7, 10]; // Minor 7th
    } else if (quality.includes('maj7') || quality === 'M7' || quality === 'Δ7') {
        intervals = [0, 4, 7, 11]; // Major 7th
    } else if (quality.includes('7')) {
        intervals = [0, 4, 7, 10]; // Dominant 7th
    } else if (quality.includes('6')) {
        // Sixth chords
        if (quality.includes('m6')) {
            intervals = [0, 3, 7, 9]; // Minor sixth
        } else if (quality.includes('69')) {
            intervals = [0, 4, 7, 9, 2]; // Major sixth add nine
        } else if (quality.includes('m69')) {
            intervals = [0, 3, 7, 9, 2]; // Minor sixth add nine
        } else {
            intervals = [0, 4, 7, 9]; // Major sixth
        }
    } else if (quality.includes('ø7') || quality.includes('hdim')) {
        intervals = [0, 3, 6, 10]; // Half-diminished 7th
    } else if (quality.includes('o7')) {
        intervals = [0, 3, 6, 9]; // Fully diminished 7th (double flat 7th)
    } else if (quality.includes('dim') || quality.includes('o')) {
        intervals = [0, 3, 6]; // Diminished triad
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
    } else if (quality.includes('add') || quality.includes('(')) {
        // Handle add chords (both old "add" format and new parentheses format)
        intervals = [0, 4, 7]; // Start with major triad
        
        // NEW FORMAT: Parse parentheses notation like (9), (6), (13), (6, no3), etc.
        if (quality.includes('(')) {
            const parenMatch = quality.match(/\(([^)]+)\)/);
            if (parenMatch) {
                const content = parenMatch[1]; // e.g., "9", "6", "13", "6, no3"
                const parts = content.split(',').map(p => p.trim()); // Split by comma
                
                parts.forEach(part => {
                    // Handle additions (numbers like 9, 11, 13, 6, etc. with optional # or b)
                    if (/^(bb|##|b|#)?\d+$/.test(part)) {
                        const systemInterval = getDegreeIntervalFromSystemTransfer(part);
                        if (systemInterval !== null) {
                            if (!intervals.includes(systemInterval)) {
                                intervals.push(systemInterval);
                            }
                            return;
                        }

                        // Extract accidental (# or b) and number
                        const accidentalMatch = part.match(/^([#b])?(\d+)$/);
                        const accidental = accidentalMatch?.[1] || ''; // '#', 'b', or ''
                        const num = parseInt(accidentalMatch?.[2]);
                        let interval;
                        
                        // Convert note number to base interval
                        if (num === 2 || num === 9) interval = 2;  // 9 = 2 octave up
                        else if (num === 4 || num === 11) interval = 5; // 11 = 4 octave up
                        else if (num === 6 || num === 13) interval = 9; // 13 = 6 octave up
                        else if (num === 5) interval = 7;
                        
                        // Adjust interval based on accidental
                        if (interval !== undefined) {
                            if (accidental === '#') {
                                interval += 1; // Raise by semitone
                            } else if (accidental === 'b') {
                                interval -= 1; // Lower by semitone
                            }
                            
                            if (!intervals.includes(interval)) {
                                intervals.push(interval);
                            }
                        }
                    }
                    // Handle removals (no3, no5, etc.) - handled in final pass below
                    else if (part.includes('no')) {
                        // These will be processed by applyOmissionsToIntervals at the end
                    }
                });
            }
        }
        // OLD FORMAT: Legacy "add" notation (for backward compatibility)
        else if (quality.includes('add')) {
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
            
            // Handle removals (no3), (no5), etc. for old format - handled in final pass below
        }
        
        // Sort intervals
        intervals.sort((a, b) => a - b);
    } else {
        intervals = [0, 4, 7]; // Major
    }
    
    // Apply omissions (no3, no5, etc.) from systemTransfer - centralized final pass
    intervals = applyOmissionsToIntervals(intervals, quality);
    
    // Apply alterations extracted from quality (e.g., M7#5 -> apply #5)
    intervals = applyAlterationsToIntervals(intervals, alterations);
    
    // Convert intervals to note names
    return intervals.map(interval => {
        const noteIndex = (rootIndex + interval) % 12;
        return noteNames[noteIndex];
    });
}

function applyAlterationsToIntervals(intervals, alterations) {
    if (!alterations || alterations.length === 0) return intervals;
    
    const result = [...intervals];
    
    alterations.forEach(alt => {
        const match = alt.match(/(bb|##|b|#)?(\d+)/);
        if (!match) return;
        
        const accidental = match[1] || '';
        const degree = match[2];
        
        // Get base interval from systemTransferData.defaultDegrees
        let baseInterval = null;
        
        if (systemTransferData && systemTransferData.defaultDegrees) {
            const degreeEntry = systemTransferData.defaultDegrees.find(d => d.degree === degree);
            if (degreeEntry && typeof degreeEntry.system === 'number') {
                baseInterval = degreeEntry.system % 12;
            }
        }
        
        // Fallback if systemTransferData not available
        if (baseInterval === null) {
            const degreeIntervals = {
                '2': 2, '3': 4, '4': 5, '5': 7, '6': 9, '7': 11, '9': 14, '11': 17, '13': 21
            };
            if (degreeIntervals[degree] !== undefined) {
                baseInterval = degreeIntervals[degree] % 12;
            }
        }
        
        if (baseInterval !== null) {
            // Apply accidental adjustment
            let adjustment = getAccidentalAdjustment(accidental, systemTransferData);
            let targetInterval = (baseInterval + adjustment) % 12;
            
            // Find and replace the base interval or add if not present
            const existingIndex = result.indexOf(baseInterval);
            if (existingIndex !== -1) {
                result[existingIndex] = targetInterval;
            } else {
                result.push(targetInterval);
            }
        }
    });
    
    return result;
}

// Get all possible voicings of chord tones within range
function getAllVoicings(chordTones) {
    const voicings = [];
    const minOctave = ChordGenConfig.MIN_OCTAVE;
    const maxOctave = ChordGenConfig.MAX_OCTAVE;
    
    // Generate all combinations of octaves for each chord tone
    function generateVoicings(tones, currentVoicing, toneIndex) {
        if (toneIndex === tones.length) {
            // Check if voicing is within reasonable range
            const freqs = currentVoicing.map(v => getNoteFrequency(v.note, v.octave));
            const minFreq = Math.min(...freqs);
            const maxFreq = Math.max(...freqs);
            
            // Keep voicings within configured range
            if (maxFreq / minFreq <= ChordGenConfig.MAX_VOICING_RANGE) {
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
        // First chord - use middle voicing
        return chordTones.map(tone => getNoteFrequency(tone, ChordGenConfig.MIN_OCTAVE));
    }
    
    const allVoicings = getAllVoicings(chordTones);
    
    if (allVoicings.length === 0) {
        // Fallback
        return chordTones.map(tone => getNoteFrequency(tone, ChordGenConfig.MIN_OCTAVE));
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

// ==================== CLEANUP ====================
// Cleanup function to be called when leaving the page
function cleanupChordGenerator() {
    // Remove indicator element
    if (addIndicator) {
        addIndicator.remove();
        addIndicator = null;
    }
    
    // Cancel any pending animation frame
    if (indicatorRAF) {
        cancelAnimationFrame(indicatorRAF);
        indicatorRAF = null;
    }
    
    // Remove any tooltips created by this page
    document.querySelectorAll('.preview-disabled-tooltip, .music-tooltip').forEach(el => el.remove());
    
    // Close audio context if open
    if (audioContext && audioContext.state !== 'closed') {
        audioContext.close().catch(() => {});
        audioContext = null;
    }
    
    // Reset state
    chordSelectorOpen = false;
    previousVoicing = null;
}

// Export cleanup function for router to call
window.cleanupChordGenerator = cleanupChordGenerator;
