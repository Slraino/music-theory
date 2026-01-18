// Local music playlist - add your MP3 files to the /music folder
const MUSIC_PLAYLIST = [
    'music/Sharou-superstar.mp3',
    'music/Sharou-Anyone%20in%202025_.mp3',
    'music/Sharou-3_03%20PM.mp3',
    'music/Sharou-2_23%20AM.mp3',
    'music/Sharou-10.mp3',
    'music/Sharou-Cassette%20Tape%20Dream.mp3',
    'music/Sharou-Sheep%20of%20the%20Far%20East%2C%20Dancing%20with%20the%20Telecaster.mp3',
    'music/Sharou-You%20and%20Me.mp3'
];

// Sound Effects Manager
class SoundEffects {
    constructor() {
        this.audioContext = null;
        this.initialized = false;
        this.musicPlaying = false;
        this.musicGain = null;
        this.musicVolume = localStorage.getItem('musicVolume') ? parseFloat(localStorage.getItem('musicVolume')) : 0.15;
        this.shouldPlayMusic = localStorage.getItem('musicEnabled') !== 'false';
        this.sfxVolume = localStorage.getItem('sfxVolume') ? parseFloat(localStorage.getItem('sfxVolume')) : 50;
        this.sfxEnabled = localStorage.getItem('sfxEnabled') === 'true' ? true : true;
        this.audioElement = null;
        this.currentTrackIndex = 0;
    }

