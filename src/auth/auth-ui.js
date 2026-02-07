// Authentication UI Module
import { signInWithGoogle, signOutUser, initAuthListener } from './auth.js';
import { loadUserProfile } from './profile.js';

// Initialize authentication UI
export function initAuthUI() {
    const authContainer = document.getElementById('authContainer');
    if (!authContainer) {
        console.error('Auth container not found');
        return;
    }

    // Listen for authentication state changes
    initAuthListener((user) => {
        updateAuthUI(user);
        // Sync settings from cloud when user logs in
        if (user && window.cloudSync) {
            window.cloudSync.onLoginSync().then((cloudSettings) => {
                if (cloudSettings && typeof soundEffects !== 'undefined') {
                    soundEffects.applyCloudSettings(cloudSettings);
                }
            });
        }
    });
}

// Update UI based on auth state
async function updateAuthUI(user) {
    const authContainer = document.getElementById('authContainer');
    
    if (user) {
        // Check for custom avatar emoji
        let avatarEmoji = '';
        try {
            const profile = await loadUserProfile();
            if (profile?.avatarEmoji) avatarEmoji = profile.avatarEmoji;
        } catch (e) { /* ignore */ }

        if (avatarEmoji) {
            // Show emoji avatar
            authContainer.innerHTML = `
                <button id="userProfileBtn" class="auth-btn" title="${user.displayName || 'User'}" style="padding: 0.25rem;">
                    <span style="font-size: 1.5rem; line-height: 1;">${avatarEmoji}</span>
                </button>
            `;
        } else {
            // Show Google photo
            authContainer.innerHTML = `
                <button id="userProfileBtn" class="auth-btn" title="${user.displayName || 'User'}" style="padding: 0.25rem;">
                    <img src="${user.photoURL || ''}" 
                         alt="${user.displayName || 'User'}" 
                         style="width: 28px; height: 28px; border-radius: 50%;"
                         onerror="this.parentElement.innerHTML='\u{1F464}'">
                </button>
            `;
        }
        
        // Click navigates to profile page
        document.getElementById('userProfileBtn').addEventListener('click', handleProfileClick);
    } else {
        // User is signed out
        authContainer.innerHTML = `
            <button id="signInBtn" class="auth-btn" title="Sign in with Google">
                \u{1F464}
            </button>
        `;
        
        // Attach sign in handler
        document.getElementById('signInBtn').addEventListener('click', handleSignIn);
    }
}

// Handle sign in
async function handleSignIn() {
    const user = await signInWithGoogle();
    if (user) {
        console.log('Welcome,', user.displayName);
    }
}

// Handle profile click - navigate to profile page
function handleProfileClick() {
    if (window.router) {
        window.router.navigate('profile.html');
    }
}
