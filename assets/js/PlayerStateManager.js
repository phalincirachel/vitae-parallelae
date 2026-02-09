/**
 * PlayerStateManager.js
 * 
 * Globales Modul zur Verwaltung von Player-Positionen zwischen verschiedenen Audio-Quellen.
 * Speichert Position als Untertitel-Index (Satzanfang), nicht als exakten Timestamp.
 * 
 * Usage:
 *   PlayerStateManager.saveState('kapitel1', subtitleTracks, audioPlayer);
 *   const state = PlayerStateManager.getState('kapitel1');
 */

const PlayerStateManager = {
    // Storage key for localStorage
    STORAGE_KEY: 'liminal_player_states',

    // In-memory cache
    _states: {},

    /**
     * Initialize - load states from localStorage
     */
    init() {
        try {
            const saved = localStorage.getItem(this.STORAGE_KEY);
            if (saved) {
                this._states = JSON.parse(saved);
                console.log('[PlayerStateManager] Loaded states:', Object.keys(this._states));
            }
        } catch (e) {
            console.warn('[PlayerStateManager] Failed to load states:', e);
            this._states = {};
        }
    },

    /**
     * Find the sentence (subtitle) that contains the given time
     * Returns the index and time of the sentence START
     * 
     * @param {number} currentTime - Current audio time in seconds
     * @param {Array} subtitleTracks - Array of {time, text} objects
     * @returns {{index: number, time: number}} - Sentence index and start time
     */
    findSentenceStart(currentTime, subtitleTracks) {
        if (!subtitleTracks || subtitleTracks.length === 0) {
            return { index: 0, time: currentTime }; // Fallback to exact time if no subtitles
        }

        // Find the last subtitle whose time is <= currentTime
        let sentenceIndex = 0;
        for (let i = subtitleTracks.length - 1; i >= 0; i--) {
            if (currentTime >= subtitleTracks[i].time) {
                sentenceIndex = i;
                break;
            }
        }

        return {
            index: sentenceIndex,
            time: subtitleTracks[sentenceIndex].time
        };
    },

    /**
     * Save current state for a player
     * 
     * @param {string} playerId - Unique ID for the player (e.g., 'kapitel1', 'lore1')
     * @param {Array} subtitleTracks - Current subtitle tracks
     * @param {Object} audioPlayer - Audio player instance (SCAudioAdapter or similar)
     */
    saveState(playerId, subtitleTracks, audioPlayer) {
        if (!playerId) return;

        const currentTime = audioPlayer?.currentTime || 0;
        const wasPlaying = audioPlayer ? !audioPlayer.paused : false;

        const sentence = this.findSentenceStart(currentTime, subtitleTracks);

        this.saveStateAt(playerId, {
            sentenceIndex: sentence.index,
            sentenceTime: sentence.time,
            wasPlaying
        });
    },

    /**
     * Save state with explicit sentence position.
     * Useful when playback time has already been resolved externally (e.g. streaming adapters).
     *
     * @param {string} playerId
     * @param {{sentenceIndex:number, sentenceTime:number, wasPlaying:boolean}} state
     */
    saveStateAt(playerId, state) {
        if (!playerId || !state) return;

        const safeIndex = Number.isFinite(state.sentenceIndex) ? state.sentenceIndex : 0;
        const safeTime = Number.isFinite(state.sentenceTime) ? state.sentenceTime : 0;
        const wasPlaying = !!state.wasPlaying;

        this._states[playerId] = {
            sentenceIndex: safeIndex,
            sentenceTime: safeTime,
            wasPlaying,
            lastUpdate: Date.now()
        };

        console.log(`[PlayerStateManager] Saved state for "${playerId}":`,
            `sentence ${safeIndex} at ${safeTime}s, wasPlaying: ${wasPlaying}`);

        this._persist();
    },

    /**
     * Get saved state for a player
     * 
     * @param {string} playerId - Unique ID for the player
     * @returns {Object|null} - Saved state or null if not found
     */
    getState(playerId) {
        return this._states[playerId] || null;
    },

    /**
     * Clear state for a specific player
     * 
     * @param {string} playerId - Unique ID for the player
     */
    clear(playerId) {
        delete this._states[playerId];
        this._persist();
        console.log(`[PlayerStateManager] Cleared state for "${playerId}"`);
    },

    /**
     * Clear all states
     */
    clearAll() {
        this._states = {};
        this._persist();
        console.log('[PlayerStateManager] Cleared all states');
    },

    /**
     * Export states for game save integration
     * @returns {Object} - All states
     */
    exportStates() {
        return { ...this._states };
    },

    /**
     * Import states from game save
     * @param {Object} states - States to import
     */
    importStates(states) {
        if (states && typeof states === 'object') {
            this._states = { ...states };
            this._persist();
            console.log('[PlayerStateManager] Imported states:', Object.keys(this._states));
        }
    },

    /**
     * Persist states to localStorage
     * @private
     */
    _persist() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this._states));
        } catch (e) {
            console.warn('[PlayerStateManager] Failed to persist states:', e);
        }
    }
};

// Auto-initialize on load
PlayerStateManager.init();

// Make globally available
if (typeof window !== 'undefined') {
    window.PlayerStateManager = PlayerStateManager;
}
