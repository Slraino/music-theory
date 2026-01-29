// Get progression info data from DataService
let progressionInfoData = {};

async function loadProgressionInfo() {
    progressionInfoData = await DataService.getProgressionInfo();
    return progressionInfoData;
}

// Initialize on load
loadProgressionInfo();

// Helper: Convert chord array to progression ID
// [["6m"], ["4"], ["5"], ["1"]] → "6m-4-5-1"
// [["6m", "4", "5"], ["1"], ["5/7"], ["1"]] → "6m,4,5-1-5/7-1"
function chordsToProgressionId(chords) {
    if (!Array.isArray(chords)) return '';
    
    // Handle nested arrays (bar format)
    if (Array.isArray(chords[0])) {
        return chords.map(bar => 
            Array.isArray(bar) ? bar.join(',') : bar
        ).join('-');
    }
    
    // Backward compatibility: simple array
    return chords.join('-');
}

// Check owner mode
function isOwnerMode() {
    return EDIT_UI_ENABLED;
}

// Event delegation for edit button - only ONE listener at document level
document.addEventListener('click', (e) => {
    if (e.target.closest('.edit-icon[data-action="edit"]') && !isEditingDetail) {
        startDetailEdit();
    }
}, true); // Use capture phase to catch before other handlers

// Helper function to prevent HTML injection
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Helper function to add tooltips based on "Word\n< Info >\nDefinition" pattern
function addTooltipsToContent(text) {
    // Find patterns like "Word\n< Info >\nDefinition"
    // and wrap Word with tooltip
    const lines = text.split('\n');
    let result = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        
        // Check if next line is "< Info >"
        if (i + 1 < lines.length && lines[i + 1].trim() === '< Info >') {
            // Check if there's a definition line after
            if (i + 2 < lines.length) {
                const definition = lines[i + 2].trim();
                if (definition && definition !== '< Info >' && definition !== '') {
                    // Wrap this word with tooltip
                    result.push(`<span class="tooltip-word" title="${escapeHtml(definition)}">${escapeHtml(trimmed)}</span>`);
                    i += 2; // Skip the "< Info >" and definition lines
                    continue;
                }
            }
        }
        
        result.push(escapeHtml(line));
    }
    
    return result.join('\n');
}

// Store current progression ID and title for editing
let currentProgId = null;
let currentLineTitle = null;
let currentUniqueKey = null;

// Helper to get the visible detail content element
function getVisibleDetailContent() {
    const progressionInfoPage = document.getElementById('progressionInfoPage');
    if (!progressionInfoPage) {
        return null;
    }
    if (progressionInfoPage.style.display === 'none') {
        return null;
    }
    
    const detailContent = progressionInfoPage.querySelector('#detailContent');
    if (!detailContent) {
        console.warn('detailContent element not found');
        return null;
    }
    return detailContent;
}

// Start editing detail
// Guard to prevent multiple edit windows opening
let isEditingDetail = false;

