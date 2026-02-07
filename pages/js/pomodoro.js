// Pomodoro Trello App - SPA Version
// Local Storage Keys
const POMODORO_STORAGE_KEYS = {
    missions: 'pomodoro_missions',
    finished: 'pomodoro_finished',
    activeMission: 'pomodoro_active'
};

// State
let pomodoroState = {
    missions: [],
    finished: [],
    activeMission: null,
    timerInterval: null,
    timeRemaining: 0,
    isWorkMode: true,
    isRunning: false,
    editingCardId: null,
    initialized: false,
    draggedCard: null,
    draggedFromZone: null,
    bgmWasPlaying: false,
    cancelTimeout: null,
    workMinutes: 50,
    restMinutes: 10
};

// Initialize Pomodoro - called by SPA router
function initPomodoro() {
    loadPomodoroFromStorage();
    renderPomodoroMissions();
    renderPomodoroFinished();
    renderPomodoroActiveMission();
    setupPomodoroEventListeners();
    pomodoroState.initialized = true;
}

// Cleanup Pomodoro - called when leaving page
function cleanupPomodoro() {
    // Stop timer
    if (pomodoroState.timerInterval) {
        clearInterval(pomodoroState.timerInterval);
        pomodoroState.timerInterval = null;
    }
    
    // Clear cancel timeout
    if (pomodoroState.cancelTimeout) {
        clearTimeout(pomodoroState.cancelTimeout);
        pomodoroState.cancelTimeout = null;
    }
    
    // Move active mission back to missions field
    if (pomodoroState.activeMission) {
        pomodoroState.missions.push(pomodoroState.activeMission);
        pomodoroState.activeMission = null;
    }
    
    // Reset timer state
    pomodoroState.timeRemaining = 0;
    pomodoroState.isWorkMode = true;
    pomodoroState.isRunning = false;
    pomodoroState.editingCardId = null;
    pomodoroState.draggedCard = null;
    pomodoroState.draggedFromZone = null;
    pomodoroState.bgmWasPlaying = false;
    
    // Save the updated state
    savePomodoroToStorage();
    
    pomodoroState.initialized = false;
}

// Load data from local storage
function loadPomodoroFromStorage() {
    try {
        const savedMissions = localStorage.getItem(POMODORO_STORAGE_KEYS.missions);
        const savedFinished = localStorage.getItem(POMODORO_STORAGE_KEYS.finished);
        const savedActive = localStorage.getItem(POMODORO_STORAGE_KEYS.activeMission);
        
        pomodoroState.missions = savedMissions ? JSON.parse(savedMissions) : [];
        pomodoroState.finished = savedFinished ? JSON.parse(savedFinished) : [];
        pomodoroState.activeMission = savedActive ? JSON.parse(savedActive) : null;
    } catch (e) {
        console.error('Error loading from storage:', e);
        pomodoroState.missions = [];
        pomodoroState.finished = [];
        pomodoroState.activeMission = null;
    }
}

// Save data to local storage
function savePomodoroToStorage() {
    try {
        localStorage.setItem(POMODORO_STORAGE_KEYS.missions, JSON.stringify(pomodoroState.missions));
        localStorage.setItem(POMODORO_STORAGE_KEYS.finished, JSON.stringify(pomodoroState.finished));
        localStorage.setItem(POMODORO_STORAGE_KEYS.activeMission, JSON.stringify(pomodoroState.activeMission));
    } catch (e) {
        console.error('Error saving to storage:', e);
    }
}

