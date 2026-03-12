import test from 'node:test';
import assert from 'node:assert/strict';
import { bookmarksMatch, getBookmarkScope, normalizeBookmarkPageKey, resolveBookmarkContentKey } from '../assets/js/shared/core/bookmark-scope.js';

test('bookmark scope prioritizes content keys and media refs', () => {
  assert.equal(getBookmarkScope({ contentKey: 'lore2', page: 'index.html' }), 'lore2');
  assert.equal(getBookmarkScope({ audioRef: 'assets/kapitel1.mp3' }), 'audio:assets/kapitel1.mp3');
  assert.equal(getBookmarkScope({ textRef: 'assets/kapitel1.txt' }), 'text:assets/kapitel1.txt');
});

test('bookmark helpers normalize page and content keys', () => {
  assert.equal(normalizeBookmarkPageKey(' liminal library.html '), 'liminal library.html');
  assert.equal(resolveBookmarkContentKey({ textRef: 'assets/lore1.txt' }, 'fallback'), 'text:assets/lore1.txt');
  assert.equal(resolveBookmarkContentKey({}, 'fallback'), 'fallback');
});

test('bookmarksMatch respects page, scope and time tolerance', () => {
  const left = { page: 'index.html', contentKey: 'main:index', time: 12.3 };
  const right = { page: 'index.html', contentKey: 'main:index', time: 12.9 };
  const other = { page: 'liminal library.html', contentKey: 'main:index', time: 12.5 };
  assert.equal(bookmarksMatch(left, right), true);
  assert.equal(bookmarksMatch(left, other), false);
});