    init() {
        if (this.initialized) return;
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContext();
            this.initialized = true;
        } catch (e) {

        }
    }

    playHoverSound() {
        if (!this.audioContext || !this.sfxEnabled) return;
        if (!this.audioContext) this.init();
        if (!this.audioContext) return;
        this.playToneSound(700, 0.05, 0.12);
    }

    playClickSound() {
        if (!this.audioContext || !this.sfxEnabled) return;
        if (!this.audioContext) this.init();
        if (!this.audioContext) return;
        this.playToneSound(1200, 0.1, 0.15, 600);
    }

    playSoftBeepSound() {
        if (!this.audioContext || !this.sfxEnabled) return;
        if (!this.audioContext) this.init();
        if (!this.audioContext) return;
        this.playToneSound(700, 0.05, 0.12);
    }

    // Unified tone generator to reduce code duplication and improve maintainability
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
        localStorage.setItem('musicVolume', this.musicVolume);
        if (typeof db !== 'undefined' && db.ready) {
            db.set('settings', 'musicVolume', this.musicVolume).catch(() => {});
        }
        if (this.audioElement) {
            this.audioElement.volume = this.musicVolume;
        }
    }

    setSfxVolume(volume) {
        this.sfxVolume = Math.max(0, Math.min(100, volume));
        localStorage.setItem('sfxVolume', this.sfxVolume);
        if (typeof db !== 'undefined' && db.ready) {
            db.set('settings', 'sfxVolume', this.sfxVolume).catch(() => {});
        }
    }

    setSfxEnabled(enabled) {
        this.sfxEnabled = enabled;
        localStorage.setItem('sfxEnabled', enabled ? 'true' : 'false');
        if (typeof db !== 'undefined' && db.ready) {
            db.set('settings', 'sfxEnabled', enabled).catch(() => {});
        }
    }

    // Extract video ID from YouTube URL
    getVideoId(youtubeUrl) {
        const patterns = [
            /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
            /youtube\.com\/embed\/([^?]+)/
        ];
        
        for (let pattern of patterns) {
            const match = youtubeUrl.match(pattern);
            if (match) {
                return match[1];
            }
        }
        return null;
    }

    // Get stream URL using multiple fallback services
    getStreamUrl(videoId) {
        // Try multiple services for better reliability
        return [
            `https://piped.kavin.rocks/api/v1/streams/${videoId}`,
            `https://pipedapi.kavin.rocks/api/v1/streams/${videoId}`,
            `https://piped.video/api/v1/streams/${videoId}`
        ];
    }

    playNextTrack() {
        if (!this.musicPlaying) return;

        // Pick random track
        const randomIndex = Math.floor(Math.random() * MUSIC_PLAYLIST.length);
        const trackUrl = MUSIC_PLAYLIST[randomIndex];



        if (this.audioElement) {
            // Pause and reset before loading new track
            this.audioElement.pause();
            this.audioElement.currentTime = 0;
            
            // Set source and wait for canplay before attempting to play
            this.audioElement.src = trackUrl;
            this.audioElement.volume = this.musicVolume;
            
            // Use load() to initiate loading
            this.audioElement.load();
            
            // Wait for canplay event before playing
            const playAttempt = () => {
                this.audioElement.play().catch(err => {
                    console.error('Could not play audio:', err);
                    this.playNextTrackAfterDelay();
                });
            };
            
            // Remove old canplay listener to avoid duplicates
            this.audioElement.removeEventListener('canplay', playAttempt);
            this.audioElement.addEventListener('canplay', playAttempt, { once: true });
        }
    }

    playNextTrackAfterDelay() {
        // Retry after 2 seconds if error
        if (this.musicPlaying) {
            setTimeout(() => this.playNextTrack(), 2000);
        }
    }

    playBackgroundMusic() {
        if (this.musicPlaying) return;
        if (!this.audioContext) this.init();

        this.musicPlaying = true;
        localStorage.setItem('musicEnabled', 'true');
        if (typeof db !== 'undefined' && db.ready) {
            db.set('settings', 'musicEnabled', true).catch(() => {});
        }

        // Create audio element if needed
        if (!this.audioElement) {
            this.audioElement = new Audio();
            this.audioElement.crossOrigin = 'anonymous';
            this.audioElement.volume = this.musicVolume;

            // When track ends, play next random one
            this.audioElement.addEventListener('ended', () => {

                setTimeout(() => this.playNextTrack(), 500);
            });

            this.audioElement.addEventListener('error', (err) => {
                console.error('Audio element error:', err);
                this.playNextTrackAfterDelay();
            });
        }

        // Start playing
        this.playNextTrack();
    }

    stopBackgroundMusic() {
        this.musicPlaying = false;
        localStorage.setItem('musicEnabled', 'false');
        if (typeof db !== 'undefined' && db.ready) {
            db.set('settings', 'musicEnabled', false).catch(() => {});
        }
        if (this.audioElement) {
            this.audioElement.pause();
            this.audioElement.currentTime = 0;
        }
    }
}

const soundEffects = new SoundEffects();

