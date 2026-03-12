const DEFAULT_STORAGE_KEY = 'liminal_player_states';

function createStorageAdapter(storage) {
  if (storage && typeof storage.getItem === 'function' && typeof storage.setItem === 'function') {
    return storage;
  }

  const memory = new Map();
  return {
    getItem(key) {
      return memory.has(key) ? memory.get(key) : null;
    },
    setItem(key, value) {
      memory.set(key, String(value));
    },
    removeItem(key) {
      memory.delete(key);
    }
  };
}

export function createPlayerStateManager(options = {}) {
  const storageKey = options.storageKey || DEFAULT_STORAGE_KEY;
  const storage = createStorageAdapter(options.storage || globalThis.localStorage);
  const logger = options.logger || console;
  const clock = typeof options.now === 'function' ? options.now : () => Date.now();

  const manager = {
    STORAGE_KEY: storageKey,
    _states: {},

    init() {
      try {
        const saved = storage.getItem(this.STORAGE_KEY);
        if (saved) {
          this._states = JSON.parse(saved);
          logger.log?.('[PlayerStateManager] Loaded states:', Object.keys(this._states));
        }
      } catch (error) {
        logger.warn?.('[PlayerStateManager] Failed to load states:', error);
        this._states = {};
      }
    },

    findSentenceStart(currentTime, subtitleTracks) {
      if (!subtitleTracks || subtitleTracks.length === 0) {
        return { index: 0, time: currentTime };
      }

      let sentenceIndex = 0;
      for (let index = subtitleTracks.length - 1; index >= 0; index -= 1) {
        if (currentTime >= subtitleTracks[index].time) {
          sentenceIndex = index;
          break;
        }
      }

      return {
        index: sentenceIndex,
        time: subtitleTracks[sentenceIndex].time
      };
    },

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

    saveStateAt(playerId, state) {
      if (!playerId || !state) return;
      const safeIndex = Number.isFinite(state.sentenceIndex) ? state.sentenceIndex : 0;
      const safeTime = Number.isFinite(state.sentenceTime) ? state.sentenceTime : 0;
      this._states[playerId] = {
        sentenceIndex: safeIndex,
        sentenceTime: safeTime,
        wasPlaying: !!state.wasPlaying,
        lastUpdate: clock()
      };
      this._persist();
    },

    getState(playerId) {
      return this._states[playerId] || null;
    },

    clear(playerId) {
      delete this._states[playerId];
      this._persist();
    },

    clearAll() {
      this._states = {};
      this._persist();
    },

    exportStates() {
      return { ...this._states };
    },

    importStates(states, importOptions = {}) {
      if (!states || typeof states !== 'object') return;
      const replace = !!importOptions.replace;
      if (replace) {
        this._states = { ...states };
        this._persist();
        return;
      }

      const now = clock();
      for (const [key, incoming] of Object.entries(states)) {
        if (!incoming || typeof incoming !== 'object') continue;
        const incomingStamp = Number.isFinite(incoming.lastUpdate) ? incoming.lastUpdate : 0;
        const currentStamp = Number((this._states[key] && this._states[key].lastUpdate) || 0);
        if (this._states[key] && currentStamp > incomingStamp) continue;

        this._states[key] = {
          sentenceIndex: Number.isFinite(incoming.sentenceIndex) ? incoming.sentenceIndex : 0,
          sentenceTime: Number.isFinite(incoming.sentenceTime) ? incoming.sentenceTime : 0,
          wasPlaying: !!incoming.wasPlaying,
          lastUpdate: incomingStamp || now
        };
      }

      this._persist();
    },

    _persist() {
      try {
        storage.setItem(this.STORAGE_KEY, JSON.stringify(this._states));
      } catch (error) {
        logger.warn?.('[PlayerStateManager] Failed to persist states:', error);
      }
    }
  };

  manager.init();
  return manager;
}

export const defaultPlayerStateManager = createPlayerStateManager();
export const PlayerStateManager = defaultPlayerStateManager;
export default defaultPlayerStateManager;