function startDetailEdit() {
    if (!isOwnerMode() || isEditingDetail) return;
    isEditingDetail = true;
    
    // Add a small delay to prevent rapid double-clicks from causing issues
    setTimeout(async () => {
        const progressionInfo = await DataService.getProgressionInfo();
        
        // Try multiple key formats to find the data (same logic as loadDetailView)
        let detailData = null;
        let keyToUse = null;
        
        if (currentUniqueKey && progressionInfo[currentUniqueKey]) {
            detailData = progressionInfo[currentUniqueKey];
            keyToUse = currentUniqueKey;
        }
        else if (currentLineTitle && progressionInfo[currentLineTitle]) {
            detailData = progressionInfo[currentLineTitle];
            keyToUse = currentLineTitle;
        }
        else if (currentLineTitle) {
            const matchingKey = Object.keys(progressionInfo).find(key => 
                key.includes(currentLineTitle) || currentLineTitle.includes(key.split('ㅤㅤ')[0])
            );
            if (matchingKey) {
                detailData = progressionInfo[matchingKey];
                keyToUse = matchingKey;
            }
        }
        
        if (!detailData) {
            detailData = { theory: '', music: [] };
            keyToUse = currentUniqueKey || currentLineTitle;
        }
        
        // Find the VISIBLE progressionInfoPage and its detailContent
        const progressionInfoPage = document.getElementById('progressionInfoPage');
        if (!progressionInfoPage || progressionInfoPage.style.display === 'none') {
            isEditingDetail = false;
            return;
        }
        
        const detailContent = progressionInfoPage.querySelector('#detailContent');
        if (!detailContent) {
            isEditingDetail = false;
            return;
        }
        
        detailContent.innerHTML = '';
        
        const musicJson = JSON.stringify(detailData.music || [], null, 2);
        
        detailContent.innerHTML = `
            <div class="detail-box">
                <div class="detail-edit-form">
                    <div class="progression-edit-row">
                        <label>Theory:</label>
                        <textarea class="detail-edit-theory" name="theory" id="detail-edit-theory" style="min-height: 150px;">${escapeHtml(detailData.theory || '')}</textarea>
                    </div>
                    <div class="progression-edit-row">
                        <label>Music Examples (JSON):</label>
                        <textarea class="detail-edit-music" name="music" id="detail-edit-music" style="min-height: 200px; font-family: monospace;">${escapeHtml(musicJson)}</textarea>
                        <small style="color: #666; margin-top: 4px; display: block;">Format: [{"title": "Song", "artist": "Artist", "part": "verse", "genre": "rock"}]</small>
                    </div>
                    <div class="detail-edit-controls">
                        <button class="detail-save-btn" id="detailSaveBtn">Save</button>
                        <button class="detail-cancel-btn" id="detailCancelBtn">Cancel</button>
                        <button class="detail-delete-btn" id="detailDeleteBtn">Delete</button>
                    </div>
                </div>
            </div>
        `;
        
        // Add event listeners for edit buttons (CSP-compliant)
        setTimeout(() => {
            document.getElementById('detailSaveBtn')?.addEventListener('click', saveDetailEdit);
            document.getElementById('detailCancelBtn')?.addEventListener('click', cancelDetailEdit);
            document.getElementById('detailDeleteBtn')?.addEventListener('click', deleteDetailProgression);
        }, 0);
    }, 0);
}

// Save detail edit
async function saveDetailEdit() {
    const theory = document.querySelector('.detail-edit-theory').value.trim();
    const musicText = document.querySelector('.detail-edit-music').value.trim();
    
    // Parse music JSON
    let music = [];
    if (musicText) {
        try {
            music = JSON.parse(musicText);
            if (!Array.isArray(music)) {
                alert('Music must be an array of objects. Example: [{"title": "Song", "artist": "Artist", "part": "verse", "genre": "rock"}]');
                return;
            }
        } catch (error) {
            alert('Invalid JSON format for music. Please check your syntax.');
            return;
        }
    }
    
    // Validate: at least one field must have content
    if (!theory && music.length === 0) {
        alert('Please enter content in at least one section (Theory or Music Examples).');
        return;
    }
    
    const progressionInfo = await DataService.getProgressionInfo();
    const keyToSave = currentUniqueKey || currentLineTitle;
    progressionInfo[keyToSave] = { theory, music };
    
    // Note: In a real app, you would save this to server
    // For now, it updates the in-memory cache
    console.log('Saved progression info:', keyToSave, progressionInfo[keyToSave]);
    
    isEditingDetail = false;
    loadDetailView();
}

// Cancel detail edit
function cancelDetailEdit() {
    isEditingDetail = false;
    loadDetailView();
}

