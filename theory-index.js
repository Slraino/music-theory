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
    
    // Show edit modal
    const modal = document.createElement('div');
    modal.id = `theory-edit-modal-${key}`;
    modal.className = 'theory-edit-modal';
    modal.innerHTML = `
        <div class="theory-edit-modal-content">
            <h2>Edit Theory</h2>
            <div class="theory-edit-form">
                <label>Content (format: Title on first line, then use "- Subtitle" for subtitles):</label>
                <textarea id="theory-edit-textarea-${key}" style="width: 100%; min-height: 300px; padding: 10px; border: 1px solid #DC143C; background: #2d2d2d; color: #e0e0e0; border-radius: 3px; font-family: Poppins, sans-serif;">${escapeHtml(theoryData.theory)}</textarea>
            </div>
            <div class="theory-edit-modal-controls">
                <button class="theory-save-btn" onclick="saveTheoryModal('${key}')">Save</button>
                <button class="theory-cancel-btn" onclick="cancelEditTheoryModal('${key}')">Cancel</button>
                <button class="theory-delete-btn" onclick="deleteTheoryModal('${key}')">Delete</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// Save theory from modal
function saveTheoryModal(key) {
    const content = document.getElementById(`theory-edit-textarea-${key}`).value.trim();
    
    const progressionDetails = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROGRESSION_DETAILS)) || {};
    progressionDetails[key] = { theory: content, music: '' };
    localStorage.setItem(STORAGE_KEYS.PROGRESSION_DETAILS, JSON.stringify(progressionDetails));
    
    const modal = document.getElementById(`theory-edit-modal-${key}`);
    if (modal) modal.remove();
    
    loadTheories();
}

// Cancel theory edit from modal
function cancelEditTheoryModal(key) {
    const modal = document.getElementById(`theory-edit-modal-${key}`);
    if (modal) modal.remove();
}

// Delete theory from modal
function deleteTheoryModal(key) {
    if (!isOwnerMode()) return;
    if (!confirm('Are you sure you want to delete this theory?')) return;
    
    const progressionDetails = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROGRESSION_DETAILS)) || {};
    delete progressionDetails[key];
    localStorage.setItem(STORAGE_KEYS.PROGRESSION_DETAILS, JSON.stringify(progressionDetails));
    
    const modal = document.getElementById(`theory-edit-modal-${key}`);
    if (modal) modal.remove();
    
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
        let mainContent = [];
        let currentSubtitle = null;
        let currentContent = [];
        
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            if (line.trim().startsWith('- ')) {
                // Save previous subtitle if exists
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
            } else {
                // Add to main content before first subtitle
                mainContent.push(line);
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
            mainContent: mainContent.join('\n').trim(),
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
                <div class="theory-main-title" onmouseenter="switchTheoryContent('${item.key}', -1)">
                    <span class="theory-title-text">${escapeHtml(parsed.mainTitle)}</span>
                    ${editBtn}
                </div>
        `;
        
        // Add subtitles
        parsed.subtitles.forEach((subtitle, subIndex) => {
            const subtitleId = `${item.key}-sub-${subIndex}`;
            // Mark first subtitle as active if no main content
            const isActive = (index === 0 && subIndex === 0 && !parsed.mainContent.trim());
            titlesHtml += `
                <div class="theory-subtitle-item ${isActive ? 'active' : ''}" data-subtitle-id="${subtitleId}" onmouseenter="switchTheoryContent('${item.key}', ${subIndex})">
                    <span class="theory-subtitle-text">${escapeHtml(subtitle.title)}</span>
                </div>
            `;
        });
        
        titlesHtml += `</div>`;
    });
    
    // Build content data for JavaScript
    let contentData = {};
    parsedTheories.forEach((parsed, index) => {
        // Add main content
        const mainContentId = `${parsed.key}-main`;
        let mainContentHtml = '';
        const mainLines = parsed.mainContent.split('\n');
        mainLines.forEach(line => {
            if (line.trim()) {
                const escapedLine = escapeHtml(line);
                const styledLine = escapedLine.replace(/\*\*(.*?)\*\*/g, '<span class="bullet-dot">●</span> <span class="styled-text">$1</span>');
                mainContentHtml += `<p class="theory-card-line">${styledLine}</p>`;
            }
        });
        contentData[mainContentId] = mainContentHtml || '<p class="theory-card-line" style="color: #888;">No content for this section.</p>';
        
        // Add subtitle content
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
    
    // Set initial content - use main content if exists, otherwise use first subtitle
    let firstContentId;
    if (parsedTheories[0].mainContent.trim()) {
        firstContentId = `${theoriesWithContent[0].key}-main`;
    } else if (parsedTheories[0].subtitles.length > 0) {
        firstContentId = `${theoriesWithContent[0].key}-sub-0`;
    } else {
        firstContentId = `${theoriesWithContent[0].key}-main`;
    }
    
    const html = `
        <div class="theory-view-container">
            <div class="theory-titles-left">
                ${titlesHtml}
            </div>
            <div class="theory-content-right">
                <div class="theory-content-display" id="theoryContentDisplay">
                    ${contentData[firstContentId] || ''}
                </div>
            </div>
        </div>
    `;
    
    theoryList.innerHTML = html;
    window.theoryContentData = contentData;
}

// Switch content when hovering over titles or subtitles
function switchTheoryContent(key, subtitleIndex) {
    const contentId = subtitleIndex === -1 ? `${key}-main` : `${key}-sub-${subtitleIndex}`;
    const contentDisplay = document.getElementById('theoryContentDisplay');
    if (window.theoryContentData && window.theoryContentData[contentId]) {
        contentDisplay.innerHTML = window.theoryContentData[contentId];
    }
    
    // Update active state
    document.querySelectorAll('.theory-subtitle-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Set active on subtitle if not main
    if (subtitleIndex !== -1) {
        const subtitleId = `${key}-sub-${subtitleIndex}`;
        const activeSubtitle = document.querySelector(`[data-subtitle-id="${subtitleId}"]`);
        if (activeSubtitle) {
            activeSubtitle.classList.add('active');
        }
    }
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
