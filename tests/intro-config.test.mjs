import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INTRO_ASSET_PATHS,
  INTRO_ROUTE,
  INTRO_VERSION,
  listIntroAssetPaths
} from '../assets/js/shared/data/intro-config.js';

test('intro config exposes stable intro metadata', () => {
  assert.equal(INTRO_VERSION, 2);
  assert.equal(INTRO_ROUTE.introFile, 'intro.html');
  assert.equal(INTRO_ROUTE.gameFile, 'index.html');
  assert.deepEqual(listIntroAssetPaths(), INTRO_ASSET_PATHS.slice());
  assert.equal(INTRO_ASSET_PATHS.includes('assets/intro/start.png'), true);
  assert.equal(INTRO_ASSET_PATHS.includes('assets/intro/einfuehrungsplatz.png'), true);
  assert.equal(INTRO_ASSET_PATHS.includes('assets/intro/placeholder.txt'), true);
  assert.equal(INTRO_ASSET_PATHS.includes('assets/intro/silence.wav'), true);
});
