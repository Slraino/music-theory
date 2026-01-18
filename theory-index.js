// Check owner mode
function isOwnerMode() {
    return EDIT_UI_ENABLED;
}

// Cache for fast access
let cachedMusicTheory = null;

function getCachedMusicTheory() {
    if (!cachedMusicTheory) {
        cachedMusicTheory = JSON.parse(localStorage.getItem('musicTheory')) || {};
    }
    return cachedMusicTheory;
}

function invalidateCache() {
    cachedMusicTheory = null;
}

// Start editing a theory
function startEditTheory(key) {
    if (!isOwnerMode()) return;
    
    // Prevent duplicate modals
    if (document.getElementById(`theory-edit-modal-${key}`)) {
        return;
    }
    
    // Use requestAnimationFrame to avoid blocking
    requestAnimationFrame(() => {
        const musicTheory = getCachedMusicTheory();
        const theoryData = typeof musicTheory[key] === 'string' 
            ? { theory: musicTheory[key], music: '' } 
            : (musicTheory[key] || { theory: '', music: '' });
        
        // Show edit modal
        const modal = document.createElement('div');
        modal.id = `theory-edit-modal-${key}`;
        modal.className = 'theory-edit-modal';
        
        const textarea = document.createElement('textarea');
        textarea.id = `theory-edit-textarea-${key}`;
        textarea.className = 'theory-edit-textarea';
        textarea.value = theoryData.theory;
        
        const content = document.createElement('div');
        content.className = 'theory-edit-modal-content';
        content.innerHTML = `<h2>Edit Theory</h2>
            <div class="theory-edit-form">
                <label>Content (format: Title on first line, then use "- Subtitle" for subtitles):</label>
            </div>
            <div class="theory-edit-modal-controls">
                <button class="theory-save-btn" onclick="saveTheoryModal('${key}')">Save</button>
                <button class="theory-cancel-btn" onclick="cancelEditTheoryModal('${key}')">Cancel</button>
            </div>`;
        
        content.querySelector('.theory-edit-form').appendChild(textarea);
        modal.appendChild(content);
        document.body.appendChild(modal);
    });
}

// Save theory from modal
function saveTheoryModal(key) {
    const content = document.getElementById(`theory-edit-textarea-${key}`).value.trim();
    
    const musicTheory = JSON.parse(localStorage.getItem('musicTheory')) || {};
    musicTheory[key] = { theory: content, music: '' };
    localStorage.setItem('musicTheory', JSON.stringify(musicTheory));
    
    // Sync to IndexedDB
    if (typeof db !== 'undefined' && db.ready) {
        db.set('musicTheory', 'default', musicTheory).catch(() => {});
    }
    
    invalidateCache();
    
    const modal = document.getElementById(`theory-edit-modal-${key}`);
    if (modal) modal.remove();
    
    loadTheories();
}

// Cancel theory edit from modal
function cancelEditTheoryModal(key) {
    const modal = document.getElementById(`theory-edit-modal-${key}`);
    if (modal) modal.remove();
    
    // Extra safety: remove any duplicates
    document.querySelectorAll(`[id="theory-edit-modal-${key}"]`).forEach(m => m.remove());
}

// Delete theory from modal
function deleteTheoryModal(key) {
    if (!isOwnerMode()) return;
    if (!confirm('Are you sure you want to delete this theory?')) return;
    
    const musicTheory = JSON.parse(localStorage.getItem('musicTheory')) || {};
    delete musicTheory[key];
    
    // Also remove from theoryOrder
    let theoryOrder = JSON.parse(localStorage.getItem('theoryOrder')) || [];
    theoryOrder = theoryOrder.filter(k => k !== key);
    
    localStorage.setItem('musicTheory', JSON.stringify(musicTheory));
    localStorage.setItem('theoryOrder', JSON.stringify(theoryOrder));
    
    // Sync to IndexedDB
    if (typeof db !== 'undefined' && db.ready) {
        db.set('musicTheory', 'default', musicTheory).catch(() => {});
        db.set('theoryOrder', 'default', theoryOrder).catch(() => {});
    }
    
    invalidateCache();
    
    const modal = document.getElementById(`theory-edit-modal-${key}`);
    if (modal) modal.remove();
    
    loadTheories();
}

// Move theory up in order
function moveTheoryUp(key) {
    if (!isOwnerMode()) return;
    
    const musicTheory = JSON.parse(localStorage.getItem('musicTheory')) || {};
    let theoryOrder = JSON.parse(localStorage.getItem('theoryOrder')) || [];
    
    // Build order from actual keys if theoryOrder doesn't exist
    if (theoryOrder.length === 0) {
        theoryOrder = Object.keys(musicTheory).filter(k => {
            const data = musicTheory[k];
            const theoryData = typeof data === 'string' ? { theory: data } : data;
            return theoryData.theory && theoryData.theory.trim() !== '';
        });
    }
    
    const currentIndex = theoryOrder.indexOf(key);
    if (currentIndex <= 0) return;
    
    // Swap positions in the array
    [theoryOrder[currentIndex - 1], theoryOrder[currentIndex]] = [theoryOrder[currentIndex], theoryOrder[currentIndex - 1]];
    
    // Save the new order
    localStorage.setItem('theoryOrder', JSON.stringify(theoryOrder));
    if (typeof db !== 'undefined' && db.ready) {
        db.set('theoryOrder', 'default', theoryOrder).catch(() => {});
    }
    loadTheories();
}

