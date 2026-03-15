export function createIntroNarrationAdapter(options = {}) {
  const speech = options.speechSynthesis || globalThis.speechSynthesis || null;
  const Utterance = options.SpeechSynthesisUtterance || globalThis.SpeechSynthesisUtterance;
  const listeners = {
    start: new Set(),
    end: new Set()
  };
  let volume = 1;
  let currentUtterance = null;
  let currentText = '';
  let activeToken = 0;
  let paused = false;
  let currentSession = null;

  function emit(type, payload) {
    listeners[type]?.forEach((listener) => {
      try {
        listener(payload);
      } catch (_) {}
    });
  }

  async function resolveVoice() {
    if (!speech || typeof speech.getVoices !== 'function') return null;
    let voices = speech.getVoices();
    if (Array.isArray(voices) && voices.length > 0) {
      return pickVoice(voices);
    }

    voices = await new Promise((resolve) => {
      const timeoutId = setTimeout(() => resolve(speech.getVoices() || []), 600);
      speech.addEventListener?.('voiceschanged', function handleVoicesChanged() {
        clearTimeout(timeoutId);
        speech.removeEventListener?.('voiceschanged', handleVoicesChanged);
        resolve(speech.getVoices() || []);
      }, { once: true });
    });
    return pickVoice(voices);
  }

  function pickVoice(voices = []) {
    return voices.find((voice) => /^de(-|_)/i.test(voice.lang || ''))
      || voices.find((voice) => /german|deutsch/i.test(voice.name || ''))
      || voices[0]
      || null;
  }

  function cleanupUtterance() {
    if (!currentUtterance) return;
    currentUtterance.onstart = null;
    currentUtterance.onend = null;
    currentUtterance.onerror = null;
    currentUtterance.onboundary = null;
    currentUtterance = null;
  }

  function settleSession(session, result, optionsForSettle = {}) {
    if (!session || session.settled) return result;
    session.settled = true;
    if (currentSession === session) currentSession = null;
    paused = false;
    cleanupUtterance();
    if (optionsForSettle.emitEnd) {
      emit('end', { text: session.fullText, cancelled: optionsForSettle.cancelled === true });
      session.options.onSegmentEnd?.({ text: session.fullText, cancelled: optionsForSettle.cancelled === true });
    }
    session.resolve?.(result);
    return result;
  }

  async function speakSession(session) {
    if (!speech || !Utterance || !session || !session.remainingText || session.settled) return false;
    const token = session.token;
    const voice = await resolveVoice();
    if (token !== activeToken || currentSession !== session || session.stopped || session.settled) return false;

    const utterance = new Utterance(session.remainingText);
    utterance.lang = session.options.lang || 'de-DE';
    utterance.rate = Number.isFinite(session.options.rate) ? session.options.rate : 1;
    utterance.pitch = Number.isFinite(session.options.pitch) ? session.options.pitch : 1;
    utterance.volume = volume;
    if (voice) utterance.voice = voice;

    session.chunkBoundaryIndex = 0;
    currentUtterance = utterance;

    utterance.onstart = () => {
      if (!session.started) {
        session.started = true;
        emit('start', { text: session.fullText });
        session.options.onSegmentStart?.({ text: session.fullText });
      }
    };
    utterance.onboundary = (event) => {
      if (typeof event?.charIndex === 'number' && event.charIndex >= 0) {
        session.chunkBoundaryIndex = event.charIndex;
      }
    };
    utterance.onend = () => {
      cleanupUtterance();
      if (token !== activeToken || session.settled || session.stopped) return;
      if (session.paused) return;
      if (currentSession !== session) return;
      session.spokenOffset = session.fullText.length;
      session.remainingText = '';
      settleSession(session, true, { emitEnd: true, cancelled: false });
    };
    utterance.onerror = () => {
      cleanupUtterance();
      if (token !== activeToken || session.settled) return;
      if (session.paused || session.stopped) return;
      settleSession(session, false, { emitEnd: true, cancelled: true });
    };
    speech.speak(utterance);
    return true;
  }

  function stopCurrentSpeech() {
    cleanupUtterance();
    if (speech?.speaking || speech?.paused) {
      speech.cancel?.();
    }
  }

  async function play(text, optionsForPlay = {}) {
    if (!speech || !Utterance || !text) return false;
    stop();
    currentText = String(text);
    const session = {
      token: ++activeToken,
      options: optionsForPlay,
      fullText: currentText,
      remainingText: currentText,
      spokenOffset: 0,
      chunkBoundaryIndex: 0,
      paused: false,
      stopped: false,
      started: false,
      settled: false,
      resolve: null
    };
    currentSession = session;
    paused = false;
    const promise = new Promise((resolve) => {
      session.resolve = resolve;
    });
    await speakSession(session);
    return promise;
  }

  function pause() {
    if (!currentSession || paused) return false;
    const session = currentSession;
    const boundaryOffset = Number.isFinite(session.chunkBoundaryIndex) ? session.chunkBoundaryIndex : 0;
    const spokenOffset = Math.max(0, Math.min(session.fullText.length, session.spokenOffset + boundaryOffset));
    session.spokenOffset = spokenOffset;
    session.remainingText = session.fullText.slice(spokenOffset);
    session.paused = true;
    paused = true;
    stopCurrentSpeech();
    return true;
  }

  function resume() {
    if (!currentSession || !paused) return false;
    if (!currentSession.remainingText) {
      settleSession(currentSession, false, { emitEnd: false, cancelled: true });
      return false;
    }
    currentSession.paused = false;
    paused = false;
    void speakSession(currentSession);
    return true;
  }

  function stop() {
    activeToken += 1;
    paused = false;
    const session = currentSession;
    currentSession = null;
    if (session) {
      session.stopped = true;
      session.paused = false;
    }
    stopCurrentSpeech();
    if (session && !session.settled) {
      settleSession(session, false, { emitEnd: true, cancelled: true });
    }
  }

  function toggle() {
    if (!speech) return false;
    if (isPlaying()) return pause();
    if (isPaused()) return resume();
    return false;
  }

  function setVolume(nextVolume) {
    volume = Math.max(0, Math.min(1, Number(nextVolume) || 0));
    if (currentUtterance) currentUtterance.volume = volume;
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
    return !!currentSession && !paused;
  }

  function isPaused() {
    return !!currentSession && paused;
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
