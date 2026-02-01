// ==================== APP CONFIGURATION ====================
const AppConfig = {
    // Audio settings
    DEFAULT_MUSIC_VOLUME: 0.15,
    DEFAULT_SFX_VOLUME: 50,
    VOLUME_FADE_STEP: 0.1,
    VOLUME_FADE_INTERVAL: 100,
    YOUTUBE_BGM_FADE_IN_DELAY: 2000,
    YOUTUBE_BGM_FADE_IN_DURATION: 1000,
    YOUTUBE_FADE_INTERVAL: 500,
    TRACK_RETRY_DELAY: 2000,
    TRACK_END_DELAY: 500,
    
    // Sound effect frequencies
    SFX_HOVER_FREQ: 700,
    SFX_CLICK_FREQ: 1200,
    SFX_CLICK_END_FREQ: 600,
    SFX_HOVER_VOLUME: 0.05,
    SFX_CLICK_VOLUME: 0.1,
    SFX_HOVER_DURATION: 0.12,
    SFX_CLICK_DURATION: 0.15,
    
    // Database
    DB_NAME: 'MusicTheoryDB',
    DB_VERSION: 2
};

// ==================== DATA SERVICE (Session-only cache) ====================
const DataService = {
    chordProgressions: null,
    musicTheory: null,
    progressionInfo: null,
    chordGeneratorData: null,
    systemTransfer: null,
    
    async getChordProgressions() {
        // Return cached if already loaded this session
        if (this.chordProgressions) {
            return this.chordProgressions;
        }
        
        try {
            const response = await fetch('pages/json/chordProgression.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Validate data structure
            if (!Array.isArray(data)) {
                throw new Error('Invalid data format: expected array');
            }
            
            // Transform and validate
            const progressions = data.map((group, index) => {
                if (!group.note) {
                    console.warn(`Group at index ${index} missing 'note' property`);
                }
                
                return {
                    title: group.note || `Group ${index + 1}`,
                    content: group.note || '',  // Keep for backward compatibility
                    progressions: Array.isArray(group.progressions) ? group.progressions : []
                };
            });
            
            // Cache in memory for this session only
            this.chordProgressions = progressions;
            console.log(`✓ Loaded ${progressions.length} progression groups from chordProgression.json`);
            return progressions;
        } catch (error) {
            console.error('Failed to load chordProgression.json:', error);
            console.warn('Using default fallback progressions (12 chromatic notes)');

            // Fallback defaults - 12 chromatic notes with empty progressions
            const defaults = ["1","b2","2","b3","3","4","#4","5","b6","6","b7","7"].map(note => ({
                title: note,
                content: note,
                progressions: []
            }));
            this.chordProgressions = defaults;
            return defaults;
        }
    },
    
    async getMusicTheory() {
        // Return cached if already loaded this session
        if (this.musicTheory) {
            return this.musicTheory;
        }
        
        try {
            const response = await fetch('pages/json/musicTheory.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Validate data structure
            if (!Array.isArray(data)) {
                throw new Error('Invalid data format: expected array');
            }
            
            // Cache in memory for this session only
            this.musicTheory = data;
            console.log(`✓ Loaded ${data.length} music theory topics from musicTheory.json`);
            return data;
        } catch (error) {
            console.error('Failed to load musicTheory.json:', error);
            console.warn('Using empty fallback for music theory');
            this.musicTheory = [];
            return [];
        }
    },
    
    async getProgressionInfo() {
        // Return cached if already loaded this session
        if (this.progressionInfo) {
            return this.progressionInfo;
        }
        
        try {
            const response = await fetch('pages/json/progressionInfo.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Validate data structure (should be object, not array)
            if (typeof data !== 'object' || data === null || Array.isArray(data)) {
                throw new Error('Invalid data format: expected object (not array)');
            }
            
            // Cache in memory for this session only
            this.progressionInfo = data;
            console.log('✓ Loaded progression info from progressionInfo.json');
            return data;
        } catch (error) {
            console.error('Failed to load progressionInfo.json:', error);
            console.warn('Using empty fallback for progression info');
            this.progressionInfo = {};
            return {};
        }
    },

    async getChordGeneratorData() {
        // Return cached if already loaded this session
        if (this.chordGeneratorData) {
            return this.chordGeneratorData;
        }

        try {
            const response = await fetch('pages/json/chordGenerator.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            // Validate data structure (should be object)
            if (typeof data !== 'object' || data === null || Array.isArray(data)) {
                throw new Error('Invalid data format: expected object');
            }

            // Cache in memory for this session only
            this.chordGeneratorData = data;
            console.log('✓ Loaded chord generator data from chordGenerator.json');
            return data;
        } catch (error) {
            console.error('Failed to load chordGenerator.json:', error);
            console.warn('Using empty fallback for chord generator data');
            this.chordGeneratorData = {};
            return {};
        }
    },

    async getSystemTransfer() {
        // Return cached if already loaded this session
        if (this.systemTransfer) {
            return this.systemTransfer;
        }

        try {
            const response = await fetch('pages/json/systemTransfer.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            // Validate data structure (should be object)
            if (typeof data !== 'object' || data === null || Array.isArray(data)) {
                throw new Error('Invalid data format: expected object');
            }

            // Cache in memory for this session only
            this.systemTransfer = data;
            console.log('✓ Loaded systemTransfer.json');
            return data;
        } catch (error) {
            console.error('Failed to load systemTransfer.json:', error);
            console.warn('Using empty fallback for system transfer data');
            this.systemTransfer = {};
            return {};
        }
    },
    
    // Clear cache (for testing/refresh)
    clearCache() {
        this.chordProgressions = null;
        this.musicTheory = null;
        this.progressionInfo = null;
        this.chordGeneratorData = null;
        this.systemTransfer = null;
    }
};

// ==================== LOADING STATE MANAGER ====================
const LoadingManager = {
    _getElements(containerId) {
        return {
            skeleton: document.getElementById(`${containerId}Skeleton`),
            error: document.getElementById(`${containerId}Error`),
            content: document.getElementById(containerId)
        };
    },
    
    showLoading(containerId) {
        const { skeleton, error, content } = this._getElements(containerId);
        if (skeleton) skeleton.style.display = 'block';
        if (error) error.classList.remove('show');
        if (content) content.style.display = 'none';
    },
    
    showContent(containerId) {
        const { skeleton, error, content } = this._getElements(containerId);
        if (skeleton) skeleton.style.display = 'none';
        if (error) error.classList.remove('show');
        if (content) content.style.display = 'block';
    },
    
    showError(containerId) {
        const { skeleton, error, content } = this._getElements(containerId);
        if (skeleton) skeleton.style.display = 'none';
        if (error) error.classList.add('show');
        if (content) content.style.display = 'none';
    }
};

// ==================== INDEXEDDB (Settings ONLY) ====================
class MusicTheoryDB {
    constructor() {
        this.dbName = AppConfig.DB_NAME;
        this.version = AppConfig.DB_VERSION;
        this.db = null;
        this.ready = false;
        this._initPromise = null;
    }

    async init() {
        // Return existing promise if already initializing
        if (this._initPromise) return this._initPromise;
        
        this._initPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => {
                console.error('IndexedDB error:', request.error);
                this._initPromise = null;
                
                // Handle version error by recreating database
                if (request.error?.name === 'VersionError') {
                    this._handleVersionError().then(resolve).catch(reject);
                } else {
                    reject(request.error);
                }
            };

            request.onsuccess = () => {
                this.db = request.result;
                this.ready = true;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Remove old content stores if they exist
                ['progressions', 'groupNames', 'musicTheory'].forEach(store => {
                    if (db.objectStoreNames.contains(store)) {
                        db.deleteObjectStore(store);
                    }
                });
                
                // Only keep settings store
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' });
                }
            };
        });
        
        return this._initPromise;
    }
    
    async _handleVersionError() {
        console.log('Deleting old database and recreating...');
        return new Promise((resolve, reject) => {
            const deleteRequest = indexedDB.deleteDatabase(this.dbName);
            deleteRequest.onsuccess = () => {
                console.log('Database deleted, reinitializing...');
                this._initPromise = null;
                this.init().then(resolve).catch(reject);
            };
            deleteRequest.onerror = () => {
                console.error('Failed to delete database:', deleteRequest.error);
                reject(deleteRequest.error);
            };
        });
    }

    async set(storeName, key, value) {
        if (storeName !== 'settings') {
            throw new Error('Only settings store is supported');
        }
        if (!this.ready) await this.init();
        
        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);
                const request = store.put({ key, data: value });
                
                request.onerror = () => reject(request.error);
                request.onsuccess = () => resolve(value);
            } catch (error) {
                reject(error);
            }
        });
    }

    async get(storeName, key) {
        if (storeName !== 'settings') {
            throw new Error('Only settings store is supported');
        }
        if (!this.ready) await this.init();
        
        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction([storeName], 'readonly');
                const store = transaction.objectStore(storeName);
                const request = store.get(key);

                request.onerror = () => reject(request.error);
                request.onsuccess = () => resolve(request.result?.data ?? null);
            } catch (error) {
                reject(error);
            }
        });
    }

    async remove(storeName, key) {
        if (storeName !== 'settings') {
            throw new Error('Only settings store is supported');
        }
        if (!this.ready) await this.init();
        
        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);
                const request = store.delete(key);

                request.onerror = () => reject(request.error);
                request.onsuccess = () => resolve();
            } catch (error) {
                reject(error);
            }
        });
    }

    async clear(storeName) {
        if (storeName !== 'settings') {
            throw new Error('Only settings store is supported');
        }
        if (!this.ready) await this.init();
        
        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);
                const request = store.clear();

                request.onerror = () => reject(request.error);
                request.onsuccess = () => resolve();
            } catch (error) {
                reject(error);
            }
        });
    }

    async migrateFromLocalStorage() {
        try {
            // Migrate user preferences only (NOT content data)
            const migrations = [
                { key: 'musicVolume', parser: parseFloat },
                { key: 'musicEnabled', parser: (val) => val === 'true' },
                { key: 'sfxVolume', parser: parseFloat },
                { key: 'sfxEnabled', parser: (val) => val === 'true' }
            ];

            for (const { key, parser } of migrations) {
                const value = localStorage.getItem(key);
                if (value !== null) {
                    await this.set('settings', key, parser(value));
                }
            }
            
            // Clean up deprecated content data from localStorage
            const deprecatedKeys = [
                'musicProgressions',
                'progressionDetails',
                'groupCustomNames',
                'musicTheory',
                'siteDescription'
            ];
            deprecatedKeys.forEach(key => localStorage.removeItem(key));
            
            console.log('✓ Migrated settings from localStorage to IndexedDB');
        } catch (error) {
            console.error('Failed to migrate from localStorage:', error);
        }
    }
}

