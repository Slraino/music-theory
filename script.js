// Helper function to prevent HTML injection
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Storage abstraction layer - tries IndexedDB, falls back to localStorage
const StorageManager = {
    async set(storeName, key, value) {
        try {
            if (typeof db !== 'undefined' && db.ready) {
                await db.set(storeName, key, value);
            }
        } catch (error) {
            console.warn('IndexedDB write failed, using localStorage:', error);
        }
        // Also save to localStorage as fallback
        const lsKey = storeName === 'progressions' ? 'musicProgressions' : 
                      storeName === 'progressionDetails' ? 'progressionDetails' :
                      storeName === 'groupNames' ? 'groupCustomNames' : key;
        localStorage.setItem(lsKey, JSON.stringify(value));
    },

    async get(storeName, key) {
        try {
            if (typeof db !== 'undefined' && db.ready) {
                const value = await db.get(storeName, key);
                if (value !== null) {
                    return value;
                }
            }
        } catch (error) {
            console.warn('IndexedDB read failed, using localStorage:', error);
        }
        // Fallback to localStorage
        const lsKey = storeName === 'progressions' ? 'musicProgressions' : 
                      storeName === 'progressionDetails' ? 'progressionDetails' :
                      storeName === 'groupNames' ? 'groupCustomNames' : key;
        const value = localStorage.getItem(lsKey);
        return value ? JSON.parse(value) : null;
    }
};

// LocalStorage keys
const STORAGE_KEYS = {
    PROGRESSIONS: 'musicProgressions',
    GROUP_NAMES: 'groupCustomNames',
    SITE_DESCRIPTION: 'siteDescription',
    OWNER_MODE: 'ownerModeEnabled'
};

// Owner mode management
let EDIT_UI_ENABLED = localStorage.getItem(STORAGE_KEYS.OWNER_MODE) === 'true';

function toggleOwnerMode() {
    const password = prompt('Enter owner password to unlock editing:');
    if (password === 'live@life04') {
        EDIT_UI_ENABLED = true;
        localStorage.setItem(STORAGE_KEYS.OWNER_MODE, 'true');
        alert('✓ Owner mode enabled! Drag and delete buttons are now visible.');
        location.reload();
    } else if (password !== null) {
        alert('✗ Incorrect password.');
    }
}

function disableOwnerMode() {
    EDIT_UI_ENABLED = false;
    localStorage.setItem(STORAGE_KEYS.OWNER_MODE, 'false');
    alert('✓ Owner mode disabled.');
    location.reload();
}

// Auto-restore data from JSON file on page load if localStorage is empty
function autoRestoreFromBackup() {
    const hasProgressions = localStorage.getItem(STORAGE_KEYS.PROGRESSIONS);
    const hasTheories = localStorage.getItem('musicTheory');
    
    // If data exists, don't restore
    if (hasProgressions && hasTheories) {
        return;
    }
    
    // Try to restore from backup JSON file
    fetch('music-theory-data.json')
        .then(response => response.json())
        .then(data => {
            if (data.progressions) {
                localStorage.setItem(STORAGE_KEYS.PROGRESSIONS, JSON.stringify(data.progressions));
            }
            if (data.progressionDetails) {
                localStorage.setItem('progressionDetails', JSON.stringify(data.progressionDetails));
            }
            if (data.musicTheory) {
                localStorage.setItem('musicTheory', JSON.stringify(data.musicTheory));
            }
            if (data.theoryOrder) {
                localStorage.setItem('theoryOrder', JSON.stringify(data.theoryOrder));
            }
            if (data.groupNames) {
                localStorage.setItem(STORAGE_KEYS.GROUP_NAMES, JSON.stringify(data.groupNames));
            }
            console.log('✓ Data restored from backup');
        })
        .catch(err => {
            console.debug('No backup found or failed to restore');
        });
}

// Auto-save functionality - saves data every 3 minutes
function autoSaveData() {
    const data = {
        progressions: localStorage.getItem(STORAGE_KEYS.PROGRESSIONS),
        progressionDetails: localStorage.getItem('progressionDetails'),
        musicTheory: localStorage.getItem('musicTheory'),
        theoryOrder: localStorage.getItem('theoryOrder'),
        groupNames: localStorage.getItem(STORAGE_KEYS.GROUP_NAMES),
        settings: {
            musicVolume: localStorage.getItem('musicVolume'),
            musicEnabled: localStorage.getItem('musicEnabled'),
            sfxVolume: localStorage.getItem('sfxVolume'),
            sfxEnabled: localStorage.getItem('sfxEnabled')
        },
        timestamp: new Date().toISOString()
    };
    
    // Try to save to server if available (non-blocking)
    fetch('/api/save-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        keepalive: true
    }).catch(err => {
        // Silently fail - server may not be running
        console.debug('Auto-save to server failed (expected if server not running)');
    });
}

