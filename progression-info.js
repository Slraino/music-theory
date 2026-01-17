// LocalStorage keys
const STORAGE_KEYS = {
    PROGRESSIONS: 'musicProgressions',
    GROUP_NAMES: 'groupCustomNames',
    SITE_DESCRIPTION: 'siteDescription',
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

// Helper function to prevent HTML injection
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Store current progression ID and title for editing
let currentProgId = null;
let currentLineTitle = null;

// Start editing detail
function startDetailEdit() {
    if (!isOwnerMode()) return;
    
    const progressionDetails = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROGRESSION_DETAILS)) || {};
    const detailContent = progressionDetails[currentLineTitle] || '';
    
    document.getElementById('detailContent').innerHTML = `
        <div class="detail-box">
            <div class="detail-edit-form">
                <div class="progression-edit-row">
                    <label for="edit-detail-content" style="display: block; margin-bottom: 8px; color: #b0b0b0;">Edit content (use <strong>**text**</strong> to style words):</label>
                    <textarea class="detail-edit-content" id="edit-detail-content" style="min-height: 300px;">${escapeHtml(detailContent)}</textarea>
                </div>
                <div class="detail-edit-controls">
                    <button class="detail-save-btn" onclick="saveDetailEdit()">Save</button>
                    <button class="detail-cancel-btn" onclick="cancelDetailEdit()">Cancel</button>
                    <button class="detail-delete-btn" onclick="deleteDetailProgression()">Delete</button>
                </div>
            </div>
        </div>
    `;
}

// Save detail edit
function saveDetailEdit() {
    const content = document.getElementById('edit-detail-content').value.trim();
    
    console.log('Saving with lineTitle:', currentLineTitle); // Debug
    console.log('Content:', content); // Debug
    
    const progressionDetails = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROGRESSION_DETAILS)) || {};
    progressionDetails[currentLineTitle] = content;
    localStorage.setItem(STORAGE_KEYS.PROGRESSION_DETAILS, JSON.stringify(progressionDetails));
    
    console.log('Saved progressionDetails:', progressionDetails); // Debug
    
    loadDetailView();
}

// Cancel detail edit
function cancelDetailEdit() {
    loadDetailView();
}

// Delete progression detail
function deleteDetailProgression() {
    if (!isOwnerMode()) return;
    
    if (confirm('Are you sure you want to delete this detail content?')) {
        const progressionDetails = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROGRESSION_DETAILS)) || {};
        delete progressionDetails[currentLineTitle];
        localStorage.setItem(STORAGE_KEYS.PROGRESSION_DETAILS, JSON.stringify(progressionDetails));
        
        loadDetailView();
    }
}

// Load and display progression detail
function loadDetailView() {
    // Update the header title with the clicked line
    const titleToShow = currentLineTitle || 'Unknown';
    console.log('Setting title to:', titleToShow); // Debug
    document.getElementById('progressionTitle').textContent = escapeHtml(titleToShow);
    
    // Show edit button only in owner mode
    const controlsDiv = document.getElementById('detailControls');
    if (isOwnerMode()) {
        controlsDiv.innerHTML = `<span class="edit-icon" onclick="startDetailEdit()" title="Edit">✏️</span>`;
    } else {
        controlsDiv.innerHTML = '';
    }
    
    // Get detail content keyed by line title
    const progressionDetails = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROGRESSION_DETAILS)) || {};
    const detailContent = progressionDetails[currentLineTitle] || '';
    
    console.log('Loading detail for:', currentLineTitle); // Debug
    console.log('All progressionDetails:', progressionDetails); // Debug
    console.log('Retrieved detailContent:', detailContent); // Debug
    
    let sectionsHtml = '';
    if (detailContent) {
        const contentLines = detailContent.split('\n').filter(l => l.trim());
        contentLines.forEach((line, idx) => {
            // Escape first, then parse **text** for styled sections
            const escapedLine = escapeHtml(line);
            const styledLine = escapedLine.replace(/\*\*(.*?)\*\*/g, '<span class="styled-text">$1</span>');
            sectionsHtml += `<p class="detail-line">${styledLine}</p>`;
        });
    } else {
        sectionsHtml = '<p style="color: #888;">No details yet. Click edit to add content.</p>';
    }
    
    document.getElementById('detailContent').innerHTML = `
        <div class="detail-box">
            <div class="detail-body">
                ${sectionsHtml}
            </div>
        </div>
    `;
}

// Load progression detail
window.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    let lineTitle = params.get('lineTitle');
    
    console.log('URL params:', { id, lineTitle }); // Debug
    
    if (id === null) {
        document.getElementById('detailContent').innerHTML = '<p>No progression selected.</p>';
        return;
    }
    
    currentProgId = parseInt(id);
    currentLineTitle = lineTitle ? decodeURIComponent(lineTitle) : '';
    console.log('Set currentLineTitle to:', currentLineTitle); // Debug
    const progs = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROGRESSIONS)) || [];
    const prog = progs[currentProgId];
    
    if (!prog) {
        document.getElementById('detailContent').innerHTML = '<p>Progression not found.</p>';
        return;
    }
    
    loadDetailView();
});
