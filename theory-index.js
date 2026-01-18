// Check owner mode
function isOwnerMode() {
    return EDIT_UI_ENABLED;
}

// Start editing a theory
function startEditTheory(key) {
    if (!isOwnerMode()) return;
    
    const musicTheory = JSON.parse(localStorage.getItem('musicTheory')) || {};
    const theoryData = typeof musicTheory[key] === 'string' 
        ? { theory: musicTheory[key], music: '' } 
        : (musicTheory[key] || { theory: '', music: '' });
    
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
    
    const musicTheory = JSON.parse(localStorage.getItem('musicTheory')) || {};
    musicTheory[key] = { theory: content, music: '' };
    localStorage.setItem('musicTheory', JSON.stringify(musicTheory));
    
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
    
    const musicTheory = JSON.parse(localStorage.getItem('musicTheory')) || {};
    delete musicTheory[key];
    localStorage.setItem('musicTheory', JSON.stringify(musicTheory));
    
    const modal = document.getElementById(`theory-edit-modal-${key}`);
    if (modal) modal.remove();
    
    loadTheories();
}

// Move theory up in order
function moveTheoryUp(key) {
    if (!isOwnerMode()) return;
    
    const musicTheory = JSON.parse(localStorage.getItem('musicTheory')) || {};
    const keys = Object.keys(musicTheory).filter(k => {
        const data = musicTheory[k];
        const theoryData = typeof data === 'string' ? { theory: data } : data;
        return theoryData.theory && theoryData.theory.trim() !== '';
    });
    
    const currentIndex = keys.indexOf(key);
    if (currentIndex <= 0) return;
    
    // Swap order by recreating object with swapped keys
    const newDetails = {};
    const keysToSwap = [keys[currentIndex - 1], keys[currentIndex]];
    let swapped = false;
    
    keys.forEach(k => {
        if (k === keys[currentIndex - 1]) {
            newDetails[keys[currentIndex]] = progressionDetails[k];
            swapped = true;
        } else if (k === keys[currentIndex]) {
            newDetails[keys[currentIndex - 1]] = progressionDetails[k];
        } else {
            newDetails[k] = progressionDetails[k];
        }
    });
    
    localStorage.setItem('progressionDetails', JSON.stringify(newDetails));
    loadTheories();
}

// Move theory down in order
function moveTheoryDown(key) {
    if (!isOwnerMode()) return;
    
    const musicTheory = JSON.parse(localStorage.getItem('musicTheory')) || {};
    const keys = Object.keys(musicTheory).filter(k => {
        const data = musicTheory[k];
        const theoryData = typeof data === 'string' ? { theory: data } : data;
        return theoryData.theory && theoryData.theory.trim() !== '';
    });
    
    const currentIndex = keys.indexOf(key);
    if (currentIndex >= keys.length - 1) return;
    
    // Swap order by recreating object with swapped keys
    const newDetails = {};
    keys.forEach(k => {
        if (k === keys[currentIndex]) {
            newDetails[keys[currentIndex + 1]] = musicTheory[k];
        } else if (k === keys[currentIndex + 1]) {
            newDetails[keys[currentIndex]] = musicTheory[k];
        } else {
            newDetails[k] = musicTheory[k];
        }
    });
    
    localStorage.setItem('musicTheory', JSON.stringify(newDetails));
    loadTheories();
}

// Add new theory card
function addNewTheory() {
    if (!isOwnerMode()) return;
    
    const musicTheory = JSON.parse(localStorage.getItem('musicTheory')) || {};
    
    // Generate a unique key for new theory
    let newKey = 'New Theory';
    let counter = 1;
    while (musicTheory[newKey]) {
        newKey = `New Theory ${counter}`;
        counter++;
    }
    
    // Create new theory entry
    musicTheory[newKey] = { theory: newKey, music: '' };
    localStorage.setItem('musicTheory', JSON.stringify(musicTheory));
    
    loadTheories();
}

// Migrate music theory data from progressionDetails to musicTheory on first load
function migrateTheoryData() {
    const musicTheory = localStorage.getItem('musicTheory');
    
    // If musicTheory already has data, don't migrate
    if (musicTheory && Object.keys(JSON.parse(musicTheory)).length > 0) {
        return;
    }
    
    // Check if there's data in progressionDetails
    const progressionDetails = localStorage.getItem('progressionDetails');
    if (progressionDetails) {
        try {
            const details = JSON.parse(progressionDetails);
            const theoryEntries = {};
            
            // Extract theory-like entries (those created in Music Theory page)
            for (const key in details) {
                const data = details[key];
                const theoryData = typeof data === 'string' ? { theory: data, music: '' } : data;
                
                // Check if this looks like a theory entry (has theory content but not linked to a progression)
                // We'll migrate all entries that have theory content
                if (theoryData.theory && theoryData.theory.trim() !== '') {
                    theoryEntries[key] = theoryData;
                }
            }
            
            // Save to musicTheory if we found entries
            if (Object.keys(theoryEntries).length > 0) {
                localStorage.setItem('musicTheory', JSON.stringify(theoryEntries));
                console.log('Migrated theory data:', theoryEntries);
            }
        } catch (e) {
            console.error('Error migrating theory data:', e);
        }
    }
}

