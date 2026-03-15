import { INTRO_ROUTE, INTRO_VERSION } from '../shared/data/intro-config.js';
import {
  INTRO_DEMO_LORE_ENTRY,
  INTRO_DEMO_LORE_ID,
  INTRO_TRACKS
} from '../intro/intro-script.js';
import { createIntroNarrationAdapter } from '../intro/intro-narration-adapter.js';
import { createInteractiveFocusOverlay } from '../shared/ui/interactive-focus-overlay.js';
import { createInteractionGate } from '../shared/ui/interaction-gate.js';

const TRANSIENT_STORAGE_KEYS = Object.freeze([
  'gameboy_reading_mode',
  'gb_background_dim_level',
  'gb_background_dim_phase',
  'gb_background_dim_mode'
]);
const MOVE_KEYS = Object.freeze([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'w', 'a', 's', 'd', 'W', 'A', 'S', 'D'
]);
const SEGMENT_TIME_STEP = 8;
const INTRO_SCENE_NAME = globalThis.window?.__GAMEBOY_INTRO_BOOTSTRAP__?.level?.sceneName || 'intro_einfuehrung';

function wait(ms) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}

async function waitFor(predicate, options = {}) {
  const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : 30000;
  const intervalMs = Number.isFinite(options.intervalMs) ? options.intervalMs : 40;
  const label = options.label || 'condition';
  const start = Date.now();
  while ((Date.now() - start) <= timeoutMs) {
    const value = predicate();
    if (value) return value;
    await wait(intervalMs);
  }
  throw new Error(`Timed out while waiting for ${label}.`);
}

function captureStorage(storageRef, keys) {
  const snapshot = {};
  keys.forEach((key) => {
    try {
      snapshot[key] = storageRef.getItem(key);
    } catch (_) {
      snapshot[key] = null;
    }
  });
  return snapshot;
}

function restoreStorage(storageRef, snapshot, preservedKeys = new Set()) {
  Object.entries(snapshot).forEach(([key, value]) => {
    if (preservedKeys.has(key)) return;
    try {
      if (value === null || value === undefined) {
        storageRef.removeItem(key);
      } else {
        storageRef.setItem(key, value);
      }
    } catch (_) {}
  });
}

function buildTrackEntries(trackName) {
  const track = INTRO_TRACKS[trackName] || [];
  return track.map((segment, index) => ({
    time: index * SEGMENT_TIME_STEP,
    text: segment.text
  }));
}

function getRefs(documentRef) {
  return {
    archiveModal: documentRef.getElementById('archiveModal'),
    audioPlayerUI: documentRef.getElementById('audioPlayerUI'),
    audioToggleBtn: documentRef.getElementById('audioToggleBtn'),
    backToChapterBtn: documentRef.getElementById('backToChapterBtn'),
    bookBtn: documentRef.getElementById('bookBtn'),
    iconPause: documentRef.getElementById('iconPause'),
    iconPlay: documentRef.getElementById('iconPlay'),
    loreProgressHud: documentRef.getElementById('loreProgressHud'),
    nextChapterBtn: documentRef.getElementById('nextChapterBtn'),
    readingModeBtn: documentRef.getElementById('readingModeBtn'),
    sceneDimmerToggleBtn: documentRef.getElementById('sceneDimmerToggleBtn'),
    skipBackBtn: documentRef.getElementById('skipBackBtn'),
    skipForwardBtn: documentRef.getElementById('skipForwardBtn'),
    startScreen: documentRef.getElementById('introStartScreen'),
    startSkipBtn: documentRef.getElementById('startSkipBtn')
  };
}

