import test from 'node:test';
import assert from 'node:assert/strict';

await import('../assets/js/scenes/liminal3d/game-start-runtime.global.js');

const gameStartRuntime = globalThis.GameboyLiminalGameStartRuntime;

function createEventTarget(initial = {}) {
  const listeners = new Map();
  return Object.assign(initial, {
    addEventListener(type, handler) {
      const handlers = listeners.get(type) || [];
      handlers.push(handler);
      listeners.set(type, handlers);
    },
    emit(type) {
      for (const handler of listeners.get(type) || []) {
        handler();
      }
    },
    listenerCount(type) {
      return (listeners.get(type) || []).length;
    }
  });
}

test('liminal game start runtime preloads segments and reveals ui after start', async () => {
  const rafQueue = [];
  const windowObject = createEventTarget({
    visualFreezeActive: false,
    requestAnimationFrame(callback) {
      rafQueue.push(callback);
      return rafQueue.length;
    }
  });
  const loading = { style: { display: 'block' } };
  const loadingScreen = { style: { display: 'block' } };
  const uiContainer = { style: { display: 'none' } };
  const audioPlayer = {
    currentSubtitleIndex: 3,
    readingModeCalls: 0,
    renderLinesCalls: [],
    setReadingMode(value) {
      this.readingModeCalls += value ? 1 : 0;
    },
    renderLines(index) {
      this.renderLinesCalls.push(index);
    },
    pause() {},
    play() { return Promise.resolve(); }
  };
  const documentObject = createEventTarget({
    hidden: false,
    getElementById(id) {
      if (id === 'loading') return loading;
      if (id === 'loading-screen') return loadingScreen;
      return null;
    }
  });

  const createdSegments = [];
  const pushedSegments = [];
  let started = false;
  let refreshCalls = 0;
  let retryCalls = 0;
  let iconUpdates = 0;
  let compileCalls = 0;
  let startLoopCalls = 0;
  const runtime = gameStartRuntime.init({
    window: windowObject,
    document: documentObject,
    requestAnimationFrame: (callback) => windowObject.requestAnimationFrame(callback),
    setTimeout: (callback) => callback(),
    getActiveSegmentTarget: () => 2,
    getInitialSegmentStartZ: () => 40,
    getSegmentLength: () => 10,
    canPreload: () => true,
    createPreloadSegment: (z, length, onReady) => {
      const segment = { z, length, onReady };
      createdSegments.push(segment);
      return segment;
    },
    pushSegment: (segment) => pushedSegments.push(segment),
    getUiContainer: () => uiContainer,
    refreshLoreProgressUi: () => { refreshCalls += 1; },
    getIsReadingMode: () => true,
    isBlaetternLayoutSelected: () => true,
    scheduleBlaetternPaginationRetry: () => { retryCalls += 1; },
    getAudioPlayer: () => audioPlayer,
    getMainChapterAutoplayIntent: () => ({ shouldAutoplay: false, policy: 'manual', reason: 'test' }),
    debugNote: () => {},
    verifyPlaybackStarted: () => Promise.resolve(false),
    updateIcons: () => { iconUpdates += 1; },
    getRenderer: () => ({ compile() { compileCalls += 1; } }),
    getScene: () => ({ name: 'scene' }),
    getCamera: () => ({ name: 'camera' }),
    getAmbientAudio: () => null,
    saveCurrentContentState: () => {},
    getContentSwitchInProgress: () => false,
    startAnimationLoop: () => { startLoopCalls += 1; return true; },
    getClock: () => ({ getDelta() {} }),
    setHasStartedGame: (value) => { started = value; },
    isFallback2DMode: () => false,
    log: () => {},
    warn: () => {}
  });

  assert.equal(runtime.initPreload(), 2);
  assert.deepEqual(createdSegments.map((segment) => segment.z), [40, 30]);
  assert.equal(pushedSegments.length, 2);
  assert.equal(started, false);

  createdSegments[0].onReady();
  assert.equal(started, false);
  createdSegments[1].onReady();
  assert.equal(started, true);
  assert.equal(loading.style.display, 'none');
  assert.equal(audioPlayer.readingModeCalls, 1);
  assert.equal(iconUpdates, 1);
  assert.equal(compileCalls, 1);
  assert.equal(startLoopCalls, 1);
  assert.equal(documentObject.listenerCount('visibilitychange'), 1);
  assert.equal(windowObject.listenerCount('pagehide'), 1);

  rafQueue.shift()();
  rafQueue.shift()();
  assert.equal(uiContainer.style.display, 'flex');
  assert.equal(refreshCalls, 1);
  assert.equal(retryCalls, 1);
  assert.deepEqual(audioPlayer.renderLinesCalls, [3]);
  assert.equal(loadingScreen.style.display, 'none');
});

test('liminal game start runtime pauses on hide and resumes on visible/pagehide', async () => {
  const windowObject = createEventTarget({
    visualFreezeActive: false,
    requestAnimationFrame() {}
  });
  const documentObject = createEventTarget({
    hidden: false,
    getElementById() {
      return null;
    }
  });
  const ambientAudio = {
    paused: false,
    pauseCalls: 0,
    playCalls: 0,
    isProbablyPlaying() {
      return true;
    },
    pause() {
      this.pauseCalls += 1;
    },
    play() {
      this.playCalls += 1;
      return Promise.resolve();
    }
  };
  const audioPlayer = {
    paused: false,
    pauseCalls: 0,
    playCalls: 0,
    isProbablyPlaying() {
      return true;
    },
    pause() {
      this.pauseCalls += 1;
    },
    play() {
      this.playCalls += 1;
      return Promise.resolve();
    }
  };
  let savedReasons = [];
  let startLoopCalls = 0;

  const runtime = gameStartRuntime.init({
    window: windowObject,
    document: documentObject,
    requestAnimationFrame: () => {},
    setTimeout: (callback) => callback(),
    getActiveSegmentTarget: () => 1,
    getInitialSegmentStartZ: () => 10,
    getSegmentLength: () => 10,
    canPreload: () => false,
    getAudioPlayer: () => audioPlayer,
    getAmbientAudio: () => ambientAudio,
    getMainChapterAutoplayIntent: () => ({ shouldAutoplay: false, policy: 'manual', reason: 'test' }),
    debugNote: () => {},
    updateIcons: () => {},
    saveCurrentContentState: (payload) => { savedReasons.push(payload.reason); },
    getContentSwitchInProgress: () => false,
    startAnimationLoop: () => { startLoopCalls += 1; return true; },
    getClock: () => ({ getDelta() {} }),
    setHasStartedGame: () => {},
    isFallback2DMode: () => true,
    log: () => {},
    warn: () => {}
  });

  runtime.startGame();
  documentObject.hidden = true;
  documentObject.emit('visibilitychange');
  assert.equal(windowObject.gamePaused, true);
  assert.deepEqual(savedReasons, ['visibility:hidden']);
  assert.equal(ambientAudio.pauseCalls, 1);
  assert.equal(audioPlayer.pauseCalls, 1);

  documentObject.hidden = false;
  documentObject.emit('visibilitychange');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(windowObject.gamePaused, false);
  assert.equal(startLoopCalls >= 2, true);
  assert.equal(ambientAudio.playCalls, 1);
  assert.equal(audioPlayer.playCalls, 1);

  windowObject.emit('pagehide');
  assert.deepEqual(savedReasons, ['visibility:hidden', 'pagehide']);
  assert.equal(ambientAudio.pauseCalls, 2);
  assert.equal(audioPlayer.pauseCalls, 2);
});
