import test from 'node:test';
import assert from 'node:assert/strict';
import { initLoadingTutorialOverlay } from '../assets/js/shared/ui/loading-tutorial-overlay.js';

test('loading tutorial overlay initializes with provided metadata', () => {
  const calls = [];
  const result = initLoadingTutorialOverlay({
    overlay: {
      init(payload) {
        calls.push(payload);
      }
    },
    pageKey: 'liminal library.html',
    sceneKey: 'liminal_library',
    chapterTitle: 'Antiquariat Hannrath',
    loadingScreenId: 'loading-screen'
  });

  assert.equal(result, true);
  assert.deepEqual(calls, [{
    pageKey: 'liminal library.html',
    sceneKey: 'liminal_library',
    chapterTitle: 'Antiquariat Hannrath',
    loadingScreenId: 'loading-screen'
  }]);
});

test('loading tutorial overlay returns false when init api is unavailable', () => {
  assert.equal(initLoadingTutorialOverlay({ overlay: null }), false);
  assert.equal(initLoadingTutorialOverlay({ overlay: {} }), false);
});