const db = new MusicTheoryDB();
db.init().then(() => {
    db.migrateFromLocalStorage();
}).catch(error => {
    console.error('Failed to initialize IndexedDB:', error);
});

/* ==================== ROUTER ==================== */
class Router {
    constructor() {
        this.currentPage = 'homePage';
        this.history = []; // Navigation history stack
        this.pages = {
            'index.html': { 
                id: 'homePage', 
                title: 'Home', 
                showBack: false,
                init: () => typeof loadSiteDescription === 'function' && loadSiteDescription()
            },
            'chord-progression.html': { 
                id: 'chordProgressionPage', 
                title: 'Chord Progression', 
                showBack: true,
                controls: 'progressionControls',
                init: () => typeof renderProgressions === 'function' && renderProgressions()
            },
            'progression-info.html': { 
                id: 'progressionInfoPage', 
                title: 'Progression Detail', 
                showBack: true,
                controls: 'detailControls',
                init: () => typeof loadProgressionDetail === 'function' && loadProgressionDetail()
            },
            'music-theory.html': { 
                id: 'musicTheoryPage', 
                title: 'Music Theory', 
                showBack: true,
                init: () => typeof loadTheories === 'function' && loadTheories()
            },
            'chord-generator.html': { 
                id: 'chordGeneratorPage', 
                title: 'Chord Generator', 
                showBack: true,
                init: () => typeof initChordGenerator === 'function' && initChordGenerator()
            }
        };
    }

