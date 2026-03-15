import { SC_URLS } from '../shared/audio/soundcloud-urls.js';

const DEFAULT_SOURCE_URL = SC_URLS.INTRO_LITA_1;
const MONITOR_INTERVAL_MS = 120;
const END_TOLERANCE_SEC = 0.2;

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
    end: new Set()
  };
  const windowRef = globalThis.window || globalThis;
  const AudioAdapter = options.AudioAdapter || windowRef.SCAudioAdapter || globalThis.SCAudioAdapter || null;
  const sourceUrl = String(options.sourceUrl || DEFAULT_SOURCE_URL || '');
  const player = AudioAdapter ? new AudioAdapter({ iframeId: options.iframeId || 'introNarrationAudio' }) : null;

  let volume = 1;
  let currentText = '';
  let activeToken = 0;
  let currentSession = null;
  let monitorTimer = null;
  let silentTimer = null;

  function clearTimers() {
    if (monitorTimer) {
      windowRef.clearTimeout(monitorTimer);
      monitorTimer = null;
    }
    if (silentTimer) {
      windowRef.clearTimeout(silentTimer);
      silentTimer = null;
    }
  }

  function cleanupSession(session) {
    if (!session || session.cleanedUp) return;
    session.cleanedUp = true;
    clearTimers();
  }

  function emitStart(session) {
    if (!session || session.started) return;
    session.started = true;
    emitListeners(listeners, 'start', { text: session.segment.text, id: session.segment.id || '' });
    session.options.onSegmentStart?.({ text: session.segment.text, id: session.segment.id || '' });
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

  async function waitForPlayerReady() {
    if (!player || !sourceUrl) return false;
    if (!player.src) {
      player.src = sourceUrl;
      player.volume = volume;
    }
    if (typeof player._waitForScReady === 'function') {
      return player._waitForScReady(6000);
    }
    const deadline = Date.now() + 6000;
    while (Date.now() < deadline) {
      if (player.widget && player._isReady) return true;
      await wait(100);
    }
    return !!(player.widget && player._isReady);
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

  async function startStreamingSession(session) {
    const ready = await waitForPlayerReady();
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
        settleMs: 180,
        tolerance: 0.55,
        readyTimeoutMs: 5000
      });
    } catch (_) {}
    if (currentSession !== session || session.settled || session.paused) return false;
    emitStart(session);
    await player.play();
    try {
      await player.seekAndConfirm(targetStart, {
        maxAttempts: 2,
        settleMs: 120,
        tolerance: 0.45,
        readyTimeoutMs: 1200
      });
      session.resumeFromSec = targetStart;
    } catch (_) {}
    if (currentSession !== session || session.settled || session.paused) {
      try {
        player.pause();
      } catch (_) {}
      return false;
    }
    void monitorStreamingPlayback(session);
    return true;
  }

  async function play(segmentOrText, optionsForPlay = {}) {
    stop();
    const segment = normalizeSegment(segmentOrText, optionsForPlay);
    currentText = segment.text;
    const session = {
      token: ++activeToken,
      segment,
      options: optionsForPlay,
      resolve: null,
      settled: false,
      started: false,
      paused: false,
      cleanedUp: false,
      resumeFromSec: hasFiniteAudioRange(segment) ? Number(segment.audioStartSec) : null,
      remainingHoldMs: Number.isFinite(segment.holdDurationMs) ? Math.max(0, segment.holdDurationMs) : 0,
      startedAtMs: 0
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

    if (hasFiniteAudioRange(session.segment)) {
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
    activeToken += 1;
    const session = currentSession;
    currentSession = null;
    clearTimers();
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
    return false;
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

  function isPlaying() {
    return !!currentSession && !currentSession.paused && !currentSession.settled;
  }

  function isPaused() {
    return !!currentSession && currentSession.paused === true && !currentSession.settled;
  }

  if (player && sourceUrl) {
    try {
      player.src = sourceUrl;
      player.volume = volume;
    } catch (_) {}
  }

  return {
    play,
    pause,
    resume,
    stop,
    toggle,
    setVolume,
    isPlaying,
    isPaused,
    getCurrentText() {
      return currentText;
    },
    onSegmentStart,
    onSegmentEnd
  };
}

export default createIntroNarrationAdapter;