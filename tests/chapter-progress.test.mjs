import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_LORE_PROGRESS_TOTAL,
  getChapterProgressSnapshot,
  resolveLoreProgressVisibility
} from '../assets/js/shared/ui/chapter-progress.js';

test('getChapterProgressSnapshot prefers GameState progress api', () => {
  const progress = getChapterProgressSnapshot('marktplatz', {
    defaultTotal: 7,
    gameState: {
      getChapterProgress() {
        return {
          sceneName: 'marktplatz',
          chapterTitle: 'Kapitel 1',
          collected: 3,
          total: 9
        };
      }
    }
  });

  assert.deepEqual(progress, {
    sceneName: 'marktplatz',
    chapterTitle: 'Kapitel 1',
    collected: 3,
    total: 9
  });
});

test('getChapterProgressSnapshot falls back to collected lights', () => {
  const progress = getChapterProgressSnapshot('liminal_library', {
    gameState: {
      state: {
        collectedLights: {
          liminal_library: [1, 2, 3, 4, 5, 6]
        }
      }
    }
  });

  assert.deepEqual(progress, {
    sceneName: 'liminal_library',
    chapterTitle: 'liminal_library',
    collected: DEFAULT_LORE_PROGRESS_TOTAL,
    total: DEFAULT_LORE_PROGRESS_TOTAL
  });
});

test('resolveLoreProgressVisibility honors explicit overrides', () => {
  assert.equal(resolveLoreProgressVisibility({ forceVisible: true, forceHidden: true }), true);
  assert.equal(resolveLoreProgressVisibility({ forceHidden: true, uiVisible: true }), false);
  assert.equal(resolveLoreProgressVisibility({ readingModeActive: false, uiVisible: true }), true);
  assert.equal(resolveLoreProgressVisibility({ readingModeActive: true, uiVisible: true }), false);
});
