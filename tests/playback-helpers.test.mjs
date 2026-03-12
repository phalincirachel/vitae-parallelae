import test from 'node:test';
import assert from 'node:assert/strict';

await import('../assets/js/shared/audio/playback-helpers.global.js');

const playbackHelpers = globalThis.GameboyPlaybackHelpers;

test('verifyPlaybackStarted succeeds when playback advances', async () => {
  const played = [];
  const positions = [0, 0.12];
  let hasRecent = false;
  const result = await playbackHelpers.verifyPlaybackStarted({
    player: { paused: false },
    retries: 0,
    delayMs: 1,
    wait: async () => {},
    play: async () => { played.push('play'); },
    getCurrentTime: async () => positions.shift() ?? 0.12,
    hasRecentProgress: () => hasRecent,
    isTransportPaused: () => false,
    isPaused: () => false,
    isProbablyPlaying: () => true,
    requireAdvance: true
  });

  assert.equal(result, true);
  assert.deepEqual(played, ['play']);
});

test('verifyPlaybackStarted succeeds from recent progress without requiring advance', async () => {
  const attempts = [];
  const result = await playbackHelpers.verifyPlaybackStarted({
    player: { paused: false },
    retries: 1,
    delayMs: 1,
    wait: async () => {},
    play: async () => { attempts.push('play'); },
    getCurrentTime: async () => 4.2,
    hasRecentProgress: () => true,
    isTransportPaused: () => false,
    isPaused: () => false,
    isProbablyPlaying: () => true,
    requireAdvance: false
  });

  assert.equal(result, true);
  assert.deepEqual(attempts, ['play']);
});

test('verifyPlaybackStarted falls back when transport is live and recent progress was seen', async () => {
  const trace = [];
  let first = true;
  const result = await playbackHelpers.verifyPlaybackStarted({
    player: { paused: false },
    retries: 0,
    delayMs: 1,
    wait: async () => {},
    play: async () => {},
    getCurrentTime: async () => 1,
    hasRecentProgress: () => {
      if (first) {
        first = false;
        return true;
      }
      return false;
    },
    isTransportPaused: () => false,
    isPaused: () => false,
    isProbablyPlaying: () => true,
    requireAdvance: false,
    onFallbackSuccess: (payload) => trace.push(payload)
  });

  assert.equal(result, true);
  assert.deepEqual(trace, [{ sawRecentProgress: true }]);
});

test('verifyPlaybackStarted reports failure after retries', async () => {
  const failures = [];
  const errors = [];
  const result = await playbackHelpers.verifyPlaybackStarted({
    player: { paused: true },
    retries: 1,
    delayMs: 1,
    wait: async () => {},
    play: async () => { throw new Error('blocked'); },
    getCurrentTime: async () => 0,
    hasRecentProgress: () => false,
    isTransportPaused: () => true,
    isPaused: () => true,
    isProbablyPlaying: () => false,
    requireAdvance: true,
    onPlayError: ({ attempt, error }) => errors.push([attempt, error.message]),
    onFailure: (payload) => failures.push(payload)
  });

  assert.equal(result, false);
  assert.deepEqual(errors, [[1, 'blocked'], [2, 'blocked']]);
  assert.deepEqual(failures, [{ retries: 1, delayMs: 1, sawRecentProgress: false, transportPaused: true }]);
});
