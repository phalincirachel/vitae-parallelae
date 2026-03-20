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
import defaultGameState from '../shared/state/game-state.js';

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
const INTRO_LAYOUT_GATE_TARGETS = Object.freeze([
  ...INTRO_LAYOUT_STEP_TARGETS,
  '.reader-settings-panel',
  '.reader-settings-panel *',
  '#archiveModal',
  '#archiveModal .archive-card',
  '#archiveModal .archive-card *',
  '#archivePrimarySettingsBtn',
  '#archivePrimaryInhaltBtn',
  '#closeArchiveBtn'
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
    startImage: documentRef.getElementById('introStartImage'),
    startSkipBtn: documentRef.getElementById('startSkipBtn'),
    introAudioPrompt: documentRef.getElementById('introAudioPrompt'),
    closeArchiveBtn: documentRef.getElementById('closeArchiveBtn')
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
    const playing = !!isPlaying;
    if (refs.iconPlay) refs.iconPlay.style.display = playing ? 'none' : 'block';
    if (refs.iconPause) refs.iconPause.style.display = playing ? 'block' : 'none';
    const root = (typeof window !== 'undefined') ? window : globalThis;
    if (root) root.__GAMEBOY_INTRO_UI_PLAYING__ = playing;
  };
}

function waitForStartImageReady(imageElement, timeoutMs = 4000) {
  if (!imageElement) return Promise.resolve(false);
  if (imageElement.complete && Number(imageElement.naturalWidth) > 0) {
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      globalThis.clearTimeout(timeoutId);
      imageElement.removeEventListener('load', handleLoad);
      imageElement.removeEventListener('error', handleError);
      resolve(result);
    };
    const handleLoad = () => finish(true);
    const handleError = () => finish(false);
    const timeoutId = globalThis.setTimeout(() => finish(false), Math.max(500, Number(timeoutMs) || 0));
    imageElement.addEventListener('load', handleLoad, { once: true });
    imageElement.addEventListener('error', handleError, { once: true });
    try {
      imageElement.decode?.().then(() => finish(true)).catch(() => {});
    } catch (_) {}
  });
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
  const realGameStatePromise = (async () => {
    const stateApi = defaultGameState;
    if (stateApi && typeof stateApi.init === 'function') {
      await stateApi.init();
    }
    return stateApi;
  })();

  const storageSnapshot = captureStorage(storageRef, TRANSIENT_STORAGE_KEYS);
  const narration = createIntroNarrationAdapter();
  const focusOverlay = createInteractiveFocusOverlay({ document: documentRef });
  const interactionGate = createInteractionGate({ document: documentRef });
  const syncAudioIcons = createAudioIconSync(refs);
  const safeInvoke = (label, callback) => {
    if (typeof callback !== 'function') return undefined;
    try {
      return callback();
    } catch (error) {
      console.error(`[Intro] ${label} failed`, error);
      return undefined;
    }
  };

  const setAudioPromptVisible = (visible) => {
    const prompt = refs.introAudioPrompt;
    if (!prompt) return;
    if (visible) {
      const canInteract = !!(runtimeState && (runtimeState.startRequested || runtimeState.narrationPrepared));
      prompt.hidden = false;
      prompt.disabled = !canInteract;
      prompt.setAttribute('aria-hidden', 'false');
      prompt.setAttribute('aria-disabled', canInteract ? 'false' : 'true');
      windowRef.requestAnimationFrame(() => prompt.classList.add('is-visible'));
      return;
    }
    prompt.classList.remove('is-visible');
    prompt.disabled = true;
    prompt.setAttribute('data-state', 'hidden');
    prompt.setAttribute('aria-hidden', 'true');
    prompt.removeAttribute('aria-busy');
    documentRef.body.classList.remove('intro-start-loading');
    windowRef.setTimeout(() => {
      if (!prompt.classList.contains('is-visible')) prompt.hidden = true;
    }, 220);
  };
  const setStartSkipVisible = (visible) => {
    const button = refs.startSkipBtn;
    if (!button) return;
    button.hidden = !visible;
    button.disabled = !visible;
    button.setAttribute('aria-hidden', visible ? 'false' : 'true');
  };

  const clearPotentialBlockingOverlays = () => {
    const transitionOverlay = documentRef.getElementById('transitionOverlay');
    transitionOverlay?.classList?.remove?.('active');
    const subtitleInfoOverlay = documentRef.getElementById('subtitleInfoOverlay');
    subtitleInfoOverlay?.classList?.remove?.('visible');
  };
  const hideBackToChapterPromptImmediate = () => {
    refs.backToChapterBtn?.blur?.();
    refs.backToChapterBtn?.classList?.remove?.('visible');
    refs.backToChapterBtn?.style?.removeProperty?.('--back-btn-top');
    hooks.showBackToChapter?.(false);
  };
  const runtimeState = {
    currentTrackName: 'main',
    currentSegmentIndex: 0,
    renderedTrackName: null,
    renderedTrackEntries: null,
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
    backToChapterDismissed: false,
    loreHudDismissed: false,
    loreHudArchivePreviewed: false,
    layoutChosen: false,
    layoutChoiceTouched: false,
    startSegmentStarted: false,
    startSegmentStartedAtMs: 0,
    startScreenHidden: false,
    pendingActions: new Map(),
    startRequested: false,
    startPromptState: 'idle',
    startUiReady: false,
    startImageReady: false,
    narrationPrepared: false,
    narrationPreparePending: false,
    lastPromptActivationAt: 0,
    lastPromptActivationType: '',
    lastDimmerActionAt: 0,
    lastDimmerActionId: '',
    currentTrackEntries: {
      start: buildTrackEntries('start'),
      main: buildTrackEntries('main'),
      souvenir: buildTrackEntries('souvenir')
    }
  };

  const isIOSLikeDevice = (() => {
    const nav = windowRef.navigator || {};
    const ua = String(nav.userAgent || '');
    const platform = String(nav.platform || '');
    const touchPoints = Number(nav.maxTouchPoints || 0);
    return /iPhone|iPad|iPod/i.test(ua) || (platform === 'MacIntel' && touchPoints > 1);
  })();

  const orbDirectionPointer = (() => {
    if (!documentRef?.body) return null;
    const existing = documentRef.querySelector('.intro-orb-direction-pointer');
    if (existing) return existing;
    const element = documentRef.createElement('div');
    element.className = 'intro-orb-direction-pointer';
    element.setAttribute('aria-hidden', 'true');
    documentRef.body.appendChild(element);
    return element;
  })();

  const hideOrbDirectionPointer = () => {
    if (!orbDirectionPointer) return;
    orbDirectionPointer.classList.remove('is-visible');
  };

  const showOrbDirectionPointer = (pointer = {}) => {
    if (!orbDirectionPointer) return;
    const left = Number(pointer.left);
    const top = Number(pointer.top);
    const angleDeg = Number(pointer.angleDeg);
    if (!Number.isFinite(left) || !Number.isFinite(top) || !Number.isFinite(angleDeg)) {
      hideOrbDirectionPointer();
      return;
    }
    orbDirectionPointer.style.setProperty('--intro-orb-pointer-left', String(Math.round(left)) + 'px');
    orbDirectionPointer.style.setProperty('--intro-orb-pointer-top', String(Math.round(top)) + 'px');
    orbDirectionPointer.style.setProperty('--intro-orb-pointer-angle', String(angleDeg.toFixed(2)) + 'deg');
    orbDirectionPointer.classList.add('is-visible');
  };

  let realGameState = null;
  let uiRecoveryFrame = 0;
  let autoResumeTimer = 0;
  let startPreludeTimer = 0;
  const visualViewportRef = windowRef.visualViewport || null;
  const updateIntroViewportHeight = () => {
    const fallbackHeight = Number(windowRef.innerHeight) || 0;
    const viewportHeight = Number(visualViewportRef?.height) || fallbackHeight;
    const safeHeight = Math.max(320, Math.round(viewportHeight || fallbackHeight || 0));
    if (safeHeight > 0) {
      documentRef.documentElement?.style?.setProperty?.('--intro-viewport-height', String(safeHeight) + 'px');
    }
  };
  updateIntroViewportHeight();
  const startPromptDefaultLabel = String(refs.introAudioPrompt?.textContent || '').trim() || 'Fuehrung beginnen';
  const START_PROMPT_LABELS = Object.freeze({
    idle: startPromptDefaultLabel,
    loading: 'L\u00e4dt Audio...',
    play: 'Fortsetzen',
    pause: 'Pause'
  });
  const setStartPromptState = (nextState = 'idle') => {
    const prompt = refs.introAudioPrompt;
    if (!prompt) return;
    runtimeState.startPromptState = nextState;
    const label = START_PROMPT_LABELS[nextState] || startPromptDefaultLabel;
    prompt.textContent = label;
    prompt.setAttribute('aria-label', label);
    prompt.setAttribute('data-state', nextState);
    const isLoading = nextState === 'loading' && !runtimeState.startScreenHidden;
    prompt.setAttribute('aria-busy', isLoading ? 'true' : 'false');
    documentRef.body.classList.toggle('intro-start-loading', isLoading);
  };
  const syncStartPromptInteractivity = () => {
    const prompt = refs.introAudioPrompt;
    if (!prompt || runtimeState.startScreenHidden || !runtimeState.startUiReady) return;
    const canInteract = true;
    prompt.disabled = !canInteract;
    prompt.setAttribute('aria-disabled', canInteract ? 'false' : 'true');
  };

  const revealStartUiWhenReady = () => {
    if (runtimeState.destroyed || runtimeState.startScreenHidden || runtimeState.startUiReady) return;
    runtimeState.startUiReady = true;
    refs.startScreen?.classList?.remove?.('is-preloading');
    refs.startScreen?.classList?.add?.('is-ready');
    setStartSkipVisible(true);
    setAudioPromptVisible(true);
    setStartPromptState(runtimeState.narrationPrepared ? 'idle' : 'loading');
    syncStartPromptInteractivity();
  };

  const markStartImageReady = () => {
    if (runtimeState.destroyed || runtimeState.startImageReady) return;
    runtimeState.startImageReady = true;
    refs.startScreen?.classList?.add?.('is-image-ready');
  };

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
    const active = !!isActive;
    windowRef.__GAMEBOY_INTRO_NARRATION_ACTIVE__ = active;
    windowRef.__GAMEBOY_INTRO_UI_PLAYING__ = active;
  };

  const isNarrationAwaitingGesture = () => typeof narration.isAwaitingGesture === 'function'
    && narration.isAwaitingGesture();

  const syncStartPromptState = (_reason = 'sync') => {
    if (runtimeState.destroyed || runtimeState.startScreenHidden || !runtimeState.startUiReady) return;
    setAudioPromptVisible(true);
    if (!runtimeState.startRequested && !runtimeState.narrationPrepared) {
      setStartPromptState('loading');
      syncStartPromptInteractivity();
      return;
    }
    if (narration.isPlaying()) {
      setStartPromptState('pause');
      syncStartPromptInteractivity();
      return;
    }
    if (narration.isPaused() || isNarrationAwaitingGesture()) {
      setStartPromptState('play');
      syncStartPromptInteractivity();
      return;
    }
    if (runtimeState.startRequested && !runtimeState.startSegmentStarted) {
      setStartPromptState('loading');
      syncStartPromptInteractivity();
      return;
    }
    setStartPromptState('idle');
    syncStartPromptInteractivity();
  };

  syncNarrationActiveFlag(false);
  windowRef.__GAMEBOY_INTRO_FLOW_ACTIVE__ = true;

  const clearDynamicFocus = () => {
    if (typeof runtimeState.dynamicFocusCleanup === 'function') runtimeState.dynamicFocusCleanup();
    runtimeState.dynamicFocusCleanup = null;
    hideOrbDirectionPointer();
  };
  const clearCurrentFocusVisual = () => {
    clearDynamicFocus();
    focusOverlay.clear();
    runtimeState.currentFocusConfig = null;
  };
  const dismissHighlightForAction = (actionId) => {
    if (!actionId || runtimeState.waitingAction !== actionId) return false;
    clearCurrentFocusVisual();
    return true;
  };

  const dismissBackToChapterHighlight = () => {
    runtimeState.backToChapterDismissed = true;
    clearCurrentFocusVisual();
  };

  const dismissLoreHudHighlight = () => {
    runtimeState.loreHudDismissed = true;
    clearCurrentFocusVisual();
  };

  const openLoreHudArchivePreview = () => {
    if (runtimeState.loreHudArchivePreviewed) return;
    runtimeState.loreHudArchivePreviewed = true;
    safeInvoke('openArchiveLore:preview', () => hooks.openArchiveLore());
    safeInvoke('forceControlsVisible:preview', () => hooks.forceControlsVisible?.());
    safeInvoke('refreshLayout:preview', () => hooks.refreshLayout?.('intro-open-lore-preview'));
    safeInvoke('forceSceneRender:preview', () => hooks.forceSceneRender?.('intro-open-lore-preview'));
    scheduleUiRecovery('intro-open-lore-preview');
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
    let disposed = false;
    const tick = () => {
      if (disposed || runtimeState.destroyed) return;
      focusOverlay.highlightRect(rectProvider());
      if (disposed || runtimeState.destroyed) return;
      frameId = windowRef.requestAnimationFrame(tick);
    };
    tick();
    runtimeState.dynamicFocusCleanup = () => {
      disposed = true;
      if (frameId) windowRef.cancelAnimationFrame(frameId);
    };
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
    clearPotentialBlockingOverlays();
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

  const scheduleUiRecovery = (reason = 'refresh') => {
    if (runtimeState.destroyed) return;
    if (uiRecoveryFrame) windowRef.cancelAnimationFrame(uiRecoveryFrame);
    uiRecoveryFrame = windowRef.requestAnimationFrame(() => {
      uiRecoveryFrame = 0;
      refreshInteractiveState(reason);
    });
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


  const resolveOrbFocusRect = () => {
    const hint = safeInvoke('getOrbFocusHint', () => hooks.getOrbFocusHint?.()) || null;
    if (hint && hint.mode === 'offscreen' && hint.pointer) {
      showOrbDirectionPointer(hint.pointer);
      return null;
    }
    hideOrbDirectionPointer();
    if (hint && hint.mode === 'onscreen' && hint.rect) {
      return hint.rect;
    }
    return safeInvoke('getOrbHighlightRect', () => hooks.getOrbHighlightRect?.()) || null;
  };

  const clearAutoResumeTimer = () => {
    if (!autoResumeTimer) return;
    windowRef.clearTimeout(autoResumeTimer);
    autoResumeTimer = 0;
  };

  const clearStartPreludeTimer = () => {
    if (!startPreludeTimer) return;
    windowRef.clearTimeout(startPreludeTimer);
    startPreludeTimer = 0;
  };

  const setTrack = (trackName, segmentIndex) => {
    runtimeState.currentTrackName = trackName;
    runtimeState.currentSegmentIndex = segmentIndex;
    const trackEntries = runtimeState.currentTrackEntries[trackName] || [];
    const safeIndex = Math.max(0, Math.min(Number.isFinite(Number(segmentIndex)) ? Math.trunc(Number(segmentIndex)) : 0, Math.max(0, trackEntries.length - 1)));
    const shouldReloadTrack = runtimeState.renderedTrackName !== trackName || runtimeState.renderedTrackEntries !== trackEntries;

    if (shouldReloadTrack || typeof hooks.setActiveSubtitleIndex !== 'function') {
      hooks.setSubtitleTracks(trackEntries, safeIndex);
      runtimeState.renderedTrackName = trackName;
      runtimeState.renderedTrackEntries = trackEntries;
      hooks.refreshLayout?.('track:' + trackName + ':' + safeIndex);
      return;
    }

    hooks.setActiveSubtitleIndex(safeIndex);
  };

  const syncSubtitleIndexFromNarrationTime = (reason = 'sync') => {
    if (runtimeState.destroyed) return;
    const trackEntries = runtimeState.currentTrackEntries?.[runtimeState.currentTrackName] || [];
    if (!Array.isArray(trackEntries) || trackEntries.length === 0) return;
    const currentTime = typeof narration.getCurrentTime === 'function' ? Number(narration.getCurrentTime()) : NaN;
    if (!Number.isFinite(currentTime)) return;

    let nextIndex = 0;
    for (let index = 1; index < trackEntries.length; index += 1) {
      const cueTime = Number(trackEntries[index]?.time);
      if (!Number.isFinite(cueTime) || (currentTime + 0.04) < cueTime) break;
      nextIndex = index;
    }

    if (nextIndex === runtimeState.currentSegmentIndex) return;
    runtimeState.currentSegmentIndex = nextIndex;
    safeInvoke('setActiveSubtitleIndex:sync:' + reason, () => hooks.setActiveSubtitleIndex?.(nextIndex));
    scheduleUiRecovery('subtitle-sync:' + reason);
  };

  const keepStartPromptAvailable = () => {
    if (runtimeState.destroyed || runtimeState.startScreenHidden || !runtimeState.startUiReady) return;
    syncStartPromptState('keep-available');
  };

  const normalizeLayoutChoice = (value) => {
    if (typeof value !== 'string') return '';
    const normalized = value.trim().toLowerCase();
    if (!normalized) return '';
    if (normalized === 'feed' || normalized === 'scroll' || normalized === 'schriftrolle') return 'flat';
    if (normalized === 'blattern') return 'blaettern';
    return normalized;
  };

  const readCheckedLayoutChoice = () => {
    const checkedInput = documentRef.querySelector('input[name="readerSentenceLayout"]:checked');
    return normalizeLayoutChoice(checkedInput?.value || '');
  };

  const markLayoutChoiceTouch = (eventTarget) => {
    const elementTarget = eventTarget instanceof Element
      ? eventTarget
      : (eventTarget && eventTarget.parentElement instanceof Element ? eventTarget.parentElement : null);
    if (!elementTarget) return;
    if (elementTarget.closest?.('.reader-radio-option[data-layout]')) {
      runtimeState.layoutChoiceTouched = true;
    }
  };

  const getLayoutChoiceFromTarget = (eventTarget) => {
    const elementTarget = eventTarget instanceof Element
      ? eventTarget
      : (eventTarget && eventTarget.parentElement instanceof Element ? eventTarget.parentElement : null);
    if (!elementTarget) return '';
    const option = elementTarget.closest?.('.reader-radio-option[data-layout]') || null;
    if (option?.dataset?.layout) {
      return normalizeLayoutChoice(option.dataset.layout);
    }
    const input = elementTarget.closest?.('input[name="readerSentenceLayout"]') || null;
    if (input?.value) {
      return normalizeLayoutChoice(input.value);
    }
    return '';
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
    clearCurrentFocusVisual();
    if (!narration.isPlaying() && !narration.isPaused()) {
      clearPresentation();
    }
    resolver(payload);
    return true;
  };

  const resolveOrRememberAction = (actionId, payload = true) => {
    if (!actionId) return false;
    if (resolveAction(actionId, payload)) return true;
    return rememberAction(actionId, payload);
  };

  runtimeState.onOrbCollected = () => {
    clearCurrentFocusVisual();
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
    windowRef.__GAMEBOY_INTRO_FLOW_ACTIVE__ = false;
    clearPresentation();
    documentRef.body.classList.remove('intro-layout-choice-pending');
    documentRef.body.classList.remove('intro-start-loading');
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
      targets: [...(config.targets || []), ...(config.selectors || [])],
      keys: config.keys || [],
      allowCanvas: config.allowCanvas === true,
      allowAll: config.allowAll === true
    });
    return new Promise((resolve) => {
      runtimeState.waitResolver = resolve;
      if (runtimeState.pendingActions.has(actionId)) {
        const buffered = consumePendingAction(actionId);
        windowRef.setTimeout(() => resolveAction(actionId, buffered), 0);
      }
    });
  };

  const isLayoutChoicePanelVisible = () => {
    const archiveVisible = refs.archiveModal?.classList?.contains?.('visible');
    if (!archiveVisible) return false;
    const settingsPanel = documentRef.querySelector('.archive-tab-content[data-tab="einstellungen"]');
    return !!settingsPanel?.classList?.contains?.('active');
  };

  const ensureLayoutChoicePanelVisible = async () => {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      safeInvoke('openArchiveSettings', () => hooks.openArchiveSettings());
      refs.archiveModal?.classList?.add?.('visible');
      if (!isLayoutChoicePanelVisible()) {
        documentRef.getElementById('archivePrimarySettingsBtn')?.click?.();
      }
      clearPotentialBlockingOverlays();
      hooks.forceControlsVisible?.();
      hooks.refreshLayout?.('intro-layout-open:' + attempt);
      hooks.forceSceneRender?.('intro-layout-open:' + attempt);
      scheduleUiRecovery('intro-layout-open:' + attempt);
      if (isLayoutChoicePanelVisible()) return true;
      await wait(90 + (attempt * 70));
    }
    return isLayoutChoicePanelVisible();
  };
  const playNarrationWithRecovery = async (segment, meta = {}, options = {}) => {
    const maxAttempts = Number.isFinite(options.maxAttempts)
      ? Math.max(1, Math.trunc(Number(options.maxAttempts)))
      : 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      if (runtimeState.destroyed) return false;
      const result = await narration.play(segment, meta);
      if (runtimeState.destroyed) return false;
      if (result !== false) return result;
      if (attempt >= maxAttempts) return result;
      narration.acknowledgeGesture?.();
      await wait(120);
    }
    return false;
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
      targets: [...(config.targets || []), ...(config.selectors || [])],
      keys: config.keys || [],
      allowCanvas: config.allowCanvas === true,
      allowAll: config.allowAll === true
    });
    const result = await playNarrationWithRecovery(segment, { trackName, segmentIndex }, { maxAttempts: 3 });
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

  const hasFiniteAudioRange = (segment) => Number.isFinite(segment?.audioStartSec)
    && Number.isFinite(segment?.audioEndSec)
    && Number(segment.audioEndSec) > Number(segment.audioStartSec);

  const beginBufferedActionWait = (actionId, config = {}) => {
    runtimeState.waitingAction = actionId;
    setGate({
      includeAudio: config.includeAudio !== false,
      targets: [...(config.targets || []), ...(config.selectors || [])],
      keys: config.keys || [],
      allowCanvas: config.allowCanvas === true,
      allowAll: config.allowAll === true
    });
    return new Promise((resolve) => {
      runtimeState.waitResolver = resolve;
      if (runtimeState.pendingActions.has(actionId)) {
        const buffered = consumePendingAction(actionId);
        windowRef.setTimeout(() => resolveAction(actionId, buffered), 0);
      }
    });
  };

  const buildContinuousAudioSegment = (trackName, startIndex, endIndex, leadInSec = 0.18) => {
    const track = INTRO_TRACKS[trackName] || [];
    const audioSegments = [];
    for (let index = startIndex; index <= endIndex; index += 1) {
      const segment = track[index];
      if (hasFiniteAudioRange(segment)) audioSegments.push(segment);
    }
    if (!audioSegments.length) return null;
    return {
      id: String(trackName) + '-' + String(startIndex) + '-' + String(endIndex) + '-block',
      text: track.slice(startIndex, endIndex + 1).map((segment) => segment?.text || '').join(' '),
      audioStartSec: Math.max(0, Number(audioSegments[0].audioStartSec) - Math.max(0, Number(leadInSec) || 0)),
      audioEndSec: Number(audioSegments[audioSegments.length - 1].audioEndSec),
      holdDurationMs: 0
    };
  };

  const playContinuousRange = async (trackName, startIndex, endIndex, options = {}) => {
    if (runtimeState.destroyed) return false;
    const blockSegment = buildContinuousAudioSegment(trackName, startIndex, endIndex, options.leadInSec);
    if (!blockSegment) return false;

    const trackEntries = runtimeState.currentTrackEntries[trackName] || [];
    const uiByIndex = options.uiByIndex || {};
    let activeIndex = -1;
    let activeIndexSinceMs = 0;
    let trackerTimer = 0;
    let trackerActive = true;

    const applyIndexState = (index) => {
      if (runtimeState.destroyed || index === activeIndex) return;
      activeIndex = index;
      activeIndexSinceMs = Date.now();
      safeInvoke('setActiveSubtitleIndex', () => hooks.setActiveSubtitleIndex?.(index));
      const uiConfig = uiByIndex[index] || null;
      if (!uiConfig) {
        clearPresentation();
        setGate({ includeAudio: true });
        return;
      }
      if (typeof uiConfig.onEnter === 'function') {
        safeInvoke('range-enter:' + trackName + ':' + index, uiConfig.onEnter);
      }
      if (uiConfig.clear === true) {
        clearPresentation();
        setGate({
          includeAudio: uiConfig.includeAudio !== false,
          targets: [...(uiConfig.targets || []), ...(uiConfig.selectors || [])],
          keys: uiConfig.keys || [],
          allowCanvas: uiConfig.allowCanvas === true,
          allowAll: uiConfig.allowAll === true
        });
        return;
      }
      applyFocus(uiConfig);
      setGate({
        includeAudio: uiConfig.includeAudio !== false,
        targets: [...(uiConfig.targets || []), ...(uiConfig.selectors || [])],
        keys: uiConfig.keys || [],
        allowCanvas: uiConfig.allowCanvas === true,
        allowAll: uiConfig.allowAll === true
      });
    };

    const advanceIndexState = (nextIndex, options = {}) => {
      if (!Number.isFinite(nextIndex) || runtimeState.destroyed) return;
      const forceAdvance = options.force === true;
      if (!forceAdvance && activeIndex >= startIndex && nextIndex > activeIndex) {
        const currentUiConfig = uiByIndex[activeIndex] || null;
        const minActiveMs = Number(currentUiConfig?.minActiveMs);
        if (Number.isFinite(minActiveMs) && minActiveMs > 0) {
          const elapsedMs = Math.max(0, Date.now() - activeIndexSinceMs);
          if (elapsedMs < minActiveMs) return;
        }
      }
      if (activeIndex < 0 || nextIndex <= activeIndex) {
        applyIndexState(nextIndex);
        return;
      }
      const fromIndex = Math.max(startIndex, activeIndex + 1);
      for (let index = fromIndex; index <= nextIndex; index += 1) {
        applyIndexState(index);
      }
    };

    const updateActiveIndexFromPlayback = () => {
      if (!trackerActive || runtimeState.destroyed) return;
      const currentTime = typeof narration.getCurrentTime === 'function' ? narration.getCurrentTime() : NaN;
      if (Number.isFinite(currentTime)) {
        let nextIndex = startIndex;
        for (let index = startIndex + 1; index <= endIndex; index += 1) {
          const cueTime = Number.isFinite(trackEntries[index]?.time) ? Number(trackEntries[index].time) : NaN;
          if (!Number.isFinite(cueTime) || (currentTime + 0.04) < cueTime) break;
          nextIndex = index;
        }
        advanceIndexState(nextIndex);
      }
      trackerTimer = windowRef.setTimeout(updateActiveIndexFromPlayback, narration.isPlaying() || narration.isPaused() ? 90 : 140);
    };

    setTrack(trackName, startIndex);
    runtimeState.lastReplaySegment = blockSegment;
    advanceIndexState(startIndex);
    updateActiveIndexFromPlayback();
    const result = await playNarrationWithRecovery(blockSegment, { trackName, startIndex, endIndex, range: true }, { maxAttempts: 3 });
    trackerActive = false;
    if (trackerTimer) windowRef.clearTimeout(trackerTimer);
    advanceIndexState(endIndex, { force: true });
    if (!runtimeState.waitingAction) clearPresentation();
    syncNarrationActiveFlag(false);
    syncAudioIcons(false);
    return result;
  };

  const playCheckpointRange = async (trackName, startIndex, endIndex, actionId, options = {}) => {
    if (runtimeState.destroyed) return false;
    const actionPromise = beginBufferedActionWait(actionId, options.initialGate || {});
    const playbackPromise = playContinuousRange(trackName, startIndex, endIndex, options);
    const [, actionResult] = await Promise.all([playbackPromise, actionPromise]);
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

  const ensureSceneReadyForReveal = async () => {
    await readyPromise;
    if (runtimeState.destroyed) return false;
    try {
      if (typeof hooks.ensureSceneReadyForReveal === 'function') {
        const ensured = await hooks.ensureSceneReadyForReveal({ timeoutMs: 12000 });
        if (ensured === false) return false;
      }
    } catch (error) {
      console.warn('[Intro] ensureSceneReadyForReveal hook failed', error);
    }
    const mapReady = await waitFor(
      () => runtimeState.destroyed || (typeof hooks.getGameReady === 'function' && hooks.getGameReady()),
      { timeoutMs: 14000, intervalMs: 80, label: 'intro map ready for reveal' }
    ).catch(() => false);
    if (!mapReady || runtimeState.destroyed) return false;
    hooks.refreshLayout?.('intro-reveal-ready');
    hooks.forceSceneRender?.('intro-reveal-ready');
    scheduleUiRecovery('intro-reveal-ready');
    return true;
  };

  const transitionOutOfStartScreen = (reason = 'complete') => {
    if (runtimeState.destroyed || runtimeState.startScreenHidden) return;
    runtimeState.startScreenHidden = true;
    runtimeState.startUiReady = true;
    refs.startScreen?.classList?.remove?.('is-preloading');
    refs.startScreen?.classList?.add?.('is-ready');
    clearAutoResumeTimer();
    clearStartPreludeTimer();
    setStartPromptState('idle');
    setAudioPromptVisible(false);
    realGameState = realGameState || defaultGameState;
    windowRef.GameState = createIntroGameState(realGameState, runtimeState);
    safeInvoke('applySentenceLayout', () => hooks.applySentenceLayout('flat'));
    safeInvoke('stopMainAudio', () => hooks.stopMainAudio());
    safeInvoke('disableAmbientDecor', () => hooks.disableAmbientDecor?.());
    safeInvoke('forceControlsVisible', () => hooks.forceControlsVisible?.());
    safeInvoke('closeArchive', () => hooks.closeArchive());
    safeInvoke('setDimmerMode', () => hooks.setDimmerMode('white-freeze'));
    if (refs.audioPlayerUI) refs.audioPlayerUI.style.display = 'flex';
    safeInvoke('forceSceneRender-prewarm', () => hooks.forceSceneRender?.('intro-ready-prewarm:' + reason));
    safeInvoke('hideLoadingScreenSafely', () => hooks.hideLoadingScreenSafely('intro-ready:' + reason));
    safeInvoke('setReadingMode', () => hooks.setReadingMode(true, 'intro-init'));
    safeInvoke('refreshLayout', () => hooks.refreshLayout?.('intro-init:' + reason));
    safeInvoke('forceSceneRender', () => hooks.forceSceneRender?.('intro-init:' + reason));
    refs.startScreen?.classList?.add?.('is-hidden');
    documentRef.body.classList.remove('intro-ready-to-begin');
    safeInvoke('refreshLoreProgressUi', () => hooks.refreshLoreProgressUi({ forceHidden: true }));
    setTrack('main', 0);
    startPreludeTimer = windowRef.setTimeout(() => {
      if (runtimeState.destroyed || runtimeState.currentTrackName !== 'main' || runtimeState.currentSegmentIndex !== 0) return;
      safeInvoke('setActiveSubtitleIndex', () => hooks.setActiveSubtitleIndex?.(1));
      scheduleUiRecovery('intro-prelude-main-1');
      startPreludeTimer = windowRef.setTimeout(() => {
        startPreludeTimer = 0;
        if (runtimeState.destroyed || runtimeState.currentTrackName !== 'main') return;
        safeInvoke('setActiveSubtitleIndex', () => hooks.setActiveSubtitleIndex?.(2));
        scheduleUiRecovery('intro-prelude-main-2');
      }, 3040);
    }, 4280);
    scheduleUiRecovery('intro-ready:' + reason);
  };

  const getSegmentExpectedDurationMs = (segment) => {
    if (!segment) return 0;
    if (Number.isFinite(segment.audioStartSec) && Number.isFinite(segment.audioEndSec)) {
      return Math.max(0, Math.round((Number(segment.audioEndSec) - Number(segment.audioStartSec)) * 1000));
    }
    if (Number.isFinite(segment.holdDurationMs)) return Math.max(0, Math.trunc(segment.holdDurationMs));
    return 0;
  };

  const waitForStartScreenTransitionPoint = async () => {
    const transitionPointSec = 23.58;
    const started = await waitFor(
      () => runtimeState.startSegmentStarted || runtimeState.destroyed,
      { timeoutMs: 180000, intervalMs: 50, label: 'intro start segment start' }
    ).catch(() => false);
    if (!started || runtimeState.destroyed) return false;
    await waitFor(
      () => {
        if (runtimeState.destroyed) return true;
        const currentTime = typeof narration.getCurrentTime === 'function' ? narration.getCurrentTime() : NaN;
        if (Number.isFinite(currentTime) && currentTime >= (transitionPointSec - 0.05)) return true;
        const narrationPlaying = typeof narration.isPlaying === 'function' && narration.isPlaying();
        const narrationPaused = typeof narration.isPaused === 'function' && narration.isPaused();
        return runtimeState.startSegmentStarted
          && !narrationPlaying
          && !narrationPaused
          && !isNarrationAwaitingGesture();
      },
      { timeoutMs: 180000, intervalMs: 60, label: 'intro start transition point' }
    ).catch(() => false);
    return !runtimeState.destroyed && !runtimeState.startScreenHidden
      && runtimeState.currentTrackName === 'start'
      && runtimeState.currentSegmentIndex === 0;
  };

  const waitForStartScreenDeadline = async () => {
    const startSegment = INTRO_TRACKS.start?.[0] || null;
    const durationMs = Math.max(0, getSegmentExpectedDurationMs(startSegment)) + 1800;
    const started = await waitFor(
      () => runtimeState.startSegmentStarted || runtimeState.destroyed,
      { timeoutMs: 45000, intervalMs: 50, label: 'intro start segment start' }
    ).catch(() => false);
    if (!started || runtimeState.destroyed) return false;
    const deadlineStartAt = Date.now();
    let pausedAt = 0;
    let pausedTotalMs = 0;
    await waitFor(
      () => {
        if (runtimeState.destroyed) return true;
        const narrationPaused = typeof narration.isPaused === 'function' && narration.isPaused();
        const isPausedLike = narrationPaused || isNarrationAwaitingGesture();
        if (isPausedLike) {
          if (!pausedAt) pausedAt = Date.now();
        } else if (pausedAt) {
          pausedTotalMs += Math.max(0, Date.now() - pausedAt);
          pausedAt = 0;
        }
        const activePausedMs = pausedAt ? Math.max(0, Date.now() - pausedAt) : 0;
        const activeElapsedMs = Math.max(0, Date.now() - deadlineStartAt - pausedTotalMs - activePausedMs);
        return activeElapsedMs >= durationMs;
      },
      { timeoutMs: 120000, intervalMs: 80, label: 'intro start deadline' }
    ).catch(() => false);
    return !runtimeState.destroyed && !runtimeState.startScreenHidden
      && runtimeState.currentTrackName === 'start'
      && runtimeState.currentSegmentIndex === 0;
  };

  const waitForNarrationTime = async (targetSec, label = 'intro narration time', options = {}) => {
    const target = Number(targetSec);
    if (!Number.isFinite(target)) return false;
    const timeoutMs = Number.isFinite(options.timeoutMs)
      ? Math.max(1000, Math.round(Number(options.timeoutMs)))
      : 60000;
    await waitFor(
      () => {
        if (runtimeState.destroyed) return true;
        const currentTime = typeof narration.getCurrentTime === 'function' ? narration.getCurrentTime() : NaN;
        if (Number.isFinite(currentTime) && currentTime >= (target - 0.06)) return true;
        const narrationPlaying = typeof narration.isPlaying === 'function' && narration.isPlaying();
        const narrationPaused = typeof narration.isPaused === 'function' && narration.isPaused();
        return runtimeState.startSegmentStarted
          && !narrationPlaying
          && !narrationPaused
          && !isNarrationAwaitingGesture();
      },
      { timeoutMs, intervalMs: 60, label }
    ).catch(() => false);
    return !runtimeState.destroyed;
  };

  const resumeNarrationIfNeeded = () => {
    if (!runtimeState.autoPausedForVisibility || runtimeState.destroyed) return;
    runtimeState.autoPausedForVisibility = false;
    if (!narration.isPaused()) return;
    narration.resume();
    narration.acknowledgeGesture?.();
    syncAudioIcons(true);
    syncNarrationActiveFlag(true);
  };

  const scheduleAutoResume = (reason = 'focus') => {
    if (runtimeState.destroyed || !runtimeState.autoPausedForVisibility) return;
    clearAutoResumeTimer();
    autoResumeTimer = windowRef.setTimeout(() => {
      autoResumeTimer = 0;
      syncSubtitleIndexFromNarrationTime(reason + '-pre');
      scheduleUiRecovery(reason);
      resumeNarrationIfNeeded();
      windowRef.setTimeout(() => {
        syncSubtitleIndexFromNarrationTime(reason + '-post');
      }, 120);
    }, 90);
  };

  narration.onAutoplayBlocked?.(() => {
    clearAutoResumeTimer();
    syncAudioIcons(false);
    syncNarrationActiveFlag(false);
    if (!runtimeState.startScreenHidden) {
      syncStartPromptState('autoplay-blocked');
      return;
    }
    hooks.forceControlsVisible?.();
    scheduleUiRecovery('autoplay-blocked');
  });

  narration.onSegmentStart(() => {
    if (runtimeState.currentTrackName === 'start' && runtimeState.currentSegmentIndex === 0) {
      runtimeState.startSegmentStarted = true;
      if (!runtimeState.startSegmentStartedAtMs) runtimeState.startSegmentStartedAtMs = Date.now();
    }
    clearAutoResumeTimer();
    if (!runtimeState.startScreenHidden && runtimeState.startUiReady) {
      syncStartPromptState('segment-start');
    } else {
      setAudioPromptVisible(false);
    }
    runtimeState.autoPausedForVisibility = false;
    syncAudioIcons(true);
    syncNarrationActiveFlag(true);
  });
  narration.onSegmentEnd(() => {
    clearAutoResumeTimer();
    if (!runtimeState.startScreenHidden && runtimeState.startUiReady) {
      syncStartPromptState('segment-end');
    } else {
      setAudioPromptVisible(false);
    }
    runtimeState.autoPausedForVisibility = false;
    syncAudioIcons(narration.isPlaying());
    syncNarrationActiveFlag(narration.isPlaying());
    scheduleUiRecovery('segment-end');
  });

  refs.audioToggleBtn?.addEventListener('click', (event) => {
    clearAutoResumeTimer();
    setAudioPromptVisible(false);
    event.preventDefault();
    event.stopImmediatePropagation();
    if (runtimeState.destroyed) return;
    runtimeState.autoPausedForVisibility = false;
    if (typeof narration.isAwaitingGesture === 'function' && narration.isAwaitingGesture()) {
      narration.acknowledgeGesture?.();
      return;
    }
    if (narration.isPlaying()) {
      narration.pause();
      syncNarrationActiveFlag(false);
      syncAudioIcons(false);
      return;
    }
    if (narration.isPaused()) {
      narration.resume();
      narration.acknowledgeGesture?.();
      syncNarrationActiveFlag(true);
      syncAudioIcons(true);
      return;
    }
    if (isIOSLikeDevice) narration.primeFromGesture?.();
    narration.acknowledgeGesture?.();
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
    keepStartPromptAvailable();
    syncSubtitleIndexFromNarrationTime('visibility');
    scheduleUiRecovery('visibility');
  });

  windowRef.addEventListener('focus', () => {
    keepStartPromptAvailable();
    syncSubtitleIndexFromNarrationTime('focus');
    scheduleAutoResume('focus');
  });
  windowRef.addEventListener('pageshow', () => {
    keepStartPromptAvailable();
    syncSubtitleIndexFromNarrationTime('pageshow');
    scheduleAutoResume('pageshow');
  });
  const handleViewportChange = (reason) => {
    updateIntroViewportHeight();
    scheduleUiRecovery(reason);
  };
  windowRef.addEventListener('resize', () => handleViewportChange('resize'));
  windowRef.addEventListener('orientationchange', () => handleViewportChange('orientationchange'));
  visualViewportRef?.addEventListener?.('resize', () => handleViewportChange('visualViewport-resize'));
  visualViewportRef?.addEventListener?.('scroll', () => handleViewportChange('visualViewport-scroll'));

  [refs.skipBackBtn, refs.skipForwardBtn].forEach((button) => {
    button?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);
  });

  refs.startSkipBtn?.addEventListener('click', () => {
    void redirectToGame(false);
  });

  let resolveStartRequest = null;
  const startRequestPromise = new Promise((resolve) => {
    resolveStartRequest = resolve;
  });

  const requestIntroStart = () => {
    if (runtimeState.destroyed || runtimeState.startScreenHidden || !runtimeState.startUiReady) return false;
    if (!runtimeState.startRequested) {
      runtimeState.startRequested = true;
      resolveStartRequest?.(true);
      resolveStartRequest = null;
    }
    if (isIOSLikeDevice) narration.primeFromGesture?.();
    narration.acknowledgeGesture?.();
    if (!runtimeState.narrationPrepared) {
      void Promise.resolve(narration.prepare?.()).then((ready) => {
        runtimeState.narrationPrepared = runtimeState.narrationPrepared || !!ready;
        if (!runtimeState.destroyed && !runtimeState.startScreenHidden && runtimeState.startUiReady) {
          syncStartPromptState('request-before-ready');
        }
      }).catch(() => {});
    }
    syncStartPromptState('request-start');
    return true;
  };

  const handleIntroAudioPromptActivation = (event) => {
    const eventType = event?.type || '';
    const isKeyboardEvent = eventType === 'keydown';
    const key = isKeyboardEvent ? event.key : '';
    if (eventType === 'pointerdown' && Number.isFinite(event?.button) && Number(event.button) !== 0) return;
    if (isKeyboardEvent && key !== 'Enter' && key !== ' ') return;
    if (!isKeyboardEvent) {
      const now = Date.now();
      const lastType = String(runtimeState.lastPromptActivationType || '');
      const deltaMs = now - runtimeState.lastPromptActivationAt;
      const isSyntheticClickAfterTouch = eventType === 'click'
        && (lastType === 'pointerdown' || lastType === 'touchstart' || lastType === 'touchend');
      const minGapMs = isSyntheticClickAfterTouch ? 700 : 240;
      if (deltaMs < minGapMs) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      runtimeState.lastPromptActivationAt = now;
      runtimeState.lastPromptActivationType = eventType;
    }
    if (!runtimeState.startUiReady) return;
    if (refs.introAudioPrompt?.disabled) return;
    clearAutoResumeTimer();
    if (runtimeState.destroyed) return;
    runtimeState.autoPausedForVisibility = false;
    if (!runtimeState.startRequested) {
      requestIntroStart();
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if (isNarrationAwaitingGesture()) {
      narration.acknowledgeGesture?.();
      syncStartPromptState('awaiting-gesture');
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if (narration.isPlaying()) {
      narration.pause();
      syncNarrationActiveFlag(false);
      syncAudioIcons(false);
      syncStartPromptState('prompt-pause');
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if (narration.isPaused()) {
      narration.resume();
      narration.acknowledgeGesture?.();
      syncNarrationActiveFlag(true);
      syncAudioIcons(true);
      syncStartPromptState('prompt-resume');
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    requestIntroStart();
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  const promptActivationEvents = windowRef.PointerEvent
    ? ['pointerdown', 'keydown']
    : ['touchend', 'click', 'keydown'];
  promptActivationEvents.forEach((eventName) => {
    refs.introAudioPrompt?.addEventListener(eventName, handleIntroAudioPromptActivation, true);
  });

  const narrationGestureBridgeEvents = ['pointerdown', 'touchstart', 'touchend', 'click', 'keydown'];
  const bridgeNarrationGesture = () => {
    if (runtimeState.destroyed) return;
    if (!isNarrationAwaitingGesture()) return;
    narration.acknowledgeGesture?.();
  };
  narrationGestureBridgeEvents.forEach((eventName) => {
    windowRef.addEventListener(eventName, bridgeNarrationGesture, true);
  });

  refs.nextChapterBtn?.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!runtimeState.finalButtonVisible) return;
    void redirectToGame(true);
  }, true);

  const onBackToChapterPressStart = () => {
    if (runtimeState.waitingAction !== 'back-to-chapter') return;
    dismissBackToChapterHighlight();
  };

  refs.backToChapterBtn?.addEventListener('pointerdown', onBackToChapterPressStart, true);
  refs.backToChapterBtn?.addEventListener('touchstart', onBackToChapterPressStart, { capture: true, passive: true });

  refs.backToChapterBtn?.addEventListener('click', (event) => {
    if (runtimeState.waitingAction === 'back-to-chapter') {
      event.preventDefault();
      event.stopImmediatePropagation();
      dismissBackToChapterHighlight();
      hideBackToChapterPromptImmediate();
      clearPresentation();
      resolveOrRememberAction('back-to-chapter', true);
      return;
    }
    // Do not buffer: this checkpoint must be completed while it is active.
  }, true);
  const resolveDimmerTutorialAction = (actionId, event = null) => {
    if (runtimeState.waitingAction !== actionId) return false;
    const now = Date.now();
    if ((now - Number(runtimeState.lastDimmerActionAt || 0)) < 420) return false;
    event?.preventDefault?.();
    event?.stopImmediatePropagation?.();
    if (actionId === 'dimmer-light') {
      hooks.setDimmerMode('reading-half');
      hooks.setReadingMode(true, 'intro-manual-dimmer-light', { syncDimmer: false, ignoreFrozen: true });
      hooks.refreshLayout?.('intro-manual-dimmer-light');
      hooks.forceSceneRender?.('intro-manual-dimmer-light');
      scheduleUiRecovery('intro-manual-dimmer-light');
    } else if (actionId === 'dimmer-dark') {
      hooks.setDimmerMode('black-freeze');
      hooks.setReadingMode(true, 'intro-manual-dimmer-dark', { syncDimmer: false, ignoreFrozen: true });
      hooks.refreshLayout?.('intro-manual-dimmer-dark');
      hooks.forceSceneRender?.('intro-manual-dimmer-dark');
      scheduleUiRecovery('intro-manual-dimmer-dark');
    } else {
      return false;
    }
    dismissHighlightForAction(actionId);
    runtimeState.lastDimmerActionAt = now;
    runtimeState.lastDimmerActionId = actionId;
    resolveOrRememberAction(actionId, true);
    return true;
  };

  const onDimmerPressStart = (event) => {
    if (runtimeState.waitingAction !== 'dimmer-dark' && runtimeState.waitingAction !== 'dimmer-light') return;
    clearCurrentFocusVisual();
    resolveDimmerTutorialAction(runtimeState.waitingAction, event);
  };
  refs.sceneDimmerToggleBtn?.addEventListener('pointerdown', onDimmerPressStart, true);
  refs.sceneDimmerToggleBtn?.addEventListener('touchstart', onDimmerPressStart, { capture: true, passive: false });
  refs.sceneDimmerToggleBtn?.addEventListener('click', (event) => {
    if (resolveDimmerTutorialAction('dimmer-light', event)) return;
    resolveDimmerTutorialAction('dimmer-dark', event);
  }, true);
  const onBookPressStart = () => {
    dismissHighlightForAction('open-book');
  };
  refs.bookBtn?.addEventListener('pointerdown', onBookPressStart, true);
  refs.bookBtn?.addEventListener('touchstart', onBookPressStart, { capture: true, passive: true });
  refs.bookBtn?.addEventListener('click', (event) => {
    if (runtimeState.waitingAction === 'open-book') {
      dismissHighlightForAction('open-book');
      resolveOrRememberAction('open-book', true);
      return;
    }
    // Do not buffer: this checkpoint must be completed while it is active.
  }, true);
  const onReadingModePressStart = () => {
    dismissHighlightForAction('enter-explore');
  };
  refs.readingModeBtn?.addEventListener('pointerdown', onReadingModePressStart, true);
  refs.readingModeBtn?.addEventListener('touchstart', onReadingModePressStart, { capture: true, passive: true });
  refs.readingModeBtn?.addEventListener('click', (event) => {
    if (runtimeState.waitingAction === 'enter-explore') {
      event.preventDefault();
      event.stopImmediatePropagation();
      hooks.setDimmerMode('off');
      hooks.setReadingMode(false, 'intro-manual-enter-explore', { syncDimmer: false, ignoreFrozen: true });
      hooks.refreshLayout?.('intro-manual-enter-explore');
      hooks.forceSceneRender?.('intro-manual-enter-explore');
      scheduleUiRecovery('intro-manual-enter-explore');
      dismissHighlightForAction('enter-explore');
      resolveOrRememberAction('enter-explore', true);
      setGate({ includeAudio: true, allowCanvas: true, keys: MOVE_KEYS, targets: ['#sceneDimmerToggleBtn', '#readingModeBtn'] });
      return;
    }
    // Do not buffer this action outside its checkpoint to avoid unintended auto-advance.
  }, true);

  const onLoreHudPressStart = () => {
    if (runtimeState.waitingAction !== 'open-lore-hud') return;
    dismissLoreHudHighlight();
  };

  refs.loreProgressHud?.addEventListener('pointerdown', onLoreHudPressStart, true);
  refs.loreProgressHud?.addEventListener('touchstart', onLoreHudPressStart, { capture: true, passive: true });

  refs.loreProgressHud?.addEventListener('click', (event) => {
    if (runtimeState.waitingAction === 'open-lore-hud') {
      event.preventDefault();
      event.stopImmediatePropagation();
      dismissLoreHudHighlight();
      openLoreHudArchivePreview();
      resolveOrRememberAction('open-lore-hud', true);
      return;
    }
    // Do not buffer: this checkpoint must be completed while it is active.
  }, true);

  const triggerLayoutChoice = (value, source) => {
    if (value !== 'blaettern' && value !== 'flat') return;
    if (runtimeState.layoutChosen) return;
    documentRef.body.classList.remove('intro-layout-choice-pending');
    documentRef.body.classList.remove('intro-start-loading');
    console.log('[Intro] layout choice:', value, 'via', source);
    safeInvoke('applySentenceLayout', () => hooks.applySentenceLayout(value));
    runtimeState.layoutChosen = true;
    if (typeof layoutChoiceConfirmedResolver === 'function') {
      const resolver = layoutChoiceConfirmedResolver;
      layoutChoiceConfirmedResolver = null;
      resolver(value);
    }
    if (runtimeState.waitingAction === 'choose-layout') {
      resolveOrRememberAction('choose-layout', value);
      return;
    }
    if (documentRef.body?.classList?.contains?.('intro-layout-choice-pending')) {
      rememberAction('choose-layout', value);
    }
  };

  const handleLayoutChoiceEvent = (event) => {
    if (!event?.isTrusted) return;
    const value = getLayoutChoiceFromTarget(event.target);
    if (!value) return;
    markLayoutChoiceTouch(event.target);
    triggerLayoutChoice(value, event.type);
  };

  documentRef.addEventListener('click', handleLayoutChoiceEvent, true);
  documentRef.addEventListener('change', handleLayoutChoiceEvent, true);

  const layoutOptionLabels = documentRef.querySelectorAll('.reader-radio-option[data-layout]');
  layoutOptionLabels.forEach((label) => {
    const handleDirectTouch = (event) => {
      if (!event?.isTrusted) return;
      markLayoutChoiceTouch(label);
      const layout = label.dataset?.layout;
      const value = normalizeLayoutChoice(layout || '');
      if (!value) return;
      const input = label.querySelector('input[name="readerSentenceLayout"]');
      if (input && !input.checked) input.checked = true;
      triggerLayoutChoice(value, 'direct-touch:' + event.type);
    };
    label.addEventListener('click', handleDirectTouch, { passive: true });
    label.addEventListener('touchend', handleDirectTouch, { passive: true });
  });

  refs.closeArchiveBtn?.addEventListener('click', () => {
    if (runtimeState.waitingAction !== 'choose-layout') return;
    const fallbackLayout = readCheckedLayoutChoice() || 'flat';
    triggerLayoutChoice(fallbackLayout, 'manual-close');
  }, true);

  windowRef.addEventListener('beforeunload', () => {
    windowRef.cancelAnimationFrame(uiRecoveryFrame);
    clearAutoResumeTimer();
    clearStartPreludeTimer();
    narrationGestureBridgeEvents.forEach((eventName) => {
      windowRef.removeEventListener(eventName, bridgeNarrationGesture, true);
    });
    narration.stop();
    syncNarrationActiveFlag(false);
    windowRef.__GAMEBOY_INTRO_FLOW_ACTIVE__ = false;
    clearPresentation();
    documentRef.body.classList.remove('intro-layout-choice-pending');
    documentRef.body.classList.remove('intro-start-loading');
  });

  refs.skipBackBtn.disabled = true;
  refs.skipForwardBtn.disabled = true;
  refs.audioPlayerUI.style.display = 'none';
  refs.backToChapterBtn.classList.remove('visible');
  refs.nextChapterBtn.classList.remove('visible');
  refs.archiveModal?.classList?.remove?.('visible');
  hooks.refreshLoreProgressUi({ forceVisible: true });
  setGate({ includeAudio: false, targets: [refs.startSkipBtn, refs.introAudioPrompt] });
  syncAudioIcons(false);
  refs.startScreen?.classList?.add?.('is-preloading');
  refs.startScreen?.classList?.remove?.('is-ready');
  refs.startScreen?.classList?.remove?.('is-image-ready');
  setStartSkipVisible(false);
  setAudioPromptVisible(false);
  setStartPromptState('idle');

  runtimeState.narrationPreparePending = true;
  const narrationPreparePromise = Promise.resolve(narration.prepare?.())
    .then((ready) => {
      runtimeState.narrationPrepared = !!ready;
      return runtimeState.narrationPrepared;
    })
    .catch(() => {
      runtimeState.narrationPrepared = false;
      return false;
    })
    .finally(() => {
      runtimeState.narrationPreparePending = false;
      if (!runtimeState.destroyed && !runtimeState.startScreenHidden && runtimeState.startUiReady) {
        syncStartPromptState('narration-prepare-settled');
      }
    });
  if (refs.startImage?.complete && Number(refs.startImage.naturalWidth) > 0) {
    markStartImageReady();
  } else {
    refs.startImage?.addEventListener?.('load', markStartImageReady, { once: true });
  }
  const startImageReadyPromise = waitForStartImageReady(refs.startImage, 12000)
    .then((imageReady) => {
      if (imageReady) markStartImageReady();
      return imageReady;
    })
    .catch(() => false);
  const startUiReadyPromise = (async () => {
    await wait(260);
    await Promise.race([
      Promise.race([startImageReadyPromise, wait(8000)]),
      wait(9000)
    ]);
    if (runtimeState.destroyed || runtimeState.startScreenHidden) return false;
    revealStartUiWhenReady();
    syncStartPromptState('start-ui-revealed');
    return runtimeState.startImageReady;
  })();

  const startPromise = (async () => {
    await startUiReadyPromise;
    await startRequestPromise;
    if (runtimeState.destroyed) return false;
    syncStartPromptState('start-requested');
    let startResult = false;
    while (!runtimeState.destroyed && !runtimeState.startScreenHidden && startResult === false) {
      startResult = await speakSegment('start', 0, { includeAudio: false, targets: [refs.startSkipBtn, refs.introAudioPrompt] });
      if (startResult === false) {
        narration.acknowledgeGesture?.();
        syncStartPromptState('start-retry');
        await wait(180);
      }
    }
    if (runtimeState.destroyed) return false;
    if (!runtimeState.startScreenHidden && !runtimeState.waitingAction) {
      setGate({ includeAudio: false, targets: [refs.startSkipBtn, refs.introAudioPrompt] });
      syncStartPromptState('start-segment-ended');
    }
    return startResult;
  })();

  void realGameStatePromise.then((resolvedState) => {
    if (runtimeState.destroyed) return;
    realGameState = resolvedState || defaultGameState;
    windowRef.GameState = createIntroGameState(realGameState, runtimeState);
  }).catch((error) => {
    console.error('[Intro] realGameState init failed', error);
    realGameState = defaultGameState;
    safeInvoke('ensureStateShape', () => realGameState?._ensureStateShape?.());
    windowRef.GameState = createIntroGameState(realGameState, runtimeState);
  });

  const startLayoutActionPromise = (async () => {
    const shouldTransition = await waitForStartScreenTransitionPoint();
    if (runtimeState.destroyed) return false;
    if (!shouldTransition && !runtimeState.startScreenHidden) return false;
    if (!runtimeState.startScreenHidden) {
      transitionOutOfStartScreen('layout-ready');
    }
    await waitFor(
      () => runtimeState.startScreenHidden || runtimeState.destroyed,
      { timeoutMs: 15000, intervalMs: 60, label: 'intro start screen hidden' }
    ).catch(() => false);
    if (runtimeState.destroyed || !runtimeState.startScreenHidden) return false;
    await waitFor(() => hooks.isArchiveReady && hooks.isArchiveReady(), { label: 'archive runtime' });
    if (runtimeState.destroyed) return false;
    const layoutPromptOpenSec = 30.9;
    await waitForNarrationTime(layoutPromptOpenSec, 'intro layout prompt open', { timeoutMs: 50000 });
    if (runtimeState.destroyed) return false;
    runtimeState.layoutChoiceTouched = false;
    documentRef.body.classList.add('intro-layout-choice-pending');
    const archiveReady = await ensureLayoutChoicePanelVisible();
    if (!archiveReady) {
      console.warn('[Intro] layout settings panel did not become visible reliably');
    }
    const actionPromise = waitForAction('choose-layout', {
      targets: [...INTRO_LAYOUT_GATE_TARGETS]
    });
    const layoutSentenceEndSec = 41.72;
    await waitForNarrationTime(layoutSentenceEndSec, 'intro layout sentence end', {
      timeoutMs: 50000
    });

    await waitFor(
      () => {
        if (runtimeState.destroyed) return true;
        const narrationPlaying = typeof narration.isPlaying === 'function' && narration.isPlaying();
        const narrationPaused = typeof narration.isPaused === 'function' && narration.isPaused();
        return !narrationPlaying && !narrationPaused && !isNarrationAwaitingGesture();
      },
      { timeoutMs: 3200, intervalMs: 60, label: 'intro layout segment completion' }
    ).catch(() => false);


    const choice = await actionPromise;
    return choice;
  })();

  const startFlowResult = await Promise.race([
    startPromise.then((startResult) => (startResult === false ? 'start-failed' : 'ended')),
    waitForStartScreenTransitionPoint().then((shouldTransition) => {
      if (!shouldTransition) return 'transition-idle';
      transitionOutOfStartScreen('timed');
      return 'transitioned';
    })
  ]);
  if (startFlowResult === 'ended') {
    transitionOutOfStartScreen('ended');
  } else if (startFlowResult === 'start-failed' && !runtimeState.startScreenHidden) {
    syncStartPromptState('start-failed');
  }
  if (!runtimeState.startScreenHidden) {
    const shouldTransition = await waitForStartScreenTransitionPoint();
    if (shouldTransition) transitionOutOfStartScreen('timed-late');
  }
  if (!runtimeState.startScreenHidden) return;

  const layoutChoice = await startLayoutActionPromise;
  if (runtimeState.destroyed) return;
  if (layoutChoice === false) return;

  hooks.openArchiveContentTab('kapitel');
  hooks.forceControlsVisible?.();
  await wait(40);
  clearPotentialBlockingOverlays();
  hooks.closeArchive();
  await playCheckpointRange('main', 3, 4, 'open-book', {
    uiByIndex: {
      3: { clear: true },
      4: {
        targets: ['#bookBtn'],
        selectors: ['#bookBtn']
      }
    }
  });
  if (runtimeState.destroyed) return;
  hooks.forceControlsVisible?.();

  await playContinuousRange('main', 5, 9, {
    leadInSec: 0,
    uiByIndex: {
      5: {
        clear: true,
        minActiveMs: 1400
      },
      6: {
        selectors: ['.archive-tab[data-tab="lore"]'],
        allowAll: true
      },
      7: {
        clear: true,
        allowAll: true,
        onEnter: () => {
          clearPresentation();
          scheduleUiRecovery('main-7-clear-hard');
        }
      },
      8: {
        clear: true,
        allowAll: true,
        onEnter: () => {
          clearPresentation();
          scheduleUiRecovery('main-8-clear-hard');
        }
      },
      9: {
        clear: true,
        allowAll: true,
        onEnter: () => {
          hooks.closeArchive();
          hooks.refreshLayout?.('main-9-clear');
          hooks.forceSceneRender?.('main-9-clear');
          hooks.forceControlsVisible?.();
        }
      }
    }
  });
  if (runtimeState.destroyed) return;

  await speakCheckpointSegment('main', 10, 'dimmer-dark', {
    targets: ['#sceneDimmerToggleBtn'],
    selectors: ['#sceneDimmerToggleBtn'],
    allowAll: true
  });
  if (runtimeState.destroyed) return;
  hooks.setDimmerMode('black-freeze');
  hooks.setReadingMode(true, 'intro-auto-dimmer-dark', { syncDimmer: false, ignoreFrozen: true });
  hooks.refreshLayout?.('intro-auto-dimmer-dark');
  hooks.forceSceneRender?.('intro-auto-dimmer-dark');
  scheduleUiRecovery('intro-auto-dimmer-dark');

  if (!(await ensureSceneReadyForReveal())) return;

  await speakCheckpointSegment('main', 11, 'dimmer-light', {
    targets: ['#sceneDimmerToggleBtn'],
    selectors: ['#sceneDimmerToggleBtn'],
    allowAll: true
  });
  if (runtimeState.destroyed) return;
  hooks.setDimmerMode('reading-half');
  hooks.setReadingMode(true, 'intro-auto-dimmer-light', { syncDimmer: false, ignoreFrozen: true });
  hooks.refreshLayout?.('intro-auto-dimmer-light');
  hooks.forceSceneRender?.('intro-auto-dimmer-light');
  scheduleUiRecovery('intro-auto-dimmer-light');
  clearPresentation();

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

  hooks.refreshLoreProgressUi({ forceVisible: true });
  hooks.setIntroOrbState?.({ revealEnabled: false, collectEnabled: false, targetLightId: null });
  await playCheckpointRange('main', 13, 15, 'collect-orb', {
    initialGate: { includeAudio: true, allowCanvas: true, keys: MOVE_KEYS },
    uiByIndex: {
      13: { clear: true, allowCanvas: true, keys: MOVE_KEYS },
      14: { clear: true, allowCanvas: true, keys: MOVE_KEYS },
      15: {
        targets: [],
        keys: MOVE_KEYS,
        allowCanvas: true,
        onEnter: () => {
          hooks.setIntroOrbState?.({ revealEnabled: true, collectEnabled: true, targetLightId: 'auto' });
          hooks.refreshLayout?.('intro-orb-armed');
          hooks.forceSceneRender?.('intro-orb-armed');
        },
        rectProvider: () => resolveOrbFocusRect()
      }
    }
  });
  if (runtimeState.destroyed) return;
  hooks.setIntroOrbState?.({ collectEnabled: false });

  setTrack('souvenir', 0);
  hooks.setReadingMode(true, 'intro-souvenir');
  hooks.setDimmerMode('reading-clear');
  runtimeState.backToChapterDismissed = false;
  hooks.showBackToChapter(true);
  const backToChapterActionPromise = beginBufferedActionWait('back-to-chapter', {});
  const backToChapterPlaybackPromise = playContinuousRange('souvenir', 0, 1, {
    uiByIndex: {
      0: { clear: true },
      1: {
        targets: ['#backToChapterBtn'],
        rectProvider: () => ((runtimeState.waitingAction === 'back-to-chapter' && runtimeState.currentTrackName === 'souvenir' && !runtimeState.backToChapterDismissed) ? createFocusRect(refs.backToChapterBtn, { paddingX: 10, paddingY: 8, inset: 6 }) : null)
      }
    }
  });
  await backToChapterPlaybackPromise;
  if (runtimeState.destroyed) return;
  if (runtimeState.waitingAction === 'back-to-chapter') {
    await wait(5000);
    if (!runtimeState.destroyed && runtimeState.waitingAction === 'back-to-chapter') {
      dismissBackToChapterHighlight();
      hideBackToChapterPromptImmediate();
      clearPresentation();
      resolveOrRememberAction('back-to-chapter', true);
    }
  }
  await backToChapterActionPromise;
  if (runtimeState.destroyed) return;

  hideBackToChapterPromptImmediate();
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

  runtimeState.loreHudDismissed = false;
  runtimeState.loreHudArchivePreviewed = false;
  await playCheckpointRange('main', 16, 17, 'open-lore-hud', {
    uiByIndex: {
      16: {
        clear: true,
        onEnter: () => {
          hideBackToChapterPromptImmediate();
          clearPresentation();
          scheduleUiRecovery('main-16-clear-hard');
        }
      },
      17: {
        targets: ['#loreProgressHud'],
        rectProvider: () => ((runtimeState.waitingAction === 'open-lore-hud' && runtimeState.currentTrackName === 'main' && !runtimeState.loreHudDismissed) ? createFocusRect(refs.loreProgressHud, { paddingX: 8, paddingY: 6, inset: 4 }) : null)
      }
    }
  });
  if (runtimeState.destroyed) return;

  clearPresentation();
  if (!runtimeState.loreHudArchivePreviewed) {
    hooks.openArchiveLore();
  }
  hooks.forceControlsVisible?.();
  await wait(60);
  await playContinuousRange('main', 18, 19, {
    uiByIndex: {
      18: { clear: true },
      19: { clear: true }
    }
  });
  if (runtimeState.destroyed) return;
  hooks.closeArchive();
  clearPotentialBlockingOverlays();
  clearPresentation();
  await wait(40);

  runtimeState.finalButtonVisible = true;
  documentRef.body.classList.add('intro-ready-to-begin');
  hooks.showNextButton('Reise beginnen');
  hooks.refreshLayout?.('intro-finish');
  hooks.forceSceneRender?.('intro-finish');
  windowRef.requestAnimationFrame(() => {
    if (runtimeState.destroyed || !runtimeState.finalButtonVisible) return;
    if (runtimeState.waitingAction) return;
    applyFocus({ selectors: ['#nextChapterBtn'] });
  });
  setGate({ includeAudio: true, targets: ['#nextChapterBtn'] });
  scheduleUiRecovery('intro-finish');
}

void initIntroApp().catch((error) => {
  console.error('[Intro] init failed', error);
});