// Generate unique ID
function generatePomodoroId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Create mission card element
function createPomodoroCardElement(mission, zone) {
    const card = document.createElement('div');
    card.className = 'mission-card';
    card.draggable = true;
    card.dataset.id = mission.id;
    card.dataset.zone = zone;
    
    const title = document.createElement('span');
    title.className = 'card-title';
    // Support multi-line titles (phrase 1 / phrase 2 separated by newline)
    if (mission.title.includes('\n')) {
        mission.title.split('\n').forEach((line, i, arr) => {
            title.appendChild(document.createTextNode(line));
            if (i < arr.length - 1) {
                title.appendChild(document.createElement('br'));
            }
        });
    } else {
        title.textContent = mission.title;
    }
    
    const actions = document.createElement('div');
    actions.className = 'card-actions';
    
    // Edit button only for missions zone
    if (zone === 'missions') {
        const editBtn = document.createElement('button');
        editBtn.className = 'edit-btn';
        editBtn.innerHTML = '✎';
        editBtn.title = 'Edit';
        editBtn.onclick = (e) => {
            e.stopPropagation();
            openPomodoroEditModal(mission.id);
        };
        actions.appendChild(editBtn);
    }
    
    // Delete button only for finished zone
    if (zone === 'finished') {
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.innerHTML = '✕';
        deleteBtn.title = 'Delete';
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            deletePomodoroMission(mission.id, zone);
        };
        actions.appendChild(deleteBtn);
    }
    
    card.appendChild(title);
    card.appendChild(actions);
    
    // Double-click to edit (missions zone only)
    if (zone === 'missions') {
        card.addEventListener('dblclick', () => {
            openPomodoroEditModal(mission.id);
        });
    }
    
    // Drag events
    card.addEventListener('dragstart', handlePomodoroDragStart);
    card.addEventListener('dragend', handlePomodoroDragEnd);
    
    return card;
}

// Render missions
function renderPomodoroMissions() {
    const container = document.getElementById('missions-container');
    if (!container) return;
    
    container.innerHTML = '';

    // Create cards list wrapper
    const cardsList = document.createElement('div');
    cardsList.className = 'cards-list';
    
    // Render all mission cards
    pomodoroState.missions.forEach(mission => {
        const card = createPomodoroCardElement(mission, 'missions');
        cardsList.appendChild(card);
    });
    
    container.appendChild(cardsList);

    // Add the add-card section at the BOTTOM
    const addSection = document.createElement('div');
    addSection.className = 'add-card-section';
    const addBtn = document.createElement('button');
    addBtn.className = 'add-mission-btn-icon';
    addBtn.id = 'add-mission-btn-icon';
    addBtn.textContent = '+';
    const addInput = document.createElement('input');
    addInput.type = 'text';
    addInput.id = 'new-mission-input';
    addInput.placeholder = 'Enter new mission...';
    addSection.appendChild(addBtn);
    addSection.appendChild(addInput);
    container.appendChild(addSection);

    // Re-attach event listeners
    addBtn.onclick = () => {
        addBtn.classList.add('hide');
        addInput.classList.add('show');
        addInput.focus();
    };
    addInput.onkeypress = (e) => {
        if (e.key === 'Enter') {
            addPomodoroMission();
            addInput.classList.remove('show');
            addBtn.classList.remove('hide');
        }
    };
    addInput.onblur = () => {
        if (!addInput.value.trim()) {
            addInput.classList.remove('show');
            addBtn.classList.remove('hide');
        }
    };
}