// Edit current progression
function editCurrentProgression() {
    if (!isOwnerMode()) return;
    alert('Edit progression feature - you can add this functionality to edit progression titles');
}

// Manual save with audio feedback
function manualSaveData() {
    const data = {
        progressions: localStorage.getItem(STORAGE_KEYS.PROGRESSIONS),
        progressionDetails: localStorage.getItem('progressionDetails'),
        musicTheory: localStorage.getItem('musicTheory'),
        theoryOrder: localStorage.getItem('theoryOrder'),
        groupNames: localStorage.getItem(STORAGE_KEYS.GROUP_NAMES),
        settings: {
            musicVolume: localStorage.getItem('musicVolume'),
            musicEnabled: localStorage.getItem('musicEnabled'),
            sfxVolume: localStorage.getItem('sfxVolume'),
            sfxEnabled: localStorage.getItem('sfxEnabled')
        },
        timestamp: new Date().toISOString()
    };
    
    // Save to server
    fetch('/api/save-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        keepalive: true
    }).then(() => {
        // Success - play success sound
        if (typeof soundEffects !== 'undefined') {
            soundEffects.playSoftBeepSound();
        }
        console.log('✓ Data saved successfully');
    }).catch(err => {
        // Failed - play error sound
        if (typeof soundEffects !== 'undefined') {
            soundEffects.playClickSound();
        }
        console.log('✗ Save failed (server may not be running)');
    });
}

// Config: owner mode based on localStorage
// Initialized above with STORAGE_KEYS.OWNER_MODE check

// Owner mode detection based on localStorage flag
function isOwnerMode() {
    return EDIT_UI_ENABLED;
}

// Toggle group content visibility (accordion - only one open at a time)
function toggleGroupContent(key) {

    
    // If clicking the same group, don't close it
    if (currentOpenGroup === key) {

        return;
    }
    
    // Close all other content containers
    const allContainers = document.querySelectorAll('.group-content-container');
    allContainers.forEach(container => {
        if (container.id !== `group-content-${key}`) {
            container.classList.add('collapsed');

        }
    });
    
    // Open current container
    const contentContainer = document.getElementById(`group-content-${key}`);

    
    if (contentContainer) {
        contentContainer.classList.remove('collapsed');
        currentOpenGroup = key;

    } else {
        console.error('Container not found for key:', key);
    }
}

