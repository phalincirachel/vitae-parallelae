import test from 'node:test';
import assert from 'node:assert/strict';
import { CHAPTER_DB, getChapterLoreIds, getContent, normalizeSceneName } from '../assets/js/shared/data/content-manifest.js';
import { getSceneConfig, resolveSceneFromLocation } from '../assets/js/shared/data/scene-config.js';

test('normalizeSceneName resolves aliases', () => {
  assert.equal(normalizeSceneName('chapter1b'), 'liminal_library');
  assert.equal(normalizeSceneName('Kapitel1c'), 'steingasse');
  assert.equal(normalizeSceneName(' marktplatz '), 'marktplatz');
});

test('content manifest exposes chapter lore ids and content', () => {
  assert.deepEqual(getChapterLoreIds('steingasse'), [3]);
  assert.equal(getContent(2).title, 'Das Flüstern');
  assert.equal(CHAPTER_DB.marktplatz.chapterButtonId, 'chapter1Btn');
});

test('scene config resolves index and liminal locations', () => {
  assert.equal(getSceneConfig('liminal_library').pageId, 'liminal library.html');
  assert.equal(resolveSceneFromLocation({ pathname: '/index.html', search: '?chapter=kapitel1c' }).sceneKey, 'steingasse');
  assert.equal(resolveSceneFromLocation({ pathname: '/liminal library.html', search: '' }).sceneKey, 'liminal_library');
});
