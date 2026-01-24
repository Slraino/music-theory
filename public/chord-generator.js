// Chord Generation and Manipulation Utilities
// Requires music-theory-data.json to be loaded

class ChordGenerator {
  constructor(musicData) {
    this.chordTypes = musicData.chordTypes;
    this.scaleFormula = musicData.scaleFormula;
    this.functionalGroups = musicData.functionalGroups;
    this.keySignatures = musicData.keySignatures;
    this.noteNames = musicData.noteNames;
  }

  // Normalize chord type tokens to canonical ASCII-friendly keys
  normalizeChordType(type) {
    const map = {
      '°': 'dim',
      'o': 'dim',
      'dim': 'dim',
      'dim7': 'dim7',
      'ø': 'hdim',
      'hdim': 'hdim',
      'm7b5': 'hdim',
      '+': 'aug',
      'aug': 'aug'
    };
    return map[type] || type;
  }

  // Map canonical types to display glyphs for chord symbols
  displayChordTypeSymbol(type) {
    const map = {
      'dim': '°',
      'dim7': '°7',
      'hdim': 'ø',
      'aug': '+'
    };
    return map[type] || type;
  }

  // Convert interval formula to semitone intervals
  formulaToSemitones(formula) {
    const intervalMap = {
      '1': 0, '#1': 1, 'b2': 1, '2': 2, '#2': 3, 'b3': 3, '3': 4, '4': 5, '#4': 6, 'b5': 6, 
      '5': 7, '#5': 8, 'b6': 8, '6': 9, 'bb7': 9, '#6': 10, 'b7': 10, '7': 11, '8': 12,
      'b9': 13, '9': 14, '#9': 15, '11': 17, '#11': 18,'b13': 20, '13': 21
    };
    
    return formula.split(',').map(interval => {
      const trimmed = interval.trim();
      if (!(trimmed in intervalMap)) {
        console.warn(`Unknown interval: ${trimmed}`);
        return 0;
      }
      return intervalMap[trimmed];
    });
  }

  // Generate chord notes in a specific key
  generateChord(key, degree, chordType = 'M', extensions = []) {
    const normalizedType = this.normalizeChordType(chordType);

    // Get root note semitone value
    const keySemitone = this.keySignatures[key];
    if (keySemitone === undefined) {
      throw new Error(`Unknown key: ${key}`);
    }

    // Parse degree (e.g., "1", "2m", "5", "b6")
    const degreeMatch = degree.match(/^([b#]?)(\d+)([mM]?)$/);
    if (!degreeMatch) {
      throw new Error(`Invalid degree format: ${degree}`);
    }

    const [, accidental, degreeNum] = degreeMatch;
    const scaleIndex = parseInt(degreeNum) - 1;
    
    // Get scale degree offset
    let scaleDegreeOffset = this.scaleFormula.major[scaleIndex] || 0;
    
    // Apply accidentals
    if (accidental === 'b') scaleDegreeOffset -= 1;
    if (accidental === '#') scaleDegreeOffset += 1;
    
    // Calculate root note
    const rootSemitone = (keySemitone + scaleDegreeOffset) % 12;

    // Get base chord formula
    const typeData = this.chordTypes[normalizedType];
    if (!typeData) {
      throw new Error(`Unknown chord type: ${chordType}`);
    }

    // Build complete formula with extensions
    let formula = typeData.formula;
    const extensionIntervals = [];
    
    extensions.forEach(ext => {
      if (typeData.extensions[ext]) {
        extensionIntervals.push(typeData.extensions[ext]);
      }
    });

    if (extensionIntervals.length > 0) {
      formula += ',' + extensionIntervals.join(',');
    }

    // Convert to semitones and generate notes
    const intervals = this.formulaToSemitones(formula);
    const notes = intervals.map(interval => {
      const noteSemitone = (rootSemitone + interval) % 12;
      return this.noteNames[noteSemitone];
    });

    // Build chord symbol
    const rootName = this.noteNames[rootSemitone];
    const extensionSymbols = extensions.join('');
    const symbolType = this.displayChordTypeSymbol(normalizedType);
    const symbol = `${rootName}${symbolType}${extensionSymbols}`;

    return {
      symbol,
      root: rootName,
      type: normalizedType,
      notes,
      intervals,
      extensions
    };
  }

  // Add random extensions to a chord type
  getRandomExtensions(chordType, count = 2) {
    const typeData = this.chordTypes[chordType];
    if (!typeData || !typeData.extensions) {
      return [];
    }

    const available = Object.keys(typeData.extensions);
    if (available.length === 0) return [];

    // Shuffle and pick random extensions
    const shuffled = available.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, available.length));
  }

  // Get chord substitution based on function
  getSubstitutions(degree) {
    // Find which functional group this degree belongs to
    for (const [functionName, group] of Object.entries(this.functionalGroups)) {
      if (group.substitutions[degree]) {
        return {
          function: functionName,
          substitutions: group.substitutions[degree]
        };
      }
    }
    return null;
  }

  // Transpose a progression to a different key
  transposeProgression(progression, fromKey, toKey) {
    const fromSemitone = this.keySignatures[fromKey];
    const toSemitone = this.keySignatures[toKey];
    const interval = toSemitone - fromSemitone;

    // Progression stays in scale degrees, just regenerate in new key
    return progression.map(chord => {
      return this.generateChord(toKey, chord.degree, chord.type, chord.extensions);
    });
  }

  // Parse chord notation (e.g., "6m", "5", "4M7")
  parseChordNotation(notation) {
    const match = notation.match(/^([b#]?\d+)([a-zA-Z0-9+#øΔ]+)?$/);
    if (!match) {
      throw new Error(`Invalid chord notation: ${notation}`);
    }

    const degree = match[1];
    const rawType = match[2] || 'M';
    const type = this.normalizeChordType(rawType);
    return { degree, type };
  }

  // Generate full progression from notation
  generateProgression(key, notations) {
    return notations.split(/\s*-\s*/).map(notation => {
      const { degree, type } = this.parseChordNotation(notation.trim());
      return this.generateChord(key, degree, type);
    });
  }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ChordGenerator;
}