// Render finished
function renderPomodoroFinished() {
    const container = document.getElementById('finished-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    // Create cards list wrapper
    const cardsList = document.createElement('div');
    cardsList.className = 'cards-list';
    
    pomodoroState.finished.forEach(mission => {
        const card = createPomodoroCardElement(mission, 'finished');
        cardsList.appendChild(card);
    });
    
    container.appendChild(cardsList);

    // Add delete zone at bottom
    const deleteZone = document.createElement('div');
    deleteZone.className = 'delete-zone';
    deleteZone.textContent = '🗑️';
    deleteZone.dataset.zone = 'delete';
    
    // Drag and drop events for delete zone
    deleteZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    });
    deleteZone.addEventListener('dragenter', (e) => {
        e.preventDefault();
        deleteZone.classList.add('drag-over');
    });
    deleteZone.addEventListener('dragleave', (e) => {
        if (!deleteZone.contains(e.relatedTarget)) {
            deleteZone.classList.remove('drag-over');
        }
    });
    deleteZone.addEventListener('drop', (e) => {
        e.preventDefault();
        deleteZone.classList.remove('drag-over');
        
        const cardId = e.dataTransfer.getData('text/plain');
        if (!cardId || !pomodoroState.draggedFromZone) return;
        
        // Delete from whichever zone it came from
        if (pomodoroState.draggedFromZone === 'missions') {
            pomodoroState.missions = pomodoroState.missions.filter(m => m.id !== cardId);
        } else if (pomodoroState.draggedFromZone === 'finished') {
            pomodoroState.finished = pomodoroState.finished.filter(m => m.id !== cardId);
        } else if (pomodoroState.draggedFromZone === 'pomodoro') {
            pomodoroState.activeMission = null;
            stopPomodoroTimer();
        }
        
        savePomodoroToStorage();
        renderPomodoroMissions();
        renderPomodoroFinished();
        renderPomodoroActiveMission();
    });
    
    container.appendChild(deleteZone);
}

// Render active mission in pomodoro zone
function renderPomodoroActiveMission() {
    const activeMissionEl = document.getElementById('active-mission');
    const timerSection = document.getElementById('timer-section');
    const dropHint = document.querySelector('.drop-hint');
    const dropZone = document.getElementById('pomodoro-zone');
    
    if (!activeMissionEl || !timerSection || !dropHint || !dropZone) return;
    
    if (pomodoroState.activeMission) {
        activeMissionEl.innerHTML = '';
        const card = createPomodoroCardElement(pomodoroState.activeMission, 'pomodoro');
        activeMissionEl.appendChild(card);
        activeMissionEl.style.display = 'block';
        timerSection.style.display = 'block';
        dropHint.style.display = 'none';
        dropZone.classList.add('has-mission');
        updatePomodoroTimerDisplay();
    } else {
        activeMissionEl.style.display = 'none';
        timerSection.style.display = 'none';
        dropHint.style.display = 'block';
        dropZone.classList.remove('has-mission');
        stopPomodoroTimer();
    }
}

// Add new mission
function addPomodoroMission() {
    const input = document.getElementById('new-mission-input');
    const btn = document.getElementById('add-mission-btn-icon');
    
    if (!input) return;
    
    const title = input.value.trim();
    if (!title) return;
    
    const mission = {
        id: generatePomodoroId(),
        title: title,
        createdAt: new Date().toISOString()
    };
    
    pomodoroState.missions.push(mission);
    input.value = ''; // Clear input BEFORE re-rendering
    savePomodoroToStorage();
    renderPomodoroMissions(); // This recreates the input element, so no need to manually hide
}

// Delete mission
function deletePomodoroMission(id, zone) {
    if (zone === 'missions') {
        pomodoroState.missions = pomodoroState.missions.filter(m => m.id !== id);
    } else if (zone === 'finished') {
        pomodoroState.finished = pomodoroState.finished.filter(m => m.id !== id);
    } else if (zone === 'pomodoro' && pomodoroState.activeMission && pomodoroState.activeMission.id === id) {
        pomodoroState.activeMission = null;
    }
    savePomodoroToStorage();
    renderPomodoroMissions();
    renderPomodoroFinished();
    renderPomodoroActiveMission();
}

// Open edit modal
function openPomodoroEditModal(id) {
    const mission = pomodoroState.missions.find(m => m.id === id);
    if (!mission) return;
    
    pomodoroState.editingCardId = id;
    const editInput = document.getElementById('edit-mission-input');
    const editModal = document.getElementById('edit-modal');
    
    if (editInput && editModal) {
        editInput.value = mission.title;
        editModal.style.display = 'flex';
        editInput.focus();
    }
}

// Close edit modal
function closePomodoroEditModal() {
    const editModal = document.getElementById('edit-modal');
    const editInput = document.getElementById('edit-mission-input');
    
    if (editModal) editModal.style.display = 'none';
    pomodoroState.editingCardId = null;
    if (editInput) editInput.value = '';
}

