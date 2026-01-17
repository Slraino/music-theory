// LocalStorage keys
const STORAGE_KEYS = {
    PROGRESSION_DETAILS: 'progressionDetails'
};

// Config: enable edit UI only when viewing locally
const EDIT_UI_ENABLED = (
    location.hostname === 'localhost' ||
    location.hostname === '127.0.0.1' ||
    location.protocol === 'file:'
);

// Check owner mode
function isOwnerMode() {
    return EDIT_UI_ENABLED;
}

// Start editing a theory
function startEditTheory(key) {
    if (!isOwnerMode()) return;
    
    const progressionDetails = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROGRESSION_DETAILS)) || {};
    const theoryData = typeof progressionDetails[key] === 'string' 
        ? { theory: progressionDetails[key], music: '' } 
        : (progressionDetails[key] || { theory: '', music: '' });
    
    // Split title and content
    const lines = theoryData.theory.split('\n');
    const title = lines[0] || 'Untitled';
    const content = lines.slice(1).join('\n');
    
    const card = document.querySelector(`[data-theory-key="${key}"]`);
    card.innerHTML = `
        <div class="theory-card-left">
            <input class="theory-edit-title" type="text" value="${escapeHtml(title)}" style="width: 100%; border: 1px solid rgba(220, 20, 60, 0.3); background: rgba(40, 40, 40, 0.9); color: #DC143C; padding: 5px; border-radius: 3px; font-weight: bold; font-size: 1.1em;">
        </div>
        <div class="theory-card-right">
            <div class="theory-card-edit">
                <div class="theory-edit-row">
                    <textarea class="theory-edit-theory" placeholder="Content" style="min-height: 150px; width: 100%;">${escapeHtml(content)}</textarea>
                </div>
                <div class="theory-edit-controls">
                    <button class="theory-save-btn" onclick="saveTheory('${key}')">Save</button>
                    <button class="theory-cancel-btn" onclick="cancelEditTheory('${key}')">Cancel</button>
                    <button class="theory-delete-btn" onclick="deleteTheory('${key}')">Delete</button>
                </div>
            </div>
        </div>
    `;
}

// Save theory edits
function saveTheory(key) {
    const title = document.querySelector(`[data-theory-key="${key}"] .theory-edit-title`).value.trim();
    const content = document.querySelector(`[data-theory-key="${key}"] .theory-edit-theory`).value.trim();
    
    // Combine title and content: title on first line, then content
    const fullTheory = content ? `${title}\n${content}` : title;
    
    const progressionDetails = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROGRESSION_DETAILS)) || {};
    progressionDetails[key] = { theory: fullTheory, music: '' };
    localStorage.setItem(STORAGE_KEYS.PROGRESSION_DETAILS, JSON.stringify(progressionDetails));
    
    loadTheories();
}

// Cancel theory edit
function cancelEditTheory(key) {
    loadTheories();
}

// Delete theory
function deleteTheory(key) {
    if (!isOwnerMode()) return;
    if (!confirm('Are you sure you want to delete this theory?')) return;
    
    const progressionDetails = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROGRESSION_DETAILS)) || {};
    delete progressionDetails[key];
    localStorage.setItem(STORAGE_KEYS.PROGRESSION_DETAILS, JSON.stringify(progressionDetails));
    
    loadTheories();
}