function createIntroGameState(realGameState, runtimeState) {
  const demoLoreDb = {
    [INTRO_DEMO_LORE_ID]: {
      title: INTRO_DEMO_LORE_ENTRY.title,
      duration: INTRO_DEMO_LORE_ENTRY.duration
    }
  };

  const localState = {
    intro: realGameState?.state?.intro || { completed: false, version: INTRO_VERSION, completedAt: null },
    collectedLore: [],
    collectedLights: { [INTRO_SCENE_NAME]: [] },
    chapterCollectibleTargets: { [INTRO_SCENE_NAME]: 1 },
    bookmarks: []
  };

  const proxy = Object.create(realGameState || null);
  proxy.state = localState;
  proxy.getAllLore = () => demoLoreDb;
  proxy.getLore = (id) => demoLoreDb[Math.trunc(Number(id))] || null;
  proxy.getBookmarks = () => [];
  proxy.addBookmark = async () => false;
  proxy.removeBookmark = async () => false;
  proxy.formatBookmarkTime = (seconds) => {
    if (realGameState && typeof realGameState.formatBookmarkTime === 'function') {
      return realGameState.formatBookmarkTime(seconds);
    }
    return String(seconds || 0);
  };
  proxy.isUnlocked = (id) => localState.collectedLore.includes(Math.trunc(Number(id)));
  proxy.getNextLockedLoreIdForScene = () => (runtimeState.demoOrbCollected ? null : INTRO_DEMO_LORE_ID);
  proxy.getNextLockedLoreId = () => (runtimeState.demoOrbCollected ? null : INTRO_DEMO_LORE_ID);
  proxy.isLightCollected = (_sceneName, lightId) => localState.collectedLights[INTRO_SCENE_NAME].includes(Math.trunc(Number(lightId)));
  proxy.getChapterCollectibleTarget = () => 1;
  proxy.getChapterCollectedCount = () => (runtimeState.demoOrbCollected ? 1 : 0);
  proxy.getChapterProgress = () => ({
    sceneName: INTRO_SCENE_NAME,
    chapterCode: 'intro',
    chapterTitle: 'Einfuehrung',
    collected: runtimeState.demoOrbCollected ? 1 : 0,
    total: 1
  });
  proxy.getAllChapterProgress = () => ({
    [INTRO_SCENE_NAME]: proxy.getChapterProgress(INTRO_SCENE_NAME)
  });
  proxy.collectLight = async (_sceneName, lightId) => {
    const numericLightId = Math.trunc(Number(lightId));
    if (!Number.isFinite(numericLightId)) return null;
    if (localState.collectedLights[INTRO_SCENE_NAME].includes(numericLightId)) return null;
    runtimeState.demoOrbCollected = true;
    localState.collectedLights[INTRO_SCENE_NAME] = [numericLightId];
    localState.collectedLore = [INTRO_DEMO_LORE_ID];
    globalThis.setTimeout(() => {
      if (typeof runtimeState.onOrbCollected === 'function') {
        runtimeState.onOrbCollected(numericLightId);
      }
    }, 0);
    return null;
  };
  proxy.unlockLore = async () => false;
  proxy.save = async () => undefined;
  proxy.reset = async () => undefined;
  proxy.importState = async () => false;
  proxy.exportState = () => (realGameState && typeof realGameState.exportState === 'function'
    ? realGameState.exportState()
    : JSON.stringify(localState, null, 2));
  return proxy;
}

function createAudioIconSync(refs) {
  return function syncIcons(isPlaying) {
    if (refs.iconPlay) refs.iconPlay.style.display = isPlaying ? 'none' : 'block';
    if (refs.iconPause) refs.iconPause.style.display = isPlaying ? 'block' : 'none';
  };
}

