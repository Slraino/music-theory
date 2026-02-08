// Authentication Module
import { auth, googleProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged } from './firebase-config.js';

// Current user state
let currentUser = null;

// Sign in with Google — tries popup first, falls back to redirect if blocked
export async function signInWithGoogle() {
    try {
        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;
        console.log('✅ Signed in:', user.displayName);
        return user;
    } catch (error) {
        console.error('⚠️ Popup sign-in failed, trying redirect...', error.message);
        try {
            // Redirect-based sign-in works even when third-party cookies are blocked
            await signInWithRedirect(auth, googleProvider);
            // Page will reload — result is handled by handleRedirectResult() on next load
            return null;
        } catch (redirectError) {
            console.error('❌ Sign-in error:', redirectError.message);
            alert('Sign-in failed: ' + redirectError.message);
            return null;
        }
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

// Handle redirect result on page load (for when signInWithRedirect was used)
async function handleRedirectResult() {
    try {
        const result = await getRedirectResult(auth);
        if (result && result.user) {
            console.log('✅ Signed in via redirect:', result.user.displayName);
        }
    } catch (error) {
        console.error('❌ Redirect sign-in error:', error.message);
    }
}

// Listen for auth state changes
export function initAuthListener(callback) {
    handleRedirectResult(); // Check for pending redirect sign-in
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