    formatTitleFromFilename(page) {
        const base = (page || '').split('/').pop().replace(/\.html?$/i, '').replace(/[-_]+/g, ' ').trim();
        if (!base) return 'Home';
        return base
            .split(' ')
            .map(word => word ? word.charAt(0).toUpperCase() + word.slice(1) : '')
            .join(' ');
    }

    init() {
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a.nav-link, a.nav-box-card');
            if (link && link.href) {
                e.preventDefault();
                const href = link.href.split('/').pop().split('?')[0];
                this.navigate(href);
            }
        });

        const backBtn = document.getElementById('backBtn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                // Go back in history
                if (this.history.length > 0) {
                    const previousPage = this.history.pop();
                    this.loadPage(previousPage, false); // Don't add to history
                    // Update browser URL
                    if (window.location.protocol !== 'file:') {
                        window.history.pushState({ page: previousPage }, '', previousPage);
                    }
                } else {
                    this.loadPage('index.html', false);
                    if (window.location.protocol !== 'file:') {
                        window.history.pushState({ page: 'index.html' }, '', 'index.html');
                    }
                }
            });
        }

        // Handle browser back/forward buttons
        window.addEventListener('popstate', (e) => {
            if (e.state && e.state.page) {
                this.loadPage(e.state.page, false);
            }
        });

        // Load the current page based on URL
        const currentPath = window.location.pathname.split('/').pop() || 'index.html';
        const pageToLoad = currentPath === '' || currentPath === '/' ? 'index.html' : currentPath;
        this.loadPage(pageToLoad);
        
        // Set initial browser state
        if (window.location.protocol !== 'file:') {
            window.history.replaceState({ page: pageToLoad }, '', pageToLoad);
        }
    }

    navigate(page) {
        this.loadPage(page, true); // Add to history
        if (window.location.protocol !== 'file:') {
            window.history.pushState({ page }, '', page);
        }
    }

    loadPage(page, addToHistory = true) {
        const pageConfig = this.pages[page];
        if (!pageConfig) {
            console.error('Page not found:', page);
            return;
        }

        this.cleanupPage();

        // Add current page to history before navigating
        if (addToHistory && this.currentPage && this.currentPage !== page) {
            this.history.push(this.currentPage);
        }

        // Hide all pages
        document.querySelectorAll('.page-section').forEach(el => {
            el.style.display = 'none';
        });

        const pageEl = document.getElementById(pageConfig.id);
        if (pageEl) {
            pageEl.style.display = 'block';
        }

        const titleEl = document.getElementById('pageTitle');
        if (titleEl) {
            const titleText = pageConfig.title || this.formatTitleFromFilename(page);
            titleEl.textContent = titleText;
        }
        
        const backBtn = document.getElementById('backBtn');
        if (backBtn) {
            backBtn.style.display = pageConfig.showBack ? 'block' : 'none';
        }

        // Handle page-specific controls
        ['detailControls', 'progressionControls'].forEach(controlId => {
            const control = document.getElementById(controlId);
            if (control) {
                control.style.display = pageConfig.controls === controlId ? 'block' : 'none';
            }
        });

        // Show floating title only on home
        document.body.classList.toggle('show-floating-title', page === 'index.html');

        this.initPage(page);
        window.scrollTo(0, 0);
        this.currentPage = page;
    }

    cleanupPage() {
        document.querySelectorAll('.music-tooltip').forEach(el => el.remove());
        const generatorContainer = document.getElementById('generatorMusic');
        if (typeof cleanupGeneratorMusicHoverHandlers === 'function') {
            cleanupGeneratorMusicHoverHandlers(generatorContainer);
        }
        const progressInfoContainer = document.getElementById('detailContent');
        if (typeof cleanupProgressInfoMusicHoverHandlers === 'function') {
            cleanupProgressInfoMusicHoverHandlers(progressInfoContainer);
        }
        if (typeof window.clearBackgroundPreview === 'function') {
            window.clearBackgroundPreview();
        }
        // Cleanup chord generator resources
        if (typeof window.cleanupChordGenerator === 'function') {
            window.cleanupChordGenerator();
        }
    }

    initPage(page) {
        const pageConfig = this.pages[page];
        if (pageConfig?.init) {
            pageConfig.init();
        }
    }
}

