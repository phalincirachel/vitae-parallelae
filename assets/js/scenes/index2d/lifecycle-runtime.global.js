(function initIndexLifecycleRuntime(globalObject) {
  function safeCall(handler, payload) {
    if (typeof handler !== 'function') return;
    try {
      return handler(payload);
    } catch {
      return undefined;
    }
  }

  function isProbablyPlaying(target) {
    if (!target) return false;
    if (typeof target.isProbablyPlaying === 'function') {
      return !!target.isProbablyPlaying();
    }
    return !target.paused;
  }

  function safePause(target) {
    if (target && typeof target.pause === 'function') {
      target.pause();
    }
  }

  function safePlay(target, onError) {
    if (!target || typeof target.play !== 'function') return;
    const result = target.play();
    if (result && typeof result.catch === 'function') {
      result.catch((error) => safeCall(onError, error));
    }
  }

  function initIndexLifecycleRuntime(options = {}) {
    const root = options.root || globalObject;
    const windowObject = options.window || root.window || root;
    const documentObject = options.document || root.document || null;
    const ambientAudio = options.ambientAudio || null;
    const audioPlayer = options.audioPlayer || null;
    const footstepSound = options.footstepSound || null;
    const debugNote = typeof options.debugNote === 'function' ? options.debugNote : () => {};
    const allowAuxScPlayback = typeof options.allowAuxScPlayback === 'function' ? options.allowAuxScPlayback : () => false;
    const applySceneAudioMix = typeof options.applySceneAudioMix === 'function' ? options.applySceneAudioMix : () => {};
    const saveCurrentContentState = typeof options.saveCurrentContentState === 'function' ? options.saveCurrentContentState : () => {};
    const startGameLoop = typeof options.startGameLoop === 'function' ? options.startGameLoop : () => {};
    const syncAuxScPlayback = typeof options.syncAuxScPlayback === 'function' ? options.syncAuxScPlayback : () => {};
    const getGameReady = typeof options.getGameReady === 'function' ? options.getGameReady : () => false;
    const getContentSwitchInProgress = typeof options.getContentSwitchInProgress === 'function' ? options.getContentSwitchInProgress : () => false;
    const setLastTime = typeof options.setLastTime === 'function' ? options.setLastTime : () => {};
    const scheduleResume = typeof options.scheduleResume === 'function' ? options.scheduleResume : (handler, delayMs) => windowObject.setTimeout(handler, delayMs);
    const warn = typeof options.warn === 'function' ? options.warn : (label, error) => {
      if (globalObject.console && typeof globalObject.console.warn === 'function') {
        globalObject.console.warn(label, error);
      }
    };

    let wasAmbientPlaying = false;
    let wasPlayerPlaying = false;
    let visibilityResumeToken = 0;

    windowObject.gamePaused = false;
    windowObject.visualFreezeActive = !!windowObject.visualFreezeActive;

    function handleFirstInteraction() {
      if (getGameReady() && ambientAudio && ambientAudio.paused && allowAuxScPlayback()) {
        safePlay(ambientAudio, (error) => warn('Ambient play failed:', error));
      }
    }

    function handleVisibilityChange() {
      const token = ++visibilityResumeToken;
      if (documentObject?.hidden) {
        windowObject.gamePaused = true;
        saveCurrentContentState({ preferCachedTime: true, reason: 'visibility:hidden' });
        debugNote('visibility', 'hidden');

        if (ambientAudio) {
          wasAmbientPlaying = isProbablyPlaying(ambientAudio);
          safePause(ambientAudio);
          debugNote('ambient', `pause hidden (wasPlaying=${wasAmbientPlaying})`);
        } else {
          wasAmbientPlaying = false;
        }

        if (audioPlayer) {
          wasPlayerPlaying = isProbablyPlaying(audioPlayer);
          safePause(audioPlayer);
          debugNote('player', `pause hidden (wasPlaying=${wasPlayerPlaying})`);
        } else {
          wasPlayerPlaying = false;
        }

        safePause(footstepSound);
        return;
      }

      setLastTime(0);
      windowObject.gamePaused = false;
      if (!windowObject.visualFreezeActive) {
        startGameLoop();
      }
      debugNote('visibility', 'visible');

      scheduleResume(() => {
        if (token !== visibilityResumeToken || documentObject?.hidden) return;
        if (getContentSwitchInProgress()) {
          debugNote('visibility', 'resume skipped (content switch active)');
          return;
        }
        applySceneAudioMix('visibility:resume');
        if (wasAmbientPlaying && ambientAudio && allowAuxScPlayback()) {
          safePlay(ambientAudio, (error) => warn('Resume ambient failed', error));
          wasAmbientPlaying = false;
          debugNote('ambient', 'resume on visible');
        }
        if (wasPlayerPlaying && audioPlayer) {
          safePlay(audioPlayer, (error) => warn('Resume player failed', error));
          wasPlayerPlaying = false;
          debugNote('player', 'resume on visible');
        }
      }, 100);
    }

    function handlePageHide() {
      visibilityResumeToken += 1;
      saveCurrentContentState({ preferCachedTime: true, reason: 'pagehide' });
      safePause(ambientAudio);
      safePause(audioPlayer);
      debugNote('lifecycle', 'pagehide');
    }

    if (documentObject && typeof documentObject.addEventListener === 'function') {
      documentObject.addEventListener('click', handleFirstInteraction, { once: true });
      documentObject.addEventListener('visibilitychange', handleVisibilityChange);
    }

    if (windowObject && typeof windowObject.addEventListener === 'function') {
      windowObject.addEventListener('pagehide', handlePageHide);
    }

    return {
      handleFirstInteraction,
      handleVisibilityChange,
      handlePageHide,
      getVisibilityResumeToken() {
        return visibilityResumeToken;
      },
      getWasAmbientPlaying() {
        return wasAmbientPlaying;
      },
      getWasPlayerPlaying() {
        return wasPlayerPlaying;
      }
    };
  }

  globalObject.GameboyIndexLifecycleRuntime = Object.freeze({
    init: initIndexLifecycleRuntime,
    isProbablyPlaying,
    safePause,
    safePlay
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