// Move theory down in order
function moveTheoryDown(key) {
    if (!isOwnerMode()) return;
    
    const musicTheory = JSON.parse(localStorage.getItem('musicTheory')) || {};
    let theoryOrder = JSON.parse(localStorage.getItem('theoryOrder')) || [];
    
    // Build order from actual keys if theoryOrder doesn't exist
    if (theoryOrder.length === 0) {
        theoryOrder = Object.keys(musicTheory).filter(k => {
            const data = musicTheory[k];
            const theoryData = typeof data === 'string' ? { theory: data } : data;
            return theoryData.theory && theoryData.theory.trim() !== '';
        });
    }
    
    const currentIndex = theoryOrder.indexOf(key);
    if (currentIndex >= theoryOrder.length - 1) return;
    
    // Swap positions in the array
    [theoryOrder[currentIndex], theoryOrder[currentIndex + 1]] = [theoryOrder[currentIndex + 1], theoryOrder[currentIndex]];
    
    // Save the new order
    localStorage.setItem('theoryOrder', JSON.stringify(theoryOrder));
    if (typeof db !== 'undefined' && db.ready) {
        db.set('theoryOrder', 'default', theoryOrder).catch(() => {});
    }
    loadTheories();
}

// Swap two theories by drag-and-drop
function swapTheories(key1, key2) {
    if (!isOwnerMode()) return;
    
    console.log('swapTheories called with:', key1, key2);
    
    const musicTheory = JSON.parse(localStorage.getItem('musicTheory')) || {};
    
    // Get or create theoryOrder array
    let theoryOrder = JSON.parse(localStorage.getItem('theoryOrder')) || [];
    
    // Build order from actual keys if theoryOrder doesn't exist
    if (theoryOrder.length === 0) {
        theoryOrder = Object.keys(musicTheory).filter(k => {
            const data = musicTheory[k];
            const theoryData = typeof data === 'string' ? { theory: data } : data;
            return theoryData.theory && theoryData.theory.trim() !== '';
        });
    }
    
    console.log('Available keys:', theoryOrder);
    
    const index1 = theoryOrder.indexOf(key1);
    const index2 = theoryOrder.indexOf(key2);
    
    console.log('Index1:', index1, 'Index2:', index2);
    
    if (index1 === -1 || index2 === -1) {
        console.log('Key not found!');
        return;
    }
    
    // Swap positions in the array
    [theoryOrder[index1], theoryOrder[index2]] = [theoryOrder[index2], theoryOrder[index1]];
    
    console.log('Keys after swap:', theoryOrder);
    
    // Save the new order
    localStorage.setItem('theoryOrder', JSON.stringify(theoryOrder));
    if (typeof db !== 'undefined' && db.ready) {
        db.set('theoryOrder', 'default', theoryOrder).catch(() => {});
    }
    
    // Invalidate cache so fresh data is loaded
    invalidateCache();
    
    console.log('Reloading theories...');
    loadTheories();
}

// Add new theory card
function addNewTheory() {
    if (!isOwnerMode()) return;
    
    const musicTheory = JSON.parse(localStorage.getItem('musicTheory')) || {};
    let theoryOrder = JSON.parse(localStorage.getItem('theoryOrder')) || [];
    
    // Generate a unique key for new theory
    let newKey = 'New Theory';
    let counter = 1;
    while (musicTheory[newKey]) {
        newKey = `New Theory ${counter}`;
        counter++;
    }
    
    // Create new theory entry
    musicTheory[newKey] = { theory: newKey, music: '' };
    
    // Add to order array
    theoryOrder.push(newKey);
    
    localStorage.setItem('musicTheory', JSON.stringify(musicTheory));
    localStorage.setItem('theoryOrder', JSON.stringify(theoryOrder));
    
    // Sync to IndexedDB
    if (typeof db !== 'undefined' && db.ready) {
        db.set('musicTheory', 'default', musicTheory).catch(() => {});
        db.set('theoryOrder', 'default', theoryOrder).catch(() => {});
    }
    
    invalidateCache();
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

            }
        } catch (e) {
            console.error('Error migrating theory data:', e);
        }
    }
}

