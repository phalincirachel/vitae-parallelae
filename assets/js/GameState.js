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
        collectedLights: {} // Map: { "sceneName": [lightId, ...] }
    },

    // METHODS
    async init() {
        // --- WEB PERSISTENCE (LocalStorage) ---
        if (!window.electronAPI) {
            try {
                const saved = localStorage.getItem('liminal_save');
                if (saved) {
                    this.state = JSON.parse(saved);
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
                        collectedLights: {}
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

                console.log("[GameState] Loaded State:", this.state);
            } catch (e) {
                console.warn("[GameState] Load Error:", e);
            }
        }
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

    async save() {
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
    }
};
