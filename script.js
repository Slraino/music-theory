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
    SITE_DESCRIPTION: 'siteDescription'
};

// Track currently open group for accordion
let currentOpenGroup = null;

// Initialize progressions from music-theory-data.json
function initializeProgressions() {
    let progs = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROGRESSIONS)) || [];
    if (progs.length === 0) {
        // Load from music-theory-data.json
        fetch('music-theory-data.json')
            .then(response => response.json())
            .then(data => {
                // Extract progressions from chordProgressions structure
                const progressions = [];
                if (data.chordProgressions && Array.isArray(data.chordProgressions)) {
                    data.chordProgressions.forEach(group => {
                        progressions.push({
                            title: group.note,
                            content: group.note
                        });
                    });
                }
                localStorage.setItem(STORAGE_KEYS.PROGRESSIONS, JSON.stringify(progressions));
                StorageManager.set('progressions', 'default', progressions);
                console.log('Loaded', progressions.length, 'progressions from music-theory-data.json');
            })
            .catch(error => {
                console.error('Failed to load music-theory-data.json:', error);
                // Fallback to minimal defaults if file not found
                const defaults = ["1","b2","2","b3","3","4","#4","5","b6","6","b7","7"].map(note => ({
                    title: note,
                    content: note
                }));
                localStorage.setItem(STORAGE_KEYS.PROGRESSIONS, JSON.stringify(defaults));
                StorageManager.set('progressions', 'default', defaults);
            });
    }
    return progs;
}

function loadProgressions() {
    initializeProgressions();
    const progs = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROGRESSIONS)) || [];

    // Hide detail-controls on this page
    const detailControls = document.getElementById('detailControls');
    if (detailControls) {
        detailControls.style.display = 'none';
    }

    // Hide progression controls
    const progressionControls = document.getElementById('progressionControls');
    if (progressionControls) {
        progressionControls.innerHTML = '';
        progressionControls.style.display = 'none';
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
                            <p class="progression-notes ${clickableClass} ${crimsonClass}" ${isClickable ? `data-prog-index="${prog.origIndex}" data-line="${encodedLine}"` : ''}>${styledLine}</p>
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
            
            groupContentBox.innerHTML = allContent;
            contentContainer.appendChild(groupContentBox);
            contentWrapper.appendChild(contentContainer);
        }
    });
    
    list.appendChild(boxesWrapper);
    list.appendChild(contentWrapper);
    
    // Add event delegation for clickable lines
    list.addEventListener('click', (e) => {
        const clickableLine = e.target.closest('.clickable-line');
        if (clickableLine) {
            const progIndex = parseInt(clickableLine.getAttribute('data-prog-index'));
            const encodedLine = clickableLine.getAttribute('data-line');
            showDetail(progIndex, encodedLine);
        }
    });
    
    // Restore the previously open group if it exists
    if (currentOpenGroup) {
        const previousContainer = document.getElementById(`group-content-${currentOpenGroup}`);
        if (previousContainer) {
            previousContainer.classList.remove('collapsed');
        }
    }
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
window.addEventListener('DOMContentLoaded', async () => {
    // Ensure siteDescription has a default value before autoRestore
    if (!localStorage.getItem(STORAGE_KEYS.SITE_DESCRIPTION)) {
        localStorage.setItem(STORAGE_KEYS.SITE_DESCRIPTION, 'Learn and explore chord progressions and music theory concepts.');
    }
    
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
        // Use setTimeout to ensure DOM is fully rendered before setting value
        setTimeout(() => {
            loadSiteDescription();
        }, 10);
    }
    
    // Only load progressions if the progressionsList element exists
    if (document.getElementById('progressionsList')) {
        loadProgressions();
        // Expand group "1" by default
        setTimeout(() => {
            const group1Container = document.getElementById('group-content-1');
            if (group1Container) {
                group1Container.classList.remove('collapsed');
                currentOpenGroup = '1';
            }
        }, 100);
    }
});

// Load and display site description
function loadSiteDescription() {
    const defaultDescription = 'Learn and explore chord progressions and music theory concepts.';
    let savedDescription = localStorage.getItem(STORAGE_KEYS.SITE_DESCRIPTION);
    
    // If not found, check for the hardcoded default from index.html
    if (!savedDescription || savedDescription.trim() === '') {
        savedDescription = defaultDescription;
        localStorage.setItem(STORAGE_KEYS.SITE_DESCRIPTION, defaultDescription);
    }
    
    const siteDescElement = document.getElementById('siteDescription');
    if (siteDescElement) {
        siteDescElement.textContent = savedDescription;
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

// Initialize Settings Panel toggle regardless of load timing
function initSettingsPanel() {
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsPanel = document.getElementById('settingsPanel');
    if (!settingsBtn || !settingsPanel) return;
    settingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = settingsPanel.classList.contains('open');
        settingsPanel.classList.toggle('open', !isOpen);
    });
    document.addEventListener('click', (e) => {
        if (!settingsPanel.contains(e.target) && e.target !== settingsBtn) {
            settingsPanel.classList.remove('open');
        }
    });

    // Prevent clicks inside the panel from bubbling to the document close handler
    settingsPanel.addEventListener('click', (e) => {
        e.stopPropagation();
    });
}

if (document.readyState !== 'loading') {
    initSettingsPanel();
} else {
    document.addEventListener('DOMContentLoaded', initSettingsPanel);
}

