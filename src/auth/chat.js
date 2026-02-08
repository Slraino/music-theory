// Chat Room Module
// Real-time chat using Firestore

import { db, collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp, Timestamp } from './firebase-config.js';
import { getCurrentUser, isSignedIn } from './auth.js';
import { loadUserProfile } from './profile.js';

let chatUnsubscribe = null; // Firestore listener cleanup
const MESSAGE_LIMIT = 50; // Max messages to load

// ── Bad Word Filter ──
const BAD_WORDS = [
    'fuck','shit','bitch','ass','asshole','bastard','damn','dick','pussy',
    'cock','cunt','fag','faggot','nigger','nigga','slut','whore','retard',
    'stfu','wtf','gtfo','lmao','dumbass','jackass','motherfucker','bullshit',
    'piss','wank','twat','bollocks','arsehole','bugger','tosser','bloody',
    'crap','douche','suck','boob','penis','vagina','anus'
];

// Build regex from word list (matches whole words, case-insensitive)
const badWordRegex = new RegExp(
    '\\b(' + BAD_WORDS.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\b', 'gi'
);

/**
 * Check if text contains bad words
 * Returns { clean: boolean, filtered: string }
 */
function filterBadWords(text) {
    const hasMatch = badWordRegex.test(text);
    badWordRegex.lastIndex = 0; // Reset regex state
    if (!hasMatch) return { clean: true, filtered: text };

    const filtered = text.replace(badWordRegex, (match) => match[0] + '*'.repeat(match.length - 1));
    return { clean: false, filtered };
}

/**
 * Render the chat room page
 * Called by Router when navigating to chat page
 */
async function renderChatPage() {
    const container = document.getElementById('chatContent');
    if (!container) return;

    container.innerHTML = `
        <div class="chat-room">
            <div class="chat-messages" id="chatMessages">
                <div class="chat-welcome">
                    <p>\u2728 Welcome to the Fantasia Chat Room \u2728</p>
                    <p class="chat-welcome-sub">Sign in to send messages</p>
                </div>
            </div>
            <div class="chat-input-area" id="chatInputArea">
                ${isSignedIn() ? `
                    <input type="text" id="chatInput" class="chat-input" 
                           placeholder="Type a message..." maxlength="300" autocomplete="off">
                    <button id="chatSendBtn" class="chat-send-btn" title="Send">\u27A4</button>
                ` : `
                    <div class="chat-login-prompt">Sign in to chat</div>
                `}
            </div>
        </div>
    `;

    // Start listening for messages
    startMessageListener();

    // Setup send functionality
    if (isSignedIn()) {
        const input = document.getElementById('chatInput');
        const sendBtn = document.getElementById('chatSendBtn');

        if (sendBtn) {
            sendBtn.addEventListener('click', () => sendMessage());
        }

        if (input) {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                }
            });
            // Auto-focus input
            input.focus();
        }
    }
}

/**
 * Send a chat message to Firestore
 */
async function sendMessage() {
    const input = document.getElementById('chatInput');
    if (!input) return;

    const text = input.value.trim();
    if (!text) return;

    const user = getCurrentUser();
    if (!user) return;

    // Filter bad words
    const { filtered } = filterBadWords(text);

    // Clear input immediately for responsive feel
    input.value = '';
    input.focus();

    try {
        // Load custom avatar emoji from profile
        let avatarEmoji = '';
        if (window.loadUserProfile) {
            try {
                const profile = await window.loadUserProfile();
                if (profile?.avatarEmoji) avatarEmoji = profile.avatarEmoji;
            } catch (e) { /* ignore - will use photoURL fallback */ }
        }

        const messagesRef = collection(db, 'chatMessages');
        await addDoc(messagesRef, {
            text: filtered,
            uid: user.uid,
            displayName: user.displayName || 'Anonymous',
            photoURL: user.photoURL || '',
            avatarEmoji: avatarEmoji,
            timestamp: serverTimestamp()
        });
    } catch (error) {
        console.error('Failed to send message:', error);
        // Restore the message on failure
        input.value = text;
    }
}

/**
 * Start real-time listener for chat messages
 */
function startMessageListener() {
    // Cleanup previous listener
    stopMessageListener();

    try {
        const messagesRef = collection(db, 'chatMessages');
        const q = query(messagesRef, orderBy('timestamp', 'asc'), limit(MESSAGE_LIMIT));

        chatUnsubscribe = onSnapshot(q, (snapshot) => {
            const messagesContainer = document.getElementById('chatMessages');
            if (!messagesContainer) return;

            // Clear welcome message on first data
            if (snapshot.size > 0) {
                messagesContainer.innerHTML = '';
            }

            // Process changes only (more efficient than re-rendering all)
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    const msg = change.doc.data();
                    const msgEl = createMessageElement(msg, change.doc.id);
                    messagesContainer.appendChild(msgEl);
                }
                if (change.type === 'removed') {
                    const el = document.getElementById(`msg-${change.doc.id}`);
                    if (el) el.remove();
                }
            });

            // Auto-scroll to bottom
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }, (error) => {
            console.error('Chat listener error:', error);
            const messagesContainer = document.getElementById('chatMessages');
            if (messagesContainer) {
                messagesContainer.innerHTML = `
                    <div class="chat-welcome">
                        <p>\u26A0\uFE0F Could not connect to chat</p>
                        <p class="chat-welcome-sub">${error.message}</p>
                    </div>
                `;
            }
        });
    } catch (error) {
        console.error('Failed to start chat listener:', error);
    }
}

/**
 * Stop listening for messages (cleanup)
 */
function stopMessageListener() {
    if (chatUnsubscribe) {
        chatUnsubscribe();
        chatUnsubscribe = null;
    }
}

/**
 * Create a DOM element for a chat message
 */
function createMessageElement(msg, docId) {
    const currentUser = getCurrentUser();
    const isOwnMessage = currentUser && msg.uid === currentUser.uid;

    const wrapper = document.createElement('div');
    wrapper.className = `chat-message ${isOwnMessage ? 'own' : ''}`;
    wrapper.id = `msg-${docId}`;

    // Format timestamp
    let timeStr = '';
    if (msg.timestamp) {
        const date = msg.timestamp instanceof Timestamp ? msg.timestamp.toDate() : new Date(msg.timestamp);
        timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }

    // Build avatar: prefer emoji, fall back to photo
    let avatarHtml = '';
    if (!isOwnMessage) {
        if (msg.avatarEmoji) {
            avatarHtml = `<span class="chat-avatar chat-avatar-emoji">${escChatHtml(msg.avatarEmoji)}</span>`;
        } else {
            avatarHtml = `<img src="${escChatHtml(msg.photoURL)}" alt="" class="chat-avatar"
                 onerror="this.style.display='none'">`;
        }
    }

    wrapper.innerHTML = `
        ${avatarHtml}
        <div class="chat-bubble">
            ${!isOwnMessage ? `<span class="chat-author">${escChatHtml(msg.displayName)}</span>` : ''}
            <span class="chat-text">${escChatHtml(msg.text)}</span>
            <span class="chat-time">${timeStr}</span>
        </div>
    `;

    return wrapper;
}

// Simple HTML escape
function escChatHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

// Expose to global scope for Router
window.renderChatPage = renderChatPage;
window.cleanupChat = stopMessageListener;

