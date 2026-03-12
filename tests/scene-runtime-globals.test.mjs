import test from 'node:test';
import assert from 'node:assert/strict';

await import('../assets/js/SceneRuntimeGlobals.js');
const sceneRuntime = globalThis.GameboySceneRuntime;

test('scene runtime resolves index levels from query params', () => {
  const defaultLevel = sceneRuntime.resolveIndexLevel({ search: '' });
  const steingasseLevel = sceneRuntime.resolveIndexLevel({ search: '?chapter=kapitel1c' });

  assert.equal(defaultLevel.sceneName, 'marktplatz');
  assert.equal(defaultLevel.chapterTitle, 'Marktplatz');
  assert.equal(steingasseLevel.sceneName, 'steingasse');
  assert.equal(steingasseLevel.mapFile, 'assets/kapitel1c.png');
});

test('scene runtime exposes shared bookmark and chapter-progress maps', () => {
  assert.equal(sceneRuntime.BOOKMARK_PAGE_KEY_MAP['liminal library.html'], 'liminal_library');
  assert.equal(sceneRuntime.CHAPTER_PROGRESS_SCENE_BY_BUTTON.chapter1cBtn, 'steingasse');
  assert.equal(sceneRuntime.getLiminalSceneRuntime().chapterLabel, '1b');
  assert.equal(globalThis.GameboySceneRuntime, sceneRuntime);
});
