import test from 'node:test';
import assert from 'node:assert/strict';
import { createChapterAutoplayIntent } from '../assets/js/shared/core/chapter-autoplay-intent.js';

function createStorage() {
  const map = new Map();
  return {
    getItem(key) { return map.has(key) ? map.get(key) : null; },
    setItem(key, value) { map.set(key, String(value)); },
    removeItem(key) { map.delete(key); }
  };
}

test('chapter autoplay intent stores and consumes manual navigation intent', () => {
  let nowValue = 1000;
  const intent = createChapterAutoplayIntent({ storage: createStorage(), now: () => nowValue });
  intent.markManual('liminal library.html', 'chapter-menu', 'bookmark');
  const consumed = intent.consume('liminal library.html');
  assert.equal(consumed.policy, 'manual');
  assert.equal(consumed.shouldAutoplay, false);
  assert.equal(consumed.reason, 'bookmark');
});

test('chapter autoplay intent falls back for stale entries', () => {
  let nowValue = 1000;
  const intent = createChapterAutoplayIntent({ storage: createStorage(), now: () => nowValue });
  intent.markAuto('index.html', 'auto', 'transition');
  nowValue += 11 * 60 * 1000;
  const consumed = intent.consume('index.html', { defaultPolicy: 'manual' });
  assert.equal(consumed.policy, 'manual');
  assert.equal(consumed.reason, 'stale-intent');
});
