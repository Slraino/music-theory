// Helper function to prevent HTML injection
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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

// Toggle group content visibility (accordion - only one open at a time)
function toggleGroupContent(key) {
    console.log('Toggle clicked for key:', key);
    
    // Close all other content containers
    const allContainers = document.querySelectorAll('.group-content-container');
    allContainers.forEach(container => {
        if (container.id !== `group-content-${key}`) {
            container.classList.add('collapsed');
            console.log('Collapsed other:', container.id);
        }
    });
    
    // Toggle current container
    const contentContainer = document.getElementById(`group-content-${key}`);
    console.log('Container found:', contentContainer);
    
    if (contentContainer) {
        if (contentContainer.classList.contains('collapsed')) {
            contentContainer.classList.remove('collapsed');
            console.log('Expanded:', key);
        } else {
            contentContainer.classList.add('collapsed');
            console.log('Collapsed:', key);
        }
    } else {
        console.error('Container not found for key:', key);
    }
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
    
    displayOrder.forEach((key, displayIdx) => {
        if (groups[key] && groups[key].length > 0) {
            // Create group box container
            const groupBox = document.createElement('div');
            groupBox.className = 'group-box';
            
            // Create clickable title box
            const customNames = JSON.parse(localStorage.getItem('groupCustomNames')) || {};
            const groupTitleText = customNames[key] || key;
            
            const titleBox = document.createElement('div');
            titleBox.className = 'group-title-box';
            titleBox.setAttribute('data-group-key', key);
            titleBox.onclick = () => toggleGroupContent(key);
            titleBox.innerHTML = `
                <span class="group-title-text">${escapeHtml(groupTitleText)}</span>
            `;
            
            // Make title editable if owner mode
            if (isOwnerMode()) {
                titleBox.style.cursor = 'pointer';
                titleBox.ondblclick = () => editGroupTitle(key);
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
                const contentLines = prog.content.split('\n').filter(l => l.trim());
                
                // Add title if displayTitle is set
                const displayTitle = prog.displayTitle !== undefined ? prog.displayTitle : prog.title;
                if (displayTitle.trim()) {
                    allContent += `<p class="progression-title-inline">${escapeHtml(displayTitle)}</p>`;
                }
                
                contentLines.forEach((line, lineIdx) => {
                    // Parse **text** for styled sections
                    const styledLine = line.replace(/\*\*(.*?)\*\*/g, '<span class="styled-text">$1</span>');
                    // Only make lines with content clickable
                    const hasContent = line.trim().length > 0;
                    const clickableClass = hasContent ? 'clickable-line' : '';
                    allContent += `
                        <p class="progression-notes ${clickableClass}" ${hasContent ? `onclick="showDetail(${prog.origIndex}, ${lineIdx})"` : ''}>${styledLine}</p>
                    `;
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
}

// Group edit mode
function startGroupEdit(groupKey) {
    if (!isOwnerMode()) return;
    
    const progs = JSON.parse(localStorage.getItem('musicProgressions')) || [];
    const contentContainer = document.getElementById(`group-content-${groupKey}`);
    const progContainer = contentContainer.querySelector('.group-content-box');
    
    // Filter progressions that belong to this group
    const groupProgresses = progs.filter(p => {
        const firstChar = p.title.charAt(0);
        const isSingleChar = firstChar === groupKey;
        const isTwoChar = groupKey.length === 2 && p.title.substring(0, 2) === groupKey;
        return isSingleChar || isTwoChar;
    });
    
    const customNames = JSON.parse(localStorage.getItem('groupCustomNames')) || {};
    const currentGroupName = customNames[groupKey] || groupKey;
    
    // Combine all progressions into one text with original indices for tracking
    let combinedAllContent = '';
    groupProgresses.forEach((prog) => {
        const origIndex = progs.indexOf(prog);
        combinedAllContent += prog.title + '\n' + prog.content + '\n---\n';
    });
    combinedAllContent = combinedAllContent.slice(0, -4); // Remove last \n---\n
    
    let html = `
        <div class="group-edit-form">
            <div class="group-name-edit">
                <label>Group Name:</label>
                <input type="text" id="group-name-edit" value="${escapeHtml(currentGroupName)}" placeholder="Group name" />
            </div>
            <div class="progression-edit-row">
                <label style="display: block; margin-bottom: 8px; color: #b0b0b0;">Edit all progressions (put --- on its own line to separate each):</label>
                <textarea class="group-edit-combined" id="group-content-all" placeholder="Title\nContent\n---\nTitle\nContent" style="min-height: 300px;">${escapeHtml(combinedAllContent)}</textarea>
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
    const progs = JSON.parse(localStorage.getItem('musicProgressions')) || [];
    const customNames = JSON.parse(localStorage.getItem('groupCustomNames')) || {};
    
    // Save group name if changed
    const newGroupName = document.getElementById('group-name-edit').value.trim();
    if (newGroupName !== '') {
        customNames[groupKey] = newGroupName;
    } else {
        delete customNames[groupKey];
    }
    
    // Get the combined text
    const combinedText = document.getElementById('group-content-all').value.trim();
    if (!combinedText) {
        alert('Please enter at least one progression!');
        return;
    }
    
    // Split by --- on its own line to get individual progressions
    const progressionBlocks = combinedText.split(/\n---\n/).map(block => block.trim()).filter(block => block);
    let newProgressions = [];
    
    progressionBlocks.forEach((block) => {
        const lines = block.split('\n').map(l => l.trim()).filter(l => l);
        
        if (lines.length === 0) return; // Skip empty blocks
        
        if (lines.length === 1) {
            // Single line = content only (no title)
            const content = lines[0];
            newProgressions.push({ title: content, content: content, displayTitle: '' });
        } else {
            // Multiple lines = first is title, rest is content
            const title = lines[0];
            const content = lines.slice(1).join('\n');
            newProgressions.push({ title, content, displayTitle: title });
        }
    });
    
    if (newProgressions.length === 0) {
        alert('Please enter at least one valid progression (Title and Content)!');
        return;
    }
    
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
function showDetail(index, lineIndex) {
    const progs = JSON.parse(localStorage.getItem('musicProgressions')) || [];
    const prog = progs[index];
    
    // Get the actual line content
    const contentLines = prog.content.split('\n').filter(l => l.trim());
    const lineContent = contentLines[lineIndex] || prog.title;
    
    // Create detail page URL with progression data and line content
    const encodedContent = encodeURIComponent(lineContent);
    const detailUrl = `progression-info.html?id=${index}&content=${encodedContent}`;
    window.location.href = detailUrl;
}

// Load progressions when page starts (only on chord-progressions page)
window.addEventListener('DOMContentLoaded', () => {

// Load site description if on main page
    if (document.getElementById('siteDescription')) {
        loadSiteDescription();
    }
    
    // Only load progressions if the progressionsList element exists
    if (document.getElementById('progressionsList')) {
        loadProgressions();
    }
});

// Load and display site description
function loadSiteDescription() {
    const savedDescription = localStorage.getItem('siteDescription') || 'Learn and explore chord progressions and music theory concepts.';
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
        loadSiteDescription();
    }
}
