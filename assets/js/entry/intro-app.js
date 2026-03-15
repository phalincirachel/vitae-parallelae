import { INTRO_ROUTE, INTRO_VERSION } from '../shared/data/intro-config.js';
import {
  INTRO_DEMO_LORE_ENTRY,
  INTRO_DEMO_LORE_ID,
  INTRO_TRACKS,
  getTrackEntries
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
const INTRO_SCENE_NAME = globalThis.window?.__GAMEBOY_INTRO_BOOTSTRAP__?.level?.sceneName || 'intro_einfuehrung';
const INTRO_WEB_BYPASS_KEY = 'gameboy_intro_bypass_once';
const INTRO_LAYOUT_STEP_TARGETS = Object.freeze([
  '.reader-settings-panel .reader-radio-option',
  '.reader-settings-panel .reader-font-option',
  '#readerFontSizeRange',
  '#readerFontSizeNumber'
]);

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
  return getTrackEntries(trackName);
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
    startSkipBtn: documentRef.getElementById('startSkipBtn'),
    introAudioPrompt: documentRef.getElementById('introAudioPrompt')
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
  hooks.disableBaseChapterFlow?.();
  hooks.stopMainAudio?.();
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

  const setAudioPromptVisible = (visible) => {
    const prompt = refs.introAudioPrompt;
    if (!prompt) return;
    if (visible) {
      prompt.hidden = false;
      prompt.disabled = false;
      windowRef.requestAnimationFrame(() => prompt.classList.add('is-visible'));
      return;
    }
    prompt.classList.remove('is-visible');
    prompt.disabled = true;
    windowRef.setTimeout(() => {
      if (!prompt.classList.contains('is-visible')) prompt.hidden = true;
    }, 220);
  };
  const runtimeState = {
    currentTrackName: 'main',
    currentSegmentIndex: 0,
    waitingAction: null,
    waitResolver: null,
    demoOrbCollected: false,
    destroyed: false,
    lastReplaySegment: null,
    dynamicFocusCleanup: null,
    currentFocusConfig: null,
    currentGateConfig: null,
    autoPausedForVisibility: false,
    finalButtonVisible: false,
    layoutChosen: false,
    pendingActions: new Map(),
    currentTrackEntries: {
      start: buildTrackEntries('start'),
      main: buildTrackEntries('main'),
      souvenir: buildTrackEntries('souvenir')
    }
  };

  let realGameState = null;
  let uiRecoveryFrame = 0;
  let autoResumeTimer = 0;

  const normalizeUiConfig = (config = {}) => ({
    includeAudio: config.includeAudio !== false,
    targets: Array.isArray(config.targets) ? [...config.targets] : [],
    keys: Array.isArray(config.keys) ? [...config.keys] : [],
    selectors: Array.isArray(config.selectors) ? [...config.selectors] : [],
    allowCanvas: config.allowCanvas === true,
    allowAll: config.allowAll === true,
    rectProvider: typeof config.rectProvider === 'function' ? config.rectProvider : null
  });

  const syncNarrationActiveFlag = (isActive) => {
    windowRef.__GAMEBOY_INTRO_NARRATION_ACTIVE__ = !!isActive;
  };

  syncNarrationActiveFlag(false);

  const clearDynamicFocus = () => {
    if (typeof runtimeState.dynamicFocusCleanup === 'function') runtimeState.dynamicFocusCleanup();
    runtimeState.dynamicFocusCleanup = null;
  };

  const clearPresentation = () => {
    runtimeState.currentFocusConfig = null;
    runtimeState.currentGateConfig = null;
    clearDynamicFocus();
    focusOverlay.clear();
    interactionGate.clear();
  };

  const setGate = (config = {}) => {
    const normalizedConfig = normalizeUiConfig(config);
    runtimeState.currentGateConfig = normalizedConfig;
    const targets = [];
    if (normalizedConfig.includeAudio && refs.audioToggleBtn && refs.audioPlayerUI?.style.display !== 'none') {
      targets.push(refs.audioToggleBtn);
    }
    if (Array.isArray(normalizedConfig.targets)) targets.push(...normalizedConfig.targets);
    interactionGate.setAllowed({
      targets,
      keys: normalizedConfig.keys,
      allowCanvas: normalizedConfig.allowCanvas,
      allowAll: normalizedConfig.allowAll
    });
  };

  const startDynamicFocus = (rectProvider) => {
    clearDynamicFocus();
    if (typeof rectProvider !== 'function') return;
    let frameId = 0;
    const tick = () => {
      if (runtimeState.destroyed) return;
      focusOverlay.highlightRect(rectProvider());
      frameId = windowRef.requestAnimationFrame(tick);
    };
    tick();
    runtimeState.dynamicFocusCleanup = () => windowRef.cancelAnimationFrame(frameId);
  };

  const applyFocus = (config = {}) => {
    const normalizedConfig = normalizeUiConfig(config);
    runtimeState.currentFocusConfig = normalizedConfig;
    if (typeof normalizedConfig.rectProvider === 'function') {
      startDynamicFocus(normalizedConfig.rectProvider);
      return;
    }
    clearDynamicFocus();
    const selectors = normalizedConfig.selectors.filter(Boolean);
    if (selectors.length > 0) {
      focusOverlay.highlightSelectors(selectors);
      return;
    }
    focusOverlay.clear();
  };

  const refreshInteractiveState = (reason = 'refresh') => {
    if (runtimeState.destroyed) return;
    hooks.refreshLayout?.('intro-app:' + reason);
    hooks.forceSceneRender?.('intro-app:' + reason);
    hooks.forceControlsVisible?.();
    if (runtimeState.currentGateConfig) {
      const gateConfig = runtimeState.currentGateConfig;
      runtimeState.currentGateConfig = null;
      setGate(gateConfig);
    } else {
      interactionGate.clear();
    }
    if (runtimeState.currentFocusConfig) {
      const focusConfig = runtimeState.currentFocusConfig;
      runtimeState.currentFocusConfig = null;
      applyFocus(focusConfig);
    } else {
      clearDynamicFocus();
      focusOverlay.clear();
    }
  };

  const createFocusRect = (element, options = {}) => {
    const rect = element?.getBoundingClientRect?.();
    if (!rect || rect.width <= 0 || rect.height <= 0) return null;
    return {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      padding: options.padding,
      paddingX: options.paddingX,
      paddingY: options.paddingY,
      inset: options.inset
    };
  };

  const clearAutoResumeTimer = () => {
    if (!autoResumeTimer) return;
    windowRef.clearTimeout(autoResumeTimer);
    autoResumeTimer = 0;
  };

  const setTrack = (trackName, segmentIndex) => {
    runtimeState.currentTrackName = trackName;
    runtimeState.currentSegmentIndex = segmentIndex;
    hooks.setSubtitleTracks(runtimeState.currentTrackEntries[trackName], segmentIndex);
    hooks.refreshLayout?.('track:' + trackName + ':' + segmentIndex);
  };

  const rememberAction = (actionId, payload = true) => {
    if (!actionId) return false;
    runtimeState.pendingActions.set(actionId, payload);
    return true;
  };

  const consumePendingAction = (actionId) => {
    if (!runtimeState.pendingActions.has(actionId)) return undefined;
    const payload = runtimeState.pendingActions.get(actionId);
    runtimeState.pendingActions.delete(actionId);
    return payload;
  };

  const rememberAllowedAction = (actionId, event, payload = true) => {
    if (!event || !interactionGate.isAllowedEventTarget(event.target)) return false;
    return rememberAction(actionId, payload);
  };

  const resolveAction = (actionId, payload) => {
    if (runtimeState.waitingAction !== actionId || typeof runtimeState.waitResolver !== 'function') return false;
    const resolver = runtimeState.waitResolver;
    runtimeState.waitingAction = null;
    runtimeState.waitResolver = null;
    clearDynamicFocus();
    focusOverlay.clear();
    runtimeState.currentFocusConfig = null;
    if (!narration.isPlaying() && !narration.isPaused()) {
      clearPresentation();
    }
    resolver(payload);
    return true;
  };

  runtimeState.onOrbCollected = () => {
    clearDynamicFocus();
    focusOverlay.clear();
    runtimeState.currentFocusConfig = null;
    hooks.renderArchive();
    hooks.refreshLoreProgressUi({ forceHidden: !runtimeState.finalButtonVisible });
    resolveAction('collect-orb', { loreId: INTRO_DEMO_LORE_ID });
  };

  const redirectToGame = async (markCompleted) => {
    if (runtimeState.destroyed) return;
    runtimeState.destroyed = true;
    windowRef.cancelAnimationFrame(uiRecoveryFrame);
    narration.stop();
    syncNarrationActiveFlag(false);
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
    if (!markCompleted) {
      try {
        windowRef.sessionStorage?.setItem?.(INTRO_WEB_BYPASS_KEY, '1');
      } catch (_) {}
    }
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
      if (runtimeState.pendingActions.has(actionId)) {
        const buffered = consumePendingAction(actionId);
        windowRef.setTimeout(() => resolveAction(actionId, buffered), 0);
      }
    });
  };

  const speakSegment = async (trackName, segmentIndex, config = {}) => {
    if (runtimeState.destroyed) return false;
    const track = INTRO_TRACKS[trackName] || [];
    const segment = track[segmentIndex];
    if (!segment) return false;
    setTrack(trackName, segmentIndex);
    runtimeState.lastReplaySegment = segment;
    applyFocus(config);
    setGate({
      includeAudio: config.includeAudio !== false,
      targets: config.targets || [],
      keys: config.keys || [],
      allowCanvas: config.allowCanvas === true,
      allowAll: config.allowAll === true
    });
    const result = await narration.play(segment, { trackName, segmentIndex });
    if (!runtimeState.waitingAction) clearPresentation();
    syncNarrationActiveFlag(false);
    syncAudioIcons(false);
    scheduleUiRecovery('segment:' + trackName + ':' + segmentIndex);
    return result;
  };

  const speakCheckpointSegment = async (trackName, segmentIndex, actionId, config = {}) => {
    if (runtimeState.destroyed) return false;
    const actionPromise = waitForAction(actionId, config);
    const speechPromise = speakSegment(trackName, segmentIndex, config);
    const [, actionResult] = await Promise.all([speechPromise, actionPromise]);
    return actionResult;
  };

  const replayCurrentSegment = async () => {
    if (!runtimeState.lastReplaySegment || runtimeState.destroyed) return;
    syncNarrationActiveFlag(false);
    syncAudioIcons(false);
    await narration.play(runtimeState.lastReplaySegment, { replay: true });
    syncNarrationActiveFlag(false);
    syncAudioIcons(false);
    scheduleUiRecovery('replay');
  };

  const resumeNarrationIfNeeded = () => {
    if (!runtimeState.autoPausedForVisibility || runtimeState.destroyed) return;
    runtimeState.autoPausedForVisibility = false;
    if (!narration.isPaused()) return;
    narration.resume();
    syncAudioIcons(true);
    syncNarrationActiveFlag(true);
  };

  const scheduleAutoResume = (reason = 'focus') => {
    if (runtimeState.destroyed || !runtimeState.autoPausedForVisibility) return;
    clearAutoResumeTimer();
    autoResumeTimer = windowRef.setTimeout(() => {
      autoResumeTimer = 0;
      scheduleUiRecovery(reason);
      resumeNarrationIfNeeded();
    }, 90);
  };

  narration.onAutoplayBlocked?.(() => {
    clearAutoResumeTimer();
    setAudioPromptVisible(true);
  });

  narration.onSegmentStart(() => {
    clearAutoResumeTimer();
    setAudioPromptVisible(false);
    runtimeState.autoPausedForVisibility = false;
    syncAudioIcons(true);
    syncNarrationActiveFlag(true);
  });
  narration.onSegmentEnd(() => {
    clearAutoResumeTimer();
    setAudioPromptVisible(false);
    runtimeState.autoPausedForVisibility = false;
    syncAudioIcons(false);
    syncNarrationActiveFlag(false);
    scheduleUiRecovery('segment-end');
  });

  refs.audioToggleBtn?.addEventListener('click', (event) => {
    clearAutoResumeTimer();
    setAudioPromptVisible(false);
    event.preventDefault();
    event.stopImmediatePropagation();
    if (runtimeState.destroyed) return;
    runtimeState.autoPausedForVisibility = false;
    if (narration.isPlaying()) {
      narration.pause();
      syncNarrationActiveFlag(false);
      syncAudioIcons(false);
      return;
    }
    if (narration.isPaused()) {
      narration.resume();
      syncNarrationActiveFlag(true);
      syncAudioIcons(true);
      return;
    }
    void replayCurrentSegment();
  }, true);

  documentRef.addEventListener('visibilitychange', () => {
    if (runtimeState.destroyed) return;
    if (documentRef.hidden) {
      clearAutoResumeTimer();
      if (narration.isPlaying()) {
        runtimeState.autoPausedForVisibility = true;
        narration.pause();
        syncAudioIcons(false);
      }
      syncNarrationActiveFlag(false);
      return;
    }
    scheduleUiRecovery('visibility');
  });

  windowRef.addEventListener('focus', () => {
    scheduleAutoResume('focus');
  });
  windowRef.addEventListener('pageshow', () => {
    scheduleAutoResume('pageshow');
  });
  windowRef.addEventListener('resize', () => scheduleUiRecovery('resize'));
  windowRef.addEventListener('orientationchange', () => scheduleUiRecovery('orientationchange'));

  [refs.skipBackBtn, refs.skipForwardBtn].forEach((button) => {
    button?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);
  });

  refs.startSkipBtn?.addEventListener('click', () => {
    void redirectToGame(false);
  });

  refs.introAudioPrompt?.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    clearAutoResumeTimer();
    setAudioPromptVisible(false);
    if (runtimeState.destroyed) return;
    runtimeState.autoPausedForVisibility = false;
    narration.acknowledgeGesture?.();
  }, true);

  refs.nextChapterBtn?.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!runtimeState.finalButtonVisible) return;
    void redirectToGame(true);
  }, true);

  refs.backToChapterBtn?.addEventListener('click', (event) => {
    if (runtimeState.waitingAction === 'back-to-chapter') {
      event.preventDefault();
      event.stopImmediatePropagation();
      resolveAction('back-to-chapter', true);
      return;
    }
    rememberAllowedAction('back-to-chapter', event, true);
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

  refs.bookBtn?.addEventListener('click', (event) => {
    if (runtimeState.waitingAction === 'open-book') {
      windowRef.setTimeout(() => resolveAction('open-book', true), 0);
      return;
    }
    rememberAllowedAction('open-book', event, true);
  });

  refs.readingModeBtn?.addEventListener('click', () => {
    if (runtimeState.waitingAction === 'enter-explore') {
      windowRef.setTimeout(() => resolveAction('enter-explore', true), 0);
      return;
    }
    rememberAction('enter-explore', true);
  });

  refs.loreProgressHud?.addEventListener('click', (event) => {
    if (runtimeState.waitingAction === 'open-lore-hud') {
      windowRef.setTimeout(() => resolveAction('open-lore-hud', true), 0);
      return;
    }
    rememberAllowedAction('open-lore-hud', event, true);
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
      if (runtimeState.waitingAction === 'choose-layout') {
        resolveAction('choose-layout', value);
        return;
      }
      rememberAllowedAction('choose-layout', event, value);
    }, true);
  });

  windowRef.addEventListener('beforeunload', () => {
    windowRef.cancelAnimationFrame(uiRecoveryFrame);
    clearAutoResumeTimer();
    narration.stop();
    syncNarrationActiveFlag(false);
    clearPresentation();
  });

  refs.skipBackBtn.disabled = true;
  refs.skipForwardBtn.disabled = true;
  refs.audioPlayerUI.style.display = 'none';
  refs.backToChapterBtn.classList.remove('visible');
  refs.nextChapterBtn.classList.remove('visible');
  refs.archiveModal?.classList?.remove?.('visible');
  hooks.refreshLoreProgressUi({ forceHidden: true });
  setGate({ includeAudio: false, targets: [refs.startSkipBtn, refs.introAudioPrompt] });
  syncAudioIcons(false);
  void narration.prepare?.();
  setAudioPromptVisible(false);

  const startPromise = (async () => {
    await speakSegment('start', 0, { includeAudio: false, targets: [refs.startSkipBtn, refs.introAudioPrompt] });
    if (runtimeState.destroyed) return;
    await speakSegment('start', 1, { includeAudio: false, targets: [refs.startSkipBtn, refs.introAudioPrompt] });
    if (runtimeState.destroyed) return;
    setGate({ includeAudio: false, targets: [refs.startSkipBtn, refs.introAudioPrompt] });
  })();

  await Promise.all([startPromise, readyPromise]);
  if (runtimeState.destroyed) return;

  realGameState = await realGameStatePromise;
  windowRef.GameState = createIntroGameState(realGameState, runtimeState);

  hooks.applySentenceLayout('flat');
  hooks.stopMainAudio();
  hooks.disableAmbientDecor?.();
  hooks.forceControlsVisible?.();
  hooks.closeArchive();
  hooks.setDimmerMode('white-freeze');
  refs.audioPlayerUI.style.display = 'flex';
  hooks.forceSceneRender?.('intro-ready-prewarm');
  hooks.hideLoadingScreenSafely('intro-ready');
  hooks.setReadingMode(true, 'intro-init');
  hooks.refreshLayout?.('intro-init');
  hooks.forceSceneRender?.('intro-init');
  refs.startScreen?.classList?.add?.('is-hidden');
  documentRef.body.classList.remove('intro-ready-to-begin');
  hooks.refreshLoreProgressUi({ forceHidden: true });
  setTrack('main', 0);
  scheduleUiRecovery('intro-ready');

  await speakSegment('main', 0);
  if (runtimeState.destroyed) return;
  await speakSegment('main', 1);
  if (runtimeState.destroyed) return;

  await waitFor(() => hooks.isArchiveReady && hooks.isArchiveReady(), { label: 'archive runtime' });
  hooks.openArchiveSettings();
  hooks.forceControlsVisible?.();
  await wait(60);
  await speakCheckpointSegment('main', 2, 'choose-layout', {
    targets: INTRO_LAYOUT_STEP_TARGETS,
    selectors: ['[data-loading-tutorial="layout-group"]']
  });
  if (runtimeState.destroyed) return;

  hooks.openArchiveContentTab('kapitel');
  hooks.forceControlsVisible?.();
  await wait(40);
  hooks.closeArchive();
  await speakSegment('main', 3, {
    targets: ['#bookBtn'],
    selectors: ['#bookBtn']
  });
  if (runtimeState.destroyed) return;
  await speakCheckpointSegment('main', 4, 'open-book', {
    targets: ['#bookBtn'],
    selectors: ['#bookBtn']
  });
  if (runtimeState.destroyed) return;
  hooks.forceControlsVisible?.();

  await speakSegment('main', 5, { selectors: ['#btnSaveData'] });
  if (runtimeState.destroyed) return;
  await speakSegment('main', 6, { selectors: ['.archive-tab[data-tab="lore"]'] });
  if (runtimeState.destroyed) return;
  await speakSegment('main', 7);
  if (runtimeState.destroyed) return;
  await speakSegment('main', 8);
  if (runtimeState.destroyed) return;

  hooks.closeArchive();
  clearPresentation();
  hooks.refreshLayout?.('main-9-clear');
  scheduleUiRecovery('main-9-clear');
  await wait(120);
  clearPresentation();
  focusOverlay.clear();
  await speakSegment('main', 9, { selectors: [] });
  if (runtimeState.destroyed) return;
  await speakCheckpointSegment('main', 10, 'dimmer-dark', {
    targets: ['#sceneDimmerToggleBtn'],
    selectors: ['#sceneDimmerToggleBtn']
  });
  if (runtimeState.destroyed) return;

  await speakCheckpointSegment('main', 11, 'dimmer-light', {
    targets: ['#sceneDimmerToggleBtn'],
    selectors: ['#sceneDimmerToggleBtn']
  });
  if (runtimeState.destroyed) return;

  await speakCheckpointSegment('main', 12, 'enter-explore', {
    targets: ['#readingModeBtn'],
    selectors: ['#readingModeBtn']
  });
  if (runtimeState.destroyed) return;
  hooks.setDimmerMode('off');
  hooks.setReadingMode(false, 'intro-enter-explore', { syncDimmer: false, ignoreFrozen: true });
  hooks.setActiveSubtitleIndex?.(13);
  hooks.disableAmbientDecor?.();
  hooks.refreshLayout?.('intro-enter-explore');
  hooks.forceSceneRender?.('intro-enter-explore');
  scheduleUiRecovery('intro-enter-explore');
  windowRef.setTimeout(() => {
    if (runtimeState.destroyed) return;
    hooks.setReadingMode(false, 'intro-enter-explore-confirm', { syncDimmer: false, ignoreFrozen: true });
    hooks.refreshLayout?.('intro-enter-explore-confirm');
    hooks.forceSceneRender?.('intro-enter-explore-confirm');
    scheduleUiRecovery('intro-enter-explore-confirm');
  }, 120);
  await wait(80);

  hooks.refreshLoreProgressUi({ forceHidden: true });
  await speakSegment('main', 13, { includeAudio: true, allowCanvas: true, keys: MOVE_KEYS });
  if (runtimeState.destroyed) return;
  await speakSegment('main', 14, { includeAudio: true, allowCanvas: true, keys: MOVE_KEYS });
  if (runtimeState.destroyed) return;
  await speakCheckpointSegment('main', 15, 'collect-orb', {
    targets: [],
    keys: MOVE_KEYS,
    allowCanvas: true,
    rectProvider: () => hooks.getOrbHighlightRect()
  });
  if (runtimeState.destroyed) return;

  setTrack('souvenir', 0);
  hooks.setReadingMode(true, 'intro-souvenir');
  hooks.setDimmerMode('reading-clear');
  hooks.showBackToChapter(true);
  await speakSegment('souvenir', 0);
  if (runtimeState.destroyed) return;
  await speakCheckpointSegment('souvenir', 1, 'back-to-chapter', {
    targets: ['#backToChapterBtn'],
    rectProvider: () => createFocusRect(refs.backToChapterBtn, { paddingX: 10, paddingY: 8, inset: 6 })
  });
  if (runtimeState.destroyed) return;

  hooks.showBackToChapter(false);
  clearPresentation();
  hooks.setReadingMode(true, 'intro-return');
  hooks.setDimmerMode('reading-clear');
  setTrack('main', 16);
  hooks.renderArchive();
  hooks.refreshLoreProgressUi({ forceVisible: true });
  hooks.refreshLayout?.('intro-return-main');
  hooks.forceSceneRender?.('intro-return-main');
  scheduleUiRecovery('intro-return-main');
  await wait(80);
  clearPresentation();

  await speakSegment('main', 16, { selectors: [] });
  if (runtimeState.destroyed) return;
  await speakCheckpointSegment('main', 17, 'open-lore-hud', {
    targets: ['#loreProgressHud'],
    rectProvider: () => createFocusRect(refs.loreProgressHud, { paddingX: 8, paddingY: 6, inset: 4 })
  });
  if (runtimeState.destroyed) return;

  hooks.openArchiveLore();
  hooks.forceControlsVisible?.();
  await wait(60);
  await speakSegment('main', 18);
  if (runtimeState.destroyed) return;

  hooks.closeArchive();
  await speakSegment('main', 19);
  if (runtimeState.destroyed) return;

  runtimeState.finalButtonVisible = true;
  documentRef.body.classList.add('intro-ready-to-begin');
  hooks.showNextButton('Reise beginnen');
  hooks.refreshLayout?.('intro-finish');
  hooks.forceSceneRender?.('intro-finish');
  applyFocus({
    rectProvider: () => refs.nextChapterBtn?.getBoundingClientRect?.() || null
  });
  setGate({ includeAudio: true, targets: ['#nextChapterBtn'] });
  scheduleUiRecovery('intro-finish');
}

void initIntroApp();






