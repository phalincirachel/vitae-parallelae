import { INTRO_STEP_SCHEMA, INTRO_TRACKS } from './intro-script.js';

const MOVE_KEYS = Object.freeze([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'w', 'a', 's', 'd', 'W', 'A', 'S', 'D'
]);

export function createIntroController(options = {}) {
  const windowRef = options.window || globalThis.window || globalThis;
  const documentRef = options.document || globalThis.document || null;
  const state = options.state;
  const refs = options.refs || {};
  const narration = options.narration;
  const textRenderer = options.textRenderer;
  const interactionGate = options.interactionGate;
  const focusOverlay = options.focusOverlay;
  const readerSettingsController = options.readerSettingsController;
  const archiveTabsController = options.archiveTabsController;
  const archiveContentController = options.archiveContentController;
  const demoGameState = options.demoGameState;
  const scene = options.scene;
  const gameState = options.gameState;
  const introVersion = Number(options.introVersion) || 1;
  const gameFile = options.gameFile || 'index.html';
  const tracks = options.tracks || INTRO_TRACKS;
  const sceneReadyPromise = options.sceneReadyPromise || scene?.preload?.();
  let waitResolver = null;
  let dynamicHighlightCleanup = null;
  let lastReplayText = '';
  let destroyed = false;

  function stepById(id) {
    return INTRO_STEP_SCHEMA.find((entry) => entry.id === id) || null;
  }

  function updateAudioIcon() {
    const isPlaying = narration?.isPlaying?.() === true;
    if (refs.iconPlay) refs.iconPlay.style.display = isPlaying ? 'none' : 'block';
    if (refs.iconPause) refs.iconPause.style.display = isPlaying ? 'block' : 'none';
  }

  function setHudVisible(visible) {
    refs.loreProgressHud?.classList.toggle('is-visible', !!visible);
    refs.loreProgressHud?.classList.toggle('is-hidden', !visible);
  }

  function updateLoreProgress() {
    if (!refs.loreProgressText) return;
    refs.loreProgressText.textContent = state.demoOrbCollected ? '1/1' : '0/1';
  }

  function updateDimmerButton() {
    const mode = state.dimmerMode;
    const iconMap = {
      sceneDimmerIconFull: mode === 'white',
      sceneDimmerIconHalf: false,
      sceneDimmerIconCrescent: mode === 'dark',
      sceneDimmerIconSun: mode === 'scene'
    };
    Object.entries(iconMap).forEach(([id, visible]) => {
      const icon = documentRef?.getElementById?.(id);
      if (!icon) return;
      icon.style.display = visible ? 'block' : 'none';
    });
    if (refs.sceneDimmerToggleBtn) {
      const label = mode === 'dark' ? 'Stadt aufhellen' : 'Hintergrund abdunkeln';
      refs.sceneDimmerToggleBtn.setAttribute('aria-label', label);
      refs.sceneDimmerToggleBtn.setAttribute('title', label);
    }
  }

  function syncModeClasses() {
    if (!documentRef?.body) return;
    const body = documentRef.body;
    body.classList.toggle('scene-dimmer-light-mode', state.dimmerMode !== 'dark');
    body.classList.toggle('intro-mode-white', state.dimmerMode === 'white');
    body.classList.toggle('intro-mode-dark', state.dimmerMode === 'dark');
    body.classList.toggle('intro-mode-scene', state.dimmerMode === 'scene');
    body.classList.toggle('intro-reading-mode', !!state.isReadingMode);
    body.classList.toggle('intro-game-mode', !state.isReadingMode);
    body.classList.toggle('intro-archive-open', !!state.archiveVisible);
    refs.audioPlayerUI?.classList.toggle('reading-mode', !!state.isReadingMode);
    refs.startScreen?.classList.toggle('is-hidden', state.currentStepId !== 'start-screen');
    if (refs.sceneDimmerOverlay) refs.sceneDimmerOverlay.dataset.mode = state.dimmerMode;
    scene?.setReadingMode?.(state.isReadingMode);
    updateDimmerButton();
    updateLoreProgress();
  }

  function stopDynamicHighlight() {
    if (typeof dynamicHighlightCleanup === 'function') dynamicHighlightCleanup();
    dynamicHighlightCleanup = null;
  }

  function startDynamicHighlight(getRect) {
    stopDynamicHighlight();
    if (typeof getRect !== 'function') return;
    let rafId = 0;
    const tick = () => {
      if (destroyed) return;
      const rect = getRect();
      if (rect) focusOverlay.highlightRect(rect);
      rafId = windowRef.requestAnimationFrame(tick);
    };
    tick();
    dynamicHighlightCleanup = () => windowRef.cancelAnimationFrame(rafId);
  }

  function applyFocus(config = {}) {
    if (typeof config.highlightRectProvider === 'function') {
      startDynamicHighlight(config.highlightRectProvider);
      return;
    }
    stopDynamicHighlight();
    const targets = Array.isArray(config.highlightTargets) ? config.highlightTargets : [];
    const selectors = targets.filter((target) => typeof target === 'string');
    const elements = targets.filter((target) => target instanceof Element);
    if (selectors.length > 0) {
      focusOverlay.highlightSelectors(selectors);
      return;
    }
    if (elements.length > 0) {
      focusOverlay.highlightElements(elements);
      return;
    }
    focusOverlay.clear();
  }

  function setGate(config = {}) {
    const targets = [];
    if (config.includeAudio !== false && refs.audioToggleBtn && refs.audioPlayerUI?.style.display !== 'none') {
      targets.push(refs.audioToggleBtn);
    }
    if (Array.isArray(config.targets)) targets.push(...config.targets);
    interactionGate.setAllowed({
      targets,
      keys: config.keys || [],
      allowCanvas: config.allowCanvas === true,
      allowAll: config.allowAll === true
    });
  }

  function clearPresentation() {
    interactionGate.clear();
    focusOverlay.clear();
    stopDynamicHighlight();
  }

  function getTrack(trackName) {
    return tracks[trackName] || [];
  }

  function setRenderedTrack(trackName, segmentIndex) {
    const track = getTrack(trackName);
    state.currentTrack = trackName;
    state.currentSegmentIndex = segmentIndex;
    textRenderer.setTrack(trackName, track);
    textRenderer.setActiveSegment(segmentIndex);
  }

  async function speakSegment(trackName, segmentIndex, config = {}) {
    const track = getTrack(trackName);
    const segment = track[segmentIndex];
    if (!segment) return false;
    state.currentStepId = config.stepId || state.currentStepId;
    setRenderedTrack(trackName, segmentIndex);
    lastReplayText = segment.text;
    applyFocus(config);
    setGate({ includeAudio: true });
    const result = await narration.play(segment.text);
    clearPresentation();
    updateAudioIcon();
    return result;
  }

  function waitForAction(actionId, config = {}) {
    state.waitingAction = actionId;
    applyFocus(config);
    setGate({
      includeAudio: true,
      targets: config.targets || [],
      keys: config.keys || [],
      allowCanvas: config.allowCanvas === true
    });
    return new Promise((resolve) => {
      waitResolver = (payload) => {
        state.waitingAction = null;
        waitResolver = null;
        clearPresentation();
        resolve(payload);
      };
    });
  }

  function resolveAction(actionId, payload) {
    if (state.waitingAction !== actionId || typeof waitResolver !== 'function') return false;
    waitResolver(payload);
    return true;
  }

  function showArchive(mode = 'inhalt', tab = 'kapitel') {
    state.archiveVisible = true;
    state.archiveMode = mode;
    state.archiveTab = tab;
    refs.archiveModal?.classList.add('visible');
    archiveContentController?.renderLoreList?.();
    archiveContentController?.renderBookmarks?.();
    if (mode === 'einstellungen') {
      archiveTabsController?.setPrimaryMode?.('einstellungen');
      archiveTabsController?.showSettingsPanel?.();
    } else {
      archiveTabsController?.setPrimaryMode?.('inhalt');
      archiveTabsController?.showContentTab?.(tab);
    }
    syncModeClasses();
  }

  function hideArchive() {
    state.archiveVisible = false;
    refs.archiveModal?.classList.remove('visible');
    syncModeClasses();
  }

  function getOrbHighlightRect() {
    const sceneState = scene?.getState?.();
    if (!sceneState || !refs.gameCanvas) return null;
    const light = Array.isArray(sceneState.yellowLights)
      ? sceneState.yellowLights.find((entry) => !entry.vanished)
      : null;
    if (!light) return refs.gameCanvas.getBoundingClientRect();
    const canvasRect = refs.gameCanvas.getBoundingClientRect();
    const scaleX = canvasRect.width / Math.max(1, refs.gameCanvas.width);
    const scaleY = canvasRect.height / Math.max(1, refs.gameCanvas.height);
    const canvasX = (light.x - sceneState.camX) * sceneState.cameraZoom;
    const canvasY = (light.y - sceneState.camY) * sceneState.cameraZoom;
    const size = 28 * sceneState.cameraZoom;
    return {
      left: canvasRect.left + ((canvasX - size) * scaleX),
      top: canvasRect.top + ((canvasY - size) * scaleY),
      width: (size * 2) * scaleX,
      height: (size * 2) * scaleY
    };
  }

  function markDemoLoreCollected() {
    state.demoOrbCollected = true;
    demoGameState.state.collectedLore = [demoGameState.demoLoreId];
    updateLoreProgress();
    setHudVisible(true);
    archiveContentController?.renderLoreList?.();
  }

  async function enterSouvenirDemo() {
    state.demoLoreOpen = true;
    state.isReadingMode = true;
    syncModeClasses();
    refs.backToChapterBtn?.classList.remove('visible');
    await speakSegment('souvenir', 0, { stepId: 'souvenir-demo' });
    await speakSegment('souvenir', 1, {
      stepId: 'souvenir-demo',
      highlightTargets: ['#backToChapterBtn']
    });
    refs.backToChapterBtn?.classList.add('visible');
    await waitForAction('back-to-chapter', {
      targets: stepById('back-to-chapter')?.allowedInteractions || ['#backToChapterBtn'],
      highlightTargets: ['#backToChapterBtn']
    });
    refs.backToChapterBtn?.classList.remove('visible');
    state.demoLoreOpen = false;
    state.isReadingMode = true;
    syncModeClasses();
    textRenderer.setTrack('main', getTrack('main'));
    textRenderer.setActiveSegment(16);
  }

  function showFinalButton() {
    refs.nextChapterBtn.textContent = 'F\u00fchrung beginnen';
    refs.nextChapterBtn.classList.add('visible');
    documentRef.body.classList.add('intro-ready-to-begin');
    applyFocus({ highlightTargets: ['#nextChapterBtn'] });
    setGate({ includeAudio: false, targets: ['#nextChapterBtn'] });
  }

  async function redirectToGame(markCompleted) {
    if (destroyed) return;
    destroyed = true;
    narration.stop?.();
    try {
      if (markCompleted) {
        await gameState?.markIntroCompleted?.(introVersion);
      }
    } catch (_) {}
    windowRef.location.href = gameFile;
  }

  function bindEvents() {
    refs.startSkipBtn?.addEventListener?.('click', () => {
      state.skipped = true;
      void redirectToGame(false);
    });

    refs.audioToggleBtn?.addEventListener?.('click', () => {
      const toggled = narration.toggle?.();
      if (!toggled && lastReplayText) {
        void narration.play(lastReplayText);
      }
      updateAudioIcon();
    });

    refs.bookBtn?.addEventListener?.('click', () => {
      showArchive('inhalt', 'kapitel');
      resolveAction('open-book');
    });

    refs.sceneDimmerToggleBtn?.addEventListener?.('click', () => {
      if (state.waitingAction === 'dimmer-dark') {
        state.dimmerMode = 'dark';
        syncModeClasses();
        resolveAction('dimmer-dark');
        return;
      }
      if (state.waitingAction === 'dimmer-light') {
        state.dimmerMode = 'scene';
        syncModeClasses();
        resolveAction('dimmer-light');
      }
    });

    refs.readingModeBtn?.addEventListener?.('click', () => {
      if (state.waitingAction !== 'enter-explore') return;
      state.isReadingMode = false;
      syncModeClasses();
      setHudVisible(true);
      resolveAction('enter-explore');
    });

    refs.backToChapterBtn?.addEventListener?.('click', () => {
      resolveAction('back-to-chapter');
    });

    refs.loreProgressHud?.addEventListener?.('click', () => {
      showArchive('inhalt', 'lore');
      resolveAction('open-lore-hud');
    });

    refs.nextChapterBtn?.addEventListener?.('click', () => {
      void redirectToGame(true);
    });

    refs.closeArchiveBtn?.addEventListener?.('click', () => {
      hideArchive();
    });

    documentRef.querySelectorAll('input[name="readerSentenceLayout"]').forEach((input) => {
      input.addEventListener('change', () => {
        if (!input.checked) return;
        readerSettingsController?.setSentenceLayout?.(input.value);
        state.sentenceLayout = input.value;
        resolveAction('choose-layout', input.value);
      });
    });
  }

  async function start() {
    bindEvents();
    updateAudioIcon();
    updateLoreProgress();
    setHudVisible(false);
    refs.skipBackBtn.disabled = true;
    refs.skipForwardBtn.disabled = true;
    refs.audioPlayerUI.style.display = 'none';
    refs.nextChapterBtn.classList.remove('visible');
    refs.backToChapterBtn.classList.remove('visible');
    syncModeClasses();
    setGate({ includeAudio: false, targets: ['#startSkipBtn'] });

    await speakSegment('start', 0, { stepId: 'start-screen' });
    if (state.skipped) return;
    await speakSegment('start', 1, { stepId: 'start-screen' });
    if (state.skipped) return;

    await sceneReadyPromise;
    refs.startScreen?.classList.add('is-hidden');
    refs.audioPlayerUI.style.display = 'flex';
    state.currentStepId = 'main-reader';
    state.isReadingMode = true;
    state.dimmerMode = 'white';
    readerSettingsController?.applyTextSettings?.({ rerender: true });
    textRenderer.setTrack('main', getTrack('main'));
    textRenderer.setActiveSegment(0);
    syncModeClasses();

    const layoutStep = stepById('layout-choice');
    await speakSegment('main', 0, { stepId: 'main-reader' });
    await speakSegment('main', 1, { stepId: 'main-reader' });
    showArchive('einstellungen', 'kapitel');
    await speakSegment('main', 2, {
      stepId: 'layout-choice',
      highlightTargets: layoutStep?.highlightTargets || ['[data-loading-tutorial="layout-group"]']
    });
    await waitForAction('choose-layout', {
      targets: layoutStep?.allowedInteractions || [],
      highlightTargets: layoutStep?.highlightTargets || ['[data-loading-tutorial="layout-group"]']
    });
    hideArchive();

    await speakSegment('main', 3, { stepId: 'book-open', highlightTargets: ['#bookBtn'] });
    await speakSegment('main', 4, { stepId: 'book-open', highlightTargets: ['#bookBtn'] });
    await waitForAction('open-book', {
      targets: stepById('book-open')?.allowedInteractions || ['#bookBtn'],
      highlightTargets: ['#bookBtn']
    });
    await speakSegment('main', 5, { stepId: 'archive-save', highlightTargets: ['#btnSaveData'] });
    await speakSegment('main', 6, { stepId: 'archive-lore-tab', highlightTargets: ['.archive-tab[data-tab="lore"]'] });
    await speakSegment('main', 7, { stepId: 'archive-explain' });
    await speakSegment('main', 8, { stepId: 'archive-explain' });
    hideArchive();

    await speakSegment('main', 9, { stepId: 'reader-white' });
    await speakSegment('main', 10, { stepId: 'dimmer-dark', highlightTargets: ['#sceneDimmerToggleBtn'] });
    await waitForAction('dimmer-dark', {
      targets: stepById('dimmer-dark')?.allowedInteractions || ['#sceneDimmerToggleBtn'],
      highlightTargets: ['#sceneDimmerToggleBtn']
    });
    await speakSegment('main', 11, { stepId: 'dimmer-light', highlightTargets: ['#sceneDimmerToggleBtn'] });
    await waitForAction('dimmer-light', {
      targets: stepById('dimmer-light')?.allowedInteractions || ['#sceneDimmerToggleBtn'],
      highlightTargets: ['#sceneDimmerToggleBtn']
    });
    await speakSegment('main', 12, { stepId: 'enter-explore', highlightTargets: ['#readingModeBtn'] });
    await waitForAction('enter-explore', {
      targets: stepById('enter-explore')?.allowedInteractions || ['#readingModeBtn'],
      highlightTargets: ['#readingModeBtn']
    });

    await speakSegment('main', 13, { stepId: 'game-mode', highlightTargets: ['#readingModeBtn'] });
    await speakSegment('main', 14, { stepId: 'collect-orb' });
    await speakSegment('main', 15, {
      stepId: 'collect-orb',
      highlightRectProvider: getOrbHighlightRect
    });
    await waitForAction('collect-orb', {
      targets: [],
      keys: MOVE_KEYS,
      allowCanvas: true,
      highlightRectProvider: getOrbHighlightRect
    });
    markDemoLoreCollected();
    await enterSouvenirDemo();

    await speakSegment('main', 16, { stepId: 'hud' });
    await speakSegment('main', 17, { stepId: 'open-lore-hud', highlightTargets: ['#loreProgressHud'] });
    await waitForAction('open-lore-hud', {
      targets: stepById('open-lore-hud')?.allowedInteractions || ['#loreProgressHud'],
      highlightTargets: ['#loreProgressHud']
    });
    await speakSegment('main', 18, { stepId: 'archive-lore-open', highlightTargets: ['#loreList'] });
    hideArchive();
    await speakSegment('main', 19, { stepId: 'finish' });
    showFinalButton();
  }

  narration?.onSegmentStart?.(updateAudioIcon);
  narration?.onSegmentEnd?.(updateAudioIcon);

  return {
    start,
    resolveAction,
    markDemoLoreCollected,
    redirectToGame
  };
}

export default createIntroController;