let router;
document.addEventListener('DOMContentLoaded', () => {
    router = new Router();
    router.init();
});

// Session ID to track which preview request is current - prevents race conditions
let backgroundPreviewSession = 0;

function ensureBackgroundVideoOverlay() {
    let overlay = document.getElementById('bgVideoOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'bgVideoOverlay';
        overlay.className = 'bg-video-overlay';
        overlay.innerHTML = '<iframe title="Background Preview" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>';
        document.body.appendChild(overlay);
    }
    return overlay;
}

function buildBackgroundYoutubeUrl(videoId, clipStart = 0) {
    if (!videoId) return '';
    const start = clipStart || 0;
    const origin = window.location?.origin ? `&origin=${encodeURIComponent(window.location.origin)}` : '';
    return `https://www.youtube.com/embed/${videoId}?start=${start}&autoplay=1&mute=0&controls=1&modestbranding=1&playsinline=1&rel=0&disablekb=0&fs=1&enablejsapi=1${origin}`;
}

let backgroundPreviewAutoStopTimeout;

window.setBackgroundPreview = (videoId, clipStart = 0, duration = 15) => {
    if (window.videoPreviewEnabled === false) return;
    
    // Increment session to invalidate any pending requests
    backgroundPreviewSession++;
    const currentSession = backgroundPreviewSession;

    // Cancel any pending fade-out from previous preview
    clearPreviewFadeTimers();
    
    const overlay = ensureBackgroundVideoOverlay();
    const url = buildBackgroundYoutubeUrl(videoId, clipStart);
    if (!url) return;
    
    // Replace iframe entirely to cancel any pending loads
    const oldIframe = overlay.querySelector('iframe');
    if (oldIframe) {
        oldIframe.remove();
    }
    
    const iframe = document.createElement('iframe');
    iframe.title = 'Background Preview';
    iframe.allow = 'autoplay; encrypted-media; picture-in-picture';
    iframe.allowFullscreen = true;
    iframe.dataset.session = currentSession;
    iframe.src = url;
    overlay.appendChild(iframe);
    
    overlay.classList.add('is-active');
    startYouTubeVolumeControl(iframe);

    // Auto-stop preview after specified duration
    if (backgroundPreviewAutoStopTimeout) {
        clearTimeout(backgroundPreviewAutoStopTimeout);
    }
    backgroundPreviewAutoStopTimeout = setTimeout(() => {
        window.clearBackgroundPreview();
    }, duration * 1000);
};

