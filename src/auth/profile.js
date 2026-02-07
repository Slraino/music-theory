// User Profile Module
// Handles user profile display, editing, and Firestore persistence

import { db, doc, getDoc, setDoc } from './firebase-config.js';
import { getCurrentUser, isSignedIn } from './auth.js';

// Emoji avatar options
const AVATAR_EMOJIS = [
    '\u{1F464}', '\u{1F60A}', '\u{1F60E}', '\u{1F913}', '\u{1F929}', '\u{1F47B}',
    '\u{1F431}', '\u{1F436}', '\u{1F43C}', '\u{1F98A}', '\u{1F430}', '\u{1F985}',
    '\u{1F3B5}', '\u{1F3B8}', '\u{1F3B9}', '\u{1F3BB}', '\u{1F941}', '\u{1F3A4}',
    '\u{2B50}', '\u{1F525}', '\u{1F4A0}', '\u{2728}', '\u{1F308}', '\u{1F31F}',
    '\u{1F680}', '\u{1F48E}', '\u{1F3AE}', '\u{1F3AF}', '\u{1FA84}', '\u{1F33A}'
];

/**
 * Load user profile from Firestore
 * Creates a default profile if none exists
 */
async function loadUserProfile() {
    const user = getCurrentUser();
    if (!user) return null;

    try {
        const profileRef = doc(db, 'users', user.uid, 'profile', 'info');
        const snapshot = await getDoc(profileRef);

        if (snapshot.exists()) {
            return snapshot.data();
        }

        // Create default profile from Google account info
        const defaultProfile = {
            displayName: user.displayName || 'Anonymous',
            bio: '',
            photoURL: user.photoURL || '',
            email: user.email || '',
            joinedAt: new Date().toISOString(),
            lastSeen: new Date().toISOString()
        };

        await setDoc(profileRef, defaultProfile);
        return defaultProfile;
    } catch (error) {
        console.error('Failed to load profile:', error);
        return null;
    }
}

/**
 * Save profile changes to Firestore
 */
async function saveUserProfile(updates) {
    const user = getCurrentUser();
    if (!user) return false;

    try {
        const profileRef = doc(db, 'users', user.uid, 'profile', 'info');
        await setDoc(profileRef, { ...updates, lastSeen: new Date().toISOString() }, { merge: true });
        console.log('✅ Profile saved');
        return true;
    } catch (error) {
        console.error('Failed to save profile:', error);
        return false;
    }
}

/**
 * Render the profile page content
 * Called by Router when navigating to profile page
 */