// Delete progression detail
async function deleteDetailProgression() {
    if (!isOwnerMode()) return;
    
    if (confirm('Are you sure you want to delete this detail content?')) {
        const progressionInfo = await DataService.getProgressionInfo();
        const keyToDelete = currentUniqueKey || currentLineTitle;
        delete progressionInfo[keyToDelete];
        
        // Note: In a real app, you would delete this from server
        // For now, it updates the in-memory cache
        console.log('Deleted progression info:', keyToDelete);
        
        isEditingDetail = false;
        loadDetailView();
    }
}

// Load and display progression detail
async function loadDetailView() {
    // Update the header title with the clicked line
    const titleToShow = currentLineTitle || 'Unknown';
    
    // Update page title directly
    const pageTitleEl = document.getElementById('pageTitle');
    if (pageTitleEl) {
        pageTitleEl.textContent = escapeHtml(titleToShow);
    }
    
    // Show edit button only in owner mode
    const controlsDiv = document.getElementById('detailControls');
    if (controlsDiv) {
        controlsDiv.style.display = 'none';
        controlsDiv.innerHTML = ''; // Clear first
    }
    
    LoadingManager.showLoading('detailContent');
    
    try {
        const [progressionInfo, chordProgressions, musicTheory] = await Promise.all([
            DataService.getProgressionInfo(),
            DataService.getChordProgressions(),
            DataService.getMusicTheory()
        ]);
        
        let detailData = { theory: '', music: [] };
        
        // Try to find data by unique key or title
        const keyToLoad = currentUniqueKey || currentLineTitle;
        
        if (progressionInfo[keyToLoad]) {
            detailData = progressionInfo[keyToLoad];
        } else {
            // Try fuzzy match
            const matchingKey = Object.keys(progressionInfo).find(key => 
                key.includes(currentLineTitle) || currentLineTitle.includes(key)
            );
            if (matchingKey) {
                detailData = progressionInfo[matchingKey];
            }
        }
        
        const selectedProgression = findSelectedProgression(chordProgressions, currentLineTitle, currentProgId);
        const theoryNames = selectedProgression && Array.isArray(selectedProgression.theory) ? selectedProgression.theory : [];
        const combinedMusic = combineMusicExamples(selectedProgression?.music, detailData.music);
        
        // Store raw music theory for tooltip lookup
        window.musicTheoryRaw = Array.isArray(musicTheory) ? musicTheory : [];
        
        LoadingManager.showContent('detailContent');
        renderDetailView({ theoryNames, music: combinedMusic, extraTheoryText: detailData.theory });
    } catch (error) {
        console.error('Failed to load progression detail:', error);
        LoadingManager.showError('detailContent');
    }
}

function renderDetailView(detailData) {
    const sectionsHtml = buildSectionsHtml(detailData.theoryNames, detailData.extraTheoryText, detailData.music);
    
    // Find the visible detailContent within progressionInfoPage
    const detailContent = getVisibleDetailContent();
    if (!detailContent) return;
    
    detailContent.innerHTML = `
        <div class="detail-box">
            <div class="detail-body">
                ${sectionsHtml}
            </div>
        </div>
    `;

    attachTheoryHoverHandlers(detailContent);
}

function findSelectedProgression(chordProgressions, progressionId, groupIndex) {
    if (!Array.isArray(chordProgressions) || !progressionId) return null;
    
    const tryFindInGroup = (group) => {
        if (!group || !Array.isArray(group.progressions)) return null;
        return group.progressions.find(prog => {
            if (!prog || !prog.chords) return false;
            const id = chordsToProgressionId(prog.chords);
            return id === progressionId;
        }) || null;
    };
    
    if (typeof groupIndex === 'number' && chordProgressions[groupIndex]) {
        const found = tryFindInGroup(chordProgressions[groupIndex]);
        if (found) return found;
    }
    
    for (let i = 0; i < chordProgressions.length; i++) {
        const found = tryFindInGroup(chordProgressions[i]);
        if (found) return found;
    }
    
    return null;
}