// Load and display all theories
function loadTheories() {
    const progressionDetails = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROGRESSION_DETAILS)) || {};
    const theoryList = document.getElementById('theoryList');
    
    // Filter entries that have theory content
    const theoriesWithContent = Object.entries(progressionDetails)
        .filter(([key, data]) => {
            const theoryData = typeof data === 'string' ? { theory: data, music: '' } : data;
            return theoryData.theory && theoryData.theory.trim() !== '';
        })
        .map(([key, data]) => {
            const theoryData = typeof data === 'string' ? { theory: data, music: '' } : data;
            return { key, ...theoryData };
        });
    
    if (theoriesWithContent.length === 0) {
        theoryList.innerHTML = '<p style="color: #888; text-align: center; margin-top: 40px;">No theories yet. Add content in Chord Progression to see them here.</p>';
        return;
    }
    
    // Parse theories to extract titles and subtitles
    const parsedTheories = theoriesWithContent.map(item => {
        const lines = item.theory.split('\n');
        const mainTitle = lines[0] || 'Untitled';
        
        const subtitles = [];
        let currentSubtitle = null;
        let currentContent = [];
        
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            if (line.trim().startsWith('- ')) {
                // Save previous subtitle
                if (currentSubtitle) {
                    subtitles.push({
                        title: currentSubtitle,
                        content: currentContent.join('\n').trim()
                    });
                }
                // Start new subtitle
                currentSubtitle = line.trim().substring(2);
                currentContent = [];
            } else if (currentSubtitle !== null) {
                // Add to current subtitle content
                currentContent.push(line);
            }
        }
        
        // Save last subtitle
        if (currentSubtitle) {
            subtitles.push({
                title: currentSubtitle,
                content: currentContent.join('\n').trim()
            });
        }
        
        return {
            key: item.key,
            mainTitle,
            subtitles
        };
    });
    
    // Build title list on left with subtitles
    let titlesHtml = '';
    theoriesWithContent.forEach((item, index) => {
        const parsed = parsedTheories[index];
        
        let editBtn = '';
        if (isOwnerMode()) {
            editBtn = `<button class="theory-title-edit-btn" onclick="startEditTheory('${item.key}')">✏️</button>`;
        }
        
        const isFirst = index === 0 ? 'active' : '';
        titlesHtml += `
            <div class="theory-title-group ${isFirst}" data-theory-key="${item.key}">
                <div class="theory-main-title">
                    <span class="theory-title-text">${escapeHtml(parsed.mainTitle)}</span>
                    ${editBtn}
                </div>
        `;
        
        // Add subtitles
        parsed.subtitles.forEach((subtitle, subIndex) => {
            const subtitleId = `${item.key}-sub-${subIndex}`;
            titlesHtml += `
                <div class="theory-subtitle-item ${index === 0 && subIndex === 0 ? 'active' : ''}" data-subtitle-id="${subtitleId}" onmouseenter="switchTheoryContent('${item.key}', ${subIndex})">
                    <span class="theory-subtitle-text">${escapeHtml(subtitle.title)}</span>
                </div>
            `;
        });
        
        titlesHtml += `</div>`;
    });
    
    // Build content data for JavaScript
    let contentData = {};
    parsedTheories.forEach((parsed, index) => {
        parsed.subtitles.forEach((subtitle, subIndex) => {
            const contentId = `${parsed.key}-sub-${subIndex}`;
            let contentHtml = '';
            
            const lines = subtitle.content.split('\n');
            lines.forEach(line => {
                if (line.trim()) {
                    const escapedLine = escapeHtml(line);
                    const styledLine = escapedLine.replace(/\*\*(.*?)\*\*/g, '<span class="bullet-dot">●</span> <span class="styled-text">$1</span>');
                    contentHtml += `<p class="theory-card-line">${styledLine}</p>`;
                }
            });
            
            contentData[contentId] = contentHtml;
        });
    });
    
    // Set initial content to first subtitle
    const firstSubtitleId = `${theoriesWithContent[0].key}-sub-0`;
    
    const html = `
        <div class="theory-view-container">
            <div class="theory-titles-left">
                ${titlesHtml}
            </div>
            <div class="theory-content-right">
                <div class="theory-content-display" id="theoryContentDisplay">
                    ${contentData[firstSubtitleId] || ''}
                </div>
            </div>
        </div>
    `;
    
    theoryList.innerHTML = html;
    window.theoryContentData = contentData;
}

// Switch content when hovering over subtitles
function switchTheoryContent(key, subtitleIndex) {
    const subtitleId = `${key}-sub-${subtitleIndex}`;
    const contentDisplay = document.getElementById('theoryContentDisplay');
    if (window.theoryContentData && window.theoryContentData[subtitleId]) {
        contentDisplay.innerHTML = window.theoryContentData[subtitleId];
    }
    
    // Update active state
    document.querySelectorAll('.theory-subtitle-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`[data-subtitle-id="${subtitleId}"]`).classList.add('active');
}

// Helper function to prevent HTML injection
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Load theories when page starts
window.addEventListener('DOMContentLoaded', () => {
    loadTheories();
});