// Initialize progressions if empty
function initializeProgressions() {
    let progs = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROGRESSIONS)) || [];
    if (progs.length === 0) {
        progs = [{"title":"b2","content":"b2"},{"title":"2","content":"2"},{"title":"b3","content":"b3"},{"title":"3","content":"3"},{"title":"4","content":"4"},{"title":"#4","content":"#4"},{"title":"5","content":"5"},{"title":"b6","content":"b6"},{"title":"6","content":"6"},{"title":"b7","content":"b7"},{"title":"7","content":"7"},{"title":"6 4 5 1","content":"6m - 4 - 5 - 1\n6m - 4 - 5 - 1 - 5/7\n6m - 4 - 5 - 1 - 3/7"},{"title":"6 3 4 1","content":"6m - 3m - 4 - 5\n6m - 3m - 4 - 1"},{"title":"4 5 3 6","content":"4 - 5 - 3m - 6m"},{"title":"2 5 1","content":"2m - 5 - 1"},{"title":"1","content":"1 - 5/7 - 5m/b7 - 4/6 - 4m/b6 - 1/5 - 2/#4 - 5 \n[ Chromatic Descent / Seondary Dominant ( 2/#4 ) / Model Interchange ( 5m/b7 / 4mb6 / 2/#4 ) ]\n\n1 7 6 5 4 3 2 5ㅤ[ Cannon ]ㅤ1 5 6 3 4 1 4 5\n1 - 5/7 - 6m - 3m/5 - 4 - 1/3 - 2m - 5ㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤ[ Verse = キセキ ]\n1 - 7ø & 3/#5 - 6m - 5m & 17 - 4M7 - 1/3 - 2M7 - 4/5 & 4m/5ㅤㅤ[ Chorus = Pretender ]\n1 - 7ø & 3 - 6m - 5m & 1 - 4......ㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤ[ Chorus = クラクラ ]\n\n1 b7 6m 4\n1 b7 b6 5\n1 b7 4 4m\n1 b7m 1 b7m\n1 b6o 6m b7\n1 b6 1 b6\n1 5 6 5\n\n1 - 7o - 6m - b6\n\n1 5 6 4ㅤ[ Axis Progression ]\n1 - 5 - 6m - 4\n1 - 5 - 6m - 27ㅤ[ Chorus = クリスマスソング ] \n\n1 5 6 3\n1 - 5m - 4 - 4m\n\n1 4 6 5ㅤ[ 50s progression ]\n1 4 6m 5\n1 4m 6m 5\n\n1 & 5m & 17 - 4 - 5 - 6m [ 9/8 ] [ Debussy - Clair De Lune ( Section 3 ) ]\n1 - 4 - 5 - 1ㅤㅤ[ Verse = 優しい忘却 ]\n1 -4 - 1/3 - 4ㅤ[ 9/8 ] [ Debussy - Clair de Lune ( Section 1, 0:34 ) ]\n1 - 4 - 1 - 4\n1 - 47 - 1 - 47\n1 - 4 - 2m - b2\n\n1 3 6\n1 - 1 - 3o - 6m ㅤ[ Chorus = Violet Snow ]\n1 - 3m - 6m - 5ㅤ[ Chorus = Silent ]\n1 - 37 - 6m - 5ㅤ [ Chorus = Orange ]\n1 3 2 5\n\n1 - 27 - 1 - 27ㅤ[ Lydian / Secondary Dominant ]\n1 - 2 - 1 - 2 ㅤ[ Lydian ]\n\n1 - b2o - 2m - 5ㅤ[ IT'S - YOU ( Max ) ]\n\n**1 1 1 1**\n1M7 - 17 - 1add6 - 1+\n1 - 1+ - 6m/1 - 17 ㅤㅤㅤ[ Chromatic Accents / Line Cliche ]\n1 omit3 - 1add6 omit3 ㅤ[ Blues ]\n1 - 4/1 - 1 - 4m/1","displayTitle":""}];
        StorageManager.set('progressions', 'default', progs);
    }
    return progs;
}


