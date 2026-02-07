// Authentication Module
import { auth, googleProvider, signInWithPopup, signOut, onAuthStateChanged } from './firebase-config.js';

// Current user state
let currentUser = null;

// Sign in with Google
export async function signInWithGoogle() {
    try {
        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;
        console.log('✅ Signed in:', user.displayName);
        return user;
    } catch (error) {
        console.error('❌ Sign-in error:', error.message);
        alert('Sign-in failed: ' + error.message);
        return null;
    }
}

// Sign out
export async function signOutUser() {
    try {
        await signOut(auth);
        console.log('✅ Signed out');
        return true;
    } catch (error) {
        console.error('❌ Sign-out error:', error.message);
        return false;
    }
}

// Listen for auth state changes
export function initAuthListener(callback) {
    onAuthStateChanged(auth, (user) => {
        currentUser = user;
        if (callback) callback(user);
    });
}

// Get current user
export function getCurrentUser() {
    return currentUser;
}

// Check if user is signed in
export function isSignedIn() {
    return currentUser !== null;
}