// Open timer settings modal
function openTimerSettingsModal() {
    const modal = document.getElementById('timer-settings-modal');
    const workInput = document.getElementById('work-time-modal');
    const restInput = document.getElementById('rest-time-modal');
    
    if (workInput) workInput.value = pomodoroState.workMinutes;
    if (restInput) restInput.value = pomodoroState.restMinutes;
    if (modal) modal.style.display = 'flex';
}

// Close timer settings modal
function closeTimerSettingsModal() {
    const modal = document.getElementById('timer-settings-modal');
    if (modal) modal.style.display = 'none';
}

// Save timer settings
function saveTimerSettings() {
    const workInput = document.getElementById('work-time-modal');
    const restInput = document.getElementById('rest-time-modal');
    
    if (workInput) pomodoroState.workMinutes = parseInt(workInput.value) || 25;
    if (restInput) pomodoroState.restMinutes = parseInt(restInput.value) || 5;
    
    // Update timer display if not running
    if (!pomodoroState.isRunning && pomodoroState.isWorkMode) {
        pomodoroState.timeRemaining = pomodoroState.workMinutes * 60;
        updatePomodoroTimerDisplay();
    }
    
    closeTimerSettingsModal();
}

// Save edit
function savePomodoroEdit() {
    const editInput = document.getElementById('edit-mission-input');
    if (!editInput) return;
    
    const newTitle = editInput.value.trim();
    if (!newTitle || !pomodoroState.editingCardId) return;
    
    const mission = pomodoroState.missions.find(m => m.id === pomodoroState.editingCardId);
    if (mission) {
        mission.title = newTitle;
        savePomodoroToStorage();
        renderPomodoroMissions();
    }
    closePomodoroEditModal();
}

// Drag and Drop Handlers
function handlePomodoroDragStart(e) {
    pomodoroState.draggedCard = e.target;
    pomodoroState.draggedFromZone = e.target.dataset.zone;
    e.target.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', e.target.dataset.id);
}

function handlePomodoroDragEnd(e) {
    e.target.classList.remove('dragging');
    pomodoroState.draggedCard = null;
    pomodoroState.draggedFromZone = null;
    
    // Remove drag-over class from all zones
    document.querySelectorAll('.drag-over').forEach(el => {
        el.classList.remove('drag-over');
    });
}

function handlePomodoroDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

function handlePomodoroDragEnter(e) {
    e.preventDefault();
    const zone = e.currentTarget;
    zone.classList.add('drag-over');
}

function handlePomodoroDragLeave(e) {
    const zone = e.currentTarget;
    if (!zone.contains(e.relatedTarget)) {
        zone.classList.remove('drag-over');
    }
}

function handlePomodoroDrop(e) {
    e.preventDefault();
    const targetZone = e.currentTarget.dataset.zone;
    const cardId = e.dataTransfer.getData('text/plain');
    
    e.currentTarget.classList.remove('drag-over');
    
    if (!cardId || !pomodoroState.draggedFromZone) return;
    
    // Find the mission data
    let missionData = null;
    
    if (pomodoroState.draggedFromZone === 'missions') {
        missionData = pomodoroState.missions.find(m => m.id === cardId);
        if (missionData) {
            pomodoroState.missions = pomodoroState.missions.filter(m => m.id !== cardId);
        }
    } else if (pomodoroState.draggedFromZone === 'finished') {
        missionData = pomodoroState.finished.find(m => m.id === cardId);
        if (missionData) {
            pomodoroState.finished = pomodoroState.finished.filter(m => m.id !== cardId);
        }
    } else if (pomodoroState.draggedFromZone === 'pomodoro') {
        missionData = pomodoroState.activeMission;
        pomodoroState.activeMission = null;
        stopPomodoroTimer();
    }
    
    if (!missionData) return;
    
    // Add to target zone
    if (targetZone === 'missions') {
        pomodoroState.missions.push(missionData);
    } else if (targetZone === 'finished') {
        pomodoroState.finished.push(missionData);
    } else if (targetZone === 'pomodoro') {
        // If there's already an active mission, move it back to missions
        if (pomodoroState.activeMission) {
            pomodoroState.missions.push(pomodoroState.activeMission);
        }
        pomodoroState.activeMission = missionData;
        stopPomodoroTimer();
        resetPomodoroTimerDisplay();
    }
    
    savePomodoroToStorage();
    renderPomodoroMissions();
    renderPomodoroFinished();
    renderPomodoroActiveMission();
}