window.clearBackgroundPreview = () => {
    // Increment session to invalidate any pending requests
    backgroundPreviewSession++;
    const clearSession = backgroundPreviewSession;
    
    // Clear any pending fade timers
    clearPreviewFadeTimers();
    
    const overlay = document.getElementById('bgVideoOverlay');
    if (!overlay) return;

    // Hide overlay immediately to avoid lingering preview screen
    overlay.classList.remove('is-active');
    
    try {
        const iframe = overlay.querySelector('iframe');
        if (iframe && iframe.src && iframe.src !== 'about:blank') {
            // Stop video immediately without fade
            sendYouTubeCommand(iframe, 'stopVideo');
        }
        if (shouldFinalizeBackgroundClear(overlay, clearSession)) {
            finalizeBackgroundPreviewClear(overlay);
        }
    } catch (e) {
        console.error('Error clearing background preview:', e);
        if (shouldFinalizeBackgroundClear(overlay, clearSession)) {
            finalizeBackgroundPreviewClear(overlay);
        }
    }
    
    stopYouTubeVolumeControl();

    if (backgroundPreviewAutoStopTimeout) {
        clearTimeout(backgroundPreviewAutoStopTimeout);
        backgroundPreviewAutoStopTimeout = null;
    }
};

let previewFadeInterval;
let previewFadeTimeout;
let playerReadyDelay = 1500; // Wait for YouTube player to initialize

function sendYouTubeCommand(iframe, func, args = []) {
    if (!iframe || !iframe.contentWindow) return false;
    try {
        iframe.contentWindow.postMessage(JSON.stringify({
            event: 'command',
            func,
            args
        }), '*');
        return true;
    } catch (e) {
        // Ignore postMessage errors
        return false;
    }
}

function clearPreviewFadeTimers() {
    if (previewFadeInterval) {
        clearInterval(previewFadeInterval);
        previewFadeInterval = null;
    }
    if (previewFadeTimeout) {
        clearTimeout(previewFadeTimeout);
        previewFadeTimeout = null;
    }
}

function startYouTubePreviewFadeIn() {
    // Intentionally disabled to avoid preview delay
}

function startYouTubePreviewFadeOut(iframe, durationMs = 1000, onComplete) {
    clearPreviewFadeTimers();
    
    // Immediately mute and stop video instead of fading
    sendYouTubeCommand(iframe, 'mute');
    sendYouTubeCommand(iframe, 'stopVideo');
    
    if (typeof onComplete === 'function') {
        onComplete();
    }
}

function shouldFinalizeBackgroundClear(overlay, clearSession) {
    if (!overlay) return false;
    const iframe = overlay.querySelector('iframe');
    if (!iframe) return true;
    const iframeSession = parseInt(iframe.dataset.session, 10);
    return iframeSession === clearSession;
}

function finalizeBackgroundPreviewClear(overlay) {
    // Remove iframe entirely to cancel any pending loads
    const iframe = overlay.querySelector('iframe');
    if (iframe) {
        iframe.remove();
    }
    // Recreate empty iframe for next use
    const newIframe = document.createElement('iframe');
    newIframe.title = 'Background Preview';
    newIframe.allow = 'autoplay; encrypted-media; picture-in-picture';
    newIframe.allowFullscreen = true;
    overlay.appendChild(newIframe);
    overlay.classList.remove('is-active');
}

let youTubeVolumeCheckInterval;
let musicFadeInInterval; // Track fadeIn interval to prevent stacking

function startYouTubeVolumeControl(iframe) {
    stopYouTubeVolumeControl();
    
    youTubeVolumeCheckInterval = setInterval(() => {
        try {
            if (soundEffects && soundEffects.audioElement && soundEffects.musicPlaying) {
                // Fade out music to 0% volume
                let currentVol = soundEffects.audioElement.volume;
                if (currentVol > 0) {
                    soundEffects.audioElement.volume = Math.max(0, currentVol - AppConfig.VOLUME_FADE_STEP);
                }
            }
        } catch (e) {
            // Ignore errors
        }
    }, AppConfig.YOUTUBE_FADE_INTERVAL);
}

function stopYouTubeVolumeControl() {
    clearInterval(youTubeVolumeCheckInterval);
    
    // Clear any existing fadeIn to prevent stacking
    if (musicFadeInInterval) {
        clearInterval(musicFadeInInterval);
        musicFadeInInterval = null;
    }
    
    // Wait 2 seconds, then check if no preview is playing before fading in BGM
    setTimeout(() => {
        // Check if a YouTube preview is currently active
        const overlay = document.getElementById('bgVideoOverlay');
        const isPreviewActive = overlay && overlay.classList.contains('is-active');
        
        if (isPreviewActive) {
            // Don't restore BGM if a preview is still playing
            return;
        }
        
        // Restore music volume with 1s fade-in
        if (soundEffects && soundEffects.audioElement && soundEffects.musicPlaying) {
            const targetVol = soundEffects.musicVolume;
            const duration = AppConfig.YOUTUBE_BGM_FADE_IN_DURATION;
            const steps = Math.max(1, Math.round(duration / AppConfig.VOLUME_FADE_INTERVAL));
            const stepSize = targetVol / steps;
            
            musicFadeInInterval = setInterval(() => {
                if (soundEffects.audioElement.volume < targetVol) {
                    soundEffects.audioElement.volume = Math.min(targetVol, soundEffects.audioElement.volume + stepSize);
                } else {
                    clearInterval(musicFadeInInterval);
                    musicFadeInInterval = null;
                }
            }, AppConfig.VOLUME_FADE_INTERVAL);
        }
    }, AppConfig.YOUTUBE_BGM_FADE_IN_DELAY);
}