// Load and display all theories
function loadTheories() {
    migrateTheoryData();
    const musicTheory = JSON.parse(localStorage.getItem('musicTheory')) || {};
    const theoryList = document.getElementById('theoryList');
    
    // Filter entries that have theory content
    const theoriesWithContent = Object.entries(musicTheory)
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
        let moveBtn = '';
        if (isOwnerMode()) {
            editBtn = `<button class="theory-title-edit-btn" onclick="startEditTheory('${item.key}')">✏️</button>`;
            let upBtn = index > 0 ? `<button class="theory-move-btn" onclick="moveTheoryUp('${item.key}')">↑</button>` : '';
            let downBtn = index < theoriesWithContent.length - 1 ? `<button class="theory-move-btn" onclick="moveTheoryDown('${item.key}')">↓</button>` : '';
            moveBtn = upBtn + downBtn;
        }
        
        const isFirst = index === 0 ? 'active' : '';
        titlesHtml += `
            <div class="theory-title-group ${isFirst}" data-theory-key="${item.key}">
                <div class="theory-main-title" onmouseenter="switchTheoryContent('${item.key}', -1)" onmouseleave="">
                    <span class="theory-title-text">${escapeHtml(parsed.mainTitle)}</span>
                    <div class="theory-btn-group">${moveBtn}${editBtn}</div>
                </div>
        `;
        
        // Add subtitles
        parsed.subtitles.forEach((subtitle, subIndex) => {
            const subtitleId = `${item.key}-sub-${subIndex}`;
            // Mark first subtitle as active if no main content
            const isActive = (index === 0 && subIndex === 0 && !parsed.mainContent.trim());
            titlesHtml += `
                <div class="theory-subtitle-item ${isActive ? 'active' : ''}" data-subtitle-id="${subtitleId}" onmouseenter="switchTheoryContent('${item.key}', ${subIndex})" onmouseleave="">
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
                let styledLine = line.replace(/<(.*?)>/g, '\uE000HIGHLIGHT$1HIGHLIGHT\uE001');
                styledLine = styledLine.replace(/^\u25cf\s*/, '\uE000BULLET\uE001');
                const escapedLine = escapeHtml(styledLine);
                let hasBullet = styledLine.includes('\uE000BULLET\uE001');
                styledLine = escapedLine.replace(/\*\*(.*?)\*\*/g, '<span class="bullet-dot">●</span> <span class="styled-text">$1</span>');
                styledLine = styledLine.replace(/\uE000HIGHLIGHT(.*?)HIGHLIGHT\uE001/g, '<span class="highlight-text">&lt;$1&gt;</span>');
                if (hasBullet) {
                    styledLine = styledLine.replace(/\uE000BULLET\uE001/, '<span class="bullet-dot">●</span>     ');
                }
                mainContentHtml += `<p class="theory-card-line">${styledLine}</p>`;
            } else {
                // Empty line for spacing
                mainContentHtml += `<p class="theory-card-line" style="height: 10px; margin: 0;"></p>`;
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
                    let styledLine = line.replace(/<(.*?)>/g, '\uE000HIGHLIGHT$1HIGHLIGHT\uE001');
                    styledLine = styledLine.replace(/^\u25cf\s*/, '\uE000BULLET\uE001');
                    const escapedLine = escapeHtml(styledLine);
                    let hasBullet = styledLine.includes('\uE000BULLET\uE001');
                    styledLine = escapedLine.replace(/\*\*(.*?)\*\*/g, '<span class="bullet-dot">●</span> <span class="styled-text">$1</span>');
                    styledLine = styledLine.replace(/\uE000HIGHLIGHT(.*?)HIGHLIGHT\uE001/g, '<span class="highlight-text">&lt;$1&gt;</span>');
                    if (hasBullet) {
                        styledLine = styledLine.replace(/\uE000BULLET\uE001/, '<span class="bullet-dot">●</span>     ');
                    }
                    contentHtml += `<p class="theory-card-line">${styledLine}</p>`;
                } else {
                    // Empty line for spacing
                    contentHtml += `<p class="theory-card-line" style="height: 10px; margin: 0;"></p>`;
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
                ${isOwnerMode() ? '<button class="theory-add-btn" onclick="addNewTheory()">+</button>' : ''}
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

// Show theory hover box with preview
function showTheoryHoverBox(key, subtitleIndex, title, event) {
    // Remove existing hover box
    hideTheoryHoverBox();
    
    if (!window.theoryContentData) return;
    
    const contentId = subtitleIndex === -1 ? `${key}-main` : `${key}-sub-${subtitleIndex}`;
    const content = window.theoryContentData[contentId];
    
    if (!content) return;
    
    // Create hover box
    const hoverBox = document.createElement('div');
    hoverBox.id = 'theory-hover-box';
    hoverBox.className = 'theory-hover-box';
    hoverBox.innerHTML = `
        <div class="theory-hover-box-content">
            <h3 class="theory-hover-title">${title}</h3>
            <div class="theory-hover-body">${content}</div>
        </div>
    `;
    
    document.body.appendChild(hoverBox);
    
    // Position near mouse
    const x = event.pageX + 20;
    const y = event.pageY - 50;
    hoverBox.style.left = x + 'px';
    hoverBox.style.top = y + 'px';
}

// Hide theory hover box
function hideTheoryHoverBox() {
    const hoverBox = document.getElementById('theory-hover-box');
    if (hoverBox) {
        hoverBox.remove();
    }
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

// Alias for SPA compatibility
function loadTheoryList() {
    loadTheories();
}

// Load theories when page starts
window.addEventListener('DOMContentLoaded', () => {
    loadTheories();
});
