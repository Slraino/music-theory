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
let progressionPickCounts = new Map(); // Track pick count for weighted random
let progressionGeneration = 0; // Track refresh generation to prevent stale auto-play
let isSubstituted = [];
let isProgressionModified = false; // Track if user has manually modified the progression
let isSubstituteMode = false; // Track if substitute mode is active
let originalPhrases = null; // Store original phrases when showing song-specific chords
let currentlyPlayingSong = null; // Track currently playing song for display
let currentProgressionName = null; // Track current progression name for variation message
let currentProgressionChords = null; // Track current base chords for header display
let currentPhraseView = 0; // 0 = phrases 1-2, 1 = phrases 3-4
let allCurrentPhrases = []; // Store all phrases (up to 4) for navigation
let autoPlayMode = 'progression'; // 'progression' = play songs matching current progression, 'music' = random from all

function rebuildProgressionFromPhrases(phrases) {
    currentBars = [];
    currentParents = [];
    isSubstituted = [];

    phrases.forEach(phrase => {
        phrase.forEach(bar => {
            currentBars.push(bar);
            const parents = bar.map(chord => getDiatonicParent(chord));
            currentParents.push(parents);
            isSubstituted.push(bar.map(chord => !isChordDiatonic(chord)));
        });
    });
}

// Rebuild allCurrentPhrases from currentBars
function rebuildPhrasesFromBars() {
    const barsPerPhrase = (allCurrentPhrases[0]?.length) || 4;
    const numPhrases = Math.ceil(currentBars.length / barsPerPhrase);
    allCurrentPhrases = [];
    
    for (let p = 0; p < numPhrases; p++) {
        const phraseStart = p * barsPerPhrase;
        const phraseEnd = phraseStart + barsPerPhrase;
        const phrase = currentBars.slice(phraseStart, phraseEnd);
        if (phrase.length > 0) {
            allCurrentPhrases.push(phrase);
        }
    }
}

function createPlaceholderPhrase(barsPerPhrase, onAdd) {
    const placeholderPhrase = document.createElement('div');
    placeholderPhrase.className = 'phrase-container phrase-placeholder';

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
        placeholderPhrase.appendChild(barDiv);
    }

    const addIcon = document.createElement('div');
    addIcon.className = 'phrase-placeholder-icon';
    addIcon.innerHTML = '+';
    addIcon.title = 'Click to add phrase';

    placeholderPhrase.appendChild(addIcon);
    
    // Make entire placeholder clickable to add phrase
    if (typeof onAdd === 'function') {
        placeholderPhrase.onclick = (e) => {
            onAdd();
        };
        placeholderPhrase.style.cursor = 'pointer';
    }
    
    return placeholderPhrase;
}

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
        
        // Check if the first phrase of the variation matches the base progression's first phrase
        // If so, skip the variation tooltip since it's essentially the same
        const baseFirstPhrase = allCurrentPhrases[0];
        const varFirstPhrase = songPhrases[0];
        const firstPhraseMatches = baseFirstPhrase && varFirstPhrase &&
            baseFirstPhrase.length === varFirstPhrase.length &&
            baseFirstPhrase.every((bar, i) => {
                const varBar = varFirstPhrase[i];
                if (!Array.isArray(bar) || !Array.isArray(varBar)) return String(bar) === String(varBar);
                return bar.length === varBar.length && bar.every((ch, j) => String(ch) === String(varBar[j]));
            });
        
        if (!firstPhraseMatches) {
            // Show variation message - use song's own progressionName if it has one
            showVariationMessage(progressionName, songPhrases, song);
        }
        
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
    
    // Clear visual-only phrase state
    visualOnlyPhrases = [];
    visualOnlyPhraseView = 0;
    
    // Restore the visual display with full interactivity
    // Use allCurrentPhrases which preserves the phrase structure
    const viewPhrases = allCurrentPhrases.slice(currentPhraseView * 2, currentPhraseView * 2 + 2);
    updateChordGrid(viewPhrases);
    
    // Restore original progression name display
    restoreProgressionNameDisplay();
    
    originalPhrases = null;
}