function loadProgressions() {
    initializeProgressions();
    const progs = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROGRESSIONS)) || [];
    console.log('📊 Loaded progressions:', progs.length);

    // Show edit button if in owner mode (for chord progression page)
    const progressionControls = document.getElementById('progressionControls');
    if (progressionControls) {
        progressionControls.innerHTML = '';
        if (isOwnerMode()) {
            progressionControls.innerHTML = `<span class="edit-icon" onclick="editCurrentProgression()" title="Edit Progression">✏️</span>`;
        }
    }
    
    const list = document.getElementById('progressionsList');
    if (!list) {
        console.error('progressionsList element not found!');
        return;
    }
    list.innerHTML = '';
    
    // Create wrapper divs
    const boxesWrapper = document.createElement('div');
    boxesWrapper.className = 'boxes-wrapper';
    
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'content-wrapper';
    
    // Group progressions by first character(s)
    const groups = {};
    progs.forEach((prog, idx) => {
        let key = prog.title.charAt(0);
        
        // Extract 2-character prefix for accidentals (b, #)
        if ((key === 'b' || key === '#') && prog.title.length > 1) {
            key = prog.title.substring(0, 2);
        }
        
        // Initialize group if not exists
        if (!groups[key]) {
            groups[key] = [];
        }
        
        groups[key].push({ ...prog, origIndex: idx });
    });
    console.log('🎵 Groups created:', Object.keys(groups));
    
    // Define display order: ascending from 1 to 7
    const displayOrder = ['1','b2','2','b3','3','4','#4','5','b6','6','b7','7'];
    
    // Also include any other keys not in the main display order
    const allKeys = Object.keys(groups).sort();
    allKeys.forEach(key => {
        if (!displayOrder.includes(key)) {
            displayOrder.push(key);
        }
    });
    
    displayOrder.forEach((key, displayIdx) => {
        if (groups[key] && groups[key].length > 0) {
            // Create group box container
            const groupBox = document.createElement('div');
            groupBox.className = 'group-box';
            
            // Create clickable title box
            const customNames = JSON.parse(localStorage.getItem(STORAGE_KEYS.GROUP_NAMES)) || {};
            const groupTitleText = customNames[key] || key;
            
            const titleBox = document.createElement('div');
            titleBox.className = 'group-title-box';
            titleBox.setAttribute('data-group-key', key);
            titleBox.onmouseenter = () => toggleGroupContent(key);
            titleBox.innerHTML = `
                <span class="group-title-text">${escapeHtml(groupTitleText)}</span>
            `;
            
            // Make title editable if owner mode
            if (isOwnerMode()) {
                titleBox.style.cursor = 'pointer';
            }
            
            groupBox.appendChild(titleBox);
            boxesWrapper.appendChild(groupBox);
            
            // Create collapsible content container (add to contentWrapper)
            const contentContainer = document.createElement('div');
            contentContainer.className = 'group-content-container collapsed';
            contentContainer.id = `group-content-${key}`;
            contentContainer.setAttribute('data-group-key', key);
            
            // Add all progressions to content
            const groupContentBox = document.createElement('div');
            groupContentBox.className = 'group-content-box';
            
            let allContent = '';
            
            groups[key].forEach((prog, idx) => {
                const contentLines = prog.content.split('\n');
                let shouldBeCrimson = false;
                
                contentLines.forEach((line, lineIdx) => {
                    // Check if line is ****
                    if (line.trim() === '****') {
                        shouldBeCrimson = true;
                        // Don't display the **** marker itself
                        return;
                    }
                    
                    if (line.trim()) {
                        // Parse **text** for styled sections
                        const styledLine = line.replace(/\*\*(.*?)\*\*/g, '<span class="bullet-dot">●</span> <span class="styled-text">$1</span>');
                        // Check if this line has styled text (**text**)
                        const hasStyledText = line.includes('**');
                        
                        // Only make lines clickable if they have content AND don't contain styling markers
                        const hasContent = line.trim().length > 0;
                        const isClickable = hasContent && !hasStyledText;
                        const clickableClass = isClickable ? 'clickable-line' : '';
                        const crimsonClass = shouldBeCrimson ? 'crimson-text' : '';
                        const encodedLine = isClickable ? encodeURIComponent(line.trim()) : '';
                        allContent += `
                            <p class="progression-notes ${clickableClass} ${crimsonClass}" ${isClickable ? `onclick="showDetail(${prog.origIndex}, '${encodedLine}')"` : ''}>${styledLine}</p>
                        `;
                        
                        // If this line has styled text, turn on crimson for the next lines
                        if (hasStyledText) {
                            shouldBeCrimson = true;
                        }
                    } else {
                        // Empty line resets the shouldBeCrimson flag
                        shouldBeCrimson = false;
                        // Empty line for spacing
                        allContent += `<p class="progression-notes" style="height: 10px; margin: 0;"></p>`;
                    }
                });
            });
            
            // Add single Edit button at the end if owner mode
            if (isOwnerMode()) {
                allContent += `<div class="group-edit-container"><span class="edit-icon" onclick="startGroupEdit('${key}')" title="Edit">✏️</span></div>`;
            }
            
            groupContentBox.innerHTML = allContent;
            contentContainer.appendChild(groupContentBox);
            contentWrapper.appendChild(contentContainer);
        }
    });
    
    list.appendChild(boxesWrapper);
    list.appendChild(contentWrapper);
    
    // Restore the previously open group if it exists
    if (currentOpenGroup) {
        const previousContainer = document.getElementById(`group-content-${currentOpenGroup}`);
        if (previousContainer) {
            previousContainer.classList.remove('collapsed');

        }
    }
}

