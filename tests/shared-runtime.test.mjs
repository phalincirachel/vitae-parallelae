import test from 'node:test';
import assert from 'node:assert/strict';
import { getLoadingTutorialCards } from '../assets/js/shared/ui/loading-tutorial-catalog.js';
import { loadThree } from '../assets/js/scenes/liminal3d/load-three.js';

test('loading tutorial catalog filters by scene and device', () => {
  const cards = getLoadingTutorialCards('marktplatz', 'mobile');
  assert.equal(cards[0].id, 'book_menu');
  assert.equal(cards.at(-1).id, 'index_pinch_zoom_mobile');
});

test('loadThree returns fallback when importers fail', async () => {
  const result = await loadThree({ importer: async () => { throw new Error('missing'); } });
  assert.equal(result.mode, '2d-fallback');
  assert.equal(result.THREE, null);
});