async function renderProfilePage() {
    const container = document.getElementById('profileContent');
    if (!container) return;

    if (!isSignedIn()) {
        container.innerHTML = `
            <div class="profile-login-prompt">
                <div class="profile-prompt-icon">\u{1F464}</div>
                <p>Sign in to view your profile</p>
                <button id="profileSignInBtn" class="profile-action-btn">Sign In with Google</button>
            </div>
        `;
        const signInBtn = document.getElementById('profileSignInBtn');
        if (signInBtn) {
            const { signInWithGoogle } = await import('./auth.js');
            signInBtn.addEventListener('click', async () => {
                await signInWithGoogle();
                renderProfilePage(); // Re-render after login
            });
        }
        return;
    }

    // Show loading
    container.innerHTML = '<div class="profile-loading">Loading profile...</div>';

    const profile = await loadUserProfile();
    const user = getCurrentUser();

    if (!profile) {
        container.innerHTML = '<div class="profile-loading">Failed to load profile. Please try again.</div>';
        return;
    }

    const joinDate = profile.joinedAt ? new Date(profile.joinedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Unknown';
    const currentEmoji = profile.avatarEmoji || '';
    const showEmoji = !!currentEmoji;

    container.innerHTML = `
        <div class="profile-card">
            <div class="profile-header">
                <div class="profile-avatar-wrapper" id="avatarWrapper" title="Click to change avatar">
                    <img src="${profile.photoURL || ''}" 
                         alt="${profile.displayName}" 
                         class="profile-avatar"
                         id="profileAvatarImg"
                         style="${showEmoji ? 'display:none;' : ''}"
                         onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                    <div class="profile-avatar-fallback" id="profileAvatarEmoji" 
                         style="display: ${showEmoji ? 'flex' : 'none'};">${currentEmoji || '\u{1F464}'}</div>
                    <div class="profile-avatar-edit-badge">\u270F\uFE0F</div>
                </div>
                <div class="profile-info">
                    <h2 class="profile-name" id="profileDisplayName">${escapeProfileHtml(profile.displayName)}</h2>
                    <p class="profile-email">${escapeProfileHtml(profile.email)}</p>
                    <p class="profile-joined">Joined ${joinDate}</p>
                </div>
            </div>

            <div class="emoji-picker-container" id="emojiPickerContainer" style="display: none;">
                <label class="profile-label">Choose Your Avatar</label>
                <div class="emoji-picker-grid" id="emojiPickerGrid">
                    ${AVATAR_EMOJIS.map(e => `<button class="emoji-picker-item ${e === currentEmoji ? 'selected' : ''}" data-emoji="${e}">${e}</button>`).join('')}
                </div>
                <div class="emoji-picker-actions">
                    <button id="usePhotoBtn" class="emoji-picker-reset">Use Google Photo</button>
                </div>
            </div>

            <div class="profile-section">
                <label class="profile-label">Display Name</label>
                <div class="profile-edit-row">
                    <input type="text" id="profileNameInput" class="profile-input" 
                           value="${escapeProfileAttr(profile.displayName)}" maxlength="30" placeholder="Your name">
                </div>
            </div>

            <div class="profile-section">
                <label class="profile-label">Bio</label>
                <textarea id="profileBioInput" class="profile-input profile-textarea" 
                          maxlength="150" placeholder="Tell us about yourself...">${escapeProfileHtml(profile.bio || '')}</textarea>
                <span class="profile-char-count" id="bioCharCount">${(profile.bio || '').length}/150</span>
            </div>

            <div class="profile-actions">
                <button id="profileSaveBtn" class="profile-action-btn">Save Changes</button>
                <button id="profileSignOutBtn" class="profile-action-btn profile-btn-outlined">Sign Out</button>
            </div>

            <div id="profileSaveStatus" class="profile-save-status"></div>
        </div>
    `;

    // Bio character counter
    const bioInput = document.getElementById('profileBioInput');
    const bioCount = document.getElementById('bioCharCount');
    if (bioInput && bioCount) {
        bioInput.addEventListener('input', () => {
            bioCount.textContent = `${bioInput.value.length}/150`;
        });
    }

    // Avatar click → toggle emoji picker
    const avatarWrapper = document.getElementById('avatarWrapper');
    const emojiPicker = document.getElementById('emojiPickerContainer');
    if (avatarWrapper && emojiPicker) {
        avatarWrapper.addEventListener('click', () => {
            emojiPicker.style.display = emojiPicker.style.display === 'none' ? 'block' : 'none';
        });
    }

    // Emoji picker selection
    let selectedEmoji = profile.avatarEmoji || '';
    const emojiGrid = document.getElementById('emojiPickerGrid');
    if (emojiGrid) {
        emojiGrid.addEventListener('click', (e) => {
            const item = e.target.closest('.emoji-picker-item');
            if (!item) return;
            // Update selection
            emojiGrid.querySelectorAll('.emoji-picker-item').forEach(el => el.classList.remove('selected'));
            item.classList.add('selected');
            selectedEmoji = item.dataset.emoji;
            // Update avatar preview
            const avatarImg = document.getElementById('profileAvatarImg');
            const avatarEmoji = document.getElementById('profileAvatarEmoji');
            if (avatarImg) avatarImg.style.display = 'none';
            if (avatarEmoji) { avatarEmoji.textContent = selectedEmoji; avatarEmoji.style.display = 'flex'; }
        });
    }

    // Use Google Photo button (reset emoji)
    const usePhotoBtn = document.getElementById('usePhotoBtn');
    if (usePhotoBtn) {
        usePhotoBtn.addEventListener('click', () => {
            selectedEmoji = '';
            emojiGrid?.querySelectorAll('.emoji-picker-item').forEach(el => el.classList.remove('selected'));
            const avatarImg = document.getElementById('profileAvatarImg');
            const avatarEmoji = document.getElementById('profileAvatarEmoji');
            if (avatarImg && profile.photoURL) { avatarImg.style.display = ''; avatarEmoji.style.display = 'none'; }
            else if (avatarEmoji) { avatarEmoji.textContent = '\u{1F464}'; avatarEmoji.style.display = 'flex'; }
        });
    }

    // Save button
    const saveBtn = document.getElementById('profileSaveBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            const nameInput = document.getElementById('profileNameInput');
            const bioInput = document.getElementById('profileBioInput');
            const status = document.getElementById('profileSaveStatus');

            const newName = (nameInput?.value || '').trim();
            const newBio = (bioInput?.value || '').trim();

            if (!newName) {
                if (status) { status.textContent = 'Name cannot be empty'; status.className = 'profile-save-status error'; }
                return;
            }

            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving...';

            const success = await saveUserProfile({
                displayName: newName,
                bio: newBio,
                avatarEmoji: selectedEmoji
            });

            if (success) {
                if (status) { status.textContent = 'Profile saved!'; status.className = 'profile-save-status success'; }
                // Update the name display
                const nameDisplay = document.getElementById('profileDisplayName');
                if (nameDisplay) nameDisplay.textContent = newName;
            } else {
                if (status) { status.textContent = 'Failed to save. Try again.'; status.className = 'profile-save-status error'; }
            }

            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Changes';

            // Clear status after 3 seconds
            setTimeout(() => { if (status) status.textContent = ''; }, 3000);
        });
    }

    // Sign out button
    const signOutBtn = document.getElementById('profileSignOutBtn');
    if (signOutBtn) {
        const { signOutUser } = await import('./auth.js');
        signOutBtn.addEventListener('click', async () => {
            const confirmed = confirm('Are you sure you want to sign out?');
            if (confirmed) {
                await signOutUser();
                // Navigate back to home
                if (window.router) {
                    window.router.navigate('index.html');
                }
            }
        });
    }
}

// Simple HTML escape helpers
function escapeProfileHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

function escapeProfileAttr(text) {
    return (text || '').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Expose to global scope for Router init
window.renderProfilePage = renderProfilePage;
window.loadUserProfile = loadUserProfile;

export { loadUserProfile };
