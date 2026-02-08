// Rank/Leaderboard System
// Global monthly leaderboard — all users can see, resets each month
import { db, collection, doc, getDoc, setDoc, updateDoc, query, orderBy, limit, getDocs, increment } from '../auth/firebase-config.js';
import { getCurrentUser } from '../auth/auth.js';

// Get current month key (e.g. "2026-02")
function getCurrentMonthKey() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
}

// Get display label for month (e.g. "February 2026")
function getMonthLabel(monthKey) {
    const [year, month] = monthKey.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

// Track work session completion — saves to global leaderboard collection
export async function recordWorkSession(minutes) {
    const user = getCurrentUser();
    if (!user) return;

    const monthKey = getCurrentMonthKey();
    // Doc ID = month_uid (e.g. "2026-02_abc123") so each user has one entry per month
    const docId = `${monthKey}_${user.uid}`;

    try {
        const entryRef = doc(db, 'leaderboard', docId);
        const entryDoc = await getDoc(entryRef);

        // Load avatar emoji from profile if available
        let avatarEmoji = '';
        try {
            if (window.loadUserProfile) {
                const profile = await window.loadUserProfile();
                if (profile?.avatarEmoji) avatarEmoji = profile.avatarEmoji;
            }
        } catch (e) { /* ignore */ }

        if (entryDoc.exists()) {
            await updateDoc(entryRef, {
                totalMinutes: increment(minutes),
                displayName: user.displayName || 'Anonymous',
                avatarEmoji: avatarEmoji,
                lastActive: new Date()
            });
        } else {
            await setDoc(entryRef, {
                uid: user.uid,
                month: monthKey,
                displayName: user.displayName || 'Anonymous',
                avatarEmoji: avatarEmoji,
                totalMinutes: minutes,
                lastActive: new Date()
            });
        }
    } catch (error) {
        console.error('Error recording work session:', error);
    }
}

// Fetch leaderboard for current month
async function fetchLeaderboard(maxResults = 10) {
    const monthKey = getCurrentMonthKey();

    try {
        const leaderboardRef = collection(db, 'leaderboard');
        // Query only current month entries, sorted by minutes
        const q = query(leaderboardRef, orderBy('totalMinutes', 'desc'), limit(50));
        const snapshot = await getDocs(q);

        const leaderboard = [];
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            // Only include current month entries
            if (data.month === monthKey) {
                leaderboard.push(data);
            }
        });

        return leaderboard.slice(0, maxResults);
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        return [];
    }
}

// Render leaderboard
async function renderLeaderboard() {
    const rankList = document.getElementById('rankList');
    if (!rankList) return;

    rankList.innerHTML = '<div class="rank-loading">Loading...</div>';

    // Show current month in header
    const rankHeader = document.querySelector('.rank-header h2');
    if (rankHeader) {
        rankHeader.textContent = `\u{1F3C6} ${getMonthLabel(getCurrentMonthKey())}`;
    }

    const currentUser = getCurrentUser();
    const leaderboard = await fetchLeaderboard(10);

    if (leaderboard.length === 0) {
        rankList.innerHTML = `
            <div class="rank-empty">
                <div class="rank-empty-icon">\u23F1\uFE0F</div>
                <div class="rank-empty-text">No rankings yet this month</div>
                <div class="rank-empty-hint">Complete a Pomodoro session to earn your rank!</div>
            </div>
        `;
        return;
    }

    rankList.innerHTML = '';
    leaderboard.forEach((user, index) => {
        const item = document.createElement('div');
        item.className = 'rank-item';
        if (currentUser && user.uid === currentUser.uid) {
            item.classList.add('current-user');
        }

        const position = document.createElement('div');
        position.className = 'rank-position';
        if (index === 0) position.classList.add('first');
        else if (index === 1) position.classList.add('second');
        else if (index === 2) position.classList.add('third');
        // Medal emoji for top 3
        const medals = ['\u{1F947}', '\u{1F948}', '\u{1F949}'];
        position.textContent = index < 3 ? medals[index] : `#${index + 1}`;

        const avatar = document.createElement('div');
        avatar.className = 'rank-avatar';
        avatar.textContent = user.avatarEmoji || '\u{1F464}';

        const userName = document.createElement('div');
        userName.className = 'rank-user';
        userName.textContent = user.displayName || 'Anonymous';

        const score = document.createElement('div');
        score.className = 'rank-score';
        const hours = Math.floor((user.totalMinutes || 0) / 60);
        const mins = (user.totalMinutes || 0) % 60;
        score.textContent = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

        item.appendChild(position);
        item.appendChild(avatar);
        item.appendChild(userName);
        item.appendChild(score);
        rankList.appendChild(item);
    });
}

// Initialize rank panel
export function initRankPanel() {
    const rankBtn = document.getElementById('rankBtn');
    const rankPanel = document.getElementById('rankPanel');
    const rankCloseBtn = document.getElementById('rankCloseBtn');

    if (rankBtn && rankPanel) {
        rankBtn.onclick = () => {
            rankPanel.style.display = 'flex';
            renderLeaderboard();
        };
    }

    if (rankCloseBtn && rankPanel) {
        rankCloseBtn.onclick = () => {
            rankPanel.style.display = 'none';
        };
    }

    if (rankPanel) {
        rankPanel.onclick = (e) => {
            if (e.target === rankPanel) {
                rankPanel.style.display = 'none';
            }
        };
    }
}
