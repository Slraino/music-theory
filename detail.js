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

// Store current progression ID for editing
let currentProgId = null;

// Start editing detail
function startDetailEdit() {
    if (!isOwnerMode()) return;
    
    const progs = JSON.parse(localStorage.getItem('musicProgressions')) || [];
    const prog = progs[currentProgId];
    
    document.getElementById('detailContent').innerHTML = `
        <div class="detail-box">
            <div class="detail-edit-form">
                <input type="text" class="detail-edit-title" value="${escapeHtml(prog.title)}" id="edit-detail-title" />
                <textarea class="detail-edit-content" id="edit-detail-content">${escapeHtml(prog.content)}</textarea>
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
    const title = document.getElementById('edit-detail-title').value.trim();
    const content = document.getElementById('edit-detail-content').value.trim();
    
    if (!title || !content) {
        alert('Please fill in title and content!');
        return;
    }
    
    const progs = JSON.parse(localStorage.getItem('musicProgressions')) || [];
    progs[currentProgId] = { title, content };
    localStorage.setItem('musicProgressions', JSON.stringify(progs));
    
    loadDetailView();
}

// Cancel detail edit
function cancelDetailEdit() {
    loadDetailView();
}

// Delete progression and return to main page
function deleteDetailProgression() {
    if (!isOwnerMode()) return;
    
    if (confirm('Are you sure you want to delete this progression?')) {
        const progs = JSON.parse(localStorage.getItem('musicProgressions')) || [];
        progs.splice(currentProgId, 1);
        localStorage.setItem('musicProgressions', JSON.stringify(progs));
        
        // Return to main page
        window.location.href = 'index.html';
    }
}

// Load and display progression detail
function loadDetailView() {
    const progs = JSON.parse(localStorage.getItem('musicProgressions')) || [];
    const prog = progs[currentProgId];
    const sectionLabels = ['Skill', 'Song'];
    
    // Update the header title with the clicked line content
    const params = new URLSearchParams(window.location.search);
    const content = params.get('content');
    const mainTitle = content || (prog.title || 'Unknown');
    document.getElementById('progressionTitle').textContent = escapeHtml(mainTitle);
    
    // Show edit button only in owner mode
    const controlsDiv = document.getElementById('detailControls');
    if (isOwnerMode()) {
        controlsDiv.innerHTML = `<span class="edit-icon" onclick="startDetailEdit()" title="Edit">✏️</span>`;
    } else {
        controlsDiv.innerHTML = '';
    }
    
    // Organize content lines with labels only if multiple lines
    const contentLines = prog.content.split('\n').filter(l => l.trim());
    
    let sectionsHtml = '';
    
    if (contentLines.length === 1) {
        // Single line - no section label needed
        sectionsHtml = `<p class="detail-line">${escapeHtml(contentLines[0])}</p>`;
    } else {
        // Multiple lines - add Skill and Song labels
        contentLines.forEach((line, idx) => {
            const label = idx < sectionLabels.length ? sectionLabels[idx] : null;
            if (label) {
                sectionsHtml += `
                    <div class="detail-section">
                        <h3 class="section-label">${label}</h3>
                        <p class="detail-line">${escapeHtml(line)}</p>
                    </div>
                `;
            } else {
                sectionsHtml += `<p class="detail-line">${escapeHtml(line)}</p>`;
            }
        });
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
    const content = params.get('content');
    
    if (id === null) {
        document.getElementById('detailContent').innerHTML = '<p>No progression selected.</p>';
        return;
    }
    
    currentProgId = parseInt(id);
    const progs = JSON.parse(localStorage.getItem('musicProgressions')) || [];
    const prog = progs[currentProgId];
    
    if (!prog) {
        document.getElementById('detailContent').innerHTML = '<p>Progression not found.</p>';
        return;
    }
    
    loadDetailView();
});