// Load and display all theories
function loadTheories() {
    migrateTheoryData();
    const musicTheory = getCachedMusicTheory();
    const theoryList = document.getElementById('theoryList');
    
    // Clear old content first to prevent duplicates
    theoryList.innerHTML = '';
    
    // Get stored order or use object keys
    let theoryOrder = JSON.parse(localStorage.getItem('theoryOrder')) || [];
    console.log('loadTheories - theoryOrder from storage:', theoryOrder);
    
    // Filter entries that have theory content, respecting theoryOrder
    let theoriesWithContent = [];
    
    // If we have a stored order, use it
    if (theoryOrder.length > 0) {
        console.log('Using stored theoryOrder');
        theoriesWithContent = theoryOrder
            .filter(key => musicTheory[key])
            .filter(key => {
                const data = musicTheory[key];
                const theoryData = typeof data === 'string' ? { theory: data, music: '' } : data;
                return theoryData.theory && theoryData.theory.trim() !== '';
            })
            .map(key => {
                const data = musicTheory[key];
                const theoryData = typeof data === 'string' ? { theory: data, music: '' } : data;
                return { key, ...theoryData };
            });
        console.log('theoriesWithContent keys:', theoriesWithContent.map(t => t.key));
    } else {
        console.log('No stored theoryOrder, using Object.entries fallback');
        // Fallback to object entries if no stored order
        theoriesWithContent = Object.entries(musicTheory)
            .filter(([key, data]) => {
                const theoryData = typeof data === 'string' ? { theory: data, music: '' } : data;
                return theoryData.theory && theoryData.theory.trim() !== '';
            })
            .map(([key, data]) => {
                const theoryData = typeof data === 'string' ? { theory: data, music: '' } : data;
                return { key, ...theoryData };
            });
        
        // Save the order for future use
        theoryOrder = theoriesWithContent.map(t => t.key);
        console.log('Saving new theoryOrder:', theoryOrder);
        localStorage.setItem('theoryOrder', JSON.stringify(theoryOrder));
        if (typeof db !== 'undefined' && db.ready) {
            db.set('theoryOrder', 'default', theoryOrder).catch(() => {});
        }
    }
    
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
        let deleteBtn = '';
        if (isOwnerMode()) {
            editBtn = `<button class="theory-title-edit-btn" data-action="edit" data-key="${item.key}">✏️</button>`;
            deleteBtn = `<button class="theory-delete-icon-btn" onclick="deleteTheoryModal('${item.key}')" title="Delete">🗑️</button>`;
            let upBtn = index > 0 ? `<button class="theory-move-btn" data-action="up" data-key="${item.key}">↑</button>` : '';
            let downBtn = index < theoriesWithContent.length - 1 ? `<button class="theory-move-btn" data-action="down" data-key="${item.key}">↓</button>` : '';
            moveBtn = upBtn + downBtn;
        }
        
        const isFirst = index === 0 ? 'active' : '';
        titlesHtml += `
            <div class="theory-title-group ${isFirst}" data-theory-key="${item.key}" draggable="true">
                <div class="theory-main-title" onmouseenter="switchTheoryContent('${item.key}', -1)" onmouseleave="">
                    <span class="theory-title-text">${escapeHtml(parsed.mainTitle)}</span>
                    <div class="theory-btn-group">${editBtn}${deleteBtn}</div>
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
    
    // Remove old event listener if it exists
    if (window.theoryListClickHandler) {
        theoryList.removeEventListener('click', window.theoryListClickHandler);
    }
    
    // Create new event listener function and store reference
    window.theoryListClickHandler = (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        
        const action = btn.dataset.action;
        const key = btn.dataset.key;
        
        console.log('Button clicked:', action, key);
        
        if (action === 'edit') {
            startEditTheory(key);
        } else if (action === 'up') {
            console.log('Calling moveTheoryUp with key:', key);
            moveTheoryUp(key);
        } else if (action === 'down') {
            console.log('Calling moveTheoryDown with key:', key);
            moveTheoryDown(key);
        }
    };
    
    // Add event listeners for buttons
    theoryList.addEventListener('click', window.theoryListClickHandler);
    
    // Add drag-and-drop handlers for theory boxes
    let draggedElement = null;
    
    theoryList.addEventListener('dragstart', (e) => {
        const titleGroup = e.target.closest('.theory-title-group');
        if (titleGroup) {
            draggedElement = titleGroup;
            titleGroup.style.opacity = '0.6';
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/html', titleGroup.innerHTML);
        }
    });
    
    theoryList.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        
        const titleGroup = e.target.closest('.theory-title-group');
        if (titleGroup && titleGroup !== draggedElement) {
            titleGroup.style.borderTop = '2px solid #FF1744';
        }
    });
    
    theoryList.addEventListener('dragleave', (e) => {
        const titleGroup = e.target.closest('.theory-title-group');
        if (titleGroup) {
            titleGroup.style.borderTop = '';
        }
    });
    
    theoryList.addEventListener('drop', (e) => {
        e.preventDefault();
        
        const dropTarget = e.target.closest('.theory-title-group');
        if (dropTarget && draggedElement && dropTarget !== draggedElement) {
            // Swap the theory boxes
            const draggedKey = draggedElement.dataset.theoryKey;
            const dropKey = dropTarget.dataset.theoryKey;
            
            swapTheories(draggedKey, dropKey);
        }
    });
    
    theoryList.addEventListener('dragend', (e) => {
        const titleGroup = e.target.closest('.theory-title-group');
        if (titleGroup) {
            titleGroup.style.opacity = '1';
            titleGroup.style.borderTop = '';
        }
        draggedElement = null;
    });
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