// Timer Functions
function updatePomodoroTimerDisplay() {
    const timerCountdown = document.getElementById('timer-countdown');
    const timerMode = document.getElementById('timer-mode');
    
    if (!timerCountdown || !timerMode) return;
    
    const minutes = Math.floor(pomodoroState.timeRemaining / 60);
    const seconds = pomodoroState.timeRemaining % 60;
    timerCountdown.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    timerMode.textContent = pomodoroState.isWorkMode ? 'Work' : 'Rest';
    timerMode.className = pomodoroState.isWorkMode ? '' : 'rest';
    timerCountdown.className = pomodoroState.isWorkMode ? '' : 'rest';
}

function resetPomodoroTimerDisplay() {
    pomodoroState.isWorkMode = true;
    pomodoroState.timeRemaining = pomodoroState.workMinutes * 60;
    updatePomodoroTimerDisplay();
}

function startPomodoroTimer() {
    if (!pomodoroState.activeMission) return;
    
    const startBtn = document.getElementById('start-btn');
    const pauseBtn = document.getElementById('pause-btn');
    
    if (pomodoroState.timeRemaining === 0) {
        pomodoroState.timeRemaining = pomodoroState.workMinutes * 60;
    }
    
    pomodoroState.isRunning = true;
    
    // Show X (cancel) button for 10 seconds during work mode only
    if (pomodoroState.isWorkMode) {
        if (startBtn) {
            startBtn.textContent = '✕';
            startBtn.className = 'cancel-mode';
            startBtn.style.display = 'inline-block';
            startBtn.onclick = cancelPomodoroTimer;
        }
        if (pauseBtn) pauseBtn.style.display = 'none';
        
        // After 10 seconds, switch to "Give Up" button
        pomodoroState.cancelTimeout = setTimeout(() => {
            if (startBtn && pomodoroState.isRunning) {
                startBtn.textContent = 'Give Up';
                startBtn.className = 'giveup-mode';
                startBtn.onclick = giveUpPomodoroTimer;
                startBtn.style.display = 'inline-block';
            }
        }, 10000);
    } else {
        // Rest mode: hide all buttons immediately
        if (startBtn) startBtn.style.display = 'none';
        if (pauseBtn) pauseBtn.style.display = 'none';
    }
    
    // Fade out BGM over 1s when timer starts
    if (typeof soundEffects !== 'undefined' && soundEffects.musicPlaying) {
        pomodoroState.bgmWasPlaying = true;
        window.fadeBGMOut();
    }
    
    pomodoroState.timerInterval = setInterval(() => {
        pomodoroState.timeRemaining--;
        
        if (pomodoroState.timeRemaining <= 0) {
            // Record work session completion before switching modes
            if (pomodoroState.isWorkMode && typeof window.recordWorkSession === 'function') {
                window.recordWorkSession(pomodoroState.workMinutes);
            }
            
            // Switch between work and rest
            pomodoroState.isWorkMode = !pomodoroState.isWorkMode;
            pomodoroState.timeRemaining = pomodoroState.isWorkMode 
                ? pomodoroState.workMinutes * 60 
                : pomodoroState.restMinutes * 60;
            
            // Play notification
            playPomodoroNotification();
            
            // Update button visibility based on new mode
            const startBtn = document.getElementById('start-btn');
            if (startBtn && pomodoroState.isRunning) {
                // Clear existing timeout
                if (pomodoroState.cancelTimeout) {
                    clearTimeout(pomodoroState.cancelTimeout);
                }
                
                // Show cancel button for 10 seconds
                startBtn.textContent = '✕';
                startBtn.className = 'cancel-mode';
                startBtn.style.display = 'inline-block';
                startBtn.onclick = cancelPomodoroTimer;
                
                // After 10 seconds, switch based on mode
                pomodoroState.cancelTimeout = setTimeout(() => {
                    if (startBtn && pomodoroState.isRunning) {
                        if (pomodoroState.isWorkMode) {
                            startBtn.textContent = 'Give Up';
                            startBtn.className = 'giveup-mode';
                            startBtn.onclick = giveUpPomodoroTimer;
                            startBtn.style.display = 'inline-block';
                        } else {
                            startBtn.style.display = 'none';
                        }
                    }
                }, 10000);
            }
        }
        
        updatePomodoroTimerDisplay();
    }, 1000);
}

