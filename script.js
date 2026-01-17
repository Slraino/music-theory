// --- Progression management ---
let editingProgIndex = null;

// Helper function to prevent HTML injection
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Helper function to safely encode group keys for use in HTML IDs
function encodeGroupKey(key) {
    return key.replace(/[#b]/g, (char) => {
        if (char === '#') return 'sharp';
        if (char === 'b') return 'flat';
        return char;
    });
}

// Helper function to decode group keys back from encoded form
function decodeGroupKey(encoded) {
    return encoded.replace(/sharp/g, '#').replace(/flat/g, 'b');
}

// Config: enable edit UI only when viewing locally
const EDIT_UI_ENABLED = (
    location.hostname === 'localhost' ||
    location.hostname === '127.0.0.1' ||
    location.protocol === 'file:'
);

// Owner mode detection based on local-only config
function isOwnerMode() {
    return EDIT_UI_ENABLED;
}

// Initialize progressions if empty
function initializeProgressions() {
    let progs = JSON.parse(localStorage.getItem('musicProgressions')) || [];
    if (progs.length === 0) {
        progs = [
            { title: '1 2 4 6', content: '1 - 2 - 4 - 6m' },
            { title: '1', content: '1' },
            { title: 'b2', content: 'b2' },
            { title: '2', content: '2' },
            { title: 'b3', content: 'b3' },
            { title: '3', content: '3' },
            { title: '4', content: '4' },
            { title: '#4', content: '#4' },
            { title: '5', content: '5' },
            { title: 'b6', content: 'b6' },
            { title: '6', content: '6' },
            { title: 'b7', content: 'b7' },
            { title: '7', content: '7' },
            { title: '6 4 5 1', content: '6m - 4 - 5 - 1\n6m - 4 - 5 - 1 - 5/7\n6m - 4 - 5 - 1 - 3/7' },
            { title: '6 3 4 1', content: '6m - 3m - 4 - 5\n6m - 3m - 4 - 1' },
            { title: '4 5 3 6', content: '4 - 5 - 3m - 6m' },
            { title: '2 5 1', content: '2m - 5 - 1' },
            { title: '1 3 6 5', content: '1 - 3m - 6m - 5' }
        ];
        localStorage.setItem('musicProgressions', JSON.stringify(progs));
    }
    return progs;
}

function loadProgressions() {
    initializeProgressions();
    const progs = JSON.parse(localStorage.getItem('musicProgressions')) || [];
    const list = document.getElementById('progressionsList');
    list.innerHTML = '';
    
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
    
    // Define display order: requested descending groups
    const displayOrder = ['7','b7','6','b6','5','#4','4','3','b3','2','b2','1'];
    
    displayOrder.forEach((key, displayIdx) => {
        if (groups[key] && groups[key].length > 0) {
            // Create single box for entire group
            const groupBox = document.createElement('div');
            groupBox.className = 'group-box';
            
            // Create container for all progressions in this group
            const progContainer = document.createElement('div');
            progContainer.className = 'progressions-in-group';
            progContainer.id = `group-${displayIdx}`;
            progContainer.setAttribute('data-group-key', key);
            
            // Create ONE single box for all progressions in this group
            const groupContentBox = document.createElement('div');
            groupContentBox.className = 'group-content-box';
            
            // Add group title at the top of content box
            const customNames = JSON.parse(localStorage.getItem('groupCustomNames')) || {};
            const groupTitleText = customNames[key] || key;
            
            let allContent = `<h2 class="group-title" data-group-key="${key}">${escapeHtml(groupTitleText)}</h2>`;
            
            groups[key].forEach((prog, idx) => {
                const contentLines = prog.content.split('\n');
                
                // Add title if displayTitle is set
                const displayTitle = prog.displayTitle !== undefined ? prog.displayTitle : prog.title;
                if (displayTitle.trim()) {
                    allContent += `<p class="progression-title-inline">${escapeHtml(displayTitle)}</p>`;
                }
                
                contentLines.forEach((line, lineIdx) => {
                    // Parse **text** for styled sections
                    const styledLine = line.replace(/\*\*(.*?)\*\*/g, '<span class="styled-text">$1</span>');
                    allContent += `
                        <p class="progression-notes clickable-line" onclick="showDetail(${prog.origIndex})">${styledLine}</p>
                    `;
                });
            });
            
            // Add single Edit button at the end if owner mode
            if (isOwnerMode()) {
                allContent += `<div class="group-edit-container"><button class="group-edit-btn" onclick="startGroupEdit('${key}')">Edit</button></div>`;
            }
            
            // Make group title clickable to edit name if owner mode
            if (isOwnerMode()) {
                allContent = allContent.replace(`data-group-key="${key}">`, `data-group-key="${key}" style="cursor: pointer;" onclick="editGroupTitle('${key}')">`);
            }
            
            groupContentBox.innerHTML = allContent;
            progContainer.appendChild(groupContentBox);
            
            groupBox.appendChild(progContainer);
            list.appendChild(groupBox);
        }
    });
}