// Group edit mode
function startGroupEdit(groupKey) {
    if (!isOwnerMode()) return;
    
    const progs = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROGRESSIONS)) || [];
    const contentContainer = document.getElementById(`group-content-${groupKey}`);
    const progContainer = contentContainer.querySelector('.group-content-box');
    
    // Filter progressions that belong to this group
    const groupProgresses = progs.filter(p => {
        const firstChar = p.title.charAt(0);
        const isSingleChar = firstChar === groupKey;
        const isTwoChar = groupKey.length === 2 && p.title.substring(0, 2) === groupKey;
        return isSingleChar || isTwoChar;
    });
    
    const customNames = JSON.parse(localStorage.getItem(STORAGE_KEYS.GROUP_NAMES)) || {};
    const currentGroupName = customNames[groupKey] || groupKey;
    
    // Combine all progressions into one text
    let combinedAllContent = '';
    groupProgresses.forEach((prog) => {
        combinedAllContent += prog.content + '\n\n';
    });
    combinedAllContent = combinedAllContent.trim();

    let html = `
        <div class="group-edit-form">
            <div class="group-name-edit">
                <label>Group Name:</label>
                <input type="text" id="group-name-edit" value="${escapeHtml(currentGroupName)}" placeholder="Group name" />
            </div>
            <div class="progression-edit-row">
                <label style="display: block; margin-bottom: 8px; color: #b0b0b0;">Edit content (use <strong>**text**</strong> to style words as titles):</label>
                <textarea class="group-edit-combined" id="group-content-all" placeholder="Enter your content here...&#10;Use **text** to make styled titles" style="min-height: 300px;">${escapeHtml(combinedAllContent)}</textarea>
            </div>
        </div>
        <div class="group-edit-controls">
            <button class="group-edit-save" onclick="saveGroupEditCombined('${escapeHtml(groupKey).replace(/'/g, "\\'")}')" >Save All</button>
            <button class="group-edit-cancel" onclick="cancelGroupEdit('${escapeHtml(groupKey).replace(/'/g, "\\'")}')" >Cancel</button>
        </div>
    `;
    
    progContainer.innerHTML = html;
}

function saveGroupEditCombined(groupKey) {
    const progs = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROGRESSIONS)) || [];
    const customNames = JSON.parse(localStorage.getItem(STORAGE_KEYS.GROUP_NAMES)) || {};
    
    // Save group name if changed
    const newGroupName = document.getElementById('group-name-edit').value.trim();
    if (newGroupName !== '') {
        customNames[groupKey] = newGroupName;
    } else {
        delete customNames[groupKey];
    }
    
    // Get the content
    const content = document.getElementById('group-content-all').value.trim();
    if (!content) {
        alert('Please enter content!');
        return;
    }
    
    // Create a single progression object with the group key as title
    const newProgressions = [{
        title: groupKey,
        content: content,
        displayTitle: ''
    }];
    
    // Remove all progressions in this group from progs array
    for (let i = progs.length - 1; i >= 0; i--) {
        const prog = progs[i];
        const firstChar = prog.title.charAt(0);
        const isSingleChar = firstChar === groupKey;
        const isTwoChar = groupKey.length === 2 && prog.title.substring(0, 2) === groupKey;
        
        if (isSingleChar || isTwoChar) {
            progs.splice(i, 1);
        }
    }
    
    // Add the new progressions to the end
    newProgressions.forEach(prog => {
        progs.push(prog);
    });
    
    localStorage.setItem(STORAGE_KEYS.PROGRESSIONS, JSON.stringify(progs));
    localStorage.setItem(STORAGE_KEYS.GROUP_NAMES, JSON.stringify(customNames));
    StorageManager.set('progressions', 'default', progs);
    StorageManager.set('groupNames', 'default', customNames);
    loadProgressions();
}

function cancelGroupEdit(groupKey) {
    loadProgressions();
}

// Show detail page for a progression
function showDetail(index, lineContent) {
    // Navigate to progression info page with ID and the clicked line for title
    let encodedContent;
    
    // If lineContent is a string (the actual line text)
    if (typeof lineContent === 'string' && lineContent.length > 0) {
        // It's already encoded from the onclick
        encodedContent = lineContent;
    } else {
        // Fallback to getting from prog (shouldn't happen now)
        const progs = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROGRESSIONS)) || [];
        const prog = progs[index];
        encodedContent = encodeURIComponent(prog.title);
    }
    
    const detailUrl = `progression-info.html?id=${index}&lineTitle=${encodedContent}`;
    window.location.href = detailUrl;
}

