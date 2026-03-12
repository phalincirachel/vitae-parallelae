import test from 'node:test';
import assert from 'node:assert/strict';
import { initIndexApp } from '../assets/js/entry/index-app.js';
import { initLiminalApp } from '../assets/js/entry/liminal-app.js';

test('index entry resolves current scene and exposes GameState', async () => {
  const result = await initIndexApp({
    locationLike: {
      pathname: '/index.html',
      search: '?chapter=kapitel1c',
      href: 'file:///index.html?chapter=kapitel1c'
    }
  });

  assert.equal(result.sceneConfig.sceneKey, 'steingasse');
  assert.equal(typeof result.GameState.init, 'function');
});

test('liminal entry resolves scene and exposes three loader', async () => {
  const result = await initLiminalApp({
    locationLike: {
      pathname: '/liminal%20library.html',
      search: '',
      href: 'file:///liminal%20library.html'
    }
  });

  assert.equal(result.sceneConfig.sceneKey, 'liminal_library');
  assert.equal(typeof result.loadThree, 'function');
});