// Cancel timer within the 10-second cancel window - no penalty
function cancelPomodoroTimer() {
    if (pomodoroState.cancelTimeout) {
        clearTimeout(pomodoroState.cancelTimeout);
        pomodoroState.cancelTimeout = null;
    }
    stopPomodoroTimer();
    resetPomodoroTimerDisplay();
    
    const startBtn = document.getElementById('start-btn');
    if (startBtn) {
        startBtn.textContent = 'Start';
        startBtn.className = '';
        startBtn.style.display = 'inline-block';
        startBtn.onclick = startPomodoroTimer;
    }
}

// Give up - returns mission to missions list
function giveUpPomodoroTimer() {
    if (pomodoroState.cancelTimeout) {
        clearTimeout(pomodoroState.cancelTimeout);
        pomodoroState.cancelTimeout = null;
    }
    
    // Move active mission back to missions
    if (pomodoroState.activeMission) {
        pomodoroState.missions.push(pomodoroState.activeMission);
        pomodoroState.activeMission = null;
    }
    
    stopPomodoroTimer();
    
    const startBtn = document.getElementById('start-btn');
    if (startBtn) {
        startBtn.textContent = 'Start';
        startBtn.className = '';
        startBtn.onclick = startPomodoroTimer;
    }
    
    savePomodoroToStorage();
    renderPomodoroMissions();
    renderPomodoroActiveMission();
}

function pausePomodoroTimer() {
    const startBtn = document.getElementById('start-btn');
    const pauseBtn = document.getElementById('pause-btn');
    
    pomodoroState.isRunning = false;
    if (pomodoroState.timerInterval) {
        clearInterval(pomodoroState.timerInterval);
        pomodoroState.timerInterval = null;
    }
    if (pomodoroState.cancelTimeout) {
        clearTimeout(pomodoroState.cancelTimeout);
        pomodoroState.cancelTimeout = null;
    }
    if (startBtn) {
        startBtn.textContent = 'Start';
        startBtn.className = '';
        startBtn.style.display = 'inline-block';
        startBtn.onclick = startPomodoroTimer;
    }
    if (pauseBtn) pauseBtn.style.display = 'none';
    
    // Restore BGM with 1s fade-in if it was playing before
    if (pomodoroState.bgmWasPlaying && typeof soundEffects !== 'undefined' && !soundEffects.musicPlaying) {
        pomodoroState.bgmWasPlaying = false;
        window.fadeBGMIn();
    }
}

function stopPomodoroTimer() {
    pausePomodoroTimer();
    pomodoroState.isWorkMode = true;
    pomodoroState.timeRemaining = 0;
}

function resetPomodoroTimer() {
    pausePomodoroTimer();
    resetPomodoroTimerDisplay();
}

