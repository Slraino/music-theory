// Switch between theory content when hovering over titles/subtitles
function switchTheoryContent(theoryIndex, subIndex) {
    const contentDisplay = document.getElementById('theoryContentDisplay');
    if (!contentDisplay || !window.theoryContentData) return;
    
    // Build content ID
    const contentId = subIndex === -1 ? 
        `theory-${theoryIndex}-main` : 
        `theory-${theoryIndex}-sub-${subIndex}`;
    
    // Get content
    const content = window.theoryContentData[contentId];
    if (content) {
        contentDisplay.innerHTML = content;
    }
    
    // Update active states
    const allTitles = document.querySelectorAll('.theory-main-title');
    const allSubtitles = document.querySelectorAll('.theory-subtitle-item');
    
    allTitles.forEach(title => title.classList.remove('active'));
    allSubtitles.forEach(subtitle => subtitle.classList.remove('active'));
    
    // Find and activate the current item
    const currentGroup = document.querySelector(`.theory-title-group[data-theory-index="${theoryIndex}"]`);
    if (currentGroup) {
        const mainTitle = currentGroup.querySelector('.theory-main-title');
        if (subIndex === -1) {
            mainTitle.classList.add('active');
        } else {
            const subtitle = currentGroup.querySelector(`.theory-subtitle-item[data-subtitle-index="${subIndex}"]`);
            if (subtitle) {
                subtitle.classList.add('active');
            }
        }
        currentGroup.classList.add('active');
    }
}

// Load and display all theories from JSON file
async function loadTheories() {
    const theoryList = document.getElementById('theoryList');
    
    try {
        // Fetch data from JSON file
        const response = await fetch('music-theory-data.json');
        const data = await response.json();
        const musicTheoryArray = data.musicTheory || [];
        
        // Clear old content first to prevent duplicates
        theoryList.innerHTML = '';
        
        if (musicTheoryArray.length === 0) {
            theoryList.innerHTML = '<p style="color: #888; text-align: center; margin-top: 40px;">No theories yet. Update music-theory-data.json to add content.</p>';
            return;
        }
        
        // Build title list on left with items
        let titlesHtml = '';
        musicTheoryArray.forEach((theory, index) => {
            const isFirst = index === 0 ? 'active' : '';
            const hasSubItems = theory.items && theory.items.length > 0;
            
            titlesHtml += `
                <div class="theory-title-group ${isFirst}" data-theory-index="${index}">
                    <div class="theory-main-title" data-theory-index="${index}" data-sub-index="-1">
                        <span class="theory-title-text">${escapeHtml(theory.name)}</span>
                    </div>
            `;
            
            // Add sub-items as subtitles
            if (hasSubItems) {
                theory.items.forEach((item, subIndex) => {
                    const isActive = (index === 0 && subIndex === 0 && (!theory.info || (Array.isArray(theory.info) && theory.info.length === 0)));
                    titlesHtml += `
                        <div class="theory-subtitle-item ${isActive ? 'active' : ''}" data-theory-index="${index}" data-subtitle-index="${subIndex}">
                            <span class="theory-subtitle-text">${escapeHtml(item.name)}</span>
                        </div>
                    `;
                });
            }
            
            titlesHtml += `</div>`;
        });
        
        // Build content data for JavaScript
        let contentData = {};
        musicTheoryArray.forEach((theory, index) => {
            // Format main content
            const mainContentId = `theory-${index}-main`;
            let mainContentHtml = formatTheoryContent(theory.info, theory.characteristics, theory.type);
            contentData[mainContentId] = mainContentHtml;
            
            // Format sub-item content
            if (theory.items && theory.items.length > 0) {
                theory.items.forEach((item, subIndex) => {
                    const contentId = `theory-${index}-sub-${subIndex}`;
                    let contentHtml = formatTheoryContent(item.info, item.characteristics, item.type);
                    contentData[contentId] = contentHtml;
                });
            }
        });
        
        // Set initial content - use main content first
        const firstContentId = `theory-0-main`;
        
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
        
        // Add event delegation for theory title and subtitle clicks
        theoryList.addEventListener('mouseenter', (e) => {
            const mainTitle = e.target.closest('.theory-main-title');
            const subtitle = e.target.closest('.theory-subtitle-item');
            
            if (mainTitle) {
                const theoryIndex = parseInt(mainTitle.getAttribute('data-theory-index'));
                const subIndex = parseInt(mainTitle.getAttribute('data-sub-index'));
                switchTheoryContent(theoryIndex, subIndex);
            } else if (subtitle) {
                const theoryIndex = parseInt(subtitle.closest('.theory-title-group').getAttribute('data-theory-index'));
                const subIndex = parseInt(subtitle.getAttribute('data-subtitle-index'));
                switchTheoryContent(theoryIndex, subIndex);
            }
        }, true);
        
    } catch (error) {
        console.error('Error loading music theory data:', error);
        theoryList.innerHTML = '<p style="color: #ff4444; text-align: center; margin-top: 40px;">Error loading music theory data. Please check music-theory-data.json file.</p>';
    }
}

// Format theory content (handles strings, arrays, and characteristics)
function formatTheoryContent(info, characteristics, type) {
    let contentHtml = '';
    
    // Handle info field with < Info > header
    if (info) {
        contentHtml += `<p class="theory-card-line"><span class="highlight-text">&lt; Info &gt;</span></p>`;
        const infoArray = Array.isArray(info) ? info : [info];
        infoArray.forEach(line => {
            if (line && line.trim()) {
                const styledLine = styleLine(line);
                contentHtml += `<p class="theory-card-line">${styledLine}</p>`;
            } else {
                contentHtml += `<p class="theory-card-line" style="height: 10px; margin: 0;"></p>`;
            }
        });
    }
    
    // Handle type field with < Type > header
    if (type && Array.isArray(type)) {
        if (contentHtml) {
            contentHtml += `<p class="theory-card-line" style="height: 15px; margin: 0;"></p>`;
        }
        contentHtml += `<p class="theory-card-line"><span class="highlight-text">&lt; Type &gt;</span></p>`;
        type.forEach(typeItem => {
            if (typeItem && typeItem.trim()) {
                const styledLine = styleLine(typeItem);
                contentHtml += `<p class="theory-card-line"><span class="bullet-dot">●</span> ${styledLine}</p>`;
            } else {
                contentHtml += `<p class="theory-card-line" style="height: 10px; margin: 0;"></p>`;
            }
        });
    }
    
    // Handle characteristics field with < Characteristics > header
    if (characteristics && Array.isArray(characteristics)) {
        if (contentHtml) {
            contentHtml += `<p class="theory-card-line" style="height: 15px; margin: 0;"></p>`;
        }
        contentHtml += `<p class="theory-card-line"><span class="highlight-text">&lt; Characteristics &gt;</span></p>`;
        characteristics.forEach(char => {
            if (char && char.trim()) {
                const styledLine = styleLine(char);
                contentHtml += `<p class="theory-card-line"><span class="bullet-dot">●</span>     ${styledLine}</p>`;
            }
        });
    }
    
    return contentHtml || '<p class="theory-card-line" style="color: #888;">No content available.</p>';
}

// Style a line of text with special formatting
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

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', loadTheories);