document.addEventListener('DOMContentLoaded', function() {
    const initializeAudio = function() {
        soundEffects.init();
        document.removeEventListener('mousedown', initializeAudio);
        document.removeEventListener('touchstart', initializeAudio);
        document.removeEventListener('click', initializeAudio);
    };
    
    document.addEventListener('mousedown', initializeAudio);
    document.addEventListener('touchstart', initializeAudio);
    document.addEventListener('click', initializeAudio);

    const buttons = document.querySelectorAll('button, a, .clickable-line, .back-btn, .group-title');
    buttons.forEach(button => {
        button.addEventListener('mouseenter', () => soundEffects.playSoftBeepSound());
        button.addEventListener('mousedown', () => soundEffects.playClickSound());
    });

    const musicToggleBtn = document.getElementById('musicToggleBtn');
    const sfxToggleBtn = document.getElementById('sfxToggleBtn');
    const volumeSlider = document.getElementById('volumeSlider');
    const volumeLabel = document.getElementById('volumeLabel');
    const sfxSlider = document.getElementById('sfxSlider');
    const sfxLabel = document.getElementById('sfxLabel');

    if (volumeSlider) {
        const savedVolume = localStorage.getItem('musicVolume');
        if (savedVolume) {
            const vol = parseFloat(savedVolume) * 100;
            volumeSlider.value = vol;
            if (volumeLabel) volumeLabel.textContent = Math.round(vol) + '%';
        }
    }

    if (sfxSlider) {
        sfxSlider.value = soundEffects.sfxVolume;
        if (sfxLabel) sfxLabel.textContent = Math.round(soundEffects.sfxVolume) + '%';
    }

    // Update SFX button visual state
    const updateSfxButtonState = () => {
        if (sfxToggleBtn) {
            if (soundEffects.sfxEnabled) {
                sfxToggleBtn.classList.add('active');
                sfxToggleBtn.textContent = '🔊 SFX On';
            } else {
                sfxToggleBtn.classList.remove('active');
                sfxToggleBtn.textContent = '🔇 SFX Off';
            }
        }
    };
    updateSfxButtonState();

    if (musicToggleBtn) {
        musicToggleBtn.addEventListener('click', function() {
            if (soundEffects.musicPlaying) {
                soundEffects.stopBackgroundMusic();
                musicToggleBtn.classList.remove('active');
                musicToggleBtn.textContent = '🎵 Music';
            } else {
                soundEffects.init();
                soundEffects.playBackgroundMusic();
                musicToggleBtn.classList.add('active');
                musicToggleBtn.textContent = '🎵 Music On';
            }
        });
    }

    if (sfxToggleBtn) {
        sfxToggleBtn.addEventListener('click', function() {
            soundEffects.setSfxEnabled(!soundEffects.sfxEnabled);
            updateSfxButtonState();
        });
    }

    if (volumeSlider) {
        volumeSlider.addEventListener('input', function() {
            soundEffects.setMusicVolume(this.value);
            if (volumeLabel) volumeLabel.textContent = this.value + '%';
        });
    }

    if (sfxSlider) {
        sfxSlider.addEventListener('input', function() {
            soundEffects.setSfxVolume(this.value);
            if (sfxLabel) sfxLabel.textContent = this.value + '%';
        });
    }

    // Auto-play music on load (default is enabled unless explicitly disabled)
    const shouldAutoPlay = localStorage.getItem('musicEnabled') !== 'false';
    let autoPlayTriggered = false;
    
    let autoPlayOnFirstInteraction = function() {
        if (!autoPlayTriggered && shouldAutoPlay && !soundEffects.musicPlaying) {
            autoPlayTriggered = true;
            soundEffects.init();
            soundEffects.playBackgroundMusic();
            if (musicToggleBtn) {
                musicToggleBtn.classList.add('active');
                musicToggleBtn.textContent = '🎵 Music On';
            }
        }
        // Remove listeners after first interaction
        document.removeEventListener('mousedown', autoPlayOnFirstInteraction);
        document.removeEventListener('touchstart', autoPlayOnFirstInteraction);
        document.removeEventListener('click', autoPlayOnFirstInteraction);
    };
    
    if (shouldAutoPlay) {
        // Try to start on first user interaction
        document.addEventListener('mousedown', autoPlayOnFirstInteraction);
        document.addEventListener('touchstart', autoPlayOnFirstInteraction);
        document.addEventListener('click', autoPlayOnFirstInteraction);
    }

    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.addedNodes.length) {
                mutation.addedNodes.forEach(function(node) {
                    if (node.nodeType === 1) {
                        const newButtons = node.querySelectorAll ? node.querySelectorAll('button, a, .clickable-line, .back-btn, .group-title') : [];
                        if (node.tagName === 'BUTTON' || node.tagName === 'A') {
                            node.addEventListener('mouseenter', () => soundEffects.playSoftBeepSound());
                            node.addEventListener('mousedown', () => soundEffects.playClickSound());
                        }
                        newButtons.forEach(btn => {
                            btn.addEventListener('mouseenter', () => soundEffects.playSoftBeepSound());
                            btn.addEventListener('mousedown', () => soundEffects.playClickSound());
                        });
                    }
                });
            }
        });
    });

    observer.observe(document.body, { childList: true, subtree: true });
});

