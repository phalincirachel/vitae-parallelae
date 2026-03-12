const HANDOFF_STORAGE_KEY = 'gb_state_handoff';
const EXPECTATION_STORAGE_KEY = 'gb_handoff_expect';

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

function getPlayerStateManagerFromOptions(options = {}) {
  if (typeof options.getPlayerStateManager === 'function') return options.getPlayerStateManager();
  if (options.playerStateManager) return options.playerStateManager;
  return globalThis.window?.PlayerStateManager || globalThis.PlayerStateManager || null;
}

function normalizeIncomingState(incoming) {
  return {
    sentenceIndex: Number.isFinite(incoming?.sentenceIndex) ? incoming.sentenceIndex : 0,
    sentenceTime: Number.isFinite(incoming?.sentenceTime) ? incoming.sentenceTime : 0,
    wasPlaying: !!incoming?.wasPlaying
  };
}

export function createStateHandoffManager(options = {}) {
  const sessionStorageRef = createStorageAdapter(options.sessionStorage || globalThis.sessionStorage);
  const now = typeof options.now === 'function' ? options.now : () => Date.now();
  const logger = options.logger || console;
  const onWrite = typeof options.onWrite === 'function' ? options.onWrite : () => {};
  const onMerge = typeof options.onMerge === 'function' ? options.onMerge : () => {};
  const onMissingExpected = typeof options.onMissingExpected === 'function' ? options.onMissingExpected : () => {};
  const onZeroMerge = typeof options.onZeroMerge === 'function' ? options.onZeroMerge : () => {};
  const onError = typeof options.onError === 'function' ? options.onError : () => {};

  const manager = {
    HANDOFF_STORAGE_KEY,
    EXPECTATION_STORAGE_KEY,

    write(targetPageKey, metadata = {}) {
      try {
        const playerStateManager = getPlayerStateManagerFromOptions(options);
        if (!playerStateManager || typeof playerStateManager.exportStates !== 'function') return null;

        const states = playerStateManager.exportStates();
        const payload = {
          from: metadata.from || '',
          to: targetPageKey,
          at: now(),
          states
        };

        sessionStorageRef.setItem(HANDOFF_STORAGE_KEY, JSON.stringify(payload));
        sessionStorageRef.setItem(EXPECTATION_STORAGE_KEY, String(targetPageKey || ''));
        onWrite({ payload, states });
        return payload;
      } catch (error) {
        logger.warn?.('[StateHandoff] Failed to write handoff payload:', error);
        onError({ phase: 'write', error });
        return null;
      }
    },

    merge(expectedTargetKey) {
      try {
        const raw = sessionStorageRef.getItem(HANDOFF_STORAGE_KEY);
        const expected = sessionStorageRef.getItem(EXPECTATION_STORAGE_KEY);
        const playerStateManager = getPlayerStateManagerFromOptions(options);

        if (!raw || !playerStateManager) {
          if (expected && expected === expectedTargetKey) {
            onMissingExpected({ expectedTargetKey, expected });
            sessionStorageRef.removeItem(EXPECTATION_STORAGE_KEY);
          }
          return { status: 'missing', merged: 0, payload: null };
        }

        const payload = JSON.parse(raw);
        if (!payload || payload.to !== expectedTargetKey || !payload.states || typeof payload.states !== 'object') {
          return { status: 'ignored', merged: 0, payload: null };
        }

        let merged = 0;
        for (const [key, incoming] of Object.entries(payload.states)) {
          if (!incoming || typeof incoming !== 'object') continue;
          const current = typeof playerStateManager.getState === 'function'
            ? playerStateManager.getState(key)
            : null;
          const incomingStamp = Number(incoming.lastUpdate || 0);
          const currentStamp = Number((current && current.lastUpdate) || 0);
          if (current && currentStamp > incomingStamp) continue;

          if (typeof playerStateManager.saveStateAt === 'function') {
            playerStateManager.saveStateAt(key, normalizeIncomingState(incoming));
            merged += 1;
          }
        }

        sessionStorageRef.removeItem(HANDOFF_STORAGE_KEY);
        sessionStorageRef.removeItem(EXPECTATION_STORAGE_KEY);
        onMerge({ payload, merged });
        if (merged === 0) onZeroMerge({ payload, merged });
        return { status: 'merged', merged, payload };
      } catch (error) {
        logger.warn?.('[StateHandoff] Failed to merge handoff payload:', error);
        onError({ phase: 'merge', error });
        return { status: 'error', merged: 0, payload: null, error };
      }
    }
  };

  return manager;
}

export { EXPECTATION_STORAGE_KEY, HANDOFF_STORAGE_KEY };
export default createStateHandoffManager;
