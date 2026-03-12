(function initIndexAudioRuntime(globalObject) {
  function clampVolume(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Math.max(0, Math.min(1, numeric));
  }

  function safeGet(getter, fallback) {
    if (typeof getter !== 'function') return fallback;
    try {
      const value = getter();
      return value === undefined ? fallback : value;
    } catch {
      return fallback;
    }
  }

  function safeSet(setter, value) {
    if (typeof setter === 'function') {
      setter(value);
    }
  }

  function toFixedValue(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return '0.000';
    return numeric.toFixed(3);
  }

  function createNoopAudio() {
    return {
      paused: true,
      volume: 0,
      src: '',
      currentTime: 0,
      audioNode: null,
      play() {
        this.paused = false;
        return Promise.resolve();
      },
      pause() {
        this.paused = true;
      },
      addEventListener() {},
      isProbablyPlaying() {
        return !this.paused;
      }
    };
  }

  function createAmbientAudio(options) {
    if (options.ambientAudio) {
      return options.ambientAudio;
    }

    if (typeof options.createAmbientAudio === 'function') {
      const created = options.createAmbientAudio();
      if (created) return created;
    }

    const AudioAdapter = options.AudioAdapter || globalObject.SCAudioAdapter || globalObject.window?.SCAudioAdapter;
    if (typeof AudioAdapter === 'function') {
      return new AudioAdapter();
    }

    return createNoopAudio();
  }

  function bindButtonFocusGuards(documentObject) {
    if (!documentObject || typeof documentObject.querySelectorAll !== 'function') {
      return 0;
    }

    const buttons = documentObject.querySelectorAll('button') || [];
    buttons.forEach((button) => {
      if (!button || typeof button.addEventListener !== 'function') return;

      button.addEventListener('click', () => {
        if (typeof button.blur === 'function') button.blur();
        if (typeof globalObject.focus === 'function') globalObject.focus();
      });

      button.addEventListener('focus', () => {
        if (typeof button.blur === 'function') button.blur();
      });

      button.addEventListener('mousedown', (event) => {
        if (documentObject.activeElement !== button && event && typeof event.preventDefault === 'function') {
          event.preventDefault();
        }
      });
    });

    return buttons.length;
  }

  function initIndexAudioRuntime(options = {}) {
    const root = options.root || globalObject;
    const documentObject = options.document || root.document || null;
    const audioPlayer = options.audioPlayer || null;
    const iconPlay = options.iconPlay || null;
    const iconPause = options.iconPause || null;
    const footstepSound = options.footstepSound || createNoopAudio();
    const shimmerSound = options.shimmerSound || createNoopAudio();
    const ambientAudio = createAmbientAudio(options);
    const getScUrl = typeof options.getScUrl === 'function' ? options.getScUrl : (value) => value;
    const audioProfile = options.audioProfile || {};
    const ambientUrl = options.ambientUrl || audioProfile.ambientUrl || 'assets/medieval_town.mp3';
    const shimmerBaseVolume = Number.isFinite(options.shimmerBaseVolume) ? options.shimmerBaseVolume : 0.4;
    const debugNote = typeof options.debugNote === 'function' ? options.debugNote : () => {};
    const trace = typeof options.trace === 'function' ? options.trace : () => {};
    const visibilityManager = options.visibilityManager || root.AudioVisibilityManager || root.window?.AudioVisibilityManager || null;
    const isIOSDevice = !!options.isIOSDevice;
    const getGameReady = () => !!safeGet(options.getGameReady, false);
    const getIsLoreMode = () => !!safeGet(options.getIsLoreMode, false);
    const getIsReadingMode = () => !!safeGet(options.getIsReadingMode, false);
    const getContentSwitchInProgress = () => !!safeGet(options.getContentSwitchInProgress, false);
    const getReaderBackgroundVolume = () => clampVolume(safeGet(options.getReaderBackgroundVolume, 1));
    const getAudioUnlocked = () => !!safeGet(options.getAudioUnlocked, false);
    const setAudioUnlocked = (value) => safeSet(options.setAudioUnlocked, !!value);
    const getFootstepPlaying = () => !!safeGet(options.getFootstepPlaying, false);
    const setFootstepPlaying = (value) => safeSet(options.setFootstepPlaying, !!value);

    ambientAudio.src = getScUrl(ambientUrl);
    ambientAudio.volume = clampVolume((audioProfile.ambient || 0) * getReaderBackgroundVolume());

    if (visibilityManager && typeof visibilityManager.unregister === 'function') {
      visibilityManager.unregister(ambientAudio);
    }

    function isAudioTransportPaused() {
      if (!audioPlayer) return true;
      if (typeof audioPlayer.isTransportPaused === 'function') {
        return !!audioPlayer.isTransportPaused();
      }
      return !!audioPlayer.paused;
    }

    function syncPlayPauseIcon() {
      const isPaused = isAudioTransportPaused();
      if (iconPlay && iconPlay.style) {
        iconPlay.style.display = isPaused ? 'block' : 'none';
      }
      if (iconPause && iconPause.style) {
        iconPause.style.display = isPaused ? 'none' : 'block';
      }
      trace('icon:sync', {
        paused: isPaused,
        iconPlay: iconPlay && iconPlay.style ? iconPlay.style.display : undefined,
        iconPause: iconPause && iconPause.style ? iconPause.style.display : undefined,
        currentTime: Number((Number(audioPlayer && audioPlayer.currentTime) || 0).toFixed(3))
      });
      return isPaused;
    }

    function isPrimaryNarrationPlaying() {
      if (!audioPlayer) return false;
      if (typeof audioPlayer.isProbablyPlaying === 'function') {
        return !!audioPlayer.isProbablyPlaying();
      }
      return !audioPlayer.paused;
    }

    function allowAuxScPlayback() {
      return !isPrimaryNarrationPlaying() && !getContentSwitchInProgress() && !documentObject?.hidden;
    }

    function syncAuxScPlayback(reason = 'unspecified') {
      if (!allowAuxScPlayback()) {
        if (getFootstepPlaying()) {
          if (typeof footstepSound.pause === 'function') footstepSound.pause();
          setFootstepPlaying(false);
        }
        if (!ambientAudio.paused && typeof ambientAudio.pause === 'function') {
          ambientAudio.pause();
        }
        debugNote('aux-audio', `${reason} blocked`);
        return false;
      }

      if (getAudioUnlocked() && getGameReady() && ambientAudio.paused && typeof ambientAudio.play === 'function') {
        const playResult = ambientAudio.play();
        if (playResult && typeof playResult.catch === 'function') {
          playResult.catch(() => {});
        }
      }
      debugNote('aux-audio', `${reason} allowed`);
      return true;
    }

    function applySceneAudioMix(reason = 'unspecified') {
      let ambientTarget = Number(audioProfile.ambient) || 0;
      let footstepTarget = Number(audioProfile.footsteps) || 0;

      if (getIsLoreMode()) ambientTarget *= 0.68;
      if (getIsReadingMode()) footstepTarget *= 0.65;
      if (getIsLoreMode()) footstepTarget *= 0.45;

      ambientTarget *= getReaderBackgroundVolume();
      footstepTarget *= getReaderBackgroundVolume();
      ambientAudio.volume = clampVolume(ambientTarget);
      footstepSound.volume = clampVolume(footstepTarget);
      syncAuxScPlayback(`mix:${reason}`);
      debugNote('audio-mix', `${reason} ambient=${toFixedValue(ambientAudio.volume)} foot=${toFixedValue(footstepSound.volume)} ios=${isIOSDevice}`);
      return {
        ambient: ambientAudio.volume,
        footsteps: footstepSound.volume
      };
    }

    function applyBackgroundSfxVolume(reason = 'unspecified') {
      shimmerSound.volume = clampVolume(shimmerBaseVolume * getReaderBackgroundVolume());
      debugNote('bg-sfx', `${reason} shimmer=${toFixedValue(shimmerSound.volume)}`);
      return shimmerSound.volume;
    }

    function unlockAudio() {
      if (getAudioUnlocked()) return false;
      setAudioUnlocked(true);
      syncAuxScPlayback('unlock');
      return true;
    }

    if (audioPlayer && typeof audioPlayer.addEventListener === 'function') {
      audioPlayer.addEventListener('play', syncPlayPauseIcon);
      audioPlayer.addEventListener('pause', syncPlayPauseIcon);
      audioPlayer.addEventListener('ended', syncPlayPauseIcon);
      audioPlayer.addEventListener('canplay', syncPlayPauseIcon);
      audioPlayer.addEventListener('play', () => syncAuxScPlayback('main-play'));
      audioPlayer.addEventListener('pause', () => syncAuxScPlayback('main-pause'));
      audioPlayer.addEventListener('ended', () => syncAuxScPlayback('main-ended'));
    }

    if (documentObject && typeof documentObject.addEventListener === 'function') {
      documentObject.addEventListener('click', unlockAudio, { once: true });
      documentObject.addEventListener('keydown', unlockAudio, { once: true });
      documentObject.addEventListener('touchstart', unlockAudio, { once: true });
    }

    const guardedButtonCount = bindButtonFocusGuards(documentObject);
    syncPlayPauseIcon();
    applySceneAudioMix('init');
    applyBackgroundSfxVolume('init');

    return {
      ambientAudio,
      guardedButtonCount,
      isAudioTransportPaused,
      syncPlayPauseIcon,
      isPrimaryNarrationPlaying,
      allowAuxScPlayback,
      syncAuxScPlayback,
      applySceneAudioMix,
      applyBackgroundSfxVolume,
      unlockAudio
    };
  }

  globalObject.GameboyIndexAudioRuntime = Object.freeze({
    init: initIndexAudioRuntime,
    createNoopAudio,
    bindButtonFocusGuards,
    clampVolume
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
