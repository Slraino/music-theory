// Settings Sync Module
// Syncs user settings (sound, music, preferences) to Firestore when logged in
// Falls back to local IndexedDB when not logged in

import { db, doc, getDoc, setDoc } from './firebase-config.js';
import { getCurrentUser } from './auth.js';

// Settings keys that get synced
const SYNC_KEYS = ['musicVolume', 'musicEnabled', 'sfxVolume', 'sfxEnabled'];

/**
 * Save a setting to Firestore (cloud)
 * Called alongside local IndexedDB saves when user is logged in
 */
export async function saveSettingToCloud(key, value) {
    const user = getCurrentUser();
    if (!user) return; // Not logged in, skip cloud save

    try {
        const userSettingsRef = doc(db, 'users', user.uid, 'settings', 'audio');
        await setDoc(userSettingsRef, { [key]: value }, { merge: true });
    } catch (error) {
        console.warn('Cloud settings save failed:', error.message);
    }
}

/**
 * Save all current settings to Firestore at once
 */
export async function saveAllSettingsToCloud(settings) {
    const user = getCurrentUser();
    if (!user) return;

    try {
        const userSettingsRef = doc(db, 'users', user.uid, 'settings', 'audio');
        await setDoc(userSettingsRef, settings, { merge: true });
        console.log('✅ Settings synced to cloud');
    } catch (error) {
        console.warn('Cloud settings save failed:', error.message);
    }
}

/**
 * Load settings from Firestore (cloud)
 * Returns null if no cloud settings exist or user not logged in
 */
export async function loadSettingsFromCloud() {
    const user = getCurrentUser();
    if (!user) return null;

    try {
        const userSettingsRef = doc(db, 'users', user.uid, 'settings', 'audio');
        const snapshot = await getDoc(userSettingsRef);

        if (snapshot.exists()) {
            console.log('✅ Settings loaded from cloud');
            return snapshot.data();
        }
        return null;
    } catch (error) {
        console.warn('Cloud settings load failed:', error.message);
        return null;
    }
}

/**
 * Called when user logs in - pulls cloud settings and applies them
 * Returns the cloud settings object or null
 */
export async function onLoginSync() {
    const cloudSettings = await loadSettingsFromCloud();
    if (cloudSettings) {
        return cloudSettings;
    }
    // First time login - no cloud settings yet, will upload local on next save
    return null;
}