function buildSectionsHtml(theoryNames, extraTheoryText, musicList) {
    let html = '';
    
    // Theory section
    const theoryLine = formatTheoryNamesLine(theoryNames);
    html += `
        <div class="detail-section">
            <div class="detail-section-title">Theory</div>
            <div class="detail-section-body">
                ${theoryLine}
            </div>
        </div>
    `;
    
    // Optional extra notes from progressionInfo
    if (extraTheoryText && extraTheoryText.trim()) {
        html += `
            <div class="detail-section">
                <div class="detail-section-title">Notes</div>
                <div class="detail-section-body">
                    ${formatTheoryText(extraTheoryText)}
                </div>
            </div>
        `;
    }
    
    // Music section
    const musicHtml = formatMusicByArtist(musicList);
    if (musicHtml) {
        html += `
            <div class="detail-section">
                <div class="detail-section-title">Music</div>
                <div class="detail-section-body">
                    ${musicHtml}
                </div>
            </div>
        `;
    }
    
    return html || '<p style="color: #888;">No detail content yet.</p>';
}

function combineMusicExamples(primary, fallback) {
    const list = [];
    const addItem = (item) => {
        if (!item || typeof item !== 'object') return;
        list.push(item);
    };
    
    if (Array.isArray(primary)) primary.forEach(addItem);
    if (Array.isArray(fallback)) fallback.forEach(addItem);
    
    return list;
}

