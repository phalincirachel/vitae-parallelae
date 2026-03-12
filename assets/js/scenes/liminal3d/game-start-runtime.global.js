(function initLiminalGameStartRuntime(globalObject) {
  function initLiminalGameStartRuntime(options = {}) {
    const root = options.root || globalObject;
    const windowObject = options.window || root.window || root;
    const documentObject = options.document || root.document || null;
    const requestFrame = typeof options.requestAnimationFrame === 'function'
      ? options.requestAnimationFrame
      : (callback) => windowObject.requestAnimationFrame(callback);
    const delay = typeof options.setTimeout === 'function' ? options.setTimeout : globalObject.setTimeout;
    const getActiveSegmentTarget = typeof options.getActiveSegmentTarget === 'function' ? options.getActiveSegmentTarget : () => 0;
    const getInitialSegmentStartZ = typeof options.getInitialSegmentStartZ === 'function' ? options.getInitialSegmentStartZ : () => 0;
    const getSegmentLength = typeof options.getSegmentLength === 'function' ? options.getSegmentLength : () => 0;
    const canPreload = typeof options.canPreload === 'function' ? options.canPreload : () => false;
    const createPreloadSegment = typeof options.createPreloadSegment === 'function' ? options.createPreloadSegment : () => null;
    const pushSegment = typeof options.pushSegment === 'function' ? options.pushSegment : () => {};
    const getUiContainer = typeof options.getUiContainer === 'function' ? options.getUiContainer : () => null;
    const refreshLoreProgressUi = typeof options.refreshLoreProgressUi === 'function' ? options.refreshLoreProgressUi : () => {};
    const getIsReadingMode = typeof options.getIsReadingMode === 'function' ? options.getIsReadingMode : () => false;
    const isBlaetternLayoutSelected = typeof options.isBlaetternLayoutSelected === 'function' ? options.isBlaetternLayoutSelected : () => false;
    const scheduleBlaetternPaginationRetry = typeof options.scheduleBlaetternPaginationRetry === 'function' ? options.scheduleBlaetternPaginationRetry : () => {};
    const getAudioPlayer = typeof options.getAudioPlayer === 'function' ? options.getAudioPlayer : () => root.audioPlayer || windowObject.audioPlayer || null;
    const getMainChapterAutoplayIntent = typeof options.getMainChapterAutoplayIntent === 'function'
      ? options.getMainChapterAutoplayIntent
      : () => ({ shouldAutoplay: false, source: 'unknown', reason: '', policy: 'manual' });
    const debugNote = typeof options.debugNote === 'function' ? options.debugNote : () => {};
    const verifyPlaybackStarted = typeof options.verifyPlaybackStarted === 'function' ? options.verifyPlaybackStarted : () => Promise.resolve(false);
    const updateIcons = typeof options.updateIcons === 'function' ? options.updateIcons : () => {};
    const getRenderer = typeof options.getRenderer === 'function' ? options.getRenderer : () => null;
    const getScene = typeof options.getScene === 'function' ? options.getScene : () => null;
    const getCamera = typeof options.getCamera === 'function' ? options.getCamera : () => null;
    const getAmbientAudio = typeof options.getAmbientAudio === 'function' ? options.getAmbientAudio : () => null;
    const saveCurrentContentState = typeof options.saveCurrentContentState === 'function' ? options.saveCurrentContentState : () => {};
    const getContentSwitchInProgress = typeof options.getContentSwitchInProgress === 'function' ? options.getContentSwitchInProgress : () => false;
    const startAnimationLoop = typeof options.startAnimationLoop === 'function' ? options.startAnimationLoop : () => false;
    const getClock = typeof options.getClock === 'function' ? options.getClock : () => null;
    const setHasStartedGame = typeof options.setHasStartedGame === 'function' ? options.setHasStartedGame : () => {};
    const isFallback2DMode = typeof options.isFallback2DMode === 'function' ? options.isFallback2DMode : () => !!windowObject.fallback2DMode;
    const log = typeof options.log === 'function' ? options.log : () => {};
    const warn = typeof options.warn === 'function' ? options.warn : () => {};

    let loadedSegments = 0;
    let gameRevealQueued = false;
    let lifecycleBound = false;
    let wasAmbientPlaying = false;
    let wasPlayerPlaying = false;
    let visibilityResumeToken = 0;

    function getInitialZValues() {
      const segmentLength = getSegmentLength();
      return Array.from(
        { length: getActiveSegmentTarget() },
        (_, index) => getInitialSegmentStartZ() - index * segmentLength
      );
    }

    function revealGameWhenReady() {
      if (gameRevealQueued) return false;
      gameRevealQueued = true;

      const finalizeReveal = () => {
        const loadingScreen = documentObject && typeof documentObject.getElementById === 'function'
          ? documentObject.getElementById('loading-screen')
          : null;
        const uiContainer = getUiContainer();
        if (uiContainer && uiContainer.style) uiContainer.style.display = 'flex';
        refreshLoreProgressUi();
        if (getIsReadingMode() && isBlaetternLayoutSelected()) {
          scheduleBlaetternPaginationRetry('ui-visible');
        }
        const audioPlayer = getAudioPlayer();
        if (audioPlayer && typeof audioPlayer.renderLines === 'function') {
          const index = Number.isFinite(audioPlayer.currentSubtitleIndex)
            ? audioPlayer.currentSubtitleIndex
            : 0;
          audioPlayer.renderLines(Math.max(0, index));
        }
        if (loadingScreen && loadingScreen.style) loadingScreen.style.display = 'none';
      };

      requestFrame(() => {
        requestFrame(finalizeReveal);
      });
      return true;
    }

    function bindLifecycleListeners() {
      if (lifecycleBound || !documentObject || typeof documentObject.addEventListener !== 'function') return;
      lifecycleBound = true;
      windowObject.gamePaused = false;

      documentObject.addEventListener('visibilitychange', () => {
        const token = ++visibilityResumeToken;
        const ambientAudio = getAmbientAudio();
        const audioPlayer = getAudioPlayer();
        if (documentObject.hidden) {
          windowObject.gamePaused = true;
          saveCurrentContentState({ preferCachedTime: true, reason: 'visibility:hidden' });
          debugNote('visibility', 'hidden');

          if (ambientAudio) {
            wasAmbientPlaying = (typeof ambientAudio.isProbablyPlaying === 'function')
              ? ambientAudio.isProbablyPlaying()
              : !ambientAudio.paused;
            ambientAudio.pause();
            debugNote('ambient', `pause hidden (wasPlaying=${wasAmbientPlaying})`);
          } else {
            wasAmbientPlaying = false;
          }

          if (audioPlayer) {
            wasPlayerPlaying = (typeof audioPlayer.isProbablyPlaying === 'function')
              ? audioPlayer.isProbablyPlaying()
              : !audioPlayer.paused;
            audioPlayer.pause();
            debugNote('player', `pause hidden (wasPlaying=${wasPlayerPlaying})`);
          } else {
            wasPlayerPlaying = false;
          }
          return;
        }

        windowObject.gamePaused = false;
        debugNote('visibility', 'visible');
        if (!windowObject.visualFreezeActive) {
          startAnimationLoop();
        }
        const clock = getClock();
        if (clock && typeof clock.getDelta === 'function') {
          clock.getDelta();
        }

        delay(() => {
          if (token !== visibilityResumeToken || documentObject.hidden) return;
          if (getContentSwitchInProgress()) {
            debugNote('visibility', 'resume skipped (content switch active)');
            return;
          }
          if (wasAmbientPlaying && ambientAudio) {
            const playResult = ambientAudio.play();
            if (playResult && typeof playResult.catch === 'function') {
              playResult.catch((resumeError) => warn('Resume ambient failed', resumeError));
            }
            wasAmbientPlaying = false;
            debugNote('ambient', 'resume on visible');
          }
          if (wasPlayerPlaying && audioPlayer) {
            const playResult = audioPlayer.play();
            if (playResult && typeof playResult.catch === 'function') {
              playResult.catch((resumeError) => warn('Resume player failed', resumeError));
            }
            wasPlayerPlaying = false;
            debugNote('player', 'resume on visible');
          }
        }, 100);
      });

      if (typeof windowObject.addEventListener === 'function') {
        windowObject.addEventListener('pagehide', () => {
          visibilityResumeToken += 1;
          const ambientAudio = getAmbientAudio();
          const audioPlayer = getAudioPlayer();
          saveCurrentContentState({ preferCachedTime: true, reason: 'pagehide' });
          if (ambientAudio) ambientAudio.pause();
          if (audioPlayer) audioPlayer.pause();
          debugNote('lifecycle', 'pagehide');
        });
      }
    }

    function startGame() {
      setHasStartedGame(true);

      const loadingText = documentObject && typeof documentObject.getElementById === 'function'
        ? documentObject.getElementById('loading')
        : null;
      if (loadingText && loadingText.style) loadingText.style.display = 'none';

      const audioPlayer = getAudioPlayer();
      if (audioPlayer && getIsReadingMode() && typeof audioPlayer.setReadingMode === 'function') {
        audioPlayer.setReadingMode(true);
      }

      const mainChapterAutoplayIntent = getMainChapterAutoplayIntent();
      if (mainChapterAutoplayIntent.shouldAutoplay) {
        debugNote('autoplay', `boot start source=${mainChapterAutoplayIntent.source} reason=${mainChapterAutoplayIntent.reason}`);
        verifyPlaybackStarted(3, 320).then((started) => {
          debugNote('autoplay', `boot result started=${started}`);
          updateIcons();
        });
      } else {
        debugNote('autoplay', `suppressed policy=${mainChapterAutoplayIntent.policy} reason=${mainChapterAutoplayIntent.reason}`);
        updateIcons();
      }

      try {
        const renderer = getRenderer();
        const scene = getScene();
        const camera = getCamera();
        if (!isFallback2DMode() && renderer && typeof renderer.compile === 'function') {
          renderer.compile(scene, camera);
        }
      } catch (compileError) {
        warn('Shader compilation failed:', compileError);
      }

      bindLifecycleListeners();
      startAnimationLoop();
      revealGameWhenReady();
      return true;
    }

    function checkPreloadComplete() {
      loadedSegments += 1;
      if (loadedSegments >= getInitialZValues().length) {
        log('DEBUG: Preload Complete. Starting Game.');
        startGame();
      }
      return loadedSegments;
    }

    function initPreload() {
      if (canPreload()) {
        const segmentLength = getSegmentLength();
        for (const z of getInitialZValues()) {
          pushSegment(createPreloadSegment(z, segmentLength, checkPreloadComplete));
        }
      } else {
        log('DEBUG: Fallback Mode active. Skipping 3D preload.');
        startGame();
      }
      return getInitialZValues().length;
    }

    return {
      initPreload,
      checkPreloadComplete,
      revealGameWhenReady,
      startGame,
      getLoadedSegments() {
        return loadedSegments;
      },
      getTotalToLoad() {
        return getInitialZValues().length;
      }
    };
  }

  globalObject.GameboyLiminalGameStartRuntime = Object.freeze({
    init: initLiminalGameStartRuntime
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
