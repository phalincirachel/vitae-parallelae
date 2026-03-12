import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlayerStateManager } from '../assets/js/shared/state/player-state-manager.js';

function createStorage() {
  const map = new Map();
  return {
    getItem(key) { return map.has(key) ? map.get(key) : null; },
    setItem(key, value) { map.set(key, String(value)); },
    removeItem(key) { map.delete(key); }
  };
}

test('player state manager saves and reloads state', () => {
  const storage = createStorage();
  const manager = createPlayerStateManager({ storage, now: () => 100 });
  manager.saveStateAt('main:index', { sentenceIndex: 2, sentenceTime: 14.2, wasPlaying: true });

  const reloaded = createPlayerStateManager({ storage, now: () => 200 });
  assert.deepEqual(reloaded.getState('main:index'), {
    sentenceIndex: 2,
    sentenceTime: 14.2,
    wasPlaying: true,
    lastUpdate: 100
  });
});

test('player state manager merge import keeps fresher local state', () => {
  const manager = createPlayerStateManager({ storage: createStorage(), now: () => 200 });
  manager.saveStateAt('main:index', { sentenceIndex: 3, sentenceTime: 21, wasPlaying: false });
  manager.importStates({ 'main:index': { sentenceIndex: 1, sentenceTime: 3, wasPlaying: true, lastUpdate: 150 } });
  assert.equal(manager.getState('main:index').sentenceIndex, 3);
});
