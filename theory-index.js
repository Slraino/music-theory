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
    
    const card = document.querySelector(`[data-theory-key="${key}"]`);
    card.innerHTML = `
        <div class="theory-card-edit">
            <div class="theory-edit-row">
                <textarea class="theory-edit-theory" style="min-height: 150px; width: 100%;">${escapeHtml(theoryData.theory)}</textarea>
            </div>
            <div class="theory-edit-row">
                <textarea class="theory-edit-music" style="min-height: 150px; width: 100%;">${escapeHtml(theoryData.music)}</textarea>
            </div>
            <div class="theory-edit-controls">
                <button class="theory-save-btn" onclick="saveTheory('${key}')">Save</button>
                <button class="theory-cancel-btn" onclick="cancelEditTheory('${key}')">Cancel</button>
                <button class="theory-delete-btn" onclick="deleteTheory('${key}')">Delete</button>
            </div>
        </div>
    `;
}

// Save theory edits
function saveTheory(key) {
    const theory = document.querySelector(`[data-theory-key="${key}"] .theory-edit-theory`).value.trim();
    const music = document.querySelector(`[data-theory-key="${key}"] .theory-edit-music`).value.trim();
    
    const progressionDetails = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROGRESSION_DETAILS)) || {};
    progressionDetails[key] = { theory, music };
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
    
    let html = '';
    theoriesWithContent.forEach(item => {
        // Escape and parse the theory content
        const lines = item.theory.split('\n').filter(l => l.trim());
        const firstLine = lines[0] || 'Untitled';
        
        let editBtn = '';
        if (isOwnerMode()) {
            editBtn = `<button class="theory-edit-btn" onclick="startEditTheory('${item.key}')">✏️</button>`;
        }
        
        let contentHtml = '';
        lines.forEach(line => {
            const escapedLine = escapeHtml(line);
            const styledLine = escapedLine.replace(/\*\*(.*?)\*\*/g, '<span class="bullet-dot">●</span> <span class="styled-text">$1</span>');
            contentHtml += `<p class="theory-card-line">${styledLine}</p>`;
        });
        
        html += `
            <div class="theory-card" data-theory-key="${item.key}">
                <div class="theory-card-left">
                    <div class="theory-card-title">${escapeHtml(firstLine)}</div>
                    ${editBtn}
                </div>
                <div class="theory-card-right">
                    <div class="theory-card-content">
                        ${contentHtml}
                    </div>
                </div>
            </div>
        `;
    });
    
    theoryList.innerHTML = html;
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
