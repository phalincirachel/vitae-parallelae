import { SC_URLS } from '../shared/audio/soundcloud-urls.js';

const DEFAULT_SOURCE_URL = SC_URLS.INTRO_LITA_1;
const MONITOR_INTERVAL_MS = 120;
const END_TOLERANCE_SEC = 0.03;
const GESTURE_EVENTS = Object.freeze(['pointerdown', 'touchstart', 'touchend', 'click', 'keydown']);

function wait(ms) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, Math.max(0, Number(ms) || 0)));
}

function emitListeners(listeners, type, payload) {
  listeners[type]?.forEach((listener) => {
    try {
      listener(payload);
    } catch (_) {}
  });
}

function normalizeSegment(segmentOrText, options = {}) {
  if (segmentOrText && typeof segmentOrText === 'object') {
    return {
      id: segmentOrText.id || options.segmentId || '',
      text: String(segmentOrText.text || ''),
      audioStartSec: Number.isFinite(segmentOrText.audioStartSec) ? Number(segmentOrText.audioStartSec) : null,
      audioEndSec: Number.isFinite(segmentOrText.audioEndSec) ? Number(segmentOrText.audioEndSec) : null,
      holdDurationMs: Number.isFinite(segmentOrText.holdDurationMs) ? Math.max(0, Math.trunc(segmentOrText.holdDurationMs)) : 0
    };
  }
  return {
    id: options.segmentId || '',
    text: String(segmentOrText || ''),
    audioStartSec: null,
    audioEndSec: null,
    holdDurationMs: 0
  };
}

function hasFiniteAudioRange(segment) {
  return Number.isFinite(segment?.audioStartSec)
    && Number.isFinite(segment?.audioEndSec)
    && Number(segment.audioEndSec) > Number(segment.audioStartSec);
}