function startInlineEdit(index) {
    if (!isOwnerMode()) {
        return; // editing disabled when not in owner mode
    }
    const progs = JSON.parse(localStorage.getItem('musicProgressions')) || [];
    const prog = progs[index];
    
    // Find the group key for this progression
    let groupKey = prog.title.charAt(0);
    if ((groupKey === 'b' || groupKey === '#') && prog.title.length > 1) {
        groupKey = prog.title.substring(0, 2);
    }
    
    // Store current state and show edit form
    const editFormId = `edit-form-${index}`;
    const editHtml = `
        <div id="${editFormId}" class="inline-edit-form">
            <input type="text" class="inline-title" value="${escapeHtml(prog.title)}" id="edit-title-${index}" placeholder="Title" />
            <textarea class="inline-content" id="edit-content-${index}" placeholder="Content">${escapeHtml(prog.content)}</textarea>
            <div class="note-controls">
                <button class="note-edit" onclick="saveInlineEdit(${index})">Save</button>
                <button class="note-delete" onclick="cancelInlineEdit(${index})">Cancel</button>
                <button class="note-remove" onclick="deleteProgression(${index})">Delete</button>
            </div>
        </div>
    `;
    
    // Insert edit form before the group box
    const groupBox = document.querySelector(`[data-group-key="${groupKey}"]`).closest('.group-box');
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = editHtml;
    groupBox.parentElement.insertBefore(tempDiv.firstElementChild, groupBox);
}

function saveInlineEdit(index) {
    const progs = JSON.parse(localStorage.getItem('musicProgressions')) || [];
    const title = document.getElementById(`edit-title-${index}`).value.trim();
    const content = document.getElementById(`edit-content-${index}`).value.trim();
    
    if (!title || !content) {
        alert('Please fill in title and content!');
        return;
    }
    
    progs[index] = { title, content };
    localStorage.setItem('musicProgressions', JSON.stringify(progs));
    loadProgressions();
}

function cancelInlineEdit(index) {
    loadProgressions();
}

// Delete a progression
function deleteProgression(index) {
    if (!isOwnerMode()) return;
    
    if (confirm('Are you sure you want to delete this progression?')) {
        const progs = JSON.parse(localStorage.getItem('musicProgressions')) || [];
        progs.splice(index, 1);
        localStorage.setItem('musicProgressions', JSON.stringify(progs));
        loadProgressions();
    }
}

// Group edit mode
function startGroupEdit(groupKey) {
    if (!isOwnerMode()) return;
    
    const progs = JSON.parse(localStorage.getItem('musicProgressions')) || [];
    const progContainer = document.querySelector(`[data-group-key="${groupKey}"]`).closest('.progressions-in-group');
    
    // Filter progressions that belong to this group
    const groupProgresses = progs.filter(p => {
        const firstChar = p.title.charAt(0);
        const isSingleChar = firstChar === groupKey;
        const isTwoChar = groupKey.length === 2 && p.title.substring(0, 2) === groupKey;
        return isSingleChar || isTwoChar;
    });
    
    const customNames = JSON.parse(localStorage.getItem('groupCustomNames')) || {};
    const currentGroupName = customNames[groupKey] || groupKey;
    
    let html = `
        <div class="group-edit-form">
            <div class="group-name-edit">
                <label>Group Name:</label>
                <input type="text" id="group-name-edit" value="${escapeHtml(currentGroupName)}" placeholder="Group name" />
            </div>
    `;
    
    groupProgresses.forEach((prog) => {
        const origIndex = progs.indexOf(prog);
        const combinedContent = prog.title + '\n' + prog.content;
        html += `
            <div class="progression-edit-row" id="edit-row-${origIndex}">
                <textarea class="group-edit-combined" id="group-content-${origIndex}" placeholder="Title (first line) and Content (rest)">${escapeHtml(combinedContent)}</textarea>
                <button class="prog-delete-btn" onclick="removeEditRow(${origIndex})">Remove</button>
            </div>
        `;
    });
    
    html += `
        <div class="add-new-section">
            <button class="add-new-btn" onclick="addNewProgressionRow('${groupKey}')">+ Add New</button>
        </div>
        <div class="group-edit-controls">
            <button class="group-edit-save" onclick="saveGroupEdit('${groupKey}')">Save All</button>
            <button class="group-edit-cancel" onclick="cancelGroupEdit('${groupKey}')">Cancel</button>
        </div>
        </div>
    `;
    
    progContainer.innerHTML = html;
}

