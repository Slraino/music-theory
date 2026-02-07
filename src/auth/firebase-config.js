// Firebase Configuration
// Note: Firebase API keys are designed to be public in client-side code.
// Security is enforced through Firebase Security Rules and Authorized Domains.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp, Timestamp, getDocs, increment } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDqUe3r4yD7VJkEQXafJT2akD4ekTUz7Y4",
  authDomain: "fantasia-3c631.firebaseapp.com",
  projectId: "fantasia-3c631",
  storageBucket: "fantasia-3c631.firebasestorage.app",
  messagingSenderId: "539485608921",
  appId: "1:539485608921:web:dd3f2dc791512ab42fd7c8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

export { auth, db, googleProvider, signInWithPopup, signOut, onAuthStateChanged };
export { doc, getDoc, setDoc, updateDoc, collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp, Timestamp, getDocs, increment };