/* ==================== SOUND EFFECTS ==================== */
const MUSIC_PLAYLIST = [
    'assets/audio/bgm/Mitsukiyo-Candy%20Dreamy.mp3',
    'assets/audio/bgm/Sharou-superstar.mp3',
    'assets/audio/bgm/Sharou-Anyone%20in%202025_.mp3',
    'assets/audio/bgm/Sharou-3_03%20PM.mp3',
    'assets/audio/bgm/Sharou-2_23%20AM.mp3',
    'assets/audio/bgm/Sharou-10.mp3',
    'assets/audio/bgm/Sharou-Cassette%20Tape%20Dream.mp3',
    'assets/audio/bgm/Sharou-Sheep%20of%20the%20Far%20East%2C%20Dancing%20with%20the%20Telecaster.mp3',
    'assets/audio/bgm/Sharou-You%20and%20Me.mp3'
];

class SoundEffects {
    constructor() {
        this.audioContext = null;
        this.initialized = false;
        this.musicPlaying = false;
        this.musicGain = null;
        this.musicVolume = AppConfig.DEFAULT_MUSIC_VOLUME;
        this.shouldPlayMusic = true;
        this.sfxVolume = AppConfig.DEFAULT_SFX_VOLUME;
        this.sfxEnabled = true;
        this.audioElement = null;
        this.currentTrackIndex = 0;
        this._settingsLoaded = false;
    }
    
    async loadSettings() {
        if (this._settingsLoaded) return;
        try {
            if (db.ready) {
                const musicVol = await db.get('settings', 'musicVolume');
                const musicEnabled = await db.get('settings', 'musicEnabled');
                const sfxVol = await db.get('settings', 'sfxVolume');
                const sfxEnabled = await db.get('settings', 'sfxEnabled');
                
                if (musicVol !== null) this.musicVolume = musicVol;
                if (musicEnabled !== null) this.shouldPlayMusic = musicEnabled;
                if (sfxVol !== null) this.sfxVolume = sfxVol;
                if (sfxEnabled !== null) this.sfxEnabled = sfxEnabled;
                
                this._settingsLoaded = true;
            }
        } catch (e) {
            console.warn('Failed to load audio settings from IndexedDB:', e);
        }
    }

