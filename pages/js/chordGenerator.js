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
let recentProgressionIndices = [];
let isSubstituted = [];
let isProgressionModified = false; // Track if user has manually modified the progression
let isSubstituteMode = false; // Track if substitute mode is active
let originalPhrases = null; // Store original phrases when showing song-specific chords
let currentlyPlayingSong = null; // Track currently playing song for display
let currentProgressionName = null; // Track current progression name for variation message
let currentProgressionChords = null; // Track current base chords for header display

// Helper: Mark progression as modified and stop preview
function markProgressionModified() {
    isProgressionModified = true;
    
    // Restore original chords if song-specific display was showing
    originalPhrases = null;
    currentlyPlayingSong = null;
    
    // Immediately stop any playing preview
    if (typeof window.clearBackgroundPreview === 'function') {
        window.clearBackgroundPreview();
    }
    
    // Clear auto-play timeout
    if (window.generatorMusicTimeout) {
        clearTimeout(window.generatorMusicTimeout);
        window.generatorMusicTimeout = null;
    }
    
    // Clear music list
    currentMusicList = [];
}

// Show song-specific chord progression (for songs with progressionVariation)
function showSongChords(song, progressionName) {
    try {
        if (!song || !song.progressionVariation) return false;
        
        // Store original phrases if not already stored
        if (!originalPhrases) {
            originalPhrases = getCurrentPhrases();
        }
        
        currentlyPlayingSong = song;
        
        // Convert progressionVariation to phrases format
        const songPhrases = normalizePhrases(song.progressionVariation);
        
        // Update the visual display only (not currentBars - that's the "real" progression)
        updateChordGridVisualOnly(songPhrases);
        
        // Show variation message in tooltip, keep progression name visible
        showVariationMessage(progressionName, songPhrases);
        
        return true;
    } catch (error) {
        console.error('Error in showSongChords:', error);
        return false;
    }
}

// Restore original chord progression display
function restoreSongChords() {
    if (!originalPhrases) return;
    
    currentlyPlayingSong = null;
    
    // Restore the visual display
    updateChordGridVisualOnly(originalPhrases);
    
    // Restore original progression name display
    restoreProgressionNameDisplay();
    
    originalPhrases = null;
}

// Show variation message when a progressionVariation song is playing
function showVariationMessage(progressionName, songPhrases) {
    const container = document.getElementById('progressionNameDisplay');
    if (!container) return;

    // Keep the progression name visible, but apply variation styling
    updateProgressionNameDisplay(progressionName || [], songPhrases || [], true);

    // Ensure the progression name tag has the variation class
    const tag = container.querySelector('.progression-name-tag');
    if (tag && !tag.classList.contains('variation')) {
        tag.classList.add('variation');
    }

    const mainName = progressionName && Array.isArray(progressionName)
        ? progressionName.join(' ')
        : '';

    const message = mainName
        ? `This is a variation of ${mainName}`
        : 'This is a chord variation';

    attachVariationTooltipToProgressionDisplay(message);
}

// Restore the original progression name display
function restoreProgressionNameDisplay() {
    if (currentProgressionName && currentProgressionChords) {
        updateProgressionNameDisplay(currentProgressionName, [currentProgressionChords]);
    }
    detachVariationTooltipFromProgressionDisplay();
}

function attachVariationTooltipToProgressionDisplay(message) {
    const display = document.getElementById('progressionNameDisplay');
    if (!display) return;

    display.dataset.variationTooltip = message;
    if (display.dataset.variationTooltipBound === 'true') return;
    display.dataset.variationTooltipBound = 'true';

    let tooltip = null;

    const handleMouseEnter = () => {
        const text = display.dataset.variationTooltip;
        if (!text) return;
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.className = 'progression-variation-tooltip';
            document.body.appendChild(tooltip);
        }
        tooltip.textContent = text;
        const rect = display.getBoundingClientRect();
        tooltip.style.left = rect.left + 'px';
        tooltip.style.top = (rect.bottom + 8) + 'px';
        tooltip.style.display = 'block';
    };

    const handleMouseLeave = () => {
        if (tooltip) {
            tooltip.style.display = 'none';
        }
    };

    display._variationTooltipHandlers = { handleMouseEnter, handleMouseLeave };
    display.addEventListener('mouseenter', handleMouseEnter);
    display.addEventListener('mouseleave', handleMouseLeave);
}

function detachVariationTooltipFromProgressionDisplay() {
    const display = document.getElementById('progressionNameDisplay');
    if (!display) return;

    if (display._variationTooltipHandlers) {
        const { handleMouseEnter, handleMouseLeave } = display._variationTooltipHandlers;
        display.removeEventListener('mouseenter', handleMouseEnter);
        display.removeEventListener('mouseleave', handleMouseLeave);
        display._variationTooltipHandlers = null;
    }
    delete display.dataset.variationTooltip;
    delete display.dataset.variationTooltipBound;
}

// Get current phrases from currentBars
function getCurrentPhrases() {
    // Reconstruct phrases from currentBars
    // For simplicity, treat all bars as one phrase
    return [currentBars.map(bar => Array.isArray(bar) ? bar : [bar])];
}

