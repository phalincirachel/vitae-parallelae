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

  async function play(text, optionsForPlay = {}) {
    if (!speech || !Utterance || !text) return false;
    stop();
    currentText = String(text);
    const token = ++activeToken;
    const voice = await resolveVoice();
    if (token !== activeToken) return false;

    const utterance = new Utterance(currentText);
    utterance.lang = optionsForPlay.lang || 'de-DE';
    utterance.rate = Number.isFinite(optionsForPlay.rate) ? optionsForPlay.rate : 1;
    utterance.pitch = Number.isFinite(optionsForPlay.pitch) ? optionsForPlay.pitch : 1;
    utterance.volume = volume;
    if (voice) utterance.voice = voice;

    currentUtterance = utterance;
    paused = false;

    return new Promise((resolve) => {
      utterance.onstart = () => {
        emit('start', { text: currentText });
        optionsForPlay.onSegmentStart?.({ text: currentText });
      };
      utterance.onend = () => {
        if (token !== activeToken) {
          resolve(false);
          return;
        }
        currentUtterance = null;
        paused = false;
        emit('end', { text: currentText, cancelled: false });
        optionsForPlay.onSegmentEnd?.({ text: currentText, cancelled: false });
        resolve(true);
      };
      utterance.onerror = () => {
        if (token !== activeToken) {
          resolve(false);
          return;
        }
        currentUtterance = null;
        paused = false;
        emit('end', { text: currentText, cancelled: true });
        optionsForPlay.onSegmentEnd?.({ text: currentText, cancelled: true });
        resolve(false);
      };
      speech.speak(utterance);
    });
  }

  function pause() {
    if (!speech?.speaking) return false;
    speech.pause?.();
    paused = true;
    return true;
  }

  function resume() {
    if (!speech?.paused) return false;
    speech.resume?.();
    paused = false;
    return true;
  }

  function stop() {
    activeToken += 1;
    paused = false;
    currentUtterance = null;
    if (speech?.speaking || speech?.paused) {
      speech.cancel?.();
    }
  }

  function toggle() {
    if (!speech) return false;
    if (speech.speaking && !speech.paused) return pause();
    if (speech.paused) return resume();
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

  return {
    play,
    pause,
    resume,
    stop,
    toggle,
    setVolume,
    isPlaying() {
      return !!speech?.speaking && !speech?.paused;
    },
    isPaused() {
      return !!speech?.paused || paused;
    },
    getCurrentText() {
      return currentText;
    },
    onSegmentStart,
    onSegmentEnd
  };
}

export default createIntroNarrationAdapter;