    init() {
        if (this.initialized) return;
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContext();
            this.initialized = true;
        } catch (e) {
            // Silently fail - will retry on user interaction
        }
    }

    _playSoundEffect(frequency, volumeFactor, duration, endFrequency = null) {
        if (!this.sfxEnabled) return;
        if (!this.audioContext) return; // Don't try to init - wait for user click
        this.playToneSound(frequency, volumeFactor, duration, endFrequency);
    }

    playHoverSound() {
        this._playSoundEffect(AppConfig.SFX_HOVER_FREQ, AppConfig.SFX_HOVER_VOLUME, AppConfig.SFX_HOVER_DURATION);
    }

    playClickSound() {
        this._playSoundEffect(AppConfig.SFX_CLICK_FREQ, AppConfig.SFX_CLICK_VOLUME, AppConfig.SFX_CLICK_DURATION, AppConfig.SFX_CLICK_END_FREQ);
    }

    playSoftBeepSound() {
        this._playSoundEffect(AppConfig.SFX_HOVER_FREQ, AppConfig.SFX_HOVER_VOLUME, AppConfig.SFX_HOVER_DURATION);
    }

    playToneSound(frequency, volumeFactor, duration, endFrequency = null) {
        try {
            const now = this.audioContext.currentTime;
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();
            osc.connect(gain);
            gain.connect(this.audioContext.destination);
            
            osc.frequency.setValueAtTime(frequency, now);
            if (endFrequency) {
                osc.frequency.exponentialRampToValueAtTime(endFrequency, now + duration);
            }
            
            const sfxGain = (this.sfxVolume / 100) * volumeFactor;
            gain.gain.setValueAtTime(sfxGain, now);
            gain.gain.exponentialRampToValueAtTime(0.01 * (this.sfxVolume / 100), now + duration);
            
            osc.start(now);
            osc.stop(now + duration);
        } catch (e) {
            console.warn('Failed to play tone sound:', e);
        }
    }

    setMusicVolume(volume) {
        this.musicVolume = Math.max(0, Math.min(1, volume / 100));
        if (typeof db !== 'undefined' && db.ready) {
            db.set('settings', 'musicVolume', this.musicVolume).catch(() => {});
        }
        if (this.audioElement) {
            this.audioElement.volume = this.musicVolume;
        }
    }

    setSfxVolume(volume) {
        this.sfxVolume = Math.max(0, Math.min(100, volume));
        if (typeof db !== 'undefined' && db.ready) {
            db.set('settings', 'sfxVolume', this.sfxVolume).catch(() => {});
        }
    }

    setSfxEnabled(enabled) {
        this.sfxEnabled = enabled;
        if (typeof db !== 'undefined' && db.ready) {
            db.set('settings', 'sfxEnabled', enabled).catch(() => {});
        }
    }

    playNextTrack() {
        if (!this.musicPlaying) return;

        const randomIndex = Math.floor(Math.random() * MUSIC_PLAYLIST.length);
        const trackUrl = MUSIC_PLAYLIST[randomIndex];

        if (this.audioElement) {
            this.audioElement.pause();
            this.audioElement.currentTime = 0;
            this.audioElement.src = trackUrl;
            this.audioElement.volume = this.musicVolume;
            this.audioElement.load();
            
            const playAttempt = () => {
                this.audioElement.play().catch(err => {
                    console.error('Could not play audio:', err);
                    this.playNextTrackAfterDelay();
                });
            };
            
            this.audioElement.removeEventListener('canplay', playAttempt);
            this.audioElement.addEventListener('canplay', playAttempt, { once: true });
        }
    }

    playNextTrackAfterDelay() {
        if (this.musicPlaying) {
            setTimeout(() => this.playNextTrack(), AppConfig.TRACK_RETRY_DELAY);
        }
    }

    playBackgroundMusic() {
        if (this.musicPlaying) return;
        if (!this.audioContext) this.init();

        this.musicPlaying = true;
        if (typeof db !== 'undefined' && db.ready) {
            db.set('settings', 'musicEnabled', true).catch(() => {});
        }

        if (!this.audioElement) {
            this.audioElement = new Audio();
            this.audioElement.crossOrigin = 'anonymous';
            this.audioElement.volume = this.musicVolume;

            this.audioElement.addEventListener('ended', () => {
                setTimeout(() => this.playNextTrack(), AppConfig.TRACK_END_DELAY);
            });

            this.audioElement.addEventListener('error', (err) => {
                console.error('Audio element error:', err);
                this.playNextTrackAfterDelay();
            });
        }

        this.playNextTrack();
    }

    stopBackgroundMusic() {
        this.musicPlaying = false;
        if (typeof db !== 'undefined' && db.ready) {
            db.set('settings', 'musicEnabled', false).catch(() => {});
        }
        if (this.audioElement) {
            this.audioElement.pause();
            this.audioElement.currentTime = 0;
        }
    }

    attachToElements(elements) {
        elements.forEach(el => {
            el.addEventListener('mouseenter', () => this.playSoftBeepSound());
            el.addEventListener('mousedown', () => this.playClickSound());
        });
    }

    async initUI() {
        // Load settings from IndexedDB first
        await this.loadSettings();
        
        // Attach to existing buttons
        this.attachToElements(document.querySelectorAll('button, a, .clickable-line, .back-btn, .group-title'));

        // Setup controls
        const musicToggleBtn = document.getElementById('musicToggleBtn');
        const sfxToggleBtn = document.getElementById('sfxToggleBtn');
        const volumeSlider = document.getElementById('volumeSlider');
        const volumeLabel = document.getElementById('volumeLabel');
        const sfxSlider = document.getElementById('sfxSlider');
        const sfxLabel = document.getElementById('sfxLabel');
        const previewToggleBtn = document.getElementById('previewToggleBtn');
        const previewLabel = document.getElementById('previewLabel');

        // Initialize slider values
        if (volumeSlider) {
            const vol = this.musicVolume * 100;
            volumeSlider.value = vol;
            if (volumeLabel) volumeLabel.textContent = Math.round(vol) + '%';
            volumeSlider.addEventListener('input', () => {
                this.setMusicVolume(volumeSlider.value);
                if (volumeLabel) volumeLabel.textContent = volumeSlider.value + '%';
            });
        }

        if (sfxSlider) {
            sfxSlider.value = this.sfxVolume;
            if (sfxLabel) sfxLabel.textContent = Math.round(this.sfxVolume) + '%';
            sfxSlider.addEventListener('input', () => {
                this.setSfxVolume(sfxSlider.value);
                if (sfxLabel) sfxLabel.textContent = sfxSlider.value + '%';
            });
        }

        // SFX toggle
        if (sfxToggleBtn) {
            const updateSfxState = () => {
                sfxToggleBtn.classList.toggle('active', this.sfxEnabled);
                sfxToggleBtn.textContent = this.sfxEnabled ? '🔊' : '🔇';
            };
            updateSfxState();
            sfxToggleBtn.addEventListener('click', () => {
                this.setSfxEnabled(!this.sfxEnabled);
                updateSfxState();
            });
        }

        // Video Preview disabled by default (no setting in control panel)
        window.videoPreviewEnabled = false;

        // Music toggle
        if (musicToggleBtn) {
            // Set initial button state
            if (this.shouldPlayMusic) {
                musicToggleBtn.classList.add('active');
                musicToggleBtn.textContent = '🎵';
            } else {
                musicToggleBtn.classList.remove('active');
                musicToggleBtn.textContent = '⏹';
            }
            
            musicToggleBtn.addEventListener('click', () => {
                if (this.musicPlaying) {
                    this.stopBackgroundMusic();
                    musicToggleBtn.classList.remove('active');
                    musicToggleBtn.textContent = '⏹';
                } else {
                    this.init();
                    this.playBackgroundMusic();
                    musicToggleBtn.classList.add('active');
                    musicToggleBtn.textContent = '🎵';
                }
            });

            // Auto-play on first interaction if enabled
            if (this.shouldPlayMusic) {
                const autoPlay = () => {
                    if (!this.musicPlaying) {
                        this.init();
                        this.playBackgroundMusic();
                        musicToggleBtn.classList.add('active');
                        musicToggleBtn.textContent = '🎵';
                    }
                    ['mousedown', 'touchstart', 'click'].forEach(e => 
                        document.removeEventListener(e, autoPlay)
                    );
                };
                ['mousedown', 'touchstart', 'click'].forEach(e => 
                    document.addEventListener(e, autoPlay, { once: true })
                );
            }
        }

        // Watch for dynamic elements
        new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1) {
                        const buttons = node.matches?.('button, a') 
                            ? [node] 
                            : Array.from(node.querySelectorAll?.('button, a, .clickable-line, .back-btn, .group-title') || []);
                        this.attachToElements(buttons);
                    }
                });
            });
        }).observe(document.body, { childList: true, subtree: true });
    }
}