// Check if a single chord is diatonic in major key
// Convert formula notation (e.g., ["1", "b3", "5"]) to semitone intervals
function formulaToIntervals(formula, defaultDegrees, accidentals) {
    if (!formula || !Array.isArray(formula)) return [0, 4, 7]; // Default major triad
    
    // Build degree to semitone map from defaultDegrees
    const degreeMap = {};
    if (defaultDegrees) {
        defaultDegrees.forEach(d => {
            degreeMap[d.degree] = d.system;
        });
    }
    // Fallback defaults
    if (!degreeMap['1']) {
        Object.assign(degreeMap, { '1': 0, '2': 2, '3': 4, '4': 5, '5': 7, '6': 9, '7': 11, '9': 14, '11': 17, '13': 21 });
    }
    
    // Build accidental adjustment map
    const accidentalMap = {};
    if (accidentals) {
        accidentals.forEach(a => {
            accidentalMap[a.accidental] = a.adjustment;
        });
    }
    // Fallback defaults
    if (!accidentalMap['b']) {
        Object.assign(accidentalMap, { 'bb': -2, 'b': -1, '#': 1, '##': 2 });
    }
    
    return formula.map(note => {
        // Parse accidental and degree from note (e.g., "b3", "#5", "bb7", "1")
        const match = note.match(/^(bb|##|b|#)?(\d+)$/);
        if (!match) return 0;
        
        const accidental = match[1] || '';
        const degree = match[2];
        
        let semitone = degreeMap[degree] || 0;
        semitone += accidentalMap[accidental] || 0;
        
        return semitone;
    });
}

// Build chord intervals map from chordIntervals formulas
function buildChordIntervalsMap(chordIntervals, defaultDegrees, accidentals) {
    const map = { '': [0, 4, 7] }; // Default major triad
    
    if (!chordIntervals) return map;
    
    // Process all categories
    const categories = ['triads', 'sixths', 'sevenths', 'ninths', 'elevenths', 'thirteenths', 'suspended', 'altered', 'powerChords'];
    categories.forEach(category => {
        if (chordIntervals[category] && Array.isArray(chordIntervals[category])) {
            chordIntervals[category].forEach(chord => {
                if (chord.symbol !== undefined && chord.formula) {
                    map[chord.symbol] = formulaToIntervals(chord.formula, defaultDegrees, accidentals);
                }
            });
        }
    });
    
    return map;
}

function isChordDiatonic(chord) {
    // Get data from systemTransfer if available, otherwise use defaults
    const diatonicPitchesArray = (systemTransferData && systemTransferData.diatonicPitches) 
        ? systemTransferData.diatonicPitches 
        : [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19, 21, 23, 24, 26, 28];
    const diatonicPitches = new Set(diatonicPitchesArray);
    
    // Build degree to semitone map
    const degreeToSemitone = {};
    if (systemTransferData && systemTransferData.defaultDegrees) {
        systemTransferData.defaultDegrees.forEach(d => {
            degreeToSemitone[d.degree] = d.system;
        });
        // Add octave extensions
        degreeToSemitone['8'] = 12;
        degreeToSemitone['10'] = 16;
        degreeToSemitone['12'] = 19;
        degreeToSemitone['14'] = 23;
    } else {
        Object.assign(degreeToSemitone, { '1': 0, '2': 2, '3': 4, '4': 5, '5': 7, '6': 9, '7': 11,
            '8': 12, '9': 14, '10': 16, '11': 17, '12': 19, '13': 21, '14': 23 });
    }
    
    // Build chord intervals map from formulas, or use pre-computed map if available
    let qualityIntervals;
    if (systemTransferData && systemTransferData.chordIntervalsMap) {
        // Use pre-computed map if available (faster)
        qualityIntervals = systemTransferData.chordIntervalsMap;
    } else if (systemTransferData && systemTransferData.chordIntervals) {
        // Build from formulas
        qualityIntervals = buildChordIntervalsMap(
            systemTransferData.chordIntervals,
            systemTransferData.defaultDegrees,
            systemTransferData.accidentalsAlgorithm
        );
    } else {
        qualityIntervals = { '': [0, 4, 7], 'm': [0, 3, 7], 'o': [0, 3, 6], '7': [0, 4, 7, 10], 'M7': [0, 4, 7, 11] };
    }
    
    // Handle slash chords - parse both chord and bass note
    const slashParts = chord.split('/');
    const baseChord = slashParts[0];
    const bassNote = slashParts[1] || null; // e.g., "7" in "5/7"
    
    // Extract degree with possible alteration and quality
    // Degree is only 1-7 (single digit), everything after is quality
    const degreeMatch = baseChord.match(/^([b#]?)([1-7])(.*)/);
    if (!degreeMatch) return true;
    
    const alteration = degreeMatch[1];
    const degreeNum = degreeMatch[2];
    const quality = degreeMatch[3];
    
    // Get root pitch from degree
    let rootPitch = degreeToSemitone[degreeNum];
    if (rootPitch === undefined) return true; // Unknown degree
    
    // Apply alteration to root
    if (alteration === 'b') rootPitch -= 1;
    if (alteration === '#') rootPitch += 1;
    
    // Get intervals for this quality (default to major triad if unknown)
    const intervals = qualityIntervals[quality] || [0, 4, 7];
    
    // Check all pitches in the chord (root + each interval)
    for (const interval of intervals) {
        const absolutePitch = rootPitch + interval;
        // Normalize to within our diatonic set range (0-28)
        const normalizedPitch = absolutePitch % 24;
        if (!diatonicPitches.has(normalizedPitch)) {
            return false; // This note is not in major scale
        }
    }
    
    // Check bass note if it's a slash chord
    if (bassNote) {
        const bassMatch = bassNote.match(/^([b#]?)(\d+)/);
        if (bassMatch) {
            const bassAlteration = bassMatch[1];
            const bassDegreeNum = bassMatch[2];
            let bassPitch = degreeToSemitone[bassDegreeNum];
            if (bassPitch !== undefined) {
                if (bassAlteration === 'b') bassPitch -= 1;
                if (bassAlteration === '#') bassPitch += 1;
                const normalizedBassPitch = bassPitch % 24;
                if (!diatonicPitches.has(normalizedBassPitch)) {
                    return false; // Bass note is not diatonic
                }
            }
        }
    }
    
    return true; // All notes are diatonic
}

// Visual-only update of chord grid (doesn't affect currentBars)
function updateChordGridVisualOnly(phrases) {
    const display = document.getElementById('progressionDisplay');
    if (!display) return;

    display.innerHTML = '';

    const displayPhrases = (phrases || []).map(phrase => ({ bars: phrase }));

    displayPhrases.forEach(phraseData => {
        const phraseContainer = document.createElement('div');
        phraseContainer.className = 'phrase-container';
        phraseContainer.classList.add('song-specific-display'); // Mark as visual-only

        phraseData.bars.forEach(bar => {
            const barDiv = document.createElement('div');
            barDiv.className = 'progression-bar';
            if (bar.length > 1) barDiv.classList.add('multi-chord');
            
            // Disable interactions for song-specific display
            barDiv.style.pointerEvents = 'none';

            bar.forEach(degree => {
                const chordWrapper = document.createElement('div');
                chordWrapper.className = 'chord-wrapper';

                const chordDiv = document.createElement('div');
                chordDiv.className = 'chord-item';
                // Add substituted class for non-diatonic chords (salmon color)
                if (!isChordDiatonic(degree)) {
                    chordDiv.classList.add('substituted');
                }
                const displayText = showDegrees ? degree : chordGenerator.degreeToNote(selectedKey, degree);
                chordDiv.textContent = displayText;

                chordWrapper.appendChild(chordDiv);
                barDiv.appendChild(chordWrapper);
            });

            phraseContainer.appendChild(barDiv);
        });

        display.appendChild(phraseContainer);
    });
    
    // Always reserve space for 2 phrases to prevent layout shift
    if (displayPhrases.length < 2) {
        const barsPerPhrase = (displayPhrases[0] && displayPhrases[0].bars && displayPhrases[0].bars.length) || 4;
        const reservedPhrase = document.createElement('div');
        reservedPhrase.className = 'phrase-container phrase-reserved song-specific-display';
        
        for (let i = 0; i < barsPerPhrase; i++) {
            const barDiv = document.createElement('div');
            barDiv.className = 'progression-bar';
            
            const chordWrapper = document.createElement('div');
            chordWrapper.className = 'chord-wrapper';
            
            const chordDiv = document.createElement('div');
            chordDiv.className = 'chord-item';
            chordDiv.textContent = '\u00A0';
            
            chordWrapper.appendChild(chordDiv);
            barDiv.appendChild(chordWrapper);
            reservedPhrase.appendChild(barDiv);
        }
        
        display.appendChild(reservedPhrase);
    }
}

// Normalize chord data to phrases format
// phrases = [[bar, bar, bar], [bar, bar, bar]] where bar = [chord, chord, ...]
function normalizePhrases(chords) {
    if (!chords || !Array.isArray(chords)) return [[["1"]]];
    
    // Check if first element is an array
    if (chords.length > 0 && Array.isArray(chords[0])) {
        // Check if first element of first element is also an array (fully nested phrases format)
        // e.g., [[["4"], ["5"]], [["3m"], ["6m"]]] - 2 phrases, each with 2 bars
        if (chords[0].length > 0 && Array.isArray(chords[0][0])) {
            return chords;
        }
        
        // Check if inner arrays contain only strings (bars format, not phrases)
        // e.g., [["4M7"], ["4/5"], ["3m7"], ["6m7", "b6m7"]] - 1 phrase with 4 bars
        const allInnerAreStringArrays = chords.every(item => 
            Array.isArray(item) && item.every(el => typeof el === 'string')
        );
        
        if (allInnerAreStringArrays) {
            // This is bars format - wrap in single phrase
            return [chords];
        }
        
        // It's progressionVariation format: [["4", "5", "3m", "6m"], ["4", "5", "1", "1"]]
        // Each inner array is a phrase, each string is a single-chord bar
        return chords.map(phrase => {
            if (Array.isArray(phrase)) {
                return phrase.map(chord => Array.isArray(chord) ? chord : [chord]);
            }
            return [[phrase]];
        });
    }
    
    // Simple/mixed array of chords: ["6m", "4", "5", ["1", "5/7"]]
    // Some elements are strings (single chord bar), some are arrays (multi-chord bar)
    // Convert to single phrase with proper bar format
    return [chords.map(c => Array.isArray(c) ? c : [c])];
}

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
                    if (prog.progression && Array.isArray(prog.progression)) {
                        // Check if this is a phrase structure (array of arrays of arrays)
                        const isPhrasedProgression = prog.progression.length > 0 && 
                            Array.isArray(prog.progression[0]) && 
                            prog.progression[0].length > 0 && 
                            Array.isArray(prog.progression[0][0]);
                        
                        if (isPhrasedProgression) {
                            // Multi-phrase format: [[["1"], ["4"]], [[["5"], ["6m"]]]]
                            // Already in phrase format
                            allProgressions.push({ phrases: prog.progression, music: prog.music || [], progressionName: prog.progressionName || null });
                        } else {
                            // Single phrase format
                            // Could be: ["1", "4", "5"] or [["1", "5m"], ["4"], ["5"]]
                            const bars = prog.progression.map(bar => Array.isArray(bar) ? bar : [bar]);
                            allProgressions.push({ phrases: [bars], music: prog.music || [], progressionName: prog.progressionName || null });
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
        
        // Add keyboard shortcut for refresh (R key)
        setupChordGeneratorKeyboardShortcuts();
    } catch (error) {
        console.error('Failed to initialize chord generator:', error);
        const container = document.querySelector('#chordGeneratorPage .generator-container');
        if (container) {
            container.innerHTML = `<p style="color:#ff6b6b; text-align:center;">Failed to load chord data. ${error.message}</p>`;
        }
    }
}

// Keyboard shortcuts for chord generator
function setupChordGeneratorKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Only trigger if chord generator page is visible
        const page = document.getElementById('chordGeneratorPage');
        if (!page || page.style.display === 'none') return;
        
        // Don't trigger if user is typing in an input/select
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
        
        // R key for refresh
        if (e.key === 'r' || e.key === 'R') {
            e.preventDefault();
            refreshChords();
        }
    });
}

// Render the chord generator page content
function renderChordGeneratorPage() {
    const container = document.querySelector('#chordGeneratorPage .generator-container');
    if (!container) return;

    container.innerHTML = `
        <div class="key-selector">
            <div style="display: flex; gap: 0.5rem; align-items: center;">
                <div class="controls-left">
                    <button class="icon-btn" title="Mouse Selection" style="opacity: 0.6;">🖱️</button>
                    <button class="icon-btn" title="Chord Substitute" onclick="toggleSubstituteMode()" style="opacity: 0.6;">🔀</button>
                </div>
                <div class="left-spacer" id="progressionNameDisplay"></div>
            </div>
            <button class="refresh-btn" onclick="refreshChords()" title="Refresh progression (R)">🔄 Refresh</button>
            <div class="controls-right">
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
        <div id="generatorMusicContainer" class="generator-music-container">
            <div id="generatorMusic" class="generator-music"></div>
        </div>
    `;
    
    // Setup tooltip on preview button
    window.setupPreviewButtonTooltip();
}

// Change key handler
function changeKey(key) {
    selectedKey = key;
    refreshChords(); // Re-render current progression with new key
}

// Toggle chord substitute mode
window.toggleSubstituteMode = function() {
    isSubstituteMode = !isSubstituteMode;
    const btn = document.querySelector('.icon-btn[title="Chord Substitute"]');
    const display = document.getElementById('progressionDisplay');
    
    if (btn) {
        if (isSubstituteMode) {
            btn.style.opacity = '1';
            btn.style.background = 'rgba(255, 200, 100, 0.3)';
            btn.style.borderColor = 'rgba(255, 200, 100, 0.6)';
        } else {
            btn.style.opacity = '0.6';
            btn.style.background = 'rgba(255, 255, 255, 0.1)';
            btn.style.borderColor = 'rgba(255, 255, 255, 0.2)';
        }
    }
    
    // Update cursor on progression display
    if (display) {
        display.style.cursor = isSubstituteMode ? 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\'><text x=\'0\' y=\'20\' font-size=\'20\'>🔀</text></svg>"), auto' : 'default';
    }
    
    // Hide indicator when switching modes
    hideAddIndicator();
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

    // Stop any playing preview and clear auto-play timeout on refresh
    if (typeof window.clearBackgroundPreview === 'function') {
        window.clearBackgroundPreview();
    }
    if (window.generatorMusicTimeout) {
        clearTimeout(window.generatorMusicTimeout);
        window.generatorMusicTimeout = null;
    }

    let randomIndex;
    const maxHistory = 10;
    const recentSet = new Set(recentProgressionIndices);
    
    // If history is larger than available progressions, trim it
    if (recentProgressionIndices.length > maxHistory) {
        recentProgressionIndices = recentProgressionIndices.slice(-maxHistory);
    }
    
    if (allProgressions.length <= 1) {
        randomIndex = 0;
    } else {
        // Try to pick a progression not in recent history
        let attempts = 0;
        do {
            randomIndex = Math.floor(Math.random() * allProgressions.length);
            attempts += 1;
        } while (recentSet.has(randomIndex) && attempts < 50);
        
        // Fallback: if all are in history, allow any except immediate last
        if (recentSet.has(randomIndex) && allProgressions.length > 1) {
            do {
                randomIndex = Math.floor(Math.random() * allProgressions.length);
            } while (randomIndex === lastProgressionIndex);
        }
    }
    
    lastProgressionIndex = randomIndex;
    recentProgressionIndices.push(randomIndex);
    if (recentProgressionIndices.length > maxHistory) {
        recentProgressionIndices = recentProgressionIndices.slice(-maxHistory);
    }
    const randomProgression = allProgressions[randomIndex];
    
    // Reset modification flag when loading a new progression
    isProgressionModified = false;
    
    // Flatten phrases into bars and keep track of phrase structure
    currentBars = [];
    currentParents = [];
    isSubstituted = [];
    
    randomProgression.phrases.forEach(phrase => {
        phrase.forEach(bar => {
            currentBars.push(bar);
            const parents = bar.map(chord => getDiatonicParent(chord));
            currentParents.push(parents);
            // Mark as substituted if chord is not diatonic (uses isChordDiatonic for proper pitch checking)
            isSubstituted.push(bar.map(chord => !isChordDiatonic(chord)));
        });
    });
    
    // Store current progression info for variation messages
    currentProgressionName = randomProgression.progressionName;
    currentProgressionChords = randomProgression.phrases;
    
    // Update chord header with base progression chords
    updateChordHeader(randomProgression.phrases);
    
    updateChordGrid(randomProgression.phrases);
    renderGeneratorMusic(randomProgression.music || [], randomProgression.progressionName);
    updateProgressionNameDisplay(randomProgression.progressionName, randomProgression.phrases);
}

// Check if a chord progression is fully diatonic
function isProgressionDiatonic(phrases) {
    if (!phrases || !Array.isArray(phrases)) return true;
    
    // Flatten all chords from phrases
    const allChords = phrases.flat(Infinity).filter(c => c && typeof c === 'string');
    
    // Diatonic degrees (without alterations)
    const diatonicDegrees = ['1', '2', '3', '4', '5', '6', '7'];
    
    // Expected qualities for diatonic chords in major key
    // 1=major, 2=minor, 3=minor, 4=major, 5=major, 6=minor, 7=diminished
    const diatonicQualities = {
        '1': ['', 'M7', 'M9', '6', '(6)', '(no3)', '(6, no3)', '+', 'sus', 'sus4', 'sus2', '7', '(9)'],
        '2': ['m', 'm7', 'm9', 'ø', 'ø7'],
        '3': ['m', 'm7', 'm9', 'sus', 'sus4'],
        '4': ['', 'M7', 'M9', '(9)', 'sus'],
        '5': ['', '7', '9', 'sus', 'sus4', 'm7'],
        '6': ['m', 'm7', 'm9', '', '7'],
        '7': ['o', 'ø', 'ø7', 'o7', 'm7']
    };
    
    for (const chord of allChords) {
        // Handle slash chords - take only the part before the slash for main analysis
        const baseChord = chord.split('/')[0];
        
        // Extract degree and quality
        const degreeMatch = baseChord.match(/^([b#]?[1-7])/);
        if (!degreeMatch) continue;
        
        const degree = degreeMatch[1];
        const quality = baseChord.slice(degree.length);
        
        // Check if degree has chromatic alteration (b or #)
        if (degree.startsWith('b') || degree.startsWith('#')) {
            return false; // Non-diatonic due to chromatic alteration
        }
        
        // Check if quality is diatonic for this degree
        const allowedQualities = diatonicQualities[degree];
        if (allowedQualities) {
            // For degree 4, check if it's minor (4m, 4m7, etc.) - that's non-diatonic
            if (degree === '4' && quality.startsWith('m')) {
                return false;
            }
            // For degree 5, 5m is diatonic (Mixolydian borrowing common), but let's be strict
            if (degree === '5' && quality.startsWith('m') && !quality.startsWith('m7')) {
                // 5m without 7 is non-diatonic modal interchange
                return false;
            }
            // For degree 2, if it's major (2, 27) it's non-diatonic (secondary dominant)
            if (degree === '2' && !quality.startsWith('m') && !quality.startsWith('ø')) {
                return false;
            }
            // For degree 3, if it's major (3, 37) it's non-diatonic (secondary dominant)
            if (degree === '3' && !quality.startsWith('m') && !quality.startsWith('sus') && quality !== '') {
                // 37, 3 alone with extensions that imply major
                if (quality.match(/^7|^9|^M/)) {
                    return false;
                }
            }
            if (degree === '3' && quality === '') {
                return false; // 3 major is non-diatonic
            }
            // For degree 6, if it's major (6, 67) it could be non-diatonic
            if (degree === '6' && !quality.startsWith('m') && quality !== '' && quality !== '7') {
                return false;
            }
        }
    }
    
    return true;
}

// Update the page title (h1) to show base chords like "4 - 5 - 3m - 6m"
function updateChordHeader(phrases) {
    const pageTitle = document.getElementById('pageTitle');
    if (!pageTitle) return;
    
    if (!phrases || !Array.isArray(phrases) || phrases.length === 0) {
        pageTitle.textContent = 'Chord Generator';
        return;
    }
    
    // Flatten phrases to get first chord from each bar
    const baseChords = [];
    phrases.forEach(phrase => {
        phrase.forEach(bar => {
            if (Array.isArray(bar) && bar.length > 0) {
                // Get just the first chord of each bar for the header
                baseChords.push(bar[0]);
            }
        });
    });
    
    const headerText = baseChords.join(' - ');
    pageTitle.textContent = headerText;
}

// Update the progression name display
// forceVariation: true when showing a song's progressionVariation
function updateProgressionNameDisplay(progressionName, phrases, forceVariation = false) {
    const container = document.getElementById('progressionNameDisplay');
    if (!container) return;
    
    if (!progressionName || !Array.isArray(progressionName) || progressionName.length === 0) {
        container.innerHTML = '';
        return;
    }
    
    const displayName = progressionName.join(' ');
    
    // Progression name shows as variation ONLY when a song with progressionVariation is playing
    const isVariation = forceVariation;
    
    if (isVariation) {
        container.innerHTML = `<span class="progression-name-tag variation" data-tooltip="This is a variation of ${escapeHtml(displayName)}">${escapeHtml(displayName)}</span>`;
    } else {
        container.innerHTML = `<span class="progression-name-tag">${escapeHtml(displayName)}</span>`;
    }
    
    // Setup hover tooltip for variation progressions
    if (isVariation) {
        const tag = container.querySelector('.progression-name-tag.variation');
        if (tag) {
            let tooltip = null;
            
            tag.addEventListener('mouseenter', function(e) {
                const tooltipText = tag.dataset.tooltip;
                if (!tooltip) {
                    tooltip = document.createElement('div');
                    tooltip.className = 'progression-variation-tooltip';
                    tooltip.textContent = tooltipText;
                    document.body.appendChild(tooltip);
                }
                
                const rect = tag.getBoundingClientRect();
                tooltip.style.left = rect.left + 'px';
                tooltip.style.top = (rect.bottom + 8) + 'px';
                tooltip.style.display = 'block';
            });
            
            tag.addEventListener('mouseleave', function() {
                if (tooltip) {
                    tooltip.style.display = 'none';
                }
            });
        }
    }
}

// Check if current progression matches any in the database and show music examples
function checkAndShowMusicExamples() {
    // Always keep header in sync with current bars (including manual edits)
    if (currentBars && currentBars.length > 0) {
        updateChordHeader([currentBars]);
    }
    
    if (!allProgressions || allProgressions.length === 0) {
        renderGeneratorMusic([]);
        return;
    }

    // Flatten currentBars into a single array for comparison
    const currentChords = currentBars.flat(Infinity).filter(c => c && typeof c === 'string');
    
    // Search through all progressions for a match
    let matchedMusic = [];
    let matchedProgressionName = null;
    let matchedPhrases = null;
    
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
                matchedMusic = prog.music || [];
                matchedProgressionName = prog.progressionName || null;
                matchedPhrases = prog.phrases || null;
                break;
            }
        }
    }

    if (matchedPhrases && matchedMusic.length > 0) {
        currentProgressionName = matchedProgressionName;
        currentProgressionChords = matchedPhrases;
        updateProgressionNameDisplay(matchedProgressionName, matchedPhrases);
        renderGeneratorMusic(matchedMusic, matchedProgressionName);
    } else {
        // No match: clear labels and music list
        renderGeneratorMusic([]);
        updateProgressionNameDisplay([], []);

        // Stop any playing preview and clear auto-play timeout
        if (typeof window.clearBackgroundPreview === 'function') {
            window.clearBackgroundPreview();
        }
        if (window.generatorMusicTimeout) {
            clearTimeout(window.generatorMusicTimeout);
        }
    }
}

// Store current music list globally for auto-play
let currentMusicList = [];
let currentMusicProgressionName = null; // Store progression name for variation messages
let autoPlayQueue = [];
let autoPlayQueueKey = '';

function renderGeneratorMusic(musicList, progressionName) {
    const container = document.getElementById('generatorMusic');
    if (!container) return;

    // Store progression name for progressionVariation messages
    currentMusicProgressionName = progressionName;

    if (!Array.isArray(musicList) || musicList.length === 0) {
        container.innerHTML = '<p class="detail-line" style="color: #888;">No music examples yet.</p>';
        currentMusicList = [];
        return;
    }

    // Store the music list for auto-play
    currentMusicList = musicList.filter(song => song && song.youtubeId);
    autoPlayQueueKey = buildMusicListKey(currentMusicList);
    autoPlayQueue = buildShuffledQueue(currentMusicList.length);

    const artistMap = new Map();
    musicList.forEach((song, songIndex) => {
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
        const hasProgressionVariation = song.progressionVariation ? 'true' : 'false';
        if (!artistDisplay && !title) return;
        const key = artistDisplay || 'Unknown Artist';
        if (!artistMap.has(key)) artistMap.set(key, []);
        if (title) {
            artistMap.get(key).push({ title, part, youtubeId, clipStart, songIndex, hasProgressionVariation });
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
            const key = `${item.title}::${item.youtubeId || ''}`;
            if (seen.has(key)) return;
            seen.add(key);

            const safeTitle = escapeHtml(item.title);
            if (!item.youtubeId) {
                titleLinks.push(safeTitle);
                return;
            }
            
            const iframeUrl = buildYoutubeEmbedUrl(item.youtubeId, item.clipStart || 0, false);
            const tooltipId = `tooltip-${Math.random().toString(36).substr(2, 9)}`;
            
            // Create link with separate tooltip in document (include songIndex for progressionVariation lookup)
            titleLinks.push(`<a class="music-link" data-tooltip="${tooltipId}" data-video-id="${item.youtubeId}" data-start="${item.clipStart || 0}" data-song-index="${item.songIndex}" data-has-progression-variation="${item.hasProgressionVariation}">${safeTitle}</a>`);
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
    
    // Auto-start a random music preview
    autoPlayRandomMusic();
}

function setupGeneratorMusicHoverHandlers(container) {
    if (!container || container.dataset.musicHoverBound === 'true') return;
    container.dataset.musicHoverBound = 'true';

    let currentVideoId = null;
    let disabledTooltip = null;

    const handleMouseOver = (event) => {
        const link = event.target.closest('.music-link');
        if (!link || !container.contains(link)) return;

        // Stop auto-play immediately when manually hovering
        window.isManuallyHovering = true;
        if (window.generatorMusicTimeout) {
            clearTimeout(window.generatorMusicTimeout);
            window.generatorMusicTimeout = null;
        }

        const videoId = link.dataset.videoId;
        const clipStart = link.dataset.start || '0';
        const songIndex = parseInt(link.dataset.songIndex);
        const hasProgressionVariation = link.dataset.hasProgressionVariation === 'true';

        // Show song-specific chords on hover (regardless of preview setting)
        if (hasProgressionVariation && !isNaN(songIndex) && currentMusicList && currentMusicList[songIndex]) {
            try {
                showSongChords(currentMusicList[songIndex], currentMusicProgressionName);
            } catch (error) {
                console.error('Error showing song chords:', error);
            }
        }

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

        if (typeof window.setBackgroundPreview === 'function') {
            window.setBackgroundPreview(videoId, clipStart);
            currentVideoId = videoId;
        }
    };

    const handleMouseOut = (event) => {
        const link = event.target.closest('.music-link');
        // Only handle if we're actually leaving a music link
        if (!link) return;
        
        // No longer manually hovering
        window.isManuallyHovering = false;
        
        // Hide tooltip on mouseout
        if (disabledTooltip) {
            disabledTooltip.style.display = 'none';
        }
        
        // Restore original chords if a song-specific display was shown
        restoreSongChords();
        
        // Only clear video preview and resume auto-play if preview is enabled
        if (window.generatorPreviewEnabled !== true) return;
        
        // Clear video preview when not hovering
        if (typeof window.clearBackgroundPreview === 'function') {
            window.clearBackgroundPreview();
        }
        
        // Resume auto-play after hover ends
        setTimeout(() => autoPlayRandomMusic(), 1000);
    };

    container.addEventListener('mouseover', handleMouseOver, { passive: true });
    container.addEventListener('mouseout', handleMouseOut, { passive: true });

    container._musicHoverHandlers = { handleMouseOver, handleMouseOut };
}

function buildYoutubeEmbedUrl(videoId, clipStart = 0, autoplay = false) {
    if (!videoId) return '';
    const autoplayParam = autoplay ? '1' : '0';
    return `https://www.youtube.com/embed/${videoId}?start=${clipStart}&autoplay=${autoplayParam}`;
}

// Auto-play a random music from the current list
function autoPlayRandomMusic() {
    if (!currentMusicList || currentMusicList.length === 0) return;
    if (window.generatorPreviewEnabled !== true) return;
    // Don't auto-play if user is manually hovering over a song
    if (window.isManuallyHovering) return;
    
    try {
        const currentKey = buildMusicListKey(currentMusicList);
        if (currentKey !== autoPlayQueueKey) {
            autoPlayQueueKey = currentKey;
            autoPlayQueue = buildShuffledQueue(currentMusicList.length);
        }
        if (autoPlayQueue.length === 0) {
            autoPlayQueue = buildShuffledQueue(currentMusicList.length);
        }
        const nextIndex = autoPlayQueue.shift();
        const randomSong = currentMusicList[nextIndex];
        if (!randomSong) return;
        
        const clipStart = randomSong.clipStart || 0;
        const clipDuration = 15;
        
        // Show song-specific chords if available
        if (randomSong.progressionVariation) {
            showSongChords(randomSong, currentMusicProgressionName);
        } else {
            // Restore original chords if previous song had custom chords
            restoreSongChords();
        }
        
        if (typeof window.setBackgroundPreview === 'function') {
            window.setBackgroundPreview(randomSong.youtubeId, clipStart);
            
            // Schedule next random music after clip duration
            if (window.generatorMusicTimeout) {
                clearTimeout(window.generatorMusicTimeout);
            }
            window.generatorMusicTimeout = setTimeout(() => {
                autoPlayRandomMusic();
            }, clipDuration * 1000);
        }
    } catch (error) {
        console.error('Error in autoPlayRandomMusic:', error);
    }
}

function buildMusicListKey(list) {
    return (list || [])
        .map(song => `${song.youtubeId || ''}:${song.clipStart || 0}`)
        .join('|');
}

function buildShuffledQueue(length) {
    const indices = Array.from({ length }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    return indices;
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
                if (isSubstituteMode) return; // Don't show + indicator in substitute mode
                
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
                chordDiv.title = 'Click: remove/substitute | Right-click: change chord';
                
                // Show - indicator when hovering over chord (only when not in substitute mode)
                chordDiv.onmouseenter = () => {
                    if (!isSubstituteMode) {
                        // Get chord position for indicator
                        const rect = chordDiv.getBoundingClientRect();
                        showRemoveIndicator(rect.right + 8, rect.top + rect.height / 2);
                    }
                };
                
                chordDiv.onmousemove = (e) => {
                    if (!isSubstituteMode) {
                        showRemoveIndicator(e.clientX, e.clientY);
                    }
                };
                
                chordDiv.onmouseleave = () => {
                    hideAddIndicator();
                };
                
                // Single click - substitute if in substitute mode, otherwise remove
                chordDiv.onclick = (e) => {
                    e.stopPropagation();
                    if (isSubstituteMode) {
                        replaceWithSubstitute(barIndex, chordIndex, degree);
                    } else {
                        removeChordFromBar(barIndex, chordIndex);
                    }
                };
                
                // Right-click to open chord selector
                chordDiv.oncontextmenu = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    showChordSelector(chordWrapper, barIndex, chordIndex, degree);
                };

                chordWrapper.appendChild(chordDiv);
                barDiv.appendChild(chordWrapper);
            });

            phraseContainer.appendChild(barDiv);
        });

        display.appendChild(phraseContainer);
    });

    // Always reserve space for a second phrase row to prevent layout shift
    // when hovering songs with 2 phrases
    if (phrases.length < 2) {
        const barsPerPhrase = (phrases[0] && phrases[0].length) || 4;
        const reservedPhrase = document.createElement('div');
        reservedPhrase.className = 'phrase-container phrase-reserved';
        
        for (let i = 0; i < barsPerPhrase; i++) {
            const barDiv = document.createElement('div');
            barDiv.className = 'progression-bar';
            
            const chordWrapper = document.createElement('div');
            chordWrapper.className = 'chord-wrapper';
            
            const chordDiv = document.createElement('div');
            chordDiv.className = 'chord-item';
            chordDiv.textContent = '\u00A0'; // Non-breaking space for height
            
            chordWrapper.appendChild(chordDiv);
            barDiv.appendChild(chordWrapper);
            reservedPhrase.appendChild(barDiv);
        }
        
        display.appendChild(reservedPhrase);
    }
}

// Add a new chord to a bar
function addChordToBar(barIndex, insertPosition = null) {
    if (!currentBars[barIndex]) return;
    
    // Mark as modified and stop preview
    markProgressionModified();
    
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
    
    // Mark as modified and stop preview
    markProgressionModified();
    
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
            // Mark as modified and stop preview
            markProgressionModified();
            
            currentBars[barIndex][chordIndex] = degree;
            // Update parent if user manually selects a new diatonic chord
            const newParent = getDiatonicParent(degree);
            currentParents[barIndex][chordIndex] = newParent;
            // Mark as substituted if chord is not diatonic
            isSubstituted[barIndex][chordIndex] = !isChordDiatonic(degree);
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
    
    // Mark as modified and stop preview
    markProgressionModified();
    
    currentBars[barIndex][chordIndex] = newDegree;
    
    // Mark as substituted if chord is not diatonic
    isSubstituted[barIndex][chordIndex] = !isChordDiatonic(newDegree);
    
    // Rebuild phrases from currentBars for display
    const phrases = [currentBars];
    updateChordGrid(phrases);
    
    // Check for matching progressions and show music examples
    checkAndShowMusicExamples();
}

// ==================== CLEANUP ====================
// Cleanup function to be called when leaving the page
function cleanupChordGenerator() {
    // Clear any pending music auto-play timeout
    if (window.generatorMusicTimeout) {
        clearTimeout(window.generatorMusicTimeout);
        window.generatorMusicTimeout = null;
    }
    
    // Clear background preview
    if (typeof window.clearBackgroundPreview === 'function') {
        window.clearBackgroundPreview();
    }
    
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
    
    // Reset state
    chordSelectorOpen = false;
}

// Export cleanup function for router to call
window.cleanupChordGenerator = cleanupChordGenerator;
