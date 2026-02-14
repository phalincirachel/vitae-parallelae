export const GameState = {
    // STATIC DATA
    CONTENT_DB: {
        1: {
            title: "Der verborgene Pfad",
            audio: "assets/lore1.mp3",
            text: "assets/lore1.txt",
            duration: "0:45"
        },
        2: {
            title: "Das Flüstern",
            audio: "assets/lore2.mp3",
            text: "assets/lore2.txt",
            duration: "1:20"
        },
        3: {
            title: "Verlorene Echos",
            audio: "assets/lore3.mp3",
            text: "assets/lore3.txt",
            duration: "0:55"
        }
    },

    // STATE
    state: {
        collectedLore: [], // Array of Content IDs
        collectedLights: {}, // Map: { "sceneName": [lightId, ...] }
        bookmarks: [] // Array of { id, chapter, chapterTitle, page, time, textPreview, createdAt }
    },

    // METHODS
    async init() {
        // --- WEB PERSISTENCE (LocalStorage) ---
        if (!window.electronAPI) {
            try {
                const saved = localStorage.getItem('liminal_save');
                if (saved) {
                    this.state = JSON.parse(saved);
                    // Audio Persistence
                    if (window.PlayerStateManager && this.state.audioPositions) {
                        window.PlayerStateManager.importStates(this.state.audioPositions);
                    }
                    console.log("[GameState] Loaded from LocalStorage (Web):", this.state);
                } else {
                    console.log("[GameState] No Web Save found. Starting new.");
                }
            } catch (e) {
                console.warn("[GameState] Web Load Error:", e);
            }
        }

        // --- ELECTRON PERSISTENCE ---
        else {
            try {
                // Check for New Session (Start wiping on first launch)
                if (!sessionStorage.getItem('GAME_SESSION_ACTIVE')) {
                    console.log("[GameState] New Session started. Wiping Save Data.");
                    sessionStorage.setItem('GAME_SESSION_ACTIVE', 'true');

                    // Force Empty State
                    this.state = {
                        collectedLore: [],
                        collectedLights: {},
                        bookmarks: []
                    };
                    await window.electronAPI.saveGame(this.state);
                } else {
                    // Check existing save
                    const save = await window.electronAPI.loadGame();
                    if (save) {
                        this.state = save;
                    }
                }

                // Compatibility: Ensure proper structure
                if (!this.state.collectedLights) this.state.collectedLights = {};
                if (!this.state.collectedLore) this.state.collectedLore = [];
                if (!Array.isArray(this.state.bookmarks)) this.state.bookmarks = [];

                // Audio Persistence
                if (window.PlayerStateManager && this.state.audioPositions) {
                    window.PlayerStateManager.importStates(this.state.audioPositions);
                    console.log("[GameState] Audio positions synced from save.");
                }

                console.log("[GameState] Loaded State:", this.state);
            } catch (e) {
                console.warn("[GameState] Load Error:", e);
            }
        }

        // Ensure bookmarks array exists after any load path
        if (!Array.isArray(this.state.bookmarks)) this.state.bookmarks = [];

        // NOTE: Auto-unlock removed as per new design.
    },

    getLore(id) {
        return this.CONTENT_DB[id];
    },

    getAllLore() {
        // Return unlocked ones + placeholders? No, we return DB, but renderer decides.
        // Actually, renderer calls getAllLore to iterate. 
        // We can just return CONTENT_DB and let renderer filter by isUnlocked.
        return this.CONTENT_DB;
    },

    isUnlocked(id) {
        return this.state.collectedLore.includes(parseInt(id));
    },

    isLightCollected(sceneName, lightId) {
        if (!this.state.collectedLights || !this.state.collectedLights[sceneName]) return false;
        return this.state.collectedLights[sceneName].includes(lightId);
    },

    // Returns the Lore ID that was unlocked, or null
    async collectLight(sceneName, lightId) {
        if (!this.state.collectedLights) this.state.collectedLights = {};
        if (!this.state.collectedLights[sceneName]) this.state.collectedLights[sceneName] = [];

        // If already collected, return null (do nothing)
        if (this.state.collectedLights[sceneName].includes(lightId)) {
            return null;
        }

        // Mark collected
        this.state.collectedLights[sceneName].push(lightId);

        // Find next locked lore matches the sequence 1 -> 2 -> 3
        const nextId = this.getNextLockedLoreId();

        if (nextId) {
            console.log(`[GameState] Light collected (${sceneName}:${lightId}) -> Unoncking Lore ${nextId}`);
            this.state.collectedLore.push(nextId);
            await this.save();
            return nextId;
        } else {
            console.log(`[GameState] Light collected (${sceneName}:${lightId}) -> All Lore unlocked!`);
            await this.save();
            return null; // Nothing new unlocked
        }
    },

    getNextLockedLoreId() {
        // Keys are 1, 2, 3...
        const ids = Object.keys(this.CONTENT_DB).map(Number).sort((a, b) => a - b);
        for (const id of ids) {
            if (!this.state.collectedLore.includes(id)) return id;
        }
        return null;
    },

    async unlockLore(id) {
        id = parseInt(id);
        if (!this.isUnlocked(id)) {
            console.log(`[GameState] Unlocking Lore Item ${id}...`);
            this.state.collectedLore.push(id);
            await this.save();
            return true; // Indicates newly unlocked
        }
        return false; // Already unlocked
    },

    async reset() {
        console.log("[GameState] Resetting all saved data...");
        this.state = {
            collectedLore: [],
            collectedLights: {},
            bookmarks: []
        };
        await this.save();
        console.log("[GameState] State Reset Complete!");
    },

    async save() {
        // Sync Audio Positions
        if (window.PlayerStateManager) {
            this.state.audioPositions = window.PlayerStateManager.exportStates();
        }

        if (window.electronAPI) {
            await window.electronAPI.saveGame(this.state);
            console.log("[GameState] Saved via Electron.");
        } else {
            // WEB FALLBACK
            try {
                localStorage.setItem('liminal_save', JSON.stringify(this.state));
                console.log("[GameState] Saved via LocalStorage.");
            } catch (e) {
                console.warn("[GameState] Save failed:", e);
            }
        }
    },

    exportState() {
        return JSON.stringify(this.state, null, 2);
    },

    async importState(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            // Basic validation
            if (Array.isArray(data.collectedLore)) {
                this.state = data;
                // Ensure defaults
                if (!this.state.collectedLights) this.state.collectedLights = {};
                if (!Array.isArray(this.state.bookmarks)) this.state.bookmarks = [];

                // Audio Persistence
                if (window.PlayerStateManager && this.state.audioPositions) {
                    window.PlayerStateManager.importStates(this.state.audioPositions, { replace: true });
                }

                await this.save();
                console.log("[GameState] Imported State:", this.state);
                return true;
            } else {
                console.warn("[GameState] Invalid Save File Format");
            }
        } catch (e) {
            console.error("[GameState] Import Error:", e);
        }
        return false;
    },

    // --- Bookmark Helpers ---
    getBookmarks() {
        if (!Array.isArray(this.state.bookmarks)) this.state.bookmarks = [];
        return this.state.bookmarks;
    },

    async addBookmark(bm) {
        if (!Array.isArray(this.state.bookmarks)) this.state.bookmarks = [];
        // Prevent duplicates (same page + time within 1s)
        const exists = this.state.bookmarks.some(
            b => b.page === bm.page && Math.abs(b.time - bm.time) < 1
        );
        if (exists) {
            console.log('[GameState] Bookmark already exists, skipping.');
            return false;
        }
        this.state.bookmarks.unshift(bm); // newest first
        await this.save();
        console.log('[GameState] Bookmark added:', bm);
        return true;
    },

    async removeBookmark(id) {
        if (!Array.isArray(this.state.bookmarks)) return false;
        const before = this.state.bookmarks.length;
        this.state.bookmarks = this.state.bookmarks.filter(b => b.id !== id);
        if (this.state.bookmarks.length < before) {
            await this.save();
            console.log('[GameState] Bookmark removed:', id);
            return true;
        }
        return false;
    },

    /**
     * Format a time in seconds to a precise display string.
     * E.g. 49.50 → "0:49.50", 125.33 → "2:05.33"
     */
    formatBookmarkTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        const whole = Math.floor(secs);
        const frac = Math.round((secs - whole) * 100);
        return `${mins}:${whole.toString().padStart(2, '0')}.${frac.toString().padStart(2, '0')}`;
    }
};