async function initIntroApp() {
  const windowRef = globalThis.window || globalThis;
  const documentRef = windowRef.document;
  const storageRef = windowRef.localStorage;
  const refs = getRefs(documentRef);
  const hooks = await waitFor(() => windowRef.GameboyIntroHooks, { label: 'intro hooks' });
  const readyPromise = waitFor(() => hooks.getGameReady && hooks.getGameReady(), {
    label: 'intro scene runtime',
    timeoutMs: 45000
  });
  const realGameStatePromise = waitFor(() => (windowRef.GameState && windowRef.GameState.state ? windowRef.GameState : null), {
    label: 'GameState init'
  });

  const storageSnapshot = captureStorage(storageRef, TRANSIENT_STORAGE_KEYS);
  const narration = createIntroNarrationAdapter();
  const focusOverlay = createInteractiveFocusOverlay({ document: documentRef });
  const interactionGate = createInteractionGate({ document: documentRef });
  const syncAudioIcons = createAudioIconSync(refs);
  const runtimeState = {
    currentTrackName: 'main',
    currentSegmentIndex: 0,
    waitingAction: null,
    waitResolver: null,
    demoOrbCollected: false,
    destroyed: false,
    lastReplayText: '',
    dynamicFocusCleanup: null,
    finalButtonVisible: false,
    layoutChosen: false,
    currentTrackEntries: {
      start: buildTrackEntries('start'),
      main: buildTrackEntries('main'),
      souvenir: buildTrackEntries('souvenir')
    }
  };

  let realGameState = null;

  const clearDynamicFocus = () => {
    if (typeof runtimeState.dynamicFocusCleanup === 'function') runtimeState.dynamicFocusCleanup();
    runtimeState.dynamicFocusCleanup = null;
  };

  const clearPresentation = () => {
    clearDynamicFocus();
    focusOverlay.clear();
    interactionGate.clear();
  };

  const setGate = (config = {}) => {
    const targets = [];
    if (config.includeAudio !== false && refs.audioToggleBtn && refs.audioPlayerUI?.style.display !== 'none') {
      targets.push(refs.audioToggleBtn);
    }
    if (Array.isArray(config.targets)) targets.push(...config.targets);
    interactionGate.setAllowed({
      targets,
      keys: Array.isArray(config.keys) ? config.keys : [],
      allowCanvas: config.allowCanvas === true,
      allowAll: config.allowAll === true
    });
  };

  const startDynamicFocus = (rectProvider) => {
    clearDynamicFocus();
    if (typeof rectProvider !== 'function') return;
    let frameId = 0;
    const tick = () => {
      if (runtimeState.destroyed) return;
      const rect = rectProvider();
      if (rect) focusOverlay.highlightRect(rect);
      frameId = windowRef.requestAnimationFrame(tick);
    };
    tick();
    runtimeState.dynamicFocusCleanup = () => windowRef.cancelAnimationFrame(frameId);
  };

  const applyFocus = (config = {}) => {
    if (typeof config.rectProvider === 'function') {
      startDynamicFocus(config.rectProvider);
      return;
    }
    clearDynamicFocus();
    const selectors = Array.isArray(config.selectors) ? config.selectors.filter(Boolean) : [];
    if (selectors.length > 0) {
      focusOverlay.highlightSelectors(selectors);
      return;
    }
    focusOverlay.clear();
  };

  const setTrack = (trackName, segmentIndex) => {
    runtimeState.currentTrackName = trackName;
    runtimeState.currentSegmentIndex = segmentIndex;
    hooks.setSubtitleTracks(runtimeState.currentTrackEntries[trackName], segmentIndex);
  };

  const resolveAction = (actionId, payload) => {
    if (runtimeState.waitingAction !== actionId || typeof runtimeState.waitResolver !== 'function') return false;
    const resolver = runtimeState.waitResolver;
    runtimeState.waitingAction = null;
    runtimeState.waitResolver = null;
    clearPresentation();
    resolver(payload);
    return true;
  };

  runtimeState.onOrbCollected = () => {
    hooks.renderArchive();
    hooks.refreshLoreProgressUi({ forceHidden: !runtimeState.finalButtonVisible });
    resolveAction('collect-orb', { loreId: INTRO_DEMO_LORE_ID });
  };

  const redirectToGame = async (markCompleted) => {
    if (runtimeState.destroyed) return;
    runtimeState.destroyed = true;
    narration.stop();
    clearPresentation();
    if (runtimeState.waitResolver) {
      const resolver = runtimeState.waitResolver;
      runtimeState.waitResolver = null;
      runtimeState.waitingAction = null;
      resolver(false);
    }
    windowRef.GameState = realGameState;
    const preservedKeys = runtimeState.layoutChosen ? new Set(['gameboy_reader_sentence_layout']) : new Set();
    restoreStorage(storageRef, storageSnapshot, preservedKeys);
    if (markCompleted && typeof realGameState.markIntroCompleted === 'function') {
      await realGameState.markIntroCompleted(INTRO_VERSION);
    }
    windowRef.location.href = INTRO_ROUTE.gameFile;
  };

  const waitForAction = (actionId, config = {}) => {
    runtimeState.waitingAction = actionId;
    applyFocus(config);
    setGate({
      includeAudio: config.includeAudio !== false,
      targets: config.targets || [],
      keys: config.keys || [],
      allowCanvas: config.allowCanvas === true
    });
    return new Promise((resolve) => {
      runtimeState.waitResolver = resolve;
    });
  };

  const speakSegment = async (trackName, segmentIndex, config = {}) => {
    if (runtimeState.destroyed) return false;
    const track = INTRO_TRACKS[trackName] || [];
    const segment = track[segmentIndex];
    if (!segment) return false;
    setTrack(trackName, segmentIndex);
    runtimeState.lastReplayText = segment.text;
    applyFocus(config);
    setGate({ includeAudio: config.includeAudio !== false, targets: config.targets || [] });
    const result = await narration.play(segment.text);
    if (!runtimeState.waitingAction) clearPresentation();
    syncAudioIcons(false);
    return result;
  };

  const replayCurrentSegment = async () => {
    if (!runtimeState.lastReplayText || runtimeState.destroyed) return;
    syncAudioIcons(false);
    await narration.play(runtimeState.lastReplayText);
    syncAudioIcons(false);
  };

  narration.onSegmentStart(() => syncAudioIcons(true));
  narration.onSegmentEnd(() => syncAudioIcons(false));

  refs.audioToggleBtn?.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (runtimeState.destroyed) return;
    if (narration.isPlaying()) {
      narration.pause();
      syncAudioIcons(false);
      return;
    }
    if (narration.isPaused()) {
      narration.resume();
      syncAudioIcons(true);
      return;
    }
    void replayCurrentSegment();
  }, true);

  [refs.skipBackBtn, refs.skipForwardBtn].forEach((button) => {
    button?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);
  });

  refs.startSkipBtn?.addEventListener('click', () => {
    void redirectToGame(false);
  });

  refs.nextChapterBtn?.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!runtimeState.finalButtonVisible) return;
    void redirectToGame(true);
  }, true);

  refs.backToChapterBtn?.addEventListener('click', (event) => {
    if (runtimeState.waitingAction !== 'back-to-chapter') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    resolveAction('back-to-chapter', true);
  }, true);

  refs.sceneDimmerToggleBtn?.addEventListener('click', (event) => {
    if (runtimeState.waitingAction !== 'dimmer-light') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    hooks.setDimmerMode('reading-clear');
    resolveAction('dimmer-light', true);
  }, true);

  refs.sceneDimmerToggleBtn?.addEventListener('click', () => {
    if (runtimeState.waitingAction === 'dimmer-dark') {
      windowRef.setTimeout(() => resolveAction('dimmer-dark', true), 0);
    }
  });

  refs.bookBtn?.addEventListener('click', () => {
    if (runtimeState.waitingAction === 'open-book') {
      windowRef.setTimeout(() => resolveAction('open-book', true), 0);
    }
  });

  refs.readingModeBtn?.addEventListener('click', () => {
    if (runtimeState.waitingAction === 'enter-explore') {
      windowRef.setTimeout(() => resolveAction('enter-explore', true), 0);
    }
  });

  refs.loreProgressHud?.addEventListener('click', () => {
    if (runtimeState.waitingAction === 'open-lore-hud') {
      windowRef.setTimeout(() => resolveAction('open-lore-hud', true), 0);
    }
  });

  documentRef.querySelectorAll('.reader-radio-option[data-layout], input[name="readerSentenceLayout"]').forEach((element) => {
    element.addEventListener('click', (event) => {
      if (runtimeState.waitingAction !== 'choose-layout') return;
      const target = event.target instanceof Element ? event.target : null;
      const option = target?.closest?.('.reader-radio-option[data-layout]') || null;
      const value = option?.dataset?.layout || target?.value;
      if (value !== 'blaettern' && value !== 'flat') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      hooks.applySentenceLayout(value);
      runtimeState.layoutChosen = true;
      resolveAction('choose-layout', value);
    }, true);
  });

  windowRef.addEventListener('beforeunload', () => {
    narration.stop();
    clearPresentation();
  });

  refs.skipBackBtn.disabled = true;
  refs.skipForwardBtn.disabled = true;
  refs.audioPlayerUI.style.display = 'none';
  refs.backToChapterBtn.classList.remove('visible');
  refs.nextChapterBtn.classList.remove('visible');
  refs.archiveModal?.classList?.remove?.('visible');
  hooks.refreshLoreProgressUi({ forceHidden: true });
  setGate({ includeAudio: false, targets: [refs.startSkipBtn] });
  syncAudioIcons(false);

  const startPromise = (async () => {
    await speakSegment('start', 0, { includeAudio: false, targets: [refs.startSkipBtn] });
    if (runtimeState.destroyed) return;
    await speakSegment('start', 1, { includeAudio: false, targets: [refs.startSkipBtn] });
    if (runtimeState.destroyed) return;
    setGate({ includeAudio: false, targets: [refs.startSkipBtn] });
  })();

  await Promise.all([startPromise, readyPromise]);
  if (runtimeState.destroyed) return;

  realGameState = await realGameStatePromise;
  windowRef.GameState = createIntroGameState(realGameState, runtimeState);

  hooks.applySentenceLayout('flat');
  hooks.hideLoadingScreenSafely('intro-ready');
  hooks.stopMainAudio();
  hooks.closeArchive();
  hooks.setDimmerMode('white-freeze');
  refs.audioPlayerUI.style.display = 'flex';
  refs.audioPlayerUI.classList.add('reading-mode');
  refs.startScreen?.classList?.add?.('is-hidden');
  documentRef.body.classList.remove('intro-ready-to-begin');
  hooks.refreshLoreProgressUi({ forceHidden: true });
  setTrack('main', 0);

  await speakSegment('main', 0);
  if (runtimeState.destroyed) return;
  await speakSegment('main', 1);
  if (runtimeState.destroyed) return;

  hooks.openArchiveSettings();
  await speakSegment('main', 2, { selectors: ['[data-loading-tutorial="layout-group"]'] });
  if (runtimeState.destroyed) return;
  await waitForAction('choose-layout', {
    targets: [
      '.reader-radio-option[data-layout="blaettern"]',
      '.reader-radio-option[data-layout="flat"]'
    ],
    selectors: ['[data-loading-tutorial="layout-group"]']
  });
  if (runtimeState.destroyed) return;

  documentRef.getElementById('archivePrimaryInhaltBtn')?.click();
  hooks.closeArchive();
  await speakSegment('main', 3, { selectors: ['#bookBtn'] });
  if (runtimeState.destroyed) return;
  await speakSegment('main', 4, { selectors: ['#bookBtn'] });
  if (runtimeState.destroyed) return;
  await waitForAction('open-book', {
    targets: ['#bookBtn'],
    selectors: ['#bookBtn']
  });
  if (runtimeState.destroyed) return;

  await speakSegment('main', 5, { selectors: ['#btnSaveData'] });
  if (runtimeState.destroyed) return;
  await speakSegment('main', 6, { selectors: ['.archive-tab[data-tab="lore"]'] });
  if (runtimeState.destroyed) return;
  await speakSegment('main', 7);
  if (runtimeState.destroyed) return;
  await speakSegment('main', 8);
  if (runtimeState.destroyed) return;

  hooks.closeArchive();
  await speakSegment('main', 9);
  if (runtimeState.destroyed) return;
  await speakSegment('main', 10, { selectors: ['#sceneDimmerToggleBtn'] });
  if (runtimeState.destroyed) return;
  await waitForAction('dimmer-dark', {
    targets: ['#sceneDimmerToggleBtn'],
    selectors: ['#sceneDimmerToggleBtn']
  });
  if (runtimeState.destroyed) return;

  await speakSegment('main', 11, { selectors: ['#sceneDimmerToggleBtn'] });
  if (runtimeState.destroyed) return;
  await waitForAction('dimmer-light', {
    targets: ['#sceneDimmerToggleBtn'],
    selectors: ['#sceneDimmerToggleBtn']
  });
  if (runtimeState.destroyed) return;

  await speakSegment('main', 12, { selectors: ['#readingModeBtn'] });
  if (runtimeState.destroyed) return;
  await waitForAction('enter-explore', {
    targets: ['#readingModeBtn'],
    selectors: ['#readingModeBtn']
  });
  if (runtimeState.destroyed) return;

  hooks.refreshLoreProgressUi({ forceHidden: true });
  await speakSegment('main', 13, { selectors: ['#readingModeBtn'], includeAudio: true });
  if (runtimeState.destroyed) return;
  await speakSegment('main', 14);
  if (runtimeState.destroyed) return;
  await speakSegment('main', 15, { rectProvider: () => hooks.getOrbHighlightRect() });
  if (runtimeState.destroyed) return;
  await waitForAction('collect-orb', {
    targets: [],
    keys: MOVE_KEYS,
    allowCanvas: true,
    rectProvider: () => hooks.getOrbHighlightRect()
  });
  if (runtimeState.destroyed) return;

  hooks.setReadingMode(true, 'intro-souvenir');
  hooks.setDimmerMode('reading-clear');
  hooks.showBackToChapter(true);
  await speakSegment('souvenir', 0);
  if (runtimeState.destroyed) return;
  await speakSegment('souvenir', 1, { selectors: ['#backToChapterBtn'] });
  if (runtimeState.destroyed) return;
  await waitForAction('back-to-chapter', {
    targets: ['#backToChapterBtn'],
    selectors: ['#backToChapterBtn']
  });
  if (runtimeState.destroyed) return;

  hooks.showBackToChapter(false);
  hooks.setReadingMode(true, 'intro-return');
  hooks.setDimmerMode('reading-clear');
  setTrack('main', 16);
  hooks.renderArchive();
  hooks.refreshLoreProgressUi({ forceVisible: true });

  await speakSegment('main', 16);
  if (runtimeState.destroyed) return;
  await speakSegment('main', 17, { selectors: ['#loreProgressHud'] });
  if (runtimeState.destroyed) return;
  await waitForAction('open-lore-hud', {
    targets: ['#loreProgressHud'],
    selectors: ['#loreProgressHud']
  });
  if (runtimeState.destroyed) return;

  hooks.renderArchive();
  await speakSegment('main', 18, { selectors: ['#loreList'] });
  if (runtimeState.destroyed) return;

  hooks.closeArchive();
  await speakSegment('main', 19);
  if (runtimeState.destroyed) return;

  runtimeState.finalButtonVisible = true;
  documentRef.body.classList.add('intro-ready-to-begin');
  hooks.showNextButton('F\u00fchrung beginnen');
  applyFocus({ selectors: ['#nextChapterBtn'] });
  setGate({ includeAudio: false, targets: ['#nextChapterBtn'] });
}

void initIntroApp();