function formatMusicByArtist(musicList) {
    if (!Array.isArray(musicList) || musicList.length === 0) {
        return '<p class="detail-line" style="color: #888;">No music examples yet.</p>';
    }
    
    const artistMap = new Map();
    musicList.forEach(song => {
        if (!song) return;
        // Handle both string and array artist formats
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
        return '<p class="detail-line" style="color: #888;">No music examples yet.</p>';
    }
    
    let html = '';
    artistMap.forEach((titles, artist) => {
        const seen = new Set();
        const titleHtml = titles
            .map(item => {
                const titleWithPart = item.part ? `${item.title} (${item.part})` : item.title;
                const key = `${titleWithPart}::${item.youtubeId || ''}`;
                if (seen.has(key)) return null;
                seen.add(key);

                const safeTitle = escapeHtml(titleWithPart);
                if (!item.youtubeId) return safeTitle;
                
                const startParam = item.clipStart && item.clipStart > 0 ? `&start=${item.clipStart}` : '';
                const iframeUrl = `https://www.youtube.com/embed/${encodeURIComponent(item.youtubeId)}?${startParam}`;
                return `<div class="music-preview">
                    <div class="music-title">${safeTitle}</div>
                    <iframe width="560" height="315" src="${escapeHtml(iframeUrl)}" 
                        title="${safeTitle}" frameborder="0" 
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                        allowfullscreen style="max-width: 100%; height: auto;"></iframe>
                </div>`;
            })
            .filter(Boolean)
            .join('');

        const line = titleHtml
            ? `${escapeHtml(artist)} - ${titleHtml}`
            : escapeHtml(artist);
        html += `<p class="detail-line music-example">${line}</p>`;
    });
    
    return html;
}

function buildTheoryContentMap(musicTheoryArray) {
    const map = {};
    musicTheoryArray.forEach(theory => {
        if (!theory || !theory.name) return;
        map[theory.name] = formatTheoryContent(theory.info, theory.characteristics, theory.type);
        if (Array.isArray(theory.items)) {
            theory.items.forEach(item => {
                if (!item || !item.name) return;
                map[item.name] = formatTheoryContent(item.info, item.characteristics, item.type);
            });
        }
    });
    return map;
}

function formatTheoryNamesLine(theoryNames) {
    if (!Array.isArray(theoryNames) || theoryNames.length === 0) {
        return '<p class="detail-line" style="color: #888;">No theory tags yet.</p>';
    }
    const safeNames = theoryNames.map(name => escapeHtml(name));
    const spans = safeNames.map(name => `<span class="theory-link" data-theory-name="${name}">${name}</span>`);
    return `<p class="detail-line">${spans.join(' ')}</p>`;
}

function attachTheoryHoverHandlers(container) {
    if (!container || container.dataset.tooltipBound === 'true') return;
    container.dataset.tooltipBound = 'true';

    container.addEventListener('mouseover', (event) => {
        const target = event.target.closest('.theory-link');
        if (!target) return;
        const name = target.getAttribute('data-theory-name');
        if (name) showTheoryTooltip(name, event);
    });

    container.addEventListener('mouseout', (event) => {
        const target = event.target.closest('.theory-link');
        if (target) hideTheoryTooltip();
    });
}

function formatTheoryContent(info, characteristics, type) {
    let contentHtml = '';
    
    if (info) {
        const infoArray = Array.isArray(info) ? info : [info];
        infoArray.forEach(line => {
            if (line && line.trim()) {
                const styledLine = styleLine(line);
                contentHtml += `<p class="detail-line">${styledLine}</p>`;
            } else {
                contentHtml += `<p class="detail-line" style="height: 10px; margin: 0;"></p>`;
            }
        });
    }
    
    if (type && Array.isArray(type)) {
        type.forEach(typeItem => {
            if (typeItem && typeItem.trim()) {
                const styledLine = styleLine(typeItem);
                contentHtml += `<p class="detail-line"><span class="bullet-dot">●</span> ${styledLine}</p>`;
            } else {
                contentHtml += `<p class="detail-line" style="height: 10px; margin: 0;"></p>`;
            }
        });
    }
    
    if (characteristics && Array.isArray(characteristics)) {
        characteristics.forEach(char => {
            if (char && char.trim()) {
                const styledLine = styleLine(char);
                contentHtml += `<p class="detail-line"><span class="bullet-dot">●</span> ${styledLine}</p>`;
            }
        });
    }
    
    return contentHtml || '<p class="detail-line" style="color: #888;">No content available.</p>';
}

function styleLine(line) {
    let styledLine = line.replace(/<(.*?)>/g, '\uE000HIGHLIGHT$1HIGHLIGHT\uE001');
    styledLine = styledLine.replace(/^\u25cf\s*/, '\uE000BULLET\uE001');
    const escapedLine = escapeHtml(styledLine);
    let hasBullet = styledLine.includes('\uE000BULLET\uE001');
    styledLine = escapedLine.replace(/\*\*(.*?)\*\*/g, '<span class="bullet-dot">●</span> <span class="styled-text">$1</span>');
    styledLine = styledLine.replace(/\uE000HIGHLIGHT(.*?)HIGHLIGHT\uE001/g, '<span class="highlight-text">&lt;$1&gt;</span>');
    if (hasBullet) {
        styledLine = styledLine.replace(/\uE000BULLET\uE001/, '<span class="bullet-dot">●</span>     ');
    }
    return styledLine;
}

function formatTheoryText(text) {
    let html = '';
    const processed = text ? addTooltipsToContent(text) : '';
    if (!processed) {
        return '<p class="detail-line" style="color: #888;">No content yet.</p>';
    }
    const lines = processed.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.trim() && line.trim() !== '< Info >') {
            const styledLine = line.replace(/\*\*(.*?)\*\*/g, '<span class="bullet-dot">●</span> <span class="styled-text">$1</span>');
            html += `<p class="detail-line">${styledLine}</p>`;
        } else if (line.trim() !== '< Info >' && line.trim() !== '') {
            html += `<p class="detail-line" style="height: 10px; margin: 0;"></p>`;
        }
    }
    return html || '<p class="detail-line" style="color: #888;">No content yet.</p>';
}

