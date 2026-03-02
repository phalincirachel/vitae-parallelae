window.GameState = {
    // Default lore collectible target per chapter. Can be adjusted per chapter in CHAPTER_DB.
    DEFAULT_CHAPTER_LORE_TARGET: 5,

    // Per subchapter configuration.
    CHAPTER_DB: {
        marktplatz: {
            id: 'marktplatz',
            code: '1a',
            title: 'Marktplatz',
            totalCollectibles: 5,
            loreIds: [1],
            chapterButtonId: 'chapter1Btn'
        },
        liminal_library: {
            id: 'liminal_library',
            code: '1b',
            title: 'Antiquariat Hannrath',
            totalCollectibles: 5,
            loreIds: [2],
            chapterButtonId: 'chapter1bBtn'
        },
        steingasse: {
            id: 'steingasse',
            code: '1c',
            title: 'Steingasse',
            totalCollectibles: 5,
            loreIds: [3],
            chapterButtonId: 'chapter1cBtn'
        }
    },

    SCENE_ALIASES: {
        index: 'marktplatz',
        kapitel1: 'marktplatz',
        chapter1: 'marktplatz',
        chapter1a: 'marktplatz',
        marktplatz: 'marktplatz',

        liminal: 'liminal_library',
        chapter1b: 'liminal_library',
        kapitel1b: 'liminal_library',
        liminal_library: 'liminal_library',

        chapter1c: 'steingasse',
        kapitel1c: 'steingasse',
        steingasse: 'steingasse'
    },

    // Lore DB with explicit chapter assignment.
    CONTENT_DB: {
        1: {
            title: 'Der verborgene Pfad',
            audio: 'assets/lore1.mp3',
            text: 'assets/lore1.txt',
            duration: '0:45',
            chapter: 'marktplatz'
        },
        2: {
            title: 'Das Flüstern',
            audio: 'assets/lore2.mp3',
            text: 'assets/lore2.txt',
            duration: '1:20',
            chapter: 'liminal_library'
        },
        3: {
            title: 'Verlorene Echos',
            audio: 'assets/lore3.mp3',
            text: 'assets/lore3.txt',
            duration: '0:55',
            chapter: 'steingasse'
        }
    },

    state: {
        collectedLore: [],
        collectedLights: {},
        chapterCollectibleTargets: {},
        bookmarks: []
    },

    _createDefaultState() {
        return {
            collectedLore: [],
            collectedLights: {},
            chapterCollectibleTargets: {},
            bookmarks: []
        };
    },

    _normalizeNumberArray(list) {
        if (!Array.isArray(list)) return [];
        const unique = new Set();
        list.forEach((entry) => {
            const n = Number(entry);
            if (Number.isFinite(n)) unique.add(Math.trunc(n));
        });
        return Array.from(unique);
    },

    _normalizeSceneName(sceneName) {
        if (typeof sceneName !== 'string') return '';
        const raw = sceneName.trim().toLowerCase();
        if (!raw) return '';
        return this.SCENE_ALIASES[raw] || raw;
    },

    _ensureStateShape() {
        if (!this.state || typeof this.state !== 'object') {
            this.state = this._createDefaultState();
        }

        this.state.collectedLore = this._normalizeNumberArray(this.state.collectedLore);

        if (!this.state.collectedLights || typeof this.state.collectedLights !== 'object') {
            this.state.collectedLights = {};
        }

        const normalizedLights = {};
        Object.keys(this.state.collectedLights).forEach((sceneKey) => {
            const normalizedKey = this._normalizeSceneName(sceneKey) || sceneKey;
            const normalizedValues = this._normalizeNumberArray(this.state.collectedLights[sceneKey]);
            if (!normalizedLights[normalizedKey]) normalizedLights[normalizedKey] = [];
            normalizedLights[normalizedKey] = this._normalizeNumberArray(
                normalizedLights[normalizedKey].concat(normalizedValues)
            );
        });
        this.state.collectedLights = normalizedLights;

        if (!this.state.chapterCollectibleTargets || typeof this.state.chapterCollectibleTargets !== 'object') {
            this.state.chapterCollectibleTargets = {};
        }

        const normalizedTargets = {};
        Object.keys(this.state.chapterCollectibleTargets).forEach((sceneKey) => {
            const normalizedKey = this._normalizeSceneName(sceneKey) || sceneKey;
            const value = Number(this.state.chapterCollectibleTargets[sceneKey]);
            if (!Number.isFinite(value) || value <= 0) {
                return;
            } else {
                normalizedTargets[normalizedKey] = Math.trunc(value);
            }
        });
        this.state.chapterCollectibleTargets = normalizedTargets;

        if (!Array.isArray(this.state.bookmarks)) this.state.bookmarks = [];
    },

    // METHODS
    async init() {
        if (!window.electronAPI) {
            try {
                const saved = localStorage.getItem('liminal_save');
                if (saved) {
                    this.state = JSON.parse(saved);
                    if (window.PlayerStateManager && this.state.audioPositions) {
                        window.PlayerStateManager.importStates(this.state.audioPositions);
                    }
                    console.log('[GameState] Loaded from LocalStorage (Web):', this.state);
                } else {
                    console.log('[GameState] No Web Save found. Starting new.');
                    this.state = this._createDefaultState();
                }
            } catch (e) {
                console.warn('[GameState] Web Load Error:', e);
                this.state = this._createDefaultState();
            }
        } else {
            try {
                if (!sessionStorage.getItem('GAME_SESSION_ACTIVE')) {
                    console.log('[GameState] New Session started. Wiping Save Data.');
                    sessionStorage.setItem('GAME_SESSION_ACTIVE', 'true');
                    this.state = this._createDefaultState();
                    await window.electronAPI.saveGame(this.state);
                } else {
                    const save = await window.electronAPI.loadGame();
                    this.state = save || this._createDefaultState();
                }

                if (window.PlayerStateManager && this.state.audioPositions) {
                    window.PlayerStateManager.importStates(this.state.audioPositions);
                    console.log('[GameState] Audio positions synced from save.');
                }

                console.log('[GameState] Loaded State:', this.state);
            } catch (e) {
                console.warn('[GameState] Load Error:', e);
                this.state = this._createDefaultState();
            }
        }

        this._ensureStateShape();
    },

    getChapterDefinitions() {
        return this.CHAPTER_DB;
    },

    getChapterConfig(sceneName) {
        const key = this._normalizeSceneName(sceneName);
        return this.CHAPTER_DB[key] || null;
    },

    getChapterLoreIds(sceneName) {
        const cfg = this.getChapterConfig(sceneName);
        if (!cfg || !Array.isArray(cfg.loreIds)) return [];
        return this._normalizeNumberArray(cfg.loreIds).sort((a, b) => a - b);
    },

    getChapterCollectibleTarget(sceneName) {
        const key = this._normalizeSceneName(sceneName);
        const stateOverride = Number(this.state.chapterCollectibleTargets && this.state.chapterCollectibleTargets[key]);
        if (Number.isFinite(stateOverride) && stateOverride > 0) return Math.trunc(stateOverride);

        const cfg = this.CHAPTER_DB[key];
        if (cfg && Number.isFinite(cfg.totalCollectibles) && cfg.totalCollectibles > 0) {
            return Math.trunc(cfg.totalCollectibles);
        }

        return this.DEFAULT_CHAPTER_LORE_TARGET;
    },

    getChapterCollectedCount(sceneName, options = {}) {
        const key = this._normalizeSceneName(sceneName);
        const bucket = (this.state.collectedLights && Array.isArray(this.state.collectedLights[key]))
            ? this.state.collectedLights[key]
            : [];
        const rawCount = bucket.length;
        if (options && options.raw === true) return rawCount;
        return Math.min(rawCount, this.getChapterCollectibleTarget(key));
    },

    getChapterProgress(sceneName) {
        const key = this._normalizeSceneName(sceneName);
        const cfg = this.CHAPTER_DB[key];
        const total = this.getChapterCollectibleTarget(key);
        const collected = this.getChapterCollectedCount(key);
        return {
            sceneName: key,
            chapterCode: cfg ? cfg.code : '',
            chapterTitle: cfg ? cfg.title : key,
            collected,
            total
        };
    },

    getAllChapterProgress() {
        const progress = {};
        Object.keys(this.CHAPTER_DB).forEach((sceneName) => {
            progress[sceneName] = this.getChapterProgress(sceneName);
        });
        return progress;
    },

    getLore(id) {
        return this.CONTENT_DB[parseInt(id, 10)];
    },

    getAllLore() {
        return this.CONTENT_DB;
    },

    isUnlocked(id) {
        return this.state.collectedLore.includes(parseInt(id, 10));
    },

    isLightCollected(sceneName, lightId) {
        const sceneKey = this._normalizeSceneName(sceneName);
        if (!this.state.collectedLights || !this.state.collectedLights[sceneKey]) return false;
        return this.state.collectedLights[sceneKey].includes(Math.trunc(Number(lightId)));
    },

    getNextLockedLoreIdForScene(sceneName) {
        const loreIds = this.getChapterLoreIds(sceneName);
        for (const id of loreIds) {
            if (!this.state.collectedLore.includes(id)) return id;
        }
        return null;
    },

    // Legacy helper kept for compatibility with older logic.
    getNextLockedLoreId() {
        const ids = Object.keys(this.CONTENT_DB).map(Number).sort((a, b) => a - b);
        for (const id of ids) {
            if (!this.state.collectedLore.includes(id)) return id;
        }
        return null;
    },

    // Returns unlocked lore ID or null.
    async collectLight(sceneName, lightId) {
        const sceneKey = this._normalizeSceneName(sceneName);
        const numericLightId = Math.trunc(Number(lightId));

        if (!sceneKey || !Number.isFinite(numericLightId)) return null;

        if (!this.state.collectedLights) this.state.collectedLights = {};
        if (!this.state.collectedLights[sceneKey]) this.state.collectedLights[sceneKey] = [];

        if (this.state.collectedLights[sceneKey].includes(numericLightId)) {
            return null;
        }

        const target = this.getChapterCollectibleTarget(sceneKey);
        if (this.state.collectedLights[sceneKey].length >= target) {
            this.state.collectedLights[sceneKey].push(numericLightId);
            console.log(`[GameState] Chapter target reached (${sceneKey}: ${target}). Light marked without new unlock.`);
            await this.save();
            return null;
        }

        this.state.collectedLights[sceneKey].push(numericLightId);

        const nextId = this.getNextLockedLoreIdForScene(sceneKey);
        if (nextId && !this.state.collectedLore.includes(nextId)) {
            console.log(`[GameState] Light collected (${sceneKey}:${numericLightId}) -> Unlocking lore ${nextId}`);
            this.state.collectedLore.push(nextId);
            await this.save();
            return nextId;
        }

        console.log(`[GameState] Light collected (${sceneKey}:${numericLightId}) -> No chapter lore left to unlock.`);
        await this.save();
        return null;
    },

    async unlockLore(id) {
        id = parseInt(id, 10);
        if (!this.isUnlocked(id)) {
            console.log(`[GameState] Unlocking Lore Item ${id}...`);
            this.state.collectedLore.push(id);
            await this.save();
            return true;
        }
        return false;
    },

    async reset() {
        console.log('[GameState] Resetting all saved data...');
        this.state = this._createDefaultState();
        await this.save();
        console.log('[GameState] State Reset Complete!');
    },

    async save() {
        this._ensureStateShape();

        if (window.PlayerStateManager) {
            this.state.audioPositions = window.PlayerStateManager.exportStates();
        }

        this.state.readerSettings = {
            layout: localStorage.getItem('gameboy_reader_sentence_layout'),
            fontSize: localStorage.getItem('gameboy_reader_font_size_px'),
            bgColor: localStorage.getItem('gameboy_reader_bg_color'),
            textColor: localStorage.getItem('gameboy_reader_text_color'),
            textVolume: localStorage.getItem('gameboy_reader_text_volume'),
            bgVolume: localStorage.getItem('gameboy_reader_background_volume')
        };

        if (window.electronAPI) {
            await window.electronAPI.saveGame(this.state);
            console.log('[GameState] Saved via Electron.');
        } else {
            try {
                localStorage.setItem('liminal_save', JSON.stringify(this.state));
                console.log('[GameState] Saved via LocalStorage.');
            } catch (e) {
                console.warn('[GameState] Save failed:', e);
            }
        }
    },

    exportState() {
        return JSON.stringify(this.state, null, 2);
    },

    async importState(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            if (Array.isArray(data.collectedLore)) {
                this.state = data;
                this._ensureStateShape();

                if (window.PlayerStateManager && this.state.audioPositions) {
                    window.PlayerStateManager.importStates(this.state.audioPositions, { replace: true });
                }

                if (data.readerSettings) {
                    const rs = data.readerSettings;
                    if (rs.layout !== null && rs.layout !== undefined) localStorage.setItem('gameboy_reader_sentence_layout', rs.layout);
                    if (rs.fontSize !== null && rs.fontSize !== undefined) localStorage.setItem('gameboy_reader_font_size_px', rs.fontSize);
                    if (rs.bgColor !== null && rs.bgColor !== undefined) localStorage.setItem('gameboy_reader_bg_color', rs.bgColor);
                    if (rs.textColor !== null && rs.textColor !== undefined) localStorage.setItem('gameboy_reader_text_color', rs.textColor);
                    if (rs.textVolume !== null && rs.textVolume !== undefined) localStorage.setItem('gameboy_reader_text_volume', rs.textVolume);
                    if (rs.bgVolume !== null && rs.bgVolume !== undefined) localStorage.setItem('gameboy_reader_background_volume', rs.bgVolume);
                }

                await this.save();
                console.log('[GameState] Imported State:', this.state);
                return true;
            }

            console.warn('[GameState] Invalid Save File Format');
        } catch (e) {
            console.error('[GameState] Import Error:', e);
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

        const scopeOf = (entry) => {
            if (!entry || typeof entry !== 'object') return '';
            const contentKey = typeof entry.contentKey === 'string' ? entry.contentKey.trim() : '';
            if (contentKey) return contentKey;
            const audioRef = typeof entry.audioRef === 'string' ? entry.audioRef.trim() : '';
            if (audioRef) return `audio:${audioRef}`;
            const textRef = typeof entry.textRef === 'string' ? entry.textRef.trim() : '';
            if (textRef) return `text:${textRef}`;
            return typeof entry.page === 'string' ? entry.page : '';
        };

        const incomingScope = scopeOf(bm);
        const exists = this.state.bookmarks.some(
            (b) => b.page === bm.page
                && scopeOf(b) === incomingScope
                && Math.abs(b.time - bm.time) < 1
        );

        if (exists) {
            console.log('[GameState] Bookmark already exists, skipping.');
            return false;
        }

        this.state.bookmarks.unshift(bm);
        await this.save();
        console.log('[GameState] Bookmark added:', bm);
        return true;
    },

    async removeBookmark(id) {
        if (!Array.isArray(this.state.bookmarks)) return false;
        const before = this.state.bookmarks.length;
        this.state.bookmarks = this.state.bookmarks.filter((b) => b.id !== id);
        if (this.state.bookmarks.length < before) {
            await this.save();
            console.log('[GameState] Bookmark removed:', id);
            return true;
        }
        return false;
    },

    formatBookmarkTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        const whole = Math.floor(secs);
        let frac = Math.round((secs - whole) * 100);
        let m = mins;
        let w = whole;

        if (frac >= 100) {
            frac = 0;
            w += 1;
        }
        if (w >= 60) {
            w -= 60;
            m += 1;
        }

        return `${m}:${w.toString().padStart(2, '0')}.${frac.toString().padStart(2, '0')}`;
    }
};
