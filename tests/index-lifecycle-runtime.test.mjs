import test from 'node:test';
import assert from 'node:assert/strict';

await import('../assets/js/scenes/index2d/lifecycle-runtime.global.js');

const lifecycleRuntime = globalThis.GameboyIndexLifecycleRuntime;

function createEventTarget(initial = {}) {
  const listeners = new Map();
  return Object.assign(initial, {
    addEventListener(type, handler) {
      const handlers = listeners.get(type) || [];
      handlers.push(handler);
      listeners.set(type, handlers);
    },
    emit(type, event = {}) {
      for (const handler of listeners.get(type) || []) {
        handler(event);
      }
    },
    listenerCount(type) {
      return (listeners.get(type) || []).length;
    }
  });
}

function createAudio(initial = {}) {
  let playCount = 0;
  let pauseCount = 0;
  const target = createEventTarget({
    paused: true,
    play() {
      playCount += 1;
      this.paused = false;
      return Promise.resolve();
    },
    pause() {
      pauseCount += 1;
      this.paused = true;
    },
    isProbablyPlaying() {
      return !this.paused;
    },
    get playCount() {
      return playCount;
    },
    get pauseCount() {
      return pauseCount;
    }
  });
  return Object.assign(target, initial);
}

test('index lifecycle runtime registers listeners and unlock click resumes ambient audio', async () => {
  const documentObject = createEventTarget({ hidden: false });
  const windowObject = createEventTarget({ visualFreezeActive: false });
  const ambientAudio = createAudio({ paused: true });

  lifecycleRuntime.init({
    window: windowObject,
    document: documentObject,
    ambientAudio,
    allowAuxScPlayback: () => true,
    getGameReady: () => true,
    scheduleResume: (handler) => handler()
  });

  assert.equal(documentObject.listenerCount('click'), 1);
  assert.equal(documentObject.listenerCount('visibilitychange'), 1);
  assert.equal(windowObject.listenerCount('pagehide'), 1);

  documentObject.emit('click');
  await Promise.resolve();
  assert.equal(ambientAudio.playCount, 1);
});

test('index lifecycle runtime pauses on hide and resumes on visible', async () => {
  const saveCalls = [];
  const mixCalls = [];
  let lastTimeValue = -1;
  let startGameLoopCalls = 0;
  let contentSwitchInProgress = false;
  const documentObject = createEventTarget({ hidden: true });
  const windowObject = createEventTarget({ visualFreezeActive: false });
  const ambientAudio = createAudio({ paused: false });
  const audioPlayer = createAudio({ paused: false });
  const footstepSound = createAudio({ paused: false });

  const runtime = lifecycleRuntime.init({
    window: windowObject,
    document: documentObject,
    ambientAudio,
    audioPlayer,
    footstepSound,
    allowAuxScPlayback: () => true,
    applySceneAudioMix: (reason) => mixCalls.push(reason),
    saveCurrentContentState: (payload) => saveCalls.push(payload),
    startGameLoop: () => { startGameLoopCalls += 1; },
    getContentSwitchInProgress: () => contentSwitchInProgress,
    setLastTime: (value) => { lastTimeValue = value; },
    scheduleResume: (handler) => handler()
  });

  documentObject.emit('visibilitychange');
  assert.equal(windowObject.gamePaused, true);
  assert.deepEqual(saveCalls[0], { preferCachedTime: true, reason: 'visibility:hidden' });
  assert.equal(runtime.getWasAmbientPlaying(), true);
  assert.equal(runtime.getWasPlayerPlaying(), true);
  assert.equal(ambientAudio.pauseCount, 1);
  assert.equal(audioPlayer.pauseCount, 1);
  assert.equal(footstepSound.pauseCount, 1);

  documentObject.hidden = false;
  documentObject.emit('visibilitychange');
  await Promise.resolve();
  assert.equal(windowObject.gamePaused, false);
  assert.equal(lastTimeValue, 0);
  assert.equal(startGameLoopCalls, 1);
  assert.deepEqual(mixCalls, ['visibility:resume']);
  assert.equal(ambientAudio.playCount, 1);
  assert.equal(audioPlayer.playCount, 1);

  contentSwitchInProgress = true;
  documentObject.hidden = true;
  documentObject.emit('visibilitychange');
  documentObject.hidden = false;
  documentObject.emit('visibilitychange');
  await Promise.resolve();
  assert.deepEqual(mixCalls, ['visibility:resume']);
});

test('index lifecycle runtime handles pagehide by saving and pausing transports', () => {
  const saveCalls = [];
  const windowObject = createEventTarget({ visualFreezeActive: false });
  const documentObject = createEventTarget({ hidden: false });
  const ambientAudio = createAudio({ paused: false });
  const audioPlayer = createAudio({ paused: false });

  const runtime = lifecycleRuntime.init({
    window: windowObject,
    document: documentObject,
    ambientAudio,
    audioPlayer,
    saveCurrentContentState: (payload) => saveCalls.push(payload),
    scheduleResume: (handler) => handler()
  });

  windowObject.emit('pagehide');

  assert.deepEqual(saveCalls, [{ preferCachedTime: true, reason: 'pagehide' }]);
  assert.equal(ambientAudio.pauseCount, 1);
  assert.equal(audioPlayer.pauseCount, 1);
  assert.equal(runtime.getVisibilityResumeToken(), 1);
});