const soundEffects = new SoundEffects();

document.addEventListener('DOMContentLoaded', () => {
    // Initialize audio context on first user interaction
    const initAudio = () => {
        soundEffects.init();
        ['mousedown', 'touchstart', 'click'].forEach(e => 
            document.removeEventListener(e, initAudio)
        );
    };
    ['mousedown', 'touchstart', 'click'].forEach(e => 
        document.addEventListener(e, initAudio)
    );

    // Setup UI controls
    soundEffects.initUI();
});

/* ==================== UTILITY FUNCTIONS ==================== */
// HTML escaping for XSS protection
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Navigate to progression detail page
function showDetail(indexOrLineText, encodedLineTitle) {
    let lineTitle = '';
    let progIndex = '';
    
    if (typeof indexOrLineText === 'number') {
        progIndex = String(indexOrLineText);
    } else if (typeof indexOrLineText === 'string') {
        lineTitle = decodeURIComponent(indexOrLineText);
    } 
    
    if (typeof encodedLineTitle === 'string') {
        lineTitle = decodeURIComponent(encodedLineTitle);
    }
    
    if ((lineTitle || progIndex) && router) {
        // Set global state for progressInfo.js to access
        window.lastSelectedLineTitle = lineTitle;
        window.lastSelectedProgIndex = progIndex;
        window.lastSelectedUniqueKey = progIndex ? `${progIndex}:${lineTitle}` : lineTitle;
        
        router.loadPage('progression-info.html');
        window.history.pushState(
            { page: 'progression-info.html', lineTitle, progIndex }, 
            '', 
            `progression-info.html?lineTitle=${encodeURIComponent(lineTitle)}&progIndex=${progIndex}`
        );
    }
}

// Load site description for home page
function loadSiteDescription() {
    const defaultDescription = 'Learn and explore chord progressions and music theory concepts.';
    const savedDescription = localStorage.getItem('siteDescription') || defaultDescription;
    
    const siteDescElement = document.getElementById('siteDescription');
    if (siteDescElement) {
        siteDescElement.textContent = savedDescription;
    }
}

function initSettingsPanel() {
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsPanel = document.getElementById('settingsPanel');
    const settingsCloseBtn = document.getElementById('settingsCloseBtn');
    if (!settingsBtn || !settingsPanel) return;
    settingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        settingsPanel.classList.toggle('open');
    });
    if (settingsCloseBtn) {
        settingsCloseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            settingsPanel.classList.remove('open');
        });
    }
    document.addEventListener('click', (e) => {
        if (!settingsPanel.contains(e.target) && e.target !== settingsBtn) {
            settingsPanel.classList.remove('open');
        }
    });

    settingsPanel.addEventListener('click', (e) => {
        e.stopPropagation();
    });
}

if (document.readyState !== 'loading') {
    initSettingsPanel();
} else {
    document.addEventListener('DOMContentLoaded', initSettingsPanel);
}
