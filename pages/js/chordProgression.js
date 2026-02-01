// Chord Progression Page Handler
(function() {
    'use strict';

let currentOpenGroupCP = null;
let progressionsData = [];

// Helper function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Helper: Convert chord array to progression ID
function chordsToProgressionId(chords) {
    if (!Array.isArray(chords)) return '';
    
    if (Array.isArray(chords[0])) {
        return chords.map(bar => 
            Array.isArray(bar) ? bar.join(',') : bar
        ).join('-');
    }
    
    return chords.join('-');
}

// Initialize and get progressions (uses DataService from app.js)
async function getProgressions() {
    try {
        // Use centralized DataService instead of duplicating fetch logic
        const progressions = await DataService.getChordProgressions();
        return progressions;
    } catch (error) {
        console.error('Failed to get progressions:', error);
        return [];
    }
}

// Render progressions to the page
async function renderProgressions() {
    const list = document.getElementById('progressionsList');
    if (!list) {
        console.error('progressionsList element not found!');
        return;
    }
    
    LoadingManager.showLoading('progressionsList');
    
    try {
        const progs = await getProgressions();
        progressionsData = progs;
        
        if (!progs || progs.length === 0) {
            throw new Error('No progressions loaded');
        }
        
        LoadingManager.showContent('progressionsList');
    
        list.innerHTML = '';
        
        const boxesWrapper = document.createElement('div');
        boxesWrapper.className = 'boxes-wrapper';
        
        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'content-wrapper';
        
        const groups = {};
        progs.forEach((prog, idx) => {
        let key = prog.title.charAt(0);
        
        if ((key === 'b' || key === '#') && prog.title.length > 1) {
            key = prog.title.substring(0, 2);
        }
        
        if (!groups[key]) {
            groups[key] = [];
        }
        
        groups[key].push({ ...prog, origIndex: idx });
    });
    
    const displayOrder = ['1','b2','2','b3','3','4','#4','5','b6','6','b7','7'];
    
    const allKeys = Object.keys(groups).sort();
    allKeys.forEach(key => {
        if (!displayOrder.includes(key)) {
            displayOrder.push(key);
        }
    });
    
    displayOrder.forEach((key) => {
        if (groups[key] && groups[key].length > 0) {
            const groupBox = document.createElement('div');
            groupBox.className = 'group-box';
            // Group names no longer stored - just use the key
            const groupTitleText = key;
            
            const titleBox = document.createElement('div');
            titleBox.className = 'group-title-box';
            titleBox.setAttribute('data-group-key', key);
            // Toggle on hover and click (click helps mobile/touch users)
            titleBox.onmouseenter = () => toggleGroupContent(key);
            titleBox.onclick = () => toggleGroupContent(key);
            titleBox.innerHTML = `
                <span class="group-title-text">${escapeHtml(groupTitleText)}</span>
            `;
            
            groupBox.appendChild(titleBox);
            boxesWrapper.appendChild(groupBox);
            
            const contentContainer = document.createElement('div');
            contentContainer.className = 'group-content-container collapsed';
            contentContainer.id = `group-content-${key}`;
            contentContainer.setAttribute('data-group-key', key);
            
            const groupContentBox = document.createElement('div');
            groupContentBox.className = 'group-content-box';
            
            let allContent = '';
            
            groups[key].forEach((prog) => {
                // Check if we have progressions data from JSON
                if (prog.progressions && prog.progressions.length > 0) {
                    prog.progressions.forEach((progression) => {
                        // Build the chord progression with bars
                        if (Array.isArray(progression.progression) && progression.progression.length > 0) {
                            // Generate progression ID for linking to progressionInfo
                            const progressionId = chordsToProgressionId(progression.progression);
                            const encodedLine = encodeURIComponent(progressionId);
                            
                            // Check for multi-phrase structure (3-level array)
                            const isMultiPhrase = progression.progression.length > 0 && 
                                Array.isArray(progression.progression[0]) && 
                                progression.progression[0].length > 0 && 
                                Array.isArray(progression.progression[0][0]);
                            
                            if (isMultiPhrase) {
                                // Multi-phrase: [[["1"], ["4"]], [["5"], ["6m"]]]
                                let phraseGroupHTML = `<div class="phrase-group">`;
                                
                                progression.progression.forEach((phrase) => {
                                    phraseGroupHTML += `<div class="progression-grid" data-prog-index="${prog.origIndex}" data-line="${encodedLine}">`;
                                    
                                    phrase.forEach((barChords) => {
                                        const isMultiChord = Array.isArray(barChords) && barChords.length > 1;
                                        const multiClass = isMultiChord ? ' multi-chord' : '';
                                        phraseGroupHTML += `<div class="progression-bar${multiClass}">`;
                                        
                                        if (Array.isArray(barChords)) {
                                            barChords.forEach((chord) => {
                                                phraseGroupHTML += `<span class="chord-item">${escapeHtml(chord)}</span>`;
                                            });
                                        } else {
                                            phraseGroupHTML += `<span class="chord-item">${escapeHtml(barChords)}</span>`;
                                        }
                                        
                                        phraseGroupHTML += `</div>`;
                                    });
                                    
                                    phraseGroupHTML += `</div>`;
                                });
                                
                                phraseGroupHTML += `</div>`;
                                allContent += phraseGroupHTML;
                            } else if (Array.isArray(progression.progression[0])) {
                                // Single phrase with bars: [["6m"], ["4"], ["5"], ["1"]]
                                let gridHTML = `<div class="progression-grid" data-prog-index="${prog.origIndex}" data-line="${encodedLine}">`;
                                
                                progression.progression.forEach((barChords) => {
                                    const isMultiChord = Array.isArray(barChords) && barChords.length > 1;
                                    const multiClass = isMultiChord ? ' multi-chord' : '';
                                    gridHTML += `<div class="progression-bar${multiClass}">`;
                                    
                                    if (Array.isArray(barChords)) {
                                        barChords.forEach((chord) => {
                                            gridHTML += `<span class="chord-item">${escapeHtml(chord)}</span>`;
                                        });
                                    } else {
                                        gridHTML += `<span class="chord-item">${escapeHtml(barChords)}</span>`;
                                    }
                                    
                                    gridHTML += `</div>`;
                                });
                                
                                gridHTML += `</div>`;
                                allContent += gridHTML;
                            } else {
                                // Simple array: ["1", "4", "5", "1"]
                                let gridHTML = `<div class="progression-grid" data-prog-index="${prog.origIndex}" data-line="${encodedLine}">`;
                                
                                progression.progression.forEach((chord) => {
                                    gridHTML += `<div class="progression-bar">`;
                                    gridHTML += `<span class="chord-item">${escapeHtml(chord)}</span>`;
                                    gridHTML += `</div>`;
                                });
                                
                                gridHTML += `</div>`;
                                allContent += gridHTML;
                            }
                        }
                    });
                }
            });
            
            groupContentBox.innerHTML = allContent;
            contentContainer.appendChild(groupContentBox);
            contentWrapper.appendChild(contentContainer);
        }
    });
    
    list.appendChild(boxesWrapper);
    list.appendChild(contentWrapper);
    
    list.addEventListener('click', (e) => {
        const progressionGrid = e.target.closest('.progression-grid');
        if (progressionGrid) {
            const progIndex = parseInt(progressionGrid.getAttribute('data-prog-index'));
            const encodedLine = progressionGrid.getAttribute('data-line');
            if (typeof showDetail === 'function') {
                showDetail(progIndex, encodedLine);
            }
        }
    });
    
    // Auto-open the first available group so content is visible immediately
    const firstKey = displayOrder.find(k => groups[k] && groups[k].length > 0);
    if (firstKey) {
        toggleGroupContent(firstKey);
    }

    if (currentOpenGroupCP) {
        const previousContainer = document.getElementById(`group-content-${currentOpenGroupCP}`);
        if (previousContainer) {
            previousContainer.classList.remove('collapsed');
        }
    }
    } catch (error) {
        console.error('Error rendering progressions:', error);
        LoadingManager.showError('progressionsList');
    }
}

function toggleGroupContent(key) {
    if (currentOpenGroupCP === key) {
        return;
    }
    
    const allContainers = document.querySelectorAll('.group-content-container');
    allContainers.forEach(container => {
        container.classList.add('collapsed');
    });
    
    const targetContainer = document.getElementById(`group-content-${key}`);
    if (targetContainer) {
        targetContainer.classList.remove('collapsed');
        currentOpenGroupCP = key;
    }
}

// Export for use in app.js
if (typeof window !== 'undefined') {
    window.renderProgressions = renderProgressions;
}

})(); // End IIFE