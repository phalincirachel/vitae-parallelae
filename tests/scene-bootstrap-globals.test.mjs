import test from 'node:test';
import assert from 'node:assert/strict';

await import('../assets/js/scenes/index2d/bootstrap.global.js');
await import('../assets/js/scenes/liminal3d/bootstrap.global.js');

const indexBootstrap = globalThis.GameboyIndexSceneBootstrap;
const liminalBootstrap = globalThis.GameboyLiminalSceneBootstrap;

test('index scene bootstrap resolves level and initializes overlay metadata', () => {
  const overlayCalls = [];
  const result = indexBootstrap.init({
    locationLike: { search: '?chapter=kapitel1c' },
    sceneRuntime: {
      resolveIndexLevel() {
        return {
          sceneName: 'steingasse',
          contentKey: 'kapitel1c',
          mapFile: 'assets/kapitel1c.png',
          audioUrl: 'assets/kapitel1c.mp3',
          subtitleFile: 'assets/kapitel1c.txt',
          activeChapterBtn: 'chapter1cBtn',
          nextChapterTarget: null,
          page: 'index.html?chapter=kapitel1c',
          chapterLabel: '1c',
          chapterTitle: 'Steingasse',
          loreProgressTotal: 5
        };
      },
      DEFAULT_LORE_PROGRESS_TOTAL: 9,
      CHAPTER_PROGRESS_SCENE_BY_BUTTON: { chapter1cBtn: 'steingasse' },
      BOOKMARK_PAGE_KEY_MAP: { 'index.html?chapter=kapitel1c': 'kapitel1c' }
    },
    loadingTutorialOverlay: {
      init(payload) {
        overlayCalls.push(payload);
      }
    }
  });

  assert.equal(result.level.sceneName, 'steingasse');
  assert.equal(result.sceneName, 'steingasse');
  assert.equal(result.loreProgressDefaultTotal, 5);
  assert.equal(result.chapterProgressSceneByButton.chapter1cBtn, 'steingasse');
  assert.equal(result.bookmarkPageKeyMap['index.html?chapter=kapitel1c'], 'kapitel1c');
  assert.deepEqual(overlayCalls, [{
    pageKey: 'index.html?chapter=kapitel1c',
    sceneKey: 'steingasse',
    chapterTitle: 'Steingasse',
    loadingScreenId: 'loading-screen'
  }]);
});

test('liminal scene bootstrap resolves scene and loads three runtime through injected importer', async () => {
  const overlayCalls = [];
  const loadThreeCalls = [];
  const root = { window: {}, location: { href: 'file:///liminal%20library.html' } };
  const result = await liminalBootstrap.init({
    root,
    liminalScene: liminalBootstrap.FALLBACK_LIMINAL_SCENE,
    loadingTutorialOverlay: {
      init(payload) {
        overlayCalls.push(payload);
      }
    },
    importEntryModule: async () => ({
      async initLiminalApp() {
        return {
          async loadThree() {
            loadThreeCalls.push('load');
            return {
              THREE: { version: 'test' },
              mode: '3d',
              source: 'unit-test'
            };
          }
        };
      }
    })
  });

  assert.equal(result.liminalScene.sceneName, 'liminal_library');
  assert.equal(result.threeResult.mode, '3d');
  assert.equal(root.window.THREE.version, 'test');
  assert.deepEqual(loadThreeCalls, ['load']);
  assert.deepEqual(overlayCalls, [{
    pageKey: 'liminal library.html',
    sceneKey: 'liminal_library',
    chapterTitle: 'Antiquariat Hannrath',
    loadingScreenId: 'loading-screen'
  }]);
});