// Show variation message when a progressionVariation song is playing
function showVariationMessage(progressionName, songPhrases, song) {
    const container = document.getElementById('progressionNameDisplay');
    if (!container) return;

    // If the song has its own progressionName, display that directly in crimson (no tooltip)
    const songOwnName = song && song.progressionName;
    if (songOwnName && Array.isArray(songOwnName) && songOwnName.length > 0) {
        const displayName = songOwnName.join(' ');
        container.innerHTML = `<span class="progression-name-tag">${escapeHtml(displayName)}</span>`;
        return;
    }

    // Otherwise show base progression name with variation styling + tooltip
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

// Map degree-only notation to diatonic chord quality
// Uses systemTransfer.diatonicChords.qualities: 1->major, 2->m, 3->m, 4->major, 5->major, 6->m, 7->o
function toDiatonicChord(degree) {
    if (!degree || typeof degree !== 'string') return degree;
    
    // Check if it's a pure degree with optional accidentals (b2, #4, 1, 2, etc.)
    // Must match: optional accidentals followed by a single digit 1-7 and nothing else
    const match = degree.match(/^([b#]*)([1-7])$/);
    if (!match) return degree; // Already has quality or is complex chord
    
    const accidental = match[1];
    const degreeNum = match[2];
    
    // Get quality from systemTransfer or use fallback
    const diatonicQualities = systemTransferData?.diatonicChords?.qualities || 
        { '1': '', '2': 'm', '3': 'm', '4': '', '5': '', '6': 'm', '7': 'o' };
    
    const quality = diatonicQualities[degreeNum] || '';
    return accidental + degreeNum + quality;
}

// Apply diatonic mapping to all chords in phrases
function applyDiatonicMapping(phrases) {
    if (!phrases || !Array.isArray(phrases)) return phrases;
    
    return phrases.map(phrase => 
        phrase.map(bar => 
            Array.isArray(bar) ? bar.map(chord => toDiatonicChord(chord)) : [toDiatonicChord(bar)]
        )
    );
}

// Split progression into phrases if it has 8+ bars (split into groups of 4)
function splitIntoPhrases(bars) {
    if (!bars || bars.length <= 4) {
        return [bars];
    }
    
    // Split into chunks of 4
    const phrases = [];
    for (let i = 0; i < bars.length; i += 4) {
        phrases.push(bars.slice(i, i + 4));
    }
    
    return phrases;
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
// Used for song-specific progressionVariation display
function updateChordGridVisualOnly(phrases) {
    const display = document.getElementById('progressionDisplay');
    if (!display) return;

    display.innerHTML = '';
    
    // Store all phrases for navigation (but don't affect currentBars)
    const allPhrases = phrases || [];
    
    // Store in a temporary variable for visual-only navigation
    visualOnlyPhrases = allPhrases;
    visualOnlyPhraseView = 0; // Reset to first view
    
    // Determine which phrases to show (first 2 phrases of current view)
    const startIdx = 0;
    const viewPhrases = allPhrases.slice(startIdx, startIdx + 2);
    
    renderVisualOnlyPhrases(display, viewPhrases);
    
    // Show phrase navigation if 3+ phrases
    if (allPhrases.length > 2) {
        renderVisualOnlyPhraseNavigation(display, allPhrases.length);
    }
}

// Temporary storage for visual-only phrase display (progressionVariation)
let visualOnlyPhrases = [];
let visualOnlyPhraseView = 0;

// Render phrases for visual-only display
function renderVisualOnlyPhrases(display, phrases) {
    display.innerHTML = '';
    
    const displayPhrases = (phrases || []).map(phrase => ({ bars: phrase }));

    displayPhrases.forEach(phraseData => {
        const phraseContainer = document.createElement('div');
        phraseContainer.className = 'phrase-container';
        phraseContainer.classList.add('song-specific-display'); // Mark as visual-only

        phraseData.bars.forEach(bar => {
            // Ensure bar is always an array
            const barArray = Array.isArray(bar) ? bar : [bar];
            
            const barDiv = document.createElement('div');
            barDiv.className = 'progression-bar';
            // Count non-empty chords for multi-chord styling
            const nonEmptyChords = barArray.filter(c => c && c !== '');
            if (nonEmptyChords.length > 1) barDiv.classList.add('multi-chord');
            
            // Disable interactions for song-specific display
            barDiv.style.pointerEvents = 'none';

            barArray.forEach(degree => {
                // Skip empty chords (but bar still renders)
                if (!degree || degree === '') return;
                
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
    
    // Show phrase placeholder if less than 2 phrases shown
    if (displayPhrases.length < 2) {
        const barsPerPhrase = (displayPhrases[0] && displayPhrases[0].bars && displayPhrases[0].bars.length) || 4;
        const placeholderPhrase = createPlaceholderPhrase(barsPerPhrase, null);
        placeholderPhrase.classList.add('song-specific-display');
        placeholderPhrase.style.pointerEvents = 'none';
        placeholderPhrase.style.opacity = '0.5';
        display.appendChild(placeholderPhrase);
    }
}

// Render phrase navigation for visual-only display (progressionVariation songs)
function renderVisualOnlyPhraseNavigation(container, totalPhrases) {
    // Remove existing navigation
    const existingNav = container.parentElement?.querySelector('.phrase-navigation');
    if (existingNav) existingNav.remove();
    
    const nav = document.createElement('div');
    nav.className = 'phrase-navigation';
    
    // Icon 1: Shows phrases 1-2
    const icon1 = document.createElement('div');
    icon1.className = 'phrase-nav-icon' + (visualOnlyPhraseView === 0 ? ' active' : '');
    icon1.textContent = '1';
    icon1.title = 'View phrases 1-2';
    icon1.onmouseenter = () => switchVisualOnlyPhraseView(0);
    icon1.onclick = () => switchVisualOnlyPhraseView(0);
    
    // Icon 2: Shows phrases 3-4
    const icon2 = document.createElement('div');
    icon2.className = 'phrase-nav-icon' + (visualOnlyPhraseView === 1 ? ' active' : '');
    icon2.textContent = '2';
    icon2.title = 'View phrases 3-4';
    icon2.onmouseenter = () => switchVisualOnlyPhraseView(1);
    icon2.onclick = () => switchVisualOnlyPhraseView(1);
    
    nav.appendChild(icon1);
    nav.appendChild(icon2);
    
    // Insert after the progression display
    container.parentElement?.insertBefore(nav, container.nextSibling);
}

// Switch visual-only phrase view
function switchVisualOnlyPhraseView(viewIndex) {
    if (visualOnlyPhraseView === viewIndex) return;
    if (visualOnlyPhrases.length <= 2 && viewIndex > 0) return;
    
    visualOnlyPhraseView = viewIndex;
    
    const display = document.getElementById('progressionDisplay');
    if (!display) return;
    
    // Get the phrases for this view
    const startIdx = viewIndex * 2;
    const viewPhrases = visualOnlyPhrases.slice(startIdx, startIdx + 2);
    
    // Re-render phrases
    renderVisualOnlyPhrases(display, viewPhrases);
    
    // Update navigation icons active state
    const navIcons = display.parentElement?.querySelectorAll('.phrase-nav-icon');
    if (navIcons) {
        navIcons.forEach((icon, i) => {
            icon.classList.toggle('active', i === viewIndex);
        });
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
        
        // Check if inner arrays contain only strings
        const allInnerAreStringArrays = chords.every(item => 
            Array.isArray(item) && item.every(el => typeof el === 'string')
        );
        
        if (allInnerAreStringArrays) {
            // Distinguish between bars format and phrases format by inner array length
            // Bars format: [["4M7"], ["4/5"], ["3m7"]] - each inner array is 1-2 elements (multi-chord bar)
            // Phrases format: [["4","5","1","5"],["4","5","b6","b7"]] - each inner array is 3-4+ elements (phrase)
            
            // Calculate average inner array length
            const avgLength = chords.reduce((sum, item) => sum + item.length, 0) / chords.length;
            
            // If average length is >= 3, treat as phrases format (each inner array is a phrase with multiple bars)
            // Bars rarely have more than 2 chords, phrases typically have 4 bars
            const likelyPhrasesFormat = avgLength >= 3;
            
            if (likelyPhrasesFormat) {
                // It's progressionVariation format: [["4", "5", "3m", "6m"], ["4", "5", "1", "1"]]
                // Each inner array is a phrase, each string is a single-chord bar
                // Handle comma-separated chords like "4M7, 4mM7" -> ["4M7", "4mM7"]
                return chords.map(phrase => {
                    if (Array.isArray(phrase)) {
                        return phrase.map(chord => {
                            if (Array.isArray(chord)) return chord;
                            // Split comma-separated chords into multi-chord bar
                            if (typeof chord === 'string' && chord.includes(',')) {
                                return chord.split(',').map(c => c.trim()).filter(c => c);
                            }
                            return [chord];
                        });
                    }
                    return [[phrase]];
                });
            }
            
            // This is bars format - wrap in single phrase
            // e.g., [["4M7"], ["4/5"], ["3m7"], ["6m7", "b6m7"]] - 1 phrase with 4 bars
            return [chords];
        }
        
        // It's progressionVariation format with mixed content
        // Each inner array is a phrase, each element is a bar (string or array)
        // Handle comma-separated chords
        return chords.map(phrase => {
            if (Array.isArray(phrase)) {
                return phrase.map(chord => {
                    if (Array.isArray(chord)) return chord;
                    // Split comma-separated chords into multi-chord bar
                    if (typeof chord === 'string' && chord.includes(',')) {
                        return chord.split(',').map(c => c.trim()).filter(c => c);
                    }
                    return [chord];
                });
            }
            return [[phrase]];
        });
    }
    
    // Simple/mixed array of chords: ["6m", "4", "5", ["1", "5/7"]]
    // Some elements are strings (single chord bar), some are arrays (multi-chord bar)
    // Handle comma-separated chords
    return [chords.map(c => {
        if (Array.isArray(c)) return c;
        // Split comma-separated chords into multi-chord bar
        if (typeof c === 'string' && c.includes(',')) {
            return c.split(',').map(ch => ch.trim()).filter(ch => ch);
        }
        return [c];
    })];
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
                            // Multi-phrase format: [[['1'], ['4']], [[['5'], ['6m']]]]
                            // Already in phrase format - apply diatonic mapping
                            const mappedPhrases = applyDiatonicMapping(prog.progression);
                            allProgressions.push({ 
                                rawPhrases: prog.progression,
                                phrases: mappedPhrases, 
                                music: prog.music || [], 
                                progressionName: prog.progressionName || null 
                            });
                        } else {
                            // Single phrase format
                            // Could be: ['1', '4', '5'] or [['1', '5m'], ['4'], ['5']]
                            let bars = prog.progression.map(bar => {
                                if (Array.isArray(bar)) {
                                    // Filter out empty strings from multi-chord bars
                                    const filtered = bar.filter(c => c && c.trim());
                                    return filtered.length > 0 ? filtered : ['']; // Keep empty bar as single empty chord
                                } else if (bar && bar.trim()) {
                                    return [bar];
                                } else {
                                    return ['']; // Empty bar - keep as empty chord placeholder
                                }
                            }); // Don't filter out empty bars - they should render as empty
                            
                            // Store raw bars for header display
                            const rawBars = JSON.parse(JSON.stringify(bars));
                            
                            // Split into phrases if 8+ bars
                            const phrases = splitIntoPhrases(bars);
                            const rawPhrases = splitIntoPhrases(rawBars);
                            
                            // Apply diatonic mapping to phrases for comparison
                            const mappedPhrases = applyDiatonicMapping(phrases);
                            
                            allProgressions.push({ 
                                rawPhrases: rawPhrases,
                                phrases: mappedPhrases, 
                                music: prog.music || [], 
                                progressionName: prog.progressionName || null 
                            });
                        }
                    }
                });
            }
        });
        
        // No fallback - user wants no default progression
        
        renderChordGeneratorPage();
        // Show empty phrase structure (4 empty bars) without loading a progression
        renderEmptyPhraseGrid();
        
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
                <button class="toggle-btn" id="addMissionBtn" onclick="addChordProgressionToPomodoro()" title="Add current progression as Pomodoro mission">
                    ➕ Add Mission
                </button>
                <div class="auto-play-group">
                    <button id="generatorPreviewToggle" class="toggle-btn disabled" onclick="toggleGeneratorPreview()">
                        🚫 Auto Playing
                    </button>
                    <div class="auto-play-menu" id="autoPlayMenu">
                        <div class="auto-play-menu-inner">
                        <div class="auto-play-option${autoPlayMode === 'progression' ? ' active' : ''}" onclick="setAutoPlayMode('progression')" title="Auto-play picks songs that use the current chord progression">
                            <span class="option-check">${autoPlayMode === 'progression' ? '✓' : ''}</span>
                            Plays by Progression
                        </div>
                        <div class="auto-play-option${autoPlayMode === 'music' ? ' active' : ''}" onclick="setAutoPlayMode('music')" title="Auto-play picks a random song from all progressions and switches to its progression">
                            <span class="option-check">${autoPlayMode === 'music' ? '✓' : ''}</span>
                            Plays by Music
                        </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div id="progressionDisplay" class="progression-grid"></div>
        <div id="generatorMusicContainer" class="generator-music-container">
            <div id="generatorMusic" class="generator-music"></div>
        </div>
    `;
    

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
        
        if (window.generatorPreviewEnabled) {
            btn.textContent = '🎬 Auto Playing';
            btn.classList.remove('disabled');
        } else {
            btn.textContent = '🚫 Auto Playing';
            btn.classList.add('disabled');
            // Clear any active preview when disabling
            if (window.clearBackgroundPreview) {
                window.clearBackgroundPreview();
            }
            // Cancel auto-play timer
            if (window.generatorMusicTimeout) {
                clearTimeout(window.generatorMusicTimeout);
                window.generatorMusicTimeout = null;
            }
            // Restore full original chord display (both phrases)
            restoreSongChords();
        }
    }
}

// Set auto-play mode
window.setAutoPlayMode = function(mode) {
    autoPlayMode = mode;
    // Update menu checkmarks
    const menu = document.getElementById('autoPlayMenu');
    if (menu) {
        menu.querySelectorAll('.auto-play-option').forEach(opt => {
            const isActive = opt.textContent.trim().toLowerCase().includes(mode === 'progression' ? 'progression' : 'music');
            opt.classList.toggle('active', isActive);
            const check = opt.querySelector('.option-check');
            if (check) check.textContent = isActive ? '✓' : '';
        });
    }

    // If auto-play is currently active, restart with new mode
    if (window.generatorPreviewEnabled) {
        if (window.generatorMusicTimeout) {
            clearTimeout(window.generatorMusicTimeout);
            window.generatorMusicTimeout = null;
        }
        if (typeof window.clearBackgroundPreview === 'function') {
            window.clearBackgroundPreview();
        }
        restoreSongChords();
        autoPlayRandomMusic();
    }
}

// Pick a weighted random index from allProgressions, avoiding excludeIndex
function pickWeightedRandomIndex(excludeIndex) {
    if (allProgressions.length <= 1) return 0;
    const weights = [];
    let totalWeight = 0;
    for (let i = 0; i < allProgressions.length; i++) {
        const pickCount = progressionPickCounts.get(i) || 0;
        let weight = 1 / (pickCount + 1);
        if (i === excludeIndex) weight *= 0.1;
        weights.push(weight);
        totalWeight += weight;
    }
    let random = Math.random() * totalWeight;
    for (let i = 0; i < weights.length; i++) {
        random -= weights[i];
        if (random <= 0) return i;
    }
    return 0;
}

function refreshChords() {
    if (allProgressions.length === 0) return;

    // Increment generation to invalidate any pending auto-play from previous progression
    progressionGeneration++;

    // Restore original chords if a song variation was being displayed
    if (originalPhrases) {
        restoreSongChords();
    }
    originalPhrases = null;
    currentlyPlayingSong = null;

    // Stop any playing preview and clear auto-play timeout on refresh
    if (typeof window.clearBackgroundPreview === 'function') {
        window.clearBackgroundPreview();
    }
    if (window.generatorMusicTimeout) {
        clearTimeout(window.generatorMusicTimeout);
        window.generatorMusicTimeout = null;
    }

    let randomIndex;
    // Weighted random selection - progressions picked more often have lower chance
    if (allProgressions.length <= 1) {
        randomIndex = 0;
    } else {
        // Calculate weights for each progression (inverse of pick count)
        const weights = [];
        let totalWeight = 0;
        
        for (let i = 0; i < allProgressions.length; i++) {
            const pickCount = progressionPickCounts.get(i) || 0;
            // Weight formula: 1 / (pickCount + 1) - higher picks = lower weight
            // Add penalty if this was the last picked progression
            let weight = 1 / (pickCount + 1);
            if (i === lastProgressionIndex) {
                weight *= 0.1; // 90% reduction for immediate repeat
            }
            weights.push(weight);
            totalWeight += weight;
        }
        
        // Weighted random selection
        let random = Math.random() * totalWeight;
        randomIndex = 0;
        for (let i = 0; i < weights.length; i++) {
            random -= weights[i];
            if (random <= 0) {
                randomIndex = i;
                break;
            }
        }
    }
    
    // Update pick count for this progression
    const currentCount = progressionPickCounts.get(randomIndex) || 0;
    progressionPickCounts.set(randomIndex, currentCount + 1);
    
    // Reset counts periodically to prevent permanent bias (when all have been picked at least once)
    const minPicks = Math.min(...Array.from({ length: allProgressions.length }, (_, i) => progressionPickCounts.get(i) || 0));
    if (minPicks >= 1) {
        // Reduce all counts by the minimum to normalize
        for (let i = 0; i < allProgressions.length; i++) {
            const count = progressionPickCounts.get(i) || 0;
            progressionPickCounts.set(i, count - minPicks);
        }
    }
    
    lastProgressionIndex = randomIndex;
    const randomProgression = allProgressions[randomIndex];
    
    // Reset modification flag when loading a new progression
    isProgressionModified = false;
    
    // Reset phrase view to first pair
    currentPhraseView = 0;
    
    // Phrases are already diatonic-mapped when loaded, use directly
    let displayPhrases = randomProgression.phrases.map(p => p.map(b => [...b]));
    
    // If only 1 phrase, pick a second random progression for phrase 2
    if (displayPhrases.length === 1 && allProgressions.length > 1) {
        let secondIndex = pickWeightedRandomIndex(randomIndex);
        const secondProg = allProgressions[secondIndex];
        if (secondProg && secondProg.phrases && secondProg.phrases.length > 0) {
            const secondPhrase = secondProg.phrases[0].map(b => [...b]);
            // Match bar count to phrase 1
            const barsNeeded = displayPhrases[0].length;
            while (secondPhrase.length < barsNeeded) secondPhrase.push(['1']);
            if (secondPhrase.length > barsNeeded) secondPhrase.length = barsNeeded;
            displayPhrases.push(secondPhrase);
        }
    }
    
    // Store all phrases for navigation (up to 4 phrases)
    allCurrentPhrases = displayPhrases.map(phrase => phrase.map(bar => [...bar]));
    
    // Flatten phrases into bars and keep track of phrase structure
    currentBars = [];
    currentParents = [];
    isSubstituted = [];
    
    displayPhrases.forEach(phrase => {
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
    currentProgressionChords = displayPhrases;
    
    // Update chord header with RAW progression chords (degree-only, no diatonic mapping)
    updateChordHeader(randomProgression.rawPhrases || randomProgression.phrases);
    
    // Get first 2 phrases for initial display
    const viewPhrases = displayPhrases.slice(0, 2);
    
    // Update grid with diatonic-mapped chords (first 2 phrases)
    updateChordGrid(viewPhrases);
    renderGeneratorMusic(randomProgression.music || [], randomProgression.progressionName);
    updateProgressionNameDisplay(randomProgression.progressionName, displayPhrases);
}

// Check if a chord progression is fully diatonic
function isProgressionDiatonic(phrases) {
    if (!phrases || !Array.isArray(phrases)) return true;
    
    // Flatten all chords from phrases
    const allChords = phrases.flat(Infinity).filter(c => c && typeof c === 'string');
    
    // Get allowed qualities from systemTransfer or use fallback
    const diatonicQualities = systemTransferData?.diatonicChords?.allowedQualities || {
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

// Update the page title (h1) to show base degrees like "4 - 5 - 3 - 6"
// Only shows the first phrase's degrees (numbers only, no quality)
function updateChordHeader(phrases) {
    const pageTitle = document.getElementById('pageTitle');
    if (!pageTitle) return;
    
    if (!phrases || !Array.isArray(phrases) || phrases.length === 0) {
        setTitlePreserveBackBtn(pageTitle, 'Chord Generator');
        return;
    }
    
    // Only use FIRST phrase for header (the base progression)
    const firstPhrase = phrases[0];
    if (!firstPhrase || !Array.isArray(firstPhrase)) {
        setTitlePreserveBackBtn(pageTitle, 'Chord Generator');
        return;
    }
    
    // Get degree number only from each bar in the first phrase
    const baseDegrees = [];
    firstPhrase.forEach(bar => {
        if (Array.isArray(bar) && bar.length > 0) {
            // Get just the first chord of each bar, extract degree number only
            const chord = bar[0];
            // Extract just the degree number (e.g., "4m" -> "4", "b6" -> "b6", "3m7" -> "3")
            const match = chord.match(/^([b#]*)([1-7])/);
            if (match) {
                baseDegrees.push(match[1] + match[2]); // accidental + degree number
            }
        }
    });
    
    const headerText = baseDegrees.join(' - ');
    setTitlePreserveBackBtn(pageTitle, headerText);
}

// Set header text without destroying child elements (back button)
function setTitlePreserveBackBtn(titleEl, text) {
    const backBtn = document.getElementById('backBtn');
    if (backBtn) backBtn.remove();
    titleEl.textContent = text;
    if (backBtn) titleEl.appendChild(backBtn);
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
    // Always keep header in sync with first phrase (including manual edits)
    // Use allCurrentPhrases so we only show the first phrase's chords in header
    if (allCurrentPhrases && allCurrentPhrases.length > 0) {
        updateChordHeader(allCurrentPhrases);
    }
    
    if (!allProgressions || allProgressions.length === 0) {
        renderGeneratorMusic([]);
        return;
    }

    // Flatten currentBars into a single array for comparison
    const currentChords = currentBars.flat(Infinity).filter(c => c && typeof c === 'string' && c.trim());
    
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
            progChords = prog.phrases.flat(Infinity).filter(c => c && typeof c === 'string' && c.trim());
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
        // No match: clear labels, music list, and stop auto-play
        currentMusicList = [];  // Clear immediately before render
        autoPlayQueue = [];     // Clear auto-play queue
        autoPlayQueueKey = '';  // Reset queue key
        renderGeneratorMusic([]);
        updateProgressionNameDisplay([], []);

        // Stop any playing preview and clear auto-play timeout
        if (typeof window.clearBackgroundPreview === 'function') {
            window.clearBackgroundPreview();
        }
        if (window.generatorMusicTimeout) {
            clearTimeout(window.generatorMusicTimeout);
            window.generatorMusicTimeout = null;
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
            html += `<div class="music-tooltip" id="${tooltipId}" style="display: none;" data-iframe-url="${escapeHtml(iframeUrl)}">
                <iframe width="560" height="315" 
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
    
    // Auto-start a random music preview (skip if suppressed by loadProgressionByIndex)
    if (!window._suppressAutoPlay) {
        autoPlayRandomMusic();
    }
}

function setupGeneratorMusicHoverHandlers(container) {
    if (!container || container.dataset.musicHoverBound === 'true') return;
    container.dataset.musicHoverBound = 'true';

    let currentVideoId = null;

    const handleMouseOver = (event) => {
        const link = event.target.closest('.music-link');
        if (!link || !container.contains(link)) return;

        // Stop auto-play immediately when manually hovering
        window.isManuallyHovering = true;
        if (window.generatorMusicTimeout) {
            clearTimeout(window.generatorMusicTimeout);
            window.generatorMusicTimeout = null;
        }
        // Cancel any pending mouseout resume timer
        if (window._mouseoutResumeTimeout) {
            clearTimeout(window._mouseoutResumeTimeout);
            window._mouseoutResumeTimeout = null;
        }

        const videoId = link.dataset.videoId;
        const clipStart = link.dataset.start || '0';
        const songIndex = parseInt(link.dataset.songIndex);
        const hasProgressionVariation = link.dataset.hasProgressionVariation === 'true';

        // Show song-specific chords on hover (always, even if auto-play is off)
        if (hasProgressionVariation && !isNaN(songIndex) && currentMusicList && currentMusicList[songIndex]) {
            try {
                showSongChords(currentMusicList[songIndex], currentMusicProgressionName);
            } catch (error) {
                console.error('Error showing song chords:', error);
            }
        } else {
            // No variation: show only phrase 1 in visual-only mode
            if (!originalPhrases) {
                originalPhrases = getCurrentPhrases();
            }
            const phrase1Only = [allCurrentPhrases[0]];
            updateChordGridVisualOnly(phrase1Only);
        }

        // Always play preview on hover
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
        
        // Restore original chords if a song-specific display was shown
        restoreSongChords();
        
        // Clear video preview when not hovering
        if (typeof window.clearBackgroundPreview === 'function') {
            window.clearBackgroundPreview();
        }
        
        // Resume auto-play after hover ends (only if auto-playing is enabled)
        if (window.generatorPreviewEnabled === true) {
            // Cancel any previous mouseout resume timer
            if (window._mouseoutResumeTimeout) {
                clearTimeout(window._mouseoutResumeTimeout);
                window._mouseoutResumeTimeout = null;
            }
            const genAtMouseOut = progressionGeneration;
            window._mouseoutResumeTimeout = setTimeout(() => {
                window._mouseoutResumeTimeout = null;
                // Only resume if the progression hasn't changed since mouseout
                if (genAtMouseOut === progressionGeneration) {
                    autoPlayRandomMusic();
                }
            }, 1000);
        }
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
// Global pool for "plays by music" mode
let allMusicPool = [];
let allMusicPoolQueue = [];

function buildAllMusicPool() {
    allMusicPool = [];
    allProgressions.forEach((prog, progIndex) => {
        if (prog.music && Array.isArray(prog.music)) {
            prog.music.forEach(song => {
                if (song && song.youtubeId) {
                    allMusicPool.push({ song, progIndex, progressionName: prog.progressionName });
                }
            });
        }
    });
    allMusicPoolQueue = buildShuffledQueue(allMusicPool.length);
}

function autoPlayRandomMusic() {
    if (window.generatorPreviewEnabled !== true) return;
    // Don't auto-play if user is manually hovering over a song
    if (window.isManuallyHovering) return;

    if (autoPlayMode === 'music') {
        autoPlayByMusic();
    } else {
        autoPlayByProgression();
    }
}

// Original mode: play songs matching current progression
function autoPlayByProgression() {
    if (!currentMusicList || currentMusicList.length === 0) return;
    
    // Capture current generation at start of this call
    const myGeneration = progressionGeneration;
    
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
        
        playSongAutoPlay(randomSong, myGeneration);
    } catch (error) {
        console.error('Error in autoPlayByProgression:', error);
    }
}

// New mode: pick random song from all progressions, switch progression to match
function autoPlayByMusic() {
    try {
        // Build pool if empty
        if (allMusicPool.length === 0) {
            buildAllMusicPool();
        }
        if (allMusicPool.length === 0) return;
        
        if (allMusicPoolQueue.length === 0) {
            allMusicPoolQueue = buildShuffledQueue(allMusicPool.length);
        }
        
        const nextIdx = allMusicPoolQueue.shift();
        const entry = allMusicPool[nextIdx];
        if (!entry) return;
        
        const { song, progIndex, progressionName } = entry;
        
        // Switch to the progression that contains this song
        loadProgressionByIndex(progIndex);
        
        // Now play the song
        const myGeneration = progressionGeneration;
        playSongAutoPlay(song, myGeneration);
    } catch (error) {
        console.error('Error in autoPlayByMusic:', error);
    }
}

// Load a specific progression by index (for "plays by music" mode)
function loadProgressionByIndex(progIndex) {
    if (progIndex < 0 || progIndex >= allProgressions.length) return;
    
    progressionGeneration++;
    
    // Cancel any pending auto-play timer from the previous progression
    if (window.generatorMusicTimeout) {
        clearTimeout(window.generatorMusicTimeout);
        window.generatorMusicTimeout = null;
    }
    
    // Restore original chords if needed
    if (originalPhrases) {
        restoreSongChords();
    }
    originalPhrases = null;
    currentlyPlayingSong = null;
    
    const prog = allProgressions[progIndex];
    let displayPhrases = prog.phrases.map(p => p.map(b => [...b]));
    
    // If only 1 phrase, pick a second random for phrase 2
    if (displayPhrases.length === 1 && allProgressions.length > 1) {
        let secondIndex = pickWeightedRandomIndex(progIndex);
        const secondProg = allProgressions[secondIndex];
        if (secondProg && secondProg.phrases && secondProg.phrases.length > 0) {
            const secondPhrase = secondProg.phrases[0].map(b => [...b]);
            const barsNeeded = displayPhrases[0].length;
            while (secondPhrase.length < barsNeeded) secondPhrase.push(['1']);
            if (secondPhrase.length > barsNeeded) secondPhrase.length = barsNeeded;
            displayPhrases.push(secondPhrase);
        }
    }
    
    allCurrentPhrases = displayPhrases.map(phrase => phrase.map(bar => [...bar]));
    
    currentBars = [];
    currentParents = [];
    isSubstituted = [];
    displayPhrases.forEach(phrase => {
        phrase.forEach(bar => {
            currentBars.push(bar);
            const parents = bar.map(chord => getDiatonicParent(chord));
            currentParents.push(parents);
            isSubstituted.push(bar.map(chord => !isChordDiatonic(chord)));
        });
    });
    
    currentProgressionName = prog.progressionName;
    currentProgressionChords = displayPhrases;
    lastProgressionIndex = progIndex;
    currentPhraseView = 0;
    
    updateChordHeader(prog.rawPhrases || prog.phrases);
    const viewPhrases = displayPhrases.slice(0, 2);
    updateChordGrid(viewPhrases);
    // Suppress auto-play from renderGeneratorMusic (we'll play the specific song after)
    window._suppressAutoPlay = true;
    renderGeneratorMusic(prog.music || [], prog.progressionName);
    window._suppressAutoPlay = false;
    updateProgressionNameDisplay(prog.progressionName, displayPhrases);
}

// Shared play logic for both modes
function playSongAutoPlay(song, myGeneration) {
    const clipStart = song.clipStart || 0;
    
    // Determine clip duration based on number of phrases
    let phraseCount = 1; // Default: show only phrase 1 for non-variation songs
    if (song.progressionVariation) {
        const songPhrases = normalizePhrases(song.progressionVariation);
        phraseCount = songPhrases.length;
    }
    
    let clipDuration = 15;
    if (phraseCount === 2) {
        clipDuration = 25;
    } else if (phraseCount > 2) {
        clipDuration = 35;
    }
    
    // Check if progression changed since we started (stale callback)
    if (myGeneration !== progressionGeneration) return;
    
    // Show song-specific chords if available, otherwise show only phrase 1
    if (song.progressionVariation) {
        showSongChords(song, currentMusicProgressionName);
    } else {
        // No variation: show only phrase 1 in visual-only (non-interactive) mode
        if (!originalPhrases) {
            originalPhrases = getCurrentPhrases();
        }
        currentlyPlayingSong = song;
        const phrase1Only = [allCurrentPhrases[0]];
        updateChordGridVisualOnly(phrase1Only);
        restoreProgressionNameDisplay();
    }
    
    if (typeof window.setBackgroundPreview === 'function') {
        window.setBackgroundPreview(song.youtubeId, clipStart, clipDuration);
        
        if (window.generatorMusicTimeout) {
            clearTimeout(window.generatorMusicTimeout);
        }
        const scheduledGeneration = progressionGeneration;
        window.generatorMusicTimeout = setTimeout(() => {
            if (scheduledGeneration === progressionGeneration) {
                autoPlayRandomMusic();
            }
        }, clipDuration * 1000);
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
    
    // Fallback: use chromaticParents from systemTransfer or hardcoded defaults
    const chromaticParents = systemTransferData?.diatonicChords?.chromaticParents || {
        'b2': '2m', '#1': '2m',
        'b3': '3m', '#2': '3m',
        '#4': '4', 'b5': '5',
        'b6': '6m', '#5': '6m',
        'b7': '7o', '#6': '7o'
    };
    
    const parent = chromaticParents[degree];
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

// Render empty phrase grid with 2 placeholder phrases (shown on first load)
function renderEmptyPhraseGrid() {
    const display = document.getElementById('progressionDisplay');
    if (!display) return;
    
    display.innerHTML = '';
    
    // Show 2 placeholder phrases with + icons
    for (let p = 0; p < 2; p++) {
        const placeholder = createPlaceholderPhrase(4, () => {
            refreshChords();
        });
        display.appendChild(placeholder);
    }
    
    // Show "No music examples yet." in music container
    const musicContainer = document.getElementById('generatorMusic');
    if (musicContainer) {
        musicContainer.innerHTML = '<p class="detail-line" style="color: #888;">No music examples yet.</p>';
    }
}

function updateChordGrid(phrases) {
    const display = document.getElementById('progressionDisplay');
    if (!display) return;

    display.innerHTML = '';
    let barGlobalIndex = 0;

    phrases.forEach((phrase, phraseIndex) => {
        const phraseContainer = document.createElement('div');
        phraseContainer.className = 'phrase-container';

        const globalPhraseIndex = currentPhraseView * 2 + phraseIndex;
        if (globalPhraseIndex >= 1) {
            const removeBtn = document.createElement('button');
            removeBtn.className = 'phrase-remove-btn';
            removeBtn.type = 'button';
            removeBtn.title = 'Remove phrase';
            removeBtn.innerHTML = '×';
            removeBtn.onmousedown = (e) => {
                e.preventDefault();
                e.stopPropagation();
            };
            removeBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                removePhrase(globalPhraseIndex);
            };
            phraseContainer.appendChild(removeBtn);
        }

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
                // Skip rendering for empty chord placeholders (but bar is still shown)
                if (!degree || degree === '') {
                    return; // Empty bar - don't add chord, just show empty bar
                }
                
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

    // Always show phrase 2 slot - either with content or as placeholder
    if (phrases.length < 2) {
        const barsPerPhrase = (phrases[0] && phrases[0].length) || 4;
        const placeholderPhrase = createPlaceholderPhrase(barsPerPhrase, () => addNewPhrase());
        display.appendChild(placeholderPhrase);
    }
    
    // Add phrase navigation if there are more than 2 phrases available
    renderPhraseNavigation(display);
}

// Render phrase navigation icons (1, 2) for viewing different phrase pairs
function renderPhraseNavigation(container) {
    // Remove existing navigation
    const existingNav = container.parentElement?.querySelector('.phrase-navigation');
    if (existingNav) existingNav.remove();
    
    // Only show navigation if there are 3+ phrases total
    if (allCurrentPhrases.length <= 2) return;
    
    const nav = document.createElement('div');
    nav.className = 'phrase-navigation';
    
    // Icon 1: Shows phrases 1-2
    const icon1 = document.createElement('div');
    icon1.className = 'phrase-nav-icon' + (currentPhraseView === 0 ? ' active' : '');
    icon1.textContent = '1';
    icon1.title = 'View phrases 1-2';
    icon1.onmouseenter = () => switchPhraseView(0);
    icon1.onclick = () => switchPhraseView(0);
    
    // Icon 2: Shows phrases 3-4
    const icon2 = document.createElement('div');
    icon2.className = 'phrase-nav-icon' + (currentPhraseView === 1 ? ' active' : '');
    icon2.textContent = '2';
    icon2.title = 'View phrases 3-4';
    icon2.onmouseenter = () => switchPhraseView(1);
    icon2.onclick = () => switchPhraseView(1);
    
    nav.appendChild(icon1);
    nav.appendChild(icon2);
    
    // Insert after the progression display
    container.parentElement?.insertBefore(nav, container.nextSibling);
}

// Switch between phrase views (0 = phrases 1-2, 1 = phrases 3-4)
function switchPhraseView(viewIndex) {
    if (currentPhraseView === viewIndex) return;
    if (allCurrentPhrases.length <= 2 && viewIndex > 0) return;
    
    currentPhraseView = viewIndex;
    
    // Get the phrases for this view
    const startIdx = viewIndex * 2;
    const viewPhrases = allCurrentPhrases.slice(startIdx, startIdx + 2);
    
    // Re-render with new view (but don't update allCurrentPhrases)
    updateChordGridWithView(viewPhrases);
}

// Update chord grid for a specific view (without changing allCurrentPhrases)
function updateChordGridWithView(phrases) {
    const display = document.getElementById('progressionDisplay');
    if (!display) return;

    display.innerHTML = '';
    
    // Calculate bar offset based on current view
    const barOffset = currentPhraseView * 2 * ((allCurrentPhrases[0]?.length) || 4);
    let barLocalIndex = 0;

    phrases.forEach((phrase, phraseIndex) => {
        const phraseContainer = document.createElement('div');
        phraseContainer.className = 'phrase-container';

        const globalPhraseIndex = currentPhraseView * 2 + phraseIndex;
        if (globalPhraseIndex >= 1) {
            const removeBtn = document.createElement('button');
            removeBtn.className = 'phrase-remove-btn';
            removeBtn.type = 'button';
            removeBtn.title = 'Remove phrase';
            removeBtn.innerHTML = '×';
            removeBtn.onmousedown = (e) => {
                e.preventDefault();
                e.stopPropagation();
            };
            removeBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                removePhrase(globalPhraseIndex);
            };
            phraseContainer.appendChild(removeBtn);
        }

        phrase.forEach(bar => {
            const barIndex = barOffset + barLocalIndex++;
            const barDiv = document.createElement('div');
            barDiv.className = 'progression-bar';
            barDiv.dataset.barIndex = barIndex;
            if (bar.length > 1) barDiv.classList.add('multi-chord');

            // Track mouse position for insert location
            let insertPosition = bar.length;
            let cachedChordWrappers = null;
            
            barDiv.onmousemove = (e) => {
                if (isSubstituteMode) return;
                const mouseX = e.clientX;
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
            
            barDiv.onmouseleave = () => hideAddIndicator();
            barDiv.onclick = (e) => {
                if (e.target === barDiv || e.target.classList.contains('progression-bar')) {
                    addChordToBar(barIndex, insertPosition);
                }
            };
            barDiv.oncontextmenu = (e) => e.preventDefault();

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
                
                chordDiv.onmouseenter = () => {
                    if (!isSubstituteMode) {
                        const rect = chordDiv.getBoundingClientRect();
                        showRemoveIndicator(rect.right + 8, rect.top + rect.height / 2);
                    }
                };
                chordDiv.onmousemove = (e) => {
                    if (!isSubstituteMode) showRemoveIndicator(e.clientX, e.clientY);
                };
                chordDiv.onmouseleave = () => hideAddIndicator();
                chordDiv.onclick = (e) => {
                    e.stopPropagation();
                    if (isSubstituteMode) {
                        replaceWithSubstitute(barIndex, chordIndex, degree);
                    } else {
                        removeChordFromBar(barIndex, chordIndex);
                    }
                };
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

    // Show placeholder for second phrase slot if needed
    if (phrases.length < 2) {
        const barsPerPhrase = (phrases[0] && phrases[0].length) || 4;
        const placeholderPhrase = createPlaceholderPhrase(barsPerPhrase, () => addNewPhrase());
        display.appendChild(placeholderPhrase);
    }
    
    renderPhraseNavigation(display);
}

// Add a new phrase to the progression
function addNewPhrase() {
    if (allCurrentPhrases.length >= 4) return;

    const barsPerPhrase = (allCurrentPhrases[0] && allCurrentPhrases[0].length) ? allCurrentPhrases[0].length : 4;
    
    // Pick a random progression from the loaded data
    let newPhrase = [];
    if (allProgressions.length > 0) {
        const randomProg = allProgressions[Math.floor(Math.random() * allProgressions.length)];
        // Use the first phrase from the random progression
        const sourcePhrases = randomProg.phrases;
        if (sourcePhrases && sourcePhrases.length > 0) {
            const sourcePhrase = sourcePhrases[0];
            // Deep copy and match bar count
            for (let i = 0; i < barsPerPhrase; i++) {
                if (i < sourcePhrase.length) {
                    newPhrase.push([...sourcePhrase[i]]);
                } else {
                    newPhrase.push(['1']);
                }
            }
        }
    }
    // Fallback if no progressions loaded
    if (newPhrase.length === 0) {
        for (let i = 0; i < barsPerPhrase; i++) {
            newPhrase.push(['1']);
        }
    }
    
    allCurrentPhrases.push(newPhrase);
    markProgressionModified();

    rebuildProgressionFromPhrases(allCurrentPhrases);

    // Update display
    const viewPhrases = allCurrentPhrases.slice(currentPhraseView * 2, currentPhraseView * 2 + 2);
    updateChordGridWithView(viewPhrases);
    checkAndShowMusicExamples();
}

function removePhrase(phraseIndex) {
    if (phraseIndex <= 0) return; // never remove first phrase
    if (phraseIndex >= allCurrentPhrases.length) return;

    allCurrentPhrases.splice(phraseIndex, 1);
    markProgressionModified();

    if (currentPhraseView * 2 >= allCurrentPhrases.length) {
        currentPhraseView = 0;
    }

    rebuildProgressionFromPhrases(allCurrentPhrases);

    const viewPhrases = allCurrentPhrases.slice(currentPhraseView * 2, currentPhraseView * 2 + 2);
    updateChordGridWithView(viewPhrases);
    checkAndShowMusicExamples();
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
    
    // Rebuild phrases from bars and display current view
    rebuildPhrasesFromBars();
    const viewPhrases = allCurrentPhrases.slice(currentPhraseView * 2, currentPhraseView * 2 + 2);
    updateChordGridWithView(viewPhrases);
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
    
    // Rebuild phrases from bars and display current view
    rebuildPhrasesFromBars();
    const viewPhrases = allCurrentPhrases.slice(currentPhraseView * 2, currentPhraseView * 2 + 2);
    updateChordGridWithView(viewPhrases);
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

// Add current chord progression to Pomodoro as mission
function addChordProgressionToPomodoro() {
    if (!allCurrentPhrases || allCurrentPhrases.length === 0) {
        alert('No progression loaded to add!');
        return;
    }
    
    // Build degree text for each phrase
    const phraseLines = allCurrentPhrases.map(phrase => {
        const degrees = [];
        phrase.forEach(bar => {
            if (Array.isArray(bar) && bar.length > 0) {
                const chord = bar[0];
                const match = chord.match(/^([b#]*)([1-7])/);
                if (match) {
                    degrees.push(match[1] + match[2]);
                }
            }
        });
        return degrees.join(' ');
    }).filter(line => line.length > 0);
    
    if (phraseLines.length === 0) {
        alert('No progression loaded to add!');
        return;
    }
    
    // Join phrases with newline (phrase 2 appears on a new line in the card)
    const progressionText = phraseLines.join('\n');
    
    // Check if pomodoro functions are available
    if (typeof window.addPomodoroMissionFromExternal !== 'function') {
        alert('Pomodoro page must be loaded first!');
        return;
    }
    
    // Add mission to pomodoro
    window.addPomodoroMissionFromExternal(progressionText);
    
    // Play confirmation sound
    if (typeof soundEffects !== 'undefined') {
        soundEffects.playClickSound();
    }
    
    // Navigate to Pomodoro page
    if (window.router && typeof window.router.navigate === 'function') {
        window.router.navigate('pomodoro.html');
    }
}

// Export cleanup function for router to call
window.cleanupChordGenerator = cleanupChordGenerator;
window.addChordProgressionToPomodoro = addChordProgressionToPomodoro;