function playPomodoroNotification() {
    // Gentle chime notification (pleasant C major chord arpeggio)
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const now = audioContext.currentTime;
        
        // Play a soft C major arpeggio: C5, E5, G5 (523Hz, 659Hz, 784Hz)
        const notes = [
            { freq: 523.25, start: 0, duration: 0.8 },      // C5
            { freq: 659.25, start: 0.15, duration: 0.8 },   // E5
            { freq: 783.99, start: 0.3, duration: 1.0 }     // G5
        ];
        
        notes.forEach(note => {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = note.freq;
            oscillator.type = 'sine';
            
            // Soft attack and gentle decay
            const startTime = now + note.start;
            const endTime = startTime + note.duration;
            
            gainNode.gain.setValueAtTime(0, startTime);
            gainNode.gain.linearRampToValueAtTime(0.15, startTime + 0.05); // Gentle attack
            gainNode.gain.exponentialRampToValueAtTime(0.01, endTime);     // Smooth fade
            
            oscillator.start(startTime);
            oscillator.stop(endTime);
        });
    } catch (e) {
        console.log('Audio notification not available');
    }
}

// Setup Event Listeners
function setupPomodoroEventListeners() {
    // Note: add-mission-btn and new-mission-input listeners are set in renderPomodoroMissions()
    
    // Drop zones
    const missionsContainer = document.getElementById('missions-container');
    const finishedContainer = document.getElementById('finished-container');
    const pomodoroZone = document.getElementById('pomodoro-zone');
    
    [missionsContainer, finishedContainer, pomodoroZone].forEach(zone => {
        if (zone) {
            zone.ondragover = handlePomodoroDragOver;
            zone.ondragenter = handlePomodoroDragEnter;
            zone.ondragleave = handlePomodoroDragLeave;
            zone.ondrop = handlePomodoroDrop;
        }
    });
    
    // Timer controls
    const startBtn = document.getElementById('start-btn');
    const pauseBtn = document.getElementById('pause-btn');
    const settingsBtn = document.getElementById('timer-settings-btn');
    
    if (startBtn) startBtn.onclick = startPomodoroTimer;
    
    // Settings button opens modal
    if (settingsBtn) {
        settingsBtn.onclick = openTimerSettingsModal;
    }
    
    // Timer settings modal
    const saveTimerBtn = document.getElementById('save-timer-settings-btn');
    const cancelTimerBtn = document.getElementById('cancel-timer-settings-btn');
    const timerModal = document.getElementById('timer-settings-modal');
    
    if (saveTimerBtn) saveTimerBtn.onclick = saveTimerSettings;
    if (cancelTimerBtn) cancelTimerBtn.onclick = closeTimerSettingsModal;
    if (timerModal) {
        timerModal.onclick = (e) => {
            if (e.target === timerModal) closeTimerSettingsModal();
        };
    }
    
    // Time input changes removed - now handled by modal
    
    // Edit modal
    const saveEditBtn = document.getElementById('save-edit-btn');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    const editInput = document.getElementById('edit-mission-input');
    const editModal = document.getElementById('edit-modal');
    
    if (saveEditBtn) saveEditBtn.onclick = savePomodoroEdit;
    if (cancelEditBtn) cancelEditBtn.onclick = closePomodoroEditModal;
    if (editInput) {
        editInput.onkeypress = (e) => {
            if (e.key === 'Enter') savePomodoroEdit();
        };
    }
    if (editModal) {
        editModal.onclick = (e) => {
            if (e.target === editModal) closePomodoroEditModal();
        };
    }
    
    // Initialize timer display
    resetPomodoroTimerDisplay();
}

// Make initPomodoro available globally for the router
window.initPomodoro = initPomodoro;
window.cleanupPomodoro = cleanupPomodoro;

// External function to add mission from other pages (like chord generator)
window.addPomodoroMissionFromExternal = function(title) {
    if (!title || !title.trim()) return;
    
    const mission = {
        id: generatePomodoroId(),
        title: title.trim(),
        createdAt: new Date().toISOString()
    };
    
    pomodoroState.missions.push(mission);
    savePomodoroToStorage();
    
    // Only re-render if pomodoro page is active
    if (document.getElementById('pomodoroPage').style.display !== 'none') {
        renderPomodoroMissions();
    }
};
