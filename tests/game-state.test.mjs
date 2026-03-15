import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameState } from '../assets/js/shared/state/game-state.js';

function createStorage() {
  const map = new Map();
  return {
    getItem(key) { return map.has(key) ? map.get(key) : null; },
    setItem(key, value) { map.set(key, String(value)); },
    removeItem(key) { map.delete(key); }
  };
}

test('game state initializes from local storage and normalizes arrays', async () => {
  const localStorage = createStorage();
  localStorage.setItem('liminal_save', JSON.stringify({
    intro: { completed: true, version: '1', completedAt: '2026-03-15T10:00:00.000Z' },
    collectedLore: ['1', 1, 2],
    collectedLights: { Kapitel1C: ['3', 3] },
    chapterCollectibleTargets: { chapter1c: '7' },
    bookmarks: []
  }));
  const state = createGameState({ localStorage, sessionStorage: createStorage(), getElectronAPI: () => null, getPlayerStateManager: () => null, logger: { warn() {}, error() {} } });
  await state.init();
  assert.equal(state.state.intro.completed, true);
  assert.equal(state.state.intro.version, 1);
  assert.deepEqual(state.state.collectedLore, [1, 2]);
  assert.deepEqual(state.state.collectedLights.steingasse, [3]);
  assert.equal(state.getChapterCollectibleTarget('kapitel1c'), 7);
});

test('game state adds non-duplicate bookmarks based on scope and time', async () => {
  const state = createGameState({ localStorage: createStorage(), sessionStorage: createStorage(), getElectronAPI: () => null, getPlayerStateManager: () => null, logger: { warn() {}, error() {} } });
  state.state = state._createDefaultState();
  const added = await state.addBookmark({ id: 'a', page: 'index.html', contentKey: 'main:index', time: 10, textPreview: 'A' });
  const duplicate = await state.addBookmark({ id: 'b', page: 'index.html', contentKey: 'main:index', time: 10.4, textPreview: 'B' });
  assert.equal(added, true);
  assert.equal(duplicate, false);
  assert.equal(state.getBookmarks().length, 1);
});

test('game state collects light and unlocks next lore in same chapter', async () => {
  const state = createGameState({ localStorage: createStorage(), sessionStorage: createStorage(), getElectronAPI: () => null, getPlayerStateManager: () => null, logger: { warn() {}, error() {} } });
  state.state = state._createDefaultState();
  const unlockedLoreId = await state.collectLight('marktplatz', 1);
  assert.equal(unlockedLoreId, 1);
  assert.deepEqual(state.state.collectedLore, [1]);
});


test('game state ignores additional chapter lights when no lore remains', async () => {
  const state = createGameState({ localStorage: createStorage(), sessionStorage: createStorage(), getElectronAPI: () => null, getPlayerStateManager: () => null, logger: { warn() {}, error() {} } });
  state.state = state._createDefaultState();

  const firstUnlock = await state.collectLight('marktplatz', 1);
  const secondUnlock = await state.collectLight('marktplatz', 2);

  assert.equal(firstUnlock, 1);
  assert.equal(secondUnlock, null);
  assert.deepEqual(state.state.collectedLore, [1]);
  assert.deepEqual(state.state.collectedLights.marktplatz, [1]);
});


test('game state exposes intro completion helpers', async () => {
  const state = createGameState({ localStorage: createStorage(), sessionStorage: createStorage(), getElectronAPI: () => null, getPlayerStateManager: () => null, logger: { warn() {}, error() {} } });
  state.state = state._createDefaultState();

  assert.equal(state.isIntroCompleted(1), false);
  const intro = await state.markIntroCompleted(1, '2026-03-15T12:30:00.000Z');
  assert.deepEqual(intro, {
    completed: true,
    version: 1,
    completedAt: '2026-03-15T12:30:00.000Z'
  });
  assert.equal(state.isIntroCompleted(1), true);
});
