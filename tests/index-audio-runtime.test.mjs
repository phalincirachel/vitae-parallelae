import test from 'node:test';
import assert from 'node:assert/strict';

await import('../assets/js/scenes/index2d/audio-runtime.global.js');

const indexAudioRuntime = globalThis.GameboyIndexAudioRuntime;

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
    volume: 0,
    currentTime: 0,
    src: '',
    audioNode: null,
    play() {
      playCount += 1;
      this.paused = false;
      return Promise.resolve();
    },
    pause() {
      pauseCount += 1;
      this.paused = true;
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

function createButton() {
  const button = createEventTarget({
    blurCount: 0,
    blur() {
      this.blurCount += 1;
    }
  });
  return button;
}

function createDocument(buttons) {
  return createEventTarget({
    hidden: false,
    activeElement: null,
    querySelectorAll(selector) {
      assert.equal(selector, 'button');
      return buttons;
    }
  });
}

test('index audio runtime initializes icon sync and registers listeners', () => {
  const buttons = [createButton(), createButton()];
  const documentObject = createDocument(buttons);
  const audioPlayer = createAudio({
    paused: true,
    currentTime: 1.25,
    isTransportPaused() {
      return this.paused;
    },
    isProbablyPlaying() {
      return !this.paused;
    }
  });
  const iconPlay = { style: {} };
  const iconPause = { style: {} };

  const runtime = indexAudioRuntime.init({
    document: documentObject,
    audioPlayer,
    iconPlay,
    iconPause,
    footstepSound: createAudio(),
    shimmerSound: createAudio(),
    ambientAudio: createAudio(),
    audioProfile: { ambient: 0.2, footsteps: 0.3 },
    getReaderBackgroundVolume: () => 1,
    getGameReady: () => false,
    getAudioUnlocked: () => false,
    setAudioUnlocked: () => {},
    getFootstepPlaying: () => false,
    setFootstepPlaying: () => {}
  });

  assert.equal(runtime.guardedButtonCount, 2);
  assert.equal(iconPlay.style.display, 'block');
  assert.equal(iconPause.style.display, 'none');
  assert.equal(audioPlayer.listenerCount('play'), 2);
  assert.equal(audioPlayer.listenerCount('pause'), 2);
  assert.equal(audioPlayer.listenerCount('ended'), 2);
  assert.equal(audioPlayer.listenerCount('canplay'), 1);
  assert.equal(documentObject.listenerCount('click'), 1);
  assert.equal(documentObject.listenerCount('keydown'), 1);
  assert.equal(documentObject.listenerCount('touchstart'), 1);

  audioPlayer.paused = false;
  audioPlayer.currentTime = 2.5;
  audioPlayer.emit('play');
  assert.equal(iconPlay.style.display, 'none');
  assert.equal(iconPause.style.display, 'block');
});

test('index audio runtime syncs aux playback against narration and visibility state', async () => {
  let audioUnlocked = true;
  let footstepPlaying = true;
  let narrationPlaying = true;
  let gameReady = true;
  let contentSwitchInProgress = false;
  const ambientAudio = createAudio({ paused: false });
  const footstepSound = createAudio({ paused: false });
  const documentObject = createDocument([]);
  const audioPlayer = createAudio({
    isProbablyPlaying() {
      return narrationPlaying;
    }
  });

  const runtime = indexAudioRuntime.init({
    document: documentObject,
    audioPlayer,
    footstepSound,
    shimmerSound: createAudio(),
    ambientAudio,
    audioProfile: { ambient: 0.2, footsteps: 0.3 },
    getReaderBackgroundVolume: () => 1,
    getGameReady: () => gameReady,
    getContentSwitchInProgress: () => contentSwitchInProgress,
    getAudioUnlocked: () => audioUnlocked,
    setAudioUnlocked: (value) => { audioUnlocked = value; },
    getFootstepPlaying: () => footstepPlaying,
    setFootstepPlaying: (value) => { footstepPlaying = value; }
  });

  assert.equal(runtime.syncAuxScPlayback('narration'), false);
  assert.equal(footstepPlaying, false);
  assert.equal(footstepSound.pauseCount, 1);
  assert.equal(ambientAudio.pauseCount, 1);
  assert.equal(ambientAudio.paused, true);

  narrationPlaying = false;
  footstepPlaying = false;
  ambientAudio.paused = true;
  const allowed = runtime.syncAuxScPlayback('resume');
  await Promise.resolve();
  assert.equal(allowed, true);
  assert.equal(ambientAudio.playCount, 1);

  documentObject.hidden = true;
  assert.equal(runtime.allowAuxScPlayback(), false);
  documentObject.hidden = false;
  contentSwitchInProgress = true;
  assert.equal(runtime.allowAuxScPlayback(), false);
});

test('index audio runtime applies scene and background volumes through shared state', () => {
  let isLoreMode = true;
  let isReadingMode = true;
  const ambientAudio = createAudio();
  const footstepSound = createAudio();
  const shimmerSound = createAudio();

  const runtime = indexAudioRuntime.init({
    document: createDocument([]),
    audioPlayer: createAudio({ isProbablyPlaying: () => false }),
    footstepSound,
    shimmerSound,
    ambientAudio,
    audioProfile: { ambient: 0.2, footsteps: 0.4 },
    shimmerBaseVolume: 0.4,
    getReaderBackgroundVolume: () => 0.5,
    getGameReady: () => false,
    getIsLoreMode: () => isLoreMode,
    getIsReadingMode: () => isReadingMode,
    getAudioUnlocked: () => false,
    setAudioUnlocked: () => {},
    getFootstepPlaying: () => false,
    setFootstepPlaying: () => {}
  });

  const mix = runtime.applySceneAudioMix('reader');
  const shimmerVolume = runtime.applyBackgroundSfxVolume('reader');
  assert.equal(Number(mix.ambient.toFixed(4)), 0.068);
  assert.equal(Number(mix.footsteps.toFixed(4)), 0.0585);
  assert.equal(Number(ambientAudio.volume.toFixed(4)), 0.068);
  assert.equal(Number(footstepSound.volume.toFixed(4)), 0.0585);
  assert.equal(Number(shimmerVolume.toFixed(4)), 0.2);
  assert.equal(Number(shimmerSound.volume.toFixed(4)), 0.2);

  isLoreMode = false;
  isReadingMode = false;
  const baseMix = runtime.applySceneAudioMix('base');
  assert.equal(Number(baseMix.ambient.toFixed(4)), 0.1);
  assert.equal(Number(baseMix.footsteps.toFixed(4)), 0.2);
});

test('index audio runtime guards button focus and unlocks audio once requested', () => {
  const buttons = [createButton()];
  const documentObject = createDocument(buttons);
  let audioUnlocked = false;
  let focusCount = 0;
  const originalFocus = globalThis.focus;
  globalThis.focus = () => {
    focusCount += 1;
  };

  try {
    const runtime = indexAudioRuntime.init({
      document: documentObject,
      audioPlayer: createAudio({ isProbablyPlaying: () => false }),
      footstepSound: createAudio(),
      shimmerSound: createAudio(),
      ambientAudio: createAudio(),
      audioProfile: { ambient: 0.2, footsteps: 0.3 },
      getReaderBackgroundVolume: () => 1,
      getGameReady: () => false,
      getAudioUnlocked: () => audioUnlocked,
      setAudioUnlocked: (value) => { audioUnlocked = value; },
      getFootstepPlaying: () => false,
      setFootstepPlaying: () => {}
    });

    let prevented = false;
    buttons[0].emit('mousedown', {
      preventDefault() {
        prevented = true;
      }
    });
    buttons[0].emit('focus');
    buttons[0].emit('click');

    assert.equal(prevented, true);
    assert.equal(buttons[0].blurCount, 2);
    assert.equal(focusCount, 1);
    assert.equal(runtime.unlockAudio(), true);
    assert.equal(audioUnlocked, true);
    assert.equal(runtime.unlockAudio(), false);
  } finally {
    globalThis.focus = originalFocus;
  }
});
