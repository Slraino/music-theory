// IndexedDB Database Manager
class MusicTheoryDB {
    constructor() {
        this.dbName = 'MusicTheoryDB';
        this.version = 1;
        this.db = null;
        this.ready = false;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => {
                console.error('IndexedDB error:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                this.ready = true;
                console.log('IndexedDB initialized successfully');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create object stores
                if (!db.objectStoreNames.contains('progressions')) {
                    db.createObjectStore('progressions', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('progressionDetails')) {
                    db.createObjectStore('progressionDetails', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('groupNames')) {
                    db.createObjectStore('groupNames', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' });
                }
                if (!db.objectStoreNames.contains('musicTheory')) {
                    db.createObjectStore('musicTheory', { keyPath: 'id' });
                }
                
                console.log('IndexedDB schema created');
            };
        });
    }

    async set(storeName, key, value) {
        if (!this.ready) await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put({ id: key, data: value });

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(value);
        });
    }

    async get(storeName, key) {
        if (!this.ready) await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(key);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                const result = request.result;
                resolve(result ? result.data : null);
            };
        });
    }

    async remove(storeName, key) {
        if (!this.ready) await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(key);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }

    async clear(storeName) {
        if (!this.ready) await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.clear();

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }

    async migrateFromLocalStorage() {
        console.log('Attempting to migrate from localStorage...');
        
        try {
            // Migrate progressions
            const progressions = localStorage.getItem('musicProgressions');
            if (progressions) {
                await this.set('progressions', 'default', JSON.parse(progressions));
                console.log('Migrated progressions to IndexedDB');
            }

            // Migrate progression details
            const details = localStorage.getItem('progressionDetails');
            if (details) {
                await this.set('progressionDetails', 'default', JSON.parse(details));
                console.log('Migrated progression details to IndexedDB');
            }

            // Migrate group names
            const groupNames = localStorage.getItem('groupCustomNames');
            if (groupNames) {
                await this.set('groupNames', 'default', JSON.parse(groupNames));
                console.log('Migrated group names to IndexedDB');
            }

            // Migrate settings
            const musicVolume = localStorage.getItem('musicVolume');
            if (musicVolume) {
                await this.set('settings', 'musicVolume', parseFloat(musicVolume));
            }

            const musicEnabled = localStorage.getItem('musicEnabled');
            if (musicEnabled) {
                await this.set('settings', 'musicEnabled', musicEnabled === 'true');
            }

            const sfxVolume = localStorage.getItem('sfxVolume');
            if (sfxVolume) {
                await this.set('settings', 'sfxVolume', parseFloat(sfxVolume));
            }

            const sfxEnabled = localStorage.getItem('sfxEnabled');
            if (sfxEnabled) {
                await this.set('settings', 'sfxEnabled', sfxEnabled === 'true');
            }

            // Migrate music theory
            const musicTheory = localStorage.getItem('musicTheory');
            if (musicTheory) {
                await this.set('musicTheory', 'default', JSON.parse(musicTheory));
                console.log('Migrated music theory to IndexedDB');
            }

            console.log('Migration complete!');
        } catch (error) {
            console.error('Error during migration:', error);
        }
    }
}

// Initialize database
const db = new MusicTheoryDB();
db.init().then(() => {
    // Try to migrate data from localStorage
    db.migrateFromLocalStorage();
}).catch(error => {
    console.error('Failed to initialize IndexedDB:', error);
});
