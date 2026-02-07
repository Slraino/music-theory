// Rank/Leaderboard System
import { db, collection, doc, getDoc, setDoc, updateDoc, query, orderBy, limit, getDocs, increment } from '../auth/firebase-config.js';
import { getCurrentUser } from '../auth/auth.js';

// Track work session completion
export async function recordWorkSession(minutes) {
    const user = getCurrentUser();
    if (!user) return;

    try {
        const userRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userRef);

        if (userDoc.exists()) {
            await updateDoc(userRef, {
                totalWorkMinutes: increment(minutes),
                lastActive: new Date()
            });
        } else {
            await setDoc(userRef, {
                displayName: user.displayName || 'Anonymous',
                photoURL: user.photoURL || '',
                totalWorkMinutes: minutes,
                lastActive: new Date()
            });
        }
    } catch (error) {
        console.error('Error recording work session:', error);
    }
}

// Fetch leaderboard data
async function fetchLeaderboard(maxResults = 10) {
    try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, orderBy('totalWorkMinutes', 'desc'), limit(maxResults));
        const snapshot = await getDocs(q);
        
        const leaderboard = [];
        snapshot.forEach(doc => {
            leaderboard.push({
                uid: doc.id,
                ...doc.data()
            });
        });
        
        return leaderboard;
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

    const currentUser = getCurrentUser();
    const leaderboard = await fetchLeaderboard(10);

    if (leaderboard.length === 0) {
        rankList.innerHTML = '<div class="rank-loading">No data available</div>';
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
        position.textContent = `#${index + 1}`;

        const userName = document.createElement('div');
        userName.className = 'rank-user';
        userName.textContent = user.displayName || 'Anonymous';

        const score = document.createElement('div');
        score.className = 'rank-score';
        score.textContent = `${user.totalWorkMinutes || 0} min`;

        item.appendChild(position);
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
