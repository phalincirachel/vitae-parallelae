import test from 'node:test';
import assert from 'node:assert/strict';
import { createStateHandoffManager } from '../assets/js/shared/state/state-handoff.js';

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    }
  };
}

test('state handoff writes payload and merges newer incoming states', () => {
  const sessionStorage = createMemoryStorage();
  const stateWrites = [];
  const playerStateManager = {
    exportStates() {
      return {
        main: {
          sentenceIndex: 4,
          sentenceTime: 12.5,
          wasPlaying: true,
          lastUpdate: 50
        }
      };
    },
    getState() {
      return {
        sentenceIndex: 1,
        sentenceTime: 2,
        wasPlaying: false,
        lastUpdate: 10
      };
    },
    saveStateAt(key, state) {
      stateWrites.push({ key, state });
    }
  };

  const manager = createStateHandoffManager({
    sessionStorage,
    playerStateManager,
    now: () => 99
  });

  const payload = manager.write('kapitel1c', { from: 'kapitel1' });
  assert.equal(payload.at, 99);
  assert.equal(payload.to, 'kapitel1c');

  const result = manager.merge('kapitel1c');
  assert.equal(result.status, 'merged');
  assert.equal(result.merged, 1);
  assert.deepEqual(stateWrites, [{
    key: 'main',
    state: {
      sentenceIndex: 4,
      sentenceTime: 12.5,
      wasPlaying: true
    }
  }]);
  assert.equal(sessionStorage.getItem('gb_state_handoff'), null);
  assert.equal(sessionStorage.getItem('gb_handoff_expect'), null);
});

test('state handoff preserves newer local state', () => {
  const sessionStorage = createMemoryStorage();
  let zeroMergeCalls = 0;
  const playerStateManager = {
    exportStates() {
      return {
        lore2: {
          sentenceIndex: 3,
          sentenceTime: 8,
          wasPlaying: false,
          lastUpdate: 10
        }
      };
    },
    getState() {
      return {
        sentenceIndex: 9,
        sentenceTime: 21,
        wasPlaying: true,
        lastUpdate: 99
      };
    },
    saveStateAt() {
      throw new Error('should not overwrite newer local state');
    }
  };

  const manager = createStateHandoffManager({
    sessionStorage,
    playerStateManager,
    onZeroMerge() {
      zeroMergeCalls += 1;
    }
  });

  manager.write('liminal_library', { from: 'kapitel1' });
  const result = manager.merge('liminal_library');
  assert.equal(result.status, 'merged');
  assert.equal(result.merged, 0);
  assert.equal(zeroMergeCalls, 1);
});

test('state handoff clears expectation when payload is missing', () => {
  const sessionStorage = createMemoryStorage();
  let missingCalls = 0;
  sessionStorage.setItem('gb_handoff_expect', 'kapitel1');

  const manager = createStateHandoffManager({
    sessionStorage,
    playerStateManager: null,
    onMissingExpected() {
      missingCalls += 1;
    }
  });

  const result = manager.merge('kapitel1');
  assert.equal(result.status, 'missing');
  assert.equal(missingCalls, 1);
  assert.equal(sessionStorage.getItem('gb_handoff_expect'), null);
});