// Load progression detail for SPA
function loadProgressionDetail() {
    // First priority: use window.lastSelectedUniqueKey (most recent click)
    if (window.lastSelectedUniqueKey) {
        currentUniqueKey = window.lastSelectedUniqueKey;
        currentLineTitle = window.lastSelectedLineTitle;
        currentProgId = window.lastSelectedProgIndex ? parseInt(window.lastSelectedProgIndex) : null;
    } else {
        // Fallback: try to get lineTitle from URL params
        const params = new URLSearchParams(window.location.search);
        let lineTitle = params.get('lineTitle');
        const progIndex = params.get('progIndex');
        
        if (!lineTitle) {
            const detailContent = getVisibleDetailContent();
            if (detailContent) detailContent.innerHTML = '<p>No progression selected.</p>';
            return;
        }
        
        currentLineTitle = decodeURIComponent(lineTitle);
        currentProgId = progIndex ? parseInt(progIndex) : null;
        currentUniqueKey = progIndex ? `${progIndex}:${currentLineTitle}` : currentLineTitle;
    }
    
    loadDetailView();
}

// Load progression detail
window.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    let lineTitle = params.get('lineTitle');
    
    if (id === null && !lineTitle) {
        const detailContent = getVisibleDetailContent();
        if (detailContent) detailContent.innerHTML = '<p>No progression selected.</p>';
        return;
    }
    
    if (id !== null) {
        currentProgId = parseInt(id);
        currentLineTitle = lineTitle ? decodeURIComponent(lineTitle) : '';
    } else if (lineTitle) {
        currentLineTitle = decodeURIComponent(lineTitle);
    }
    
    const progs = JSON.parse(localStorage.getItem('musicProgressions')) || [];
    
    if (id !== null) {
        const prog = progs[currentProgId];
        if (!prog) {
            const detailContent = getVisibleDetailContent();
            if (detailContent) detailContent.innerHTML = '<p>Progression not found.</p>';
            return;
        }
    }
    
    loadDetailView();
});