export function createIntroNarrationAdapter(options = {}) {
  const listeners = {
    start: new Set(),
    end: new Set(),
    blocked: new Set()
  };
  const windowRef = globalThis.window || globalThis;
  const documentRef = windowRef.document || null;
  const AudioAdapter = options.AudioAdapter || windowRef.SCAudioAdapter || globalThis.SCAudioAdapter || null;
  const sourceUrl = String(options.sourceUrl || DEFAULT_SOURCE_URL || '');
  const player = AudioAdapter ? new AudioAdapter({ iframeId: options.iframeId || 'introNarrationAudio' }) : null;
  try {
    windowRef.AudioVisibilityManager?.unregister?.(player);
  } catch (_) {}

  let volume = 1;
  let currentText = '';
  let currentSession = null;
  let monitorTimer = null;
  let silentTimer = null;
  let hardStopTimer = null;
  let readyPromise = null
  let gestureCleanup = null
  let gestureRetryHandler = null;

  function clearTimers() {
    if (monitorTimer) {
      windowRef.clearTimeout(monitorTimer);
      monitorTimer = null;
    }
    if (silentTimer) {
      windowRef.clearTimeout(silentTimer);
      silentTimer = null;
    }
    if (hardStopTimer) {
      windowRef.clearTimeout(hardStopTimer);
      hardStopTimer = null;
    }
  }

  function clearGestureRetry() {
    if (typeof gestureCleanup === 'function') gestureCleanup();
    gestureCleanup = null;
    gestureRetryHandler = null;
  }

  function promoteWidgetIframe() {
    const iframe = player?.iframe || null;
    if (!iframe || !iframe.style) return;
    iframe.style.display = 'block';
    iframe.style.position = 'fixed';
    iframe.style.width = '1px';
    iframe.style.height = '1px';
    iframe.style.opacity = '0.01';
    iframe.style.pointerEvents = 'none';
    iframe.style.left = '0';
    iframe.style.bottom = '0';
    iframe.style.border = '0';
    iframe.style.clipPath = 'inset(50%)';
    iframe.style.overflow = 'hidden';
    iframe.setAttribute?.('aria-hidden', 'true');
    iframe.setAttribute?.('tabindex', '-1');
    iframe.setAttribute?.('allow', 'autoplay');
  }

  function cleanupSession(session) {
    if (!session || session.cleanedUp) return;
    session.cleanedUp = true;
    clearTimers();
    clearGestureRetry();
  }

  function emitStart(session) {
    if (!session || session.started) return;
    session.started = true;
    emitListeners(listeners, 'start', { text: session.segment.text, id: session.segment.id || '' });
    session.options.onSegmentStart?.({ text: session.segment.text, id: session.segment.id || '' });
  }

  function emitBlocked(session) {
    if (!session || session.blockedEmitted) return;
    session.blockedEmitted = true;
    session.awaitingGesture = true;
    const payload = {
      text: session.segment.text,
      id: session.segment.id || '',
      requiresGesture: true
    };
    emitListeners(listeners, 'blocked', payload);
    session.options.onAutoplayBlocked?.(payload);
  }

  function settleSession(session, result, settleOptions = {}) {
    if (!session || session.settled) return result;
    session.settled = true;
    cleanupSession(session);
    if (currentSession === session) currentSession = null;
    if (settleOptions.pausePlayer !== false) {
      try {
        player?.pause?.();
      } catch (_) {}
    }
    if (settleOptions.emitEnd) {
      const payload = {
        text: session.segment.text,
        id: session.segment.id || '',
        cancelled: settleOptions.cancelled === true
      };
      emitListeners(listeners, 'end', payload);
      session.options.onSegmentEnd?.(payload);
    }
    session.resolve?.(result);
    return result;
  }

  async function waitForPlayerReady(timeoutMs = 20000) {
    if (!player || !sourceUrl) return false;
    if (!player.src) {
      player.src = sourceUrl;
      player.volume = volume;
      promoteWidgetIframe();
    }
    promoteWidgetIframe();
    if (typeof player._waitForScReady === 'function') {
      return player._waitForScReady(Math.max(6000, Number(timeoutMs) || 0));
    }
    const deadline = Date.now() + Math.max(6000, Number(timeoutMs) || 0);
    while (Date.now() < deadline) {
      promoteWidgetIframe();
      if (player.widget && player._isReady) return true;
      await wait(100);
    }
    return !!(player.widget && player._isReady);
  }

  async function verifyTransportStart(targetStart = null) {
    const helper = windowRef.GameboyPlaybackHelpers?.verifyPlaybackStarted;
    if (!player || typeof helper !== 'function') return true;
    const normalizedTarget = Number.isFinite(targetStart) ? Number(targetStart) : null;

    const hasFreshProgress = (maxAgeMs = 2600) => {
      if (typeof player.hasRecentProgress !== 'function') return false;
      return !!player.hasRecentProgress(Math.max(800, Number(maxAgeMs) || 0));
    };

    const readTransportPosition = async () => {
      let currentPos = Number.isFinite(player.currentTime) ? Number(player.currentTime) : normalizedTarget;
      if (typeof player.getAccurateCurrentTime === 'function') {
        try {
          const accuratePos = await player.getAccurateCurrentTime(700);
          if (Number.isFinite(accuratePos)) currentPos = Number(accuratePos);
        } catch (_) {}
      }
      return Number.isFinite(currentPos) ? Number(currentPos) : null;
    };

    const isTransportLive = async () => {
      const transportPaused = (typeof player.isTransportPaused === 'function')
        ? player.isTransportPaused()
        : !!player.paused;
      if (transportPaused) return false;
      if (hasFreshProgress(2600)) return true;

      const baseline = await readTransportPosition();
      if (!Number.isFinite(baseline)) return false;
      await wait(210);
      const nextPos = await readTransportPosition();
      if (!Number.isFinite(nextPos)) return false;

      return (Number(nextPos) - Number(baseline)) >= 0.03;
    };

    try {
      const started = !!(await helper({
        player,
        retries: 5,
        delayMs: 320,
        requireAdvance: true,
        advanceThreshold: 0.04,
        initialPosition: normalizedTarget,
        play: async () => {
          const transportPaused = (typeof player.isTransportPaused === 'function')
            ? player.isTransportPaused()
            : !!player.paused;
          if (transportPaused || !hasFreshProgress(2200)) {
            await player.play();
          }
        },
        hasRecentProgress: () => hasFreshProgress(2600),
        isTransportPaused: () => (typeof player.isTransportPaused === 'function'
          ? player.isTransportPaused()
          : !!player.paused),
        isProbablyPlaying: () => (typeof player.isProbablyPlaying === 'function'
          ? player.isProbablyPlaying()
          : !player.paused)
      }));
      if (started) return true;
      return isTransportLive();
    } catch (_) {
      return isTransportLive();
    }
  }

  async function capturePosition(session) {
    if (!session || !player) return session?.resumeFromSec || 0;
    try {
      const time = await player.getAccurateCurrentTime(500);
      if (Number.isFinite(time)) {
        if (currentSession !== session || !session.paused) return session.resumeFromSec || Number(time);
        session.resumeFromSec = Math.max(session.segment.audioStartSec || 0, Number(time));
        return session.resumeFromSec;
      }
    } catch (_) {}
    const fallback = Number.isFinite(player.currentTime) ? Number(player.currentTime) : (session.resumeFromSec || 0);
    if (currentSession !== session || !session.paused) return session.resumeFromSec || fallback;
    session.resumeFromSec = Math.max(session.segment.audioStartSec || 0, fallback);
    return session.resumeFromSec;
  }

  function scheduleHardStop(session) {
    const remainingMs = Math.max(0, Number(session.remainingHardStopMs) || 0);
    if (remainingMs <= 0) {
      settleSession(session, true, { emitEnd: true, cancelled: false });
      return;
    }
    session.hardStopStartedAtMs = Date.now();
    hardStopTimer = windowRef.setTimeout(() => {
      if (currentSession !== session || session.settled || session.paused) return;
      session.remainingHardStopMs = 0;
      settleSession(session, true, { emitEnd: true, cancelled: false });
    }, remainingMs);
  }

  function scheduleSilentCompletion(session) {
    const remainingMs = Math.max(0, Number(session.remainingHoldMs) || 0);
    emitStart(session);
    if (remainingMs <= 0) {
      settleSession(session, true, { emitEnd: true, cancelled: false });
      return;
    }
    session.startedAtMs = Date.now();
    silentTimer = windowRef.setTimeout(() => {
      if (currentSession !== session || session.settled || session.paused) return;
      session.remainingHoldMs = 0;
      settleSession(session, true, { emitEnd: true, cancelled: false });
    }, remainingMs);
  }

  async function monitorStreamingPlayback(session) {
    if (!session || currentSession !== session || session.settled || session.paused) return;
    let position = session.resumeFromSec;
    try {
      position = await player.getAccurateCurrentTime(450);
    } catch (_) {
      position = Number.isFinite(player.currentTime) ? Number(player.currentTime) : session.resumeFromSec;
    }
    if (currentSession !== session || session.settled || session.paused) return;

    if (Number.isFinite(position)) {
      session.resumeFromSec = Math.max(session.segment.audioStartSec || 0, Number(position));
    }

    if ((session.resumeFromSec + END_TOLERANCE_SEC) >= session.segment.audioEndSec) {
      try {
        player.pause();
      } catch (_) {}
      try {
        player.currentTime = session.segment.audioEndSec;
      } catch (_) {}
      settleSession(session, true, { emitEnd: true, cancelled: false });
      return;
    }

    monitorTimer = windowRef.setTimeout(() => {
      void monitorStreamingPlayback(session);
    }, MONITOR_INTERVAL_MS);
  }

  function waitForGestureResume(session, targetStart) {
    if (!documentRef || typeof documentRef.addEventListener !== 'function') {
      return Promise.resolve(false);
    }
    clearGestureRetry();
    return new Promise((resolve) => {
      const listenerOptions = { capture: true, passive: true };
      const finish = (started) => {
        clearGestureRetry();
        resolve(!!started);
      };
      const handler = async () => {
        clearGestureRetry();
        if (currentSession !== session || session.settled || session.paused) {
          finish(false);
          return;
        }

        // iOS autoplay policy: issue play immediately inside the user-gesture handler.
        try {
          promoteWidgetIframe();
          const immediatePlay = player?.play?.();
          if (immediatePlay && typeof immediatePlay.catch === 'function') {
            immediatePlay.catch(() => {});
          }
        } catch (_) {}

        try {
          const alreadyStarted = await verifyTransportStart(targetStart);
          if (alreadyStarted) {
            finish(true);
            return;
          }
          if (Number.isFinite(targetStart) && typeof player?.seekAndConfirm === 'function') {
            await player.seekAndConfirm(targetStart, {
              maxAttempts: 2,
              settleMs: 100,
              tolerance: 0.45,
              readyTimeoutMs: 1200
            });
          }
          const started = await verifyTransportStart(targetStart);
          finish(started);
        } catch (_) {
          finish(false);
        }
      };
      gestureRetryHandler = handler;
      gestureCleanup = () => {
        GESTURE_EVENTS.forEach((eventName) => {
          documentRef.removeEventListener(eventName, handler, listenerOptions);
        });
      };
      GESTURE_EVENTS.forEach((eventName) => {
        documentRef.addEventListener(eventName, handler, listenerOptions);
      });
      emitBlocked(session);
    });
  }

  async function ensureTransportStarted(session, targetStart) {
    const started = await verifyTransportStart(targetStart);
    if (started) return true;
    if (currentSession !== session || session.settled || session.paused) return false;
    await wait(220);
    const startedAfterDelay = await verifyTransportStart(targetStart);
    if (startedAfterDelay) return true;
    if (currentSession !== session || session.settled || session.paused) return false;
    return waitForGestureResume(session, targetStart);
  }

  async function startStreamingSession(session) {
    const ready = await waitForPlayerReady(20000);
    if (!ready || currentSession !== session || session.settled) {
      settleSession(session, false, { emitEnd: true, cancelled: true, pausePlayer: false });
      return false;
    }
    if (session.paused) return false;
    const targetStart = Number.isFinite(session.resumeFromSec)
      ? Number(session.resumeFromSec)
      : Number(session.segment.audioStartSec);
    try {
      await player.seekAndConfirm(targetStart, {
        maxAttempts: 4,
        settleMs: 140,
        tolerance: 0.55,
        readyTimeoutMs: 5000
      });
    } catch (_) {}
    if (currentSession !== session || session.settled || session.paused) return false;
    await player.play();
    session.resumeFromSec = targetStart;
    if (currentSession !== session || session.settled || session.paused) {
      try {
        player.pause();
      } catch (_) {}
      return false;
    }
    const transportStarted = await ensureTransportStarted(session, targetStart);
    if (!transportStarted || currentSession !== session || session.settled || session.paused) {
      if (!session.paused && !session.settled) {
        settleSession(session, false, { emitEnd: true, cancelled: true });
      }
      return false;
    }
    session.awaitingGesture = false;
    emitStart(session);
    scheduleHardStop(session);
    void monitorStreamingPlayback(session);
    return true;
  }

  async function play(segmentOrText, optionsForPlay = {}) {
    stop();
    const segment = normalizeSegment(segmentOrText, optionsForPlay);
    currentText = segment.text;
    const session = {
      segment,
      options: optionsForPlay,
      resolve: null,
      settled: false,
      started: false,
      paused: false,
      cleanedUp: false,
      blockedEmitted: false,
      awaitingGesture: false,
      resumeFromSec: hasFiniteAudioRange(segment) ? Number(segment.audioStartSec) : null,
      remainingHoldMs: Number.isFinite(segment.holdDurationMs) ? Math.max(0, segment.holdDurationMs) : 0,
      startedAtMs: 0,
      remainingHardStopMs: hasFiniteAudioRange(segment)
        ? Math.max(1600, Math.round((Number(segment.audioEndSec) - Number(segment.audioStartSec)) * 1000) + 1400)
        : 0,
      hardStopStartedAtMs: 0
    };
    currentSession = session;

    const promise = new Promise((resolve) => {
      session.resolve = resolve;
    });

    if (hasFiniteAudioRange(segment)) {
      void startStreamingSession(session);
      return promise;
    }

    scheduleSilentCompletion(session);
    return promise;
  }

  function pause() {
    if (!currentSession || currentSession.paused || currentSession.settled) return false;
    const session = currentSession;
    session.paused = true;
    clearTimers();
    clearGestureRetry();

    if (hasFiniteAudioRange(session.segment)) {
      const immediatePos = Number.isFinite(player?.currentTime) ? Number(player.currentTime) : (session.resumeFromSec || 0);
      session.resumeFromSec = Math.max(session.segment.audioStartSec || 0, immediatePos);
      try {
        player?.pause?.();
      } catch (_) {}
      void capturePosition(session);
      return true;
    }

    if (session.startedAtMs > 0) {
      const elapsed = Date.now() - session.startedAtMs;
      session.remainingHoldMs = Math.max(0, session.remainingHoldMs - elapsed);
    }
    return true;
  }

  function resume() {
    if (!currentSession || !currentSession.paused || currentSession.settled) return false;
    const session = currentSession;
    session.paused = false;
    if (hasFiniteAudioRange(session.segment)) {
      void startStreamingSession(session);
      return true;
    }
    scheduleSilentCompletion(session);
    return true;
  }

  function stop() {
    const session = currentSession;
    currentSession = null;
    clearTimers();
    clearGestureRetry();
    try {
      player?.pause?.();
    } catch (_) {}
    if (session && !session.settled) {
      session.paused = false;
      settleSession(session, false, { emitEnd: true, cancelled: true, pausePlayer: false });
    }
  }

  function toggle() {
    if (isPlaying()) return pause();
    if (isPaused()) return resume();
    return primeFromGesture();
  }
  function primeFromGesture() {
    if (!player) return false;
    try {
      promoteWidgetIframe();
      const prevVolume = Number.isFinite(Number(player.volume)) ? Number(player.volume) : volume;
      try {
        player.volume = 0;
      } catch (_) {}

      try {
        const immediatePlay = player.play?.();
        if (immediatePlay && typeof immediatePlay.catch === 'function') {
          immediatePlay.catch(() => {});
        }
      } catch (_) {}

      windowRef.setTimeout(() => {
        try { player.pause?.(); } catch (_) {}
        try { player.volume = prevVolume; } catch (_) {}
      }, 80);
      return true;
    } catch (_) {
      return false;
    }
  }

  function acknowledgeGesture() {
    if (typeof gestureRetryHandler === 'function') {
      void gestureRetryHandler();
      return true;
    }
    if (currentSession
      && hasFiniteAudioRange(currentSession.segment)
      && !currentSession.paused
      && !currentSession.settled
      && currentSession.started !== true) {
      try {
        promoteWidgetIframe();
        const immediatePlay = player?.play?.();
        if (immediatePlay && typeof immediatePlay.catch === 'function') {
          immediatePlay.catch(() => {});
        }
      } catch (_) {}
      return true;
    }
    if (isPaused()) return resume();
    return primeFromGesture();
  }

  function setVolume(nextVolume) {
    volume = Math.max(0, Math.min(1, Number(nextVolume) || 0));
    if (player) player.volume = volume;
    return volume;
  }

  function onSegmentStart(listener) {
    if (typeof listener === 'function') listeners.start.add(listener);
    return () => listeners.start.delete(listener);
  }

  function onSegmentEnd(listener) {
    if (typeof listener === 'function') listeners.end.add(listener);
    return () => listeners.end.delete(listener);
  }

  function onAutoplayBlocked(listener) {
    if (typeof listener === 'function') listeners.blocked.add(listener);
    return () => listeners.blocked.delete(listener);
  }

  function isPlaying() {
    return !!currentSession && currentSession.started === true && currentSession.paused !== true && !currentSession.settled;
  }

  function isAwaitingGesture() {
    return !!currentSession && currentSession.awaitingGesture === true && currentSession.started !== true && !currentSession.settled;
  }

  function isPaused() {
    return !!currentSession && currentSession.paused === true && !currentSession.settled;
  }

  async function prepare() {
    if (!player || !sourceUrl) return false;
    if (!readyPromise) {
      readyPromise = waitForPlayerReady(20000).then((ready) => {
        if (!ready) readyPromise = null;
        return ready;
      });
    }
    return readyPromise;
  }

  if (player && sourceUrl) {
    try {
      player.src = sourceUrl;
      player.volume = volume;
      promoteWidgetIframe();
    } catch (_) {}
  }

  return {
    play,
    pause,
    resume,
    stop,
    toggle,
    acknowledgeGesture,
    primeFromGesture,
    setVolume,
    isPlaying,
    isAwaitingGesture,
    isPaused,
    getCurrentText() {
      return currentText;
    },
    onSegmentStart,
    onSegmentEnd,
    onAutoplayBlocked,
    prepare,
    getCurrentTime() {
      if (Number.isFinite(player?.currentTime)) return Number(player.currentTime);
      if (currentSession && Number.isFinite(currentSession.resumeFromSec)) return Number(currentSession.resumeFromSec);
      return 0;
    }
  };
}

export default createIntroNarrationAdapter;