// Load progressions when page starts (only on chord-progressions page)
window.addEventListener('DOMContentLoaded', () => {
    // Auto-restore from backup JSON on page load
    autoRestoreFromBackup();
    
    // Auto-recover progression details from IndexedDB if localStorage is empty
    let progressionDetails = JSON.parse(localStorage.getItem('progressionDetails')) || {};
    if (Object.keys(progressionDetails).length === 0 && typeof db !== 'undefined' && db.ready) {
        db.get('progressionDetails', 'default').then(idbData => {
            if (idbData && Object.keys(idbData).length > 0) {
                localStorage.setItem('progressionDetails', JSON.stringify(idbData));
                console.log('Recovered progression details from IndexedDB');
                // Reload if we're on the progression info page
                if (document.getElementById('progressionInfoPage')) {
                    location.reload();
                }
            }
        }).catch(() => {
            // IndexedDB recovery failed, use default
            console.log('IndexedDB recovery failed, using default fallback');
            setDefaultProgressionDetails();
        });
    } else if (Object.keys(progressionDetails).length === 0) {
        setDefaultProgressionDetails();
    }

    function setDefaultProgressionDetails() {
        const defaults = {"1 - 2 - 4 - 6m":{"theory":"Diatonic\n< Info >\nin scale","music":""},"New Theory":{"theory":"Chromatic \n< Info >\nnot in scale","music":""},"1M7 - 17 - 1add6 - 1+ㅤㅤ[ Chromatic Descent ]ㅤ[ Verse: 漫ろ雨 ]":{"theory":"Pedal Note","music":""},"15:1M7 - 17 - 1add6 - 1+ㅤㅤ[ Chromatic Descent ]ㅤ[ Verse: 漫ろ雨 ]":{"theory":"Pedal Note / Chromatic Descent","music":"","genre":""},"15:1M7 - 17 - 1add6 - 1+":{"theory":"[ Pedal Note ] [ Chromatic Descent ]","music":"","genre":""}};
        localStorage.setItem('progressionDetails', JSON.stringify(defaults));
        StorageManager.set('progressionDetails', 'default', defaults);
    }

// Load site description if on main page
    if (document.getElementById('siteDescription')) {
        loadSiteDescription();
    }
    
    // Only load progressions if the progressionsList element exists
    if (document.getElementById('progressionsList')) {
        loadProgressions();
        // Expand group "1" by default
        const group1Box = document.querySelector('[data-group-key="1"]');
        if (group1Box) {
            toggleGroupContent('1');
        }
    }
});

// Load and display site description
function loadSiteDescription() {
    const savedDescription = localStorage.getItem(STORAGE_KEYS.SITE_DESCRIPTION) || 'Learn and explore chord progressions and music theory concepts.';
    document.getElementById('siteDescription').textContent = savedDescription;
    
    // Show edit button in owner mode
    if (isOwnerMode()) {
        document.getElementById('editDescBtn').style.display = 'inline-block';
        document.getElementById('editDescBtn').onclick = editSiteDescription;
        document.getElementById('siteDescription').style.cursor = 'pointer';
        document.getElementById('siteDescription').onclick = editSiteDescription;
    }
}

// Edit site description
function editSiteDescription() {
    if (!isOwnerMode()) return;
    
    const currentDescription = localStorage.getItem('siteDescription') || 'Learn and explore chord progressions and music theory concepts.';
    const newDescription = prompt('Edit site description:', currentDescription);
    
    if (newDescription !== null && newDescription.trim() !== '') {
        localStorage.setItem('siteDescription', newDescription.trim());
        StorageManager.set('settings', 'siteDescription', newDescription.trim());
        loadSiteDescription();
    }
}

// Updated showDetail for SPA navigation
function showDetail(indexOrLineText, encodedLineTitle) {
    // Support both old format (index) and new format (line text)
    let lineTitle = '';
    let progIndex = '';
    
    if (typeof indexOrLineText === 'number') {
        progIndex = String(indexOrLineText);
    } else if (typeof indexOrLineText === 'string') {
        lineTitle = decodeURIComponent(indexOrLineText);
    } 
    
    if (typeof encodedLineTitle === 'string') {
        lineTitle = decodeURIComponent(encodedLineTitle);
    }
    
    if ((lineTitle || progIndex) && router) {
        // Create unique key combining progression index and line title
        const uniqueKey = progIndex ? `${progIndex}:${lineTitle}` : lineTitle;
        
        // Store the line title and progression index for the progression-info page to find
        window.lastSelectedLineTitle = lineTitle;
        window.lastSelectedProgIndex = progIndex;
        window.lastSelectedUniqueKey = uniqueKey;
        
        // Navigate to progression-info.html with line title as parameter
        router.loadPage('progression-info.html');
        
        // Set URL parameter for bookmark/share capability
        window.history.pushState({ page: 'progression-info.html', lineTitle, progIndex }, '', 'progression-info.html?lineTitle=' + encodeURIComponent(lineTitle) + '&progIndex=' + progIndex);
    }
}