// Show theory tooltip when hovering over a line
function showTheoryTooltip(lineTitle, event) {
    // Remove existing tooltip
    hideTheoryTooltip();
    
    const theoryName = lineTitle.trim();
    
    // Prefer in-memory music theory data if available
    const rawTheory = Array.isArray(window.musicTheoryRaw) ? window.musicTheoryRaw : [];
    const rawEntry = findTheoryEntryByName(theoryName, rawTheory);
    let tooltipContent = '';
    
    if (rawEntry) {
        tooltipContent = buildTooltipContentFromEntry(rawEntry);
    }
    
    // Fallback: Get theory definition from Music Theory page storage
    const musicTheory = JSON.parse(localStorage.getItem('musicTheory')) || {};
    
    // Try to find exact match first
    let theoryData = musicTheory[theoryName];
    
    // If not found, try case-insensitive search
    if (!theoryData) {
        for (const key in musicTheory) {
            if (key.toLowerCase() === theoryName.toLowerCase()) {
                theoryData = musicTheory[key];
                break;
            }
        }
    }
    
    // If not found, try partial match (check if theory name appears in stored theory content)
    if (!theoryData) {
        for (const key in musicTheory) {
            const data = musicTheory[key];
            const theory = typeof data === 'string' ? data : (data.theory || '');
            // Check first line (main title)
            const firstLine = theory.split('\n')[0];
            if (firstLine.toLowerCase() === theoryName.toLowerCase()) {
                theoryData = musicTheory[key];
                break;
            }
        }
    }
    
    // If still not found, search in subtitles
    if (!theoryData) {
        for (const key in musicTheory) {
            const data = musicTheory[key];
            const theory = typeof data === 'string' ? data : (data.theory || '');
            const lines = theory.split('\n');
            
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                // Check if this line is a subtitle matching our search
                if (line.startsWith('- ') && line.slice(2).toLowerCase() === theoryName.toLowerCase()) {
                    // Found it as a subtitle, extract its info
                    for (let j = i + 1; j < lines.length; j++) {
                        const contentLine = lines[j].trim();
                        if (contentLine === '< Info >') {
                            // Extract content after Info marker until next subtitle or end
                            for (let k = j + 1; k < lines.length; k++) {
                                const infoLine = lines[k].trim();
                                if (infoLine.startsWith('- ') || infoLine === '') break;
                                if (infoLine) tooltipContent += infoLine + '\n';
                            }
                            break;
                        }
                    }
                    if (tooltipContent) break;
                }
            }
            if (tooltipContent) break;
        }
        
        if (!tooltipContent) {
            // Theory not found - show helpful message
            tooltipContent = `<p class="tooltip-line" style="color: #999; font-style: italic;">Theory definition not found. Add to Music Theory page.</p>`;
        }
    }
    
    if (!tooltipContent && theoryData) {
        const theory = typeof theoryData === 'string' ? theoryData : (theoryData.theory || '');
        if (!theory.trim()) return;
        
        // Extract content after "< Info >" until empty line
        const lines = theory.split('\n');
        let inInfoSection = false;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            if (line.trim() === '< Info >') {
                inInfoSection = true;
                continue;
            }
            
            if (inInfoSection) {
                if (line.trim() === '') {
                    break; // Stop at empty line
                }
                if (line.trim()) {
                    const styled = line.replace(/\*\*(.*?)\*\*/g, '<span class="tooltip-styled">$1</span>');
                    tooltipContent += `<p class="tooltip-line">${escapeHtml(styled)}</p>`;
                }
            }
        }
        
        // If no info section found, show first 5 lines
        if (!tooltipContent.trim()) {
            for (let i = 0; i < Math.min(5, lines.length); i++) {
                if (lines[i].trim()) {
                    const styled = lines[i].replace(/\*\*(.*?)\*\*/g, '<span class="tooltip-styled">$1</span>');
                    tooltipContent += `<p class="tooltip-line">${escapeHtml(styled)}</p>`;
                }
            }
        }
    } else if (!tooltipContent) {
        // No theory data found at all
        return;
    }
    
    // Create tooltip
    const tooltip = document.createElement('div');
    tooltip.id = 'progression-theory-tooltip';
    tooltip.className = 'progression-theory-tooltip';
    
    tooltip.innerHTML = `
        <div class="tooltip-content">
            <div class="tooltip-theory">${tooltipContent}</div>
        </div>
    `;
    

    document.body.appendChild(tooltip);
    
    // Position near mouse with bounds checking
    const x = Math.min(event.pageX + 15, window.innerWidth - 370);
    const y = Math.min(event.pageY + 10, window.innerHeight - 260);
    tooltip.style.left = x + 'px';
    tooltip.style.top = y + 'px';
    tooltip.style.display = 'block';
    

}

function findTheoryEntryByName(name, musicTheoryArray) {
    if (!name || !Array.isArray(musicTheoryArray)) return null;
    const lower = name.toLowerCase();
    for (const theory of musicTheoryArray) {
        if (theory?.name && theory.name.toLowerCase() === lower) {
            return theory;
        }
        if (Array.isArray(theory?.items)) {
            const foundItem = theory.items.find(item => item?.name && item.name.toLowerCase() === lower);
            if (foundItem) return foundItem;
        }
    }
    return null;
}

function buildTooltipContentFromEntry(entry) {
    let html = '';
    const info = entry.info;
    const infoArray = Array.isArray(info) ? info : (info ? [info] : []);
    infoArray.forEach(line => {
        if (line && line.trim()) {
            html += `<p class="tooltip-line">${styleLine(line)}</p>`;
        }
    });
    if (!html) {
        html = '<p class="tooltip-line" style="color: #999; font-style: italic;">No info available.</p>';
    }
    return html;
}

// Hide theory tooltip
function hideTheoryTooltip() {
    const tooltip = document.getElementById('progression-theory-tooltip');
    if (tooltip) {
        tooltip.remove();
    }
}


