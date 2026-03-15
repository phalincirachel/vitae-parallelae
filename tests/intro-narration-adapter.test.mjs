import test from 'node:test';
import assert from 'node:assert/strict';
import { createIntroNarrationAdapter } from '../assets/js/intro/intro-narration-adapter.js';

class MockAudioAdapter {
  static instances = [];

  constructor() {
    this._src = '';
    this._volume = 1;
    this._currentTime = 0;
    this._timer = null;
    this.widget = {};
    this._isReady = true;
    MockAudioAdapter.instances.push(this);
  }

  get src() {
    return this._src;
  }

  set src(value) {
    this._src = String(value || '');
  }

  get volume() {
    return this._volume;
  }

  set volume(value) {
    this._volume = Number(value) || 0;
  }

  get currentTime() {
    return this._currentTime;
  }

  set currentTime(value) {
    this._currentTime = Math.max(0, Number(value) || 0);
  }

  _waitForScReady() {
    return Promise.resolve(true);
  }

  seekAndConfirm(targetSeconds) {
    this.currentTime = targetSeconds;
    return Promise.resolve({ ok: true, target: this.currentTime, position: this.currentTime, attempts: 1 });
  }

  getAccurateCurrentTime() {
    return Promise.resolve(this.currentTime);
  }

  play() {
    if (this._timer) clearInterval(this._timer);
    this._timer = setInterval(() => {
      this._currentTime += 0.05;
    }, 20);
    return Promise.resolve();
  }

  pause() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test('intro narration adapter streams a bounded segment and settles at segment end', async () => {
  MockAudioAdapter.instances.length = 0;
  const adapter = createIntroNarrationAdapter({
    AudioAdapter: MockAudioAdapter,
    sourceUrl: 'https://example.com/intro'
  });
  let started = 0;
  let ended = 0;
  adapter.onSegmentStart(() => { started += 1; });
  adapter.onSegmentEnd(({ cancelled }) => {
    if (!cancelled) ended += 1;
  });

  const result = await adapter.play({
    id: 'seg-1',
    text: 'Testsegment',
    audioStartSec: 2,
    audioEndSec: 2.22
  });

  assert.equal(result, true);
  assert.equal(started, 1);
  assert.equal(ended, 1);
  assert.equal(adapter.isPlaying(), false);
  assert.equal(adapter.isPaused(), false);
});

test('intro narration adapter pauses immediately and resumes from the stored stream position', async () => {
  MockAudioAdapter.instances.length = 0;
  const adapter = createIntroNarrationAdapter({
    AudioAdapter: MockAudioAdapter,
    sourceUrl: 'https://example.com/intro'
  });
  const player = MockAudioAdapter.instances[0];

  const playbackPromise = adapter.play({
    id: 'seg-2',
    text: 'Pause Resume',
    audioStartSec: 5,
    audioEndSec: 5.45
  });

  await wait(110);
  assert.equal(adapter.isPlaying(), true);
  assert.equal(adapter.pause(), true);
  assert.equal(adapter.isPaused(), true);

  const pausedAt = player.currentTime;
  await wait(140);
  assert.ok(Math.abs(player.currentTime - pausedAt) < 0.06, `stream advanced during pause: ${pausedAt} -> ${player.currentTime}`);

  assert.equal(adapter.resume(), true);
  assert.equal(adapter.isPlaying(), true);

  const result = await playbackPromise;
  assert.equal(result, true);
  assert.equal(adapter.isPlaying(), false);
});

test('intro narration adapter supports silent hold segments for text without dedicated audio', async () => {
  MockAudioAdapter.instances.length = 0;
  const adapter = createIntroNarrationAdapter({
    AudioAdapter: MockAudioAdapter,
    sourceUrl: 'https://example.com/intro'
  });

  const startedAt = Date.now();
  const result = await adapter.play({
    id: 'seg-3',
    text: 'Stumm',
    holdDurationMs: 120
  });
  const elapsed = Date.now() - startedAt;

  assert.equal(result, true);
  assert.ok(elapsed >= 90, `silent hold resolved too early: ${elapsed}ms`);
});