function addNewProgressionRow(groupKey) {
    const form = document.querySelector('.group-edit-form');
    const addNewSection = form.querySelector('.add-new-section');
    const newId = 'new-' + Date.now();
    
    const newRow = document.createElement('div');
    newRow.className = 'progression-edit-row';
    newRow.id = 'edit-row-' + newId;
    newRow.innerHTML = `
        <textarea class="group-edit-combined" id="group-content-${newId}" placeholder="Title (first line) and Content (rest)"></textarea>
        <button class="prog-delete-btn" onclick="removeEditRow('${newId}')">Remove</button>
    `;
    
    form.insertBefore(newRow, addNewSection);
}

function removeEditRow(id) {
    const row = document.getElementById('edit-row-' + id);
    if (row) {
        row.remove();
    }
}

function saveGroupEdit(groupKey) {
    const progs = JSON.parse(localStorage.getItem('musicProgressions')) || [];
    const customNames = JSON.parse(localStorage.getItem('groupCustomNames')) || {};
    
    // Save group name if changed
    const newGroupName = document.getElementById('group-name-edit').value.trim();
    if (newGroupName !== '') {
        customNames[groupKey] = newGroupName;
    } else {
        delete customNames[groupKey];
    }
    
    // Get all edit rows
    const editRows = document.querySelectorAll('.progression-edit-row');
    let rowIndices = new Set();
    let newProgressions = [];
    
    editRows.forEach((row) => {
        const rowId = row.id.replace('edit-row-', '');
        const combinedInput = row.querySelector('.group-edit-combined');
        
        const combinedText = combinedInput.value.trim();
        if (!combinedText) return;
        
        // Split by first newline: title is first line, content is rest
        const lines = combinedText.split('\n');
        const title = lines[0].trim();
        const content = lines.slice(1).join('\n').trim();
        
        if (title && content) {
            if (rowId.startsWith('new-')) {
                // New progression
                newProgressions.push({ title, content, displayTitle: '' });
            } else {
                // Existing progression - mark as kept
                const origIndex = parseInt(rowId);
                rowIndices.add(origIndex);
                progs[origIndex] = { 
                    title: title, 
                    content: content, 
                    displayTitle: title
                };
            }
        }
    });
    
    // Remove progressions that were deleted (rows that don't exist anymore)
    // Go through existing progressions in this group and remove ones not in rowIndices
    for (let i = progs.length - 1; i >= 0; i--) {
        const prog = progs[i];
        const firstChar = prog.title.charAt(0);
        const isSingleChar = firstChar === groupKey;
        const isTwoChar = groupKey.length === 2 && prog.title.substring(0, 2) === groupKey;
        
        if ((isSingleChar || isTwoChar) && !rowIndices.has(i)) {
            // This progression belongs to the group but wasn't in the edit form, so delete it
            progs.splice(i, 1);
        }
    }
    
    // Add new progressions to the end
    newProgressions.forEach(prog => {
        progs.push(prog);
    });
    
    localStorage.setItem('musicProgressions', JSON.stringify(progs));
    localStorage.setItem('groupCustomNames', JSON.stringify(customNames));
    loadProgressions();
}

function cancelGroupEdit(groupKey) {
    loadProgressions();
}

// Edit group title
function editGroupTitle(groupKey) {
    if (!isOwnerMode()) return;
    
    const customNames = JSON.parse(localStorage.getItem('groupCustomNames')) || {};
    const currentName = customNames[groupKey] || groupKey;
    const newName = prompt(`Edit group name for "${currentName}" (leave blank to reset):`, currentName);
    
    if (newName !== null) {
        if (newName.trim() === '') {
            // Remove custom name to reset to default
            delete customNames[groupKey];
        } else {
            // Save custom name
            customNames[groupKey] = newName.trim();
        }
        localStorage.setItem('groupCustomNames', JSON.stringify(customNames));
        loadProgressions();
    }
}

// Show detail page for a progression
function showDetail(index) {
    const progs = JSON.parse(localStorage.getItem('musicProgressions')) || [];
    const prog = progs[index];
    
    // Create detail page URL with progression data
    const detailUrl = `detail.html?id=${index}`;
    window.location.href = detailUrl;
}

// Load progressions when page starts
window.addEventListener('DOMContentLoaded', loadProgressions);
