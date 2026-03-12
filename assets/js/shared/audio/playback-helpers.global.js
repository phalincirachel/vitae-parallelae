(function bootstrapPlaybackHelpers(root, factory) {
  root.GameboyPlaybackHelpers = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function createPlaybackHelpers() {
  function waitMs(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function verifyPlaybackStarted(options = {}) {
    const player = options.player || null;
    if (!player) return false;

    const retries = Number.isFinite(options.retries) ? options.retries : 2;
    const delayMs = Number.isFinite(options.delayMs) ? options.delayMs : 320;
    const requireAdvance = options.requireAdvance !== false;
    const advanceThreshold = Number.isFinite(options.advanceThreshold) ? options.advanceThreshold : 0.08;
    const wait = typeof options.wait === 'function' ? options.wait : waitMs;
    const play = typeof options.play === 'function'
      ? options.play
      : async () => player.play();
    const getCurrentTime = typeof options.getCurrentTime === 'function'
      ? options.getCurrentTime
      : async () => {
          if (typeof player.getAccurateCurrentTime === 'function') {
            return player.getAccurateCurrentTime(700);
          }
          return player.currentTime || 0;
        };
    const hasRecentProgress = typeof options.hasRecentProgress === 'function'
      ? options.hasRecentProgress
      : () => (typeof player.hasRecentProgress === 'function' ? player.hasRecentProgress(1800) : false);
    const isTransportPaused = typeof options.isTransportPaused === 'function'
      ? options.isTransportPaused
      : () => !!player.paused;
    const isPaused = typeof options.isPaused === 'function'
      ? options.isPaused
      : () => !!player.paused;
    const isProbablyPlaying = typeof options.isProbablyPlaying === 'function'
      ? options.isProbablyPlaying
      : () => (typeof player.isProbablyPlaying === 'function' ? player.isProbablyPlaying() : !player.paused);

    let previousPos = Number.isFinite(options.initialPosition)
      ? options.initialPosition
      : await getCurrentTime(600);
    let sawRecentProgress = !!hasRecentProgress(1800);

    options.onStart?.({
      retries,
      delayMs,
      startPos: Number((previousPos || 0).toFixed(3)),
      paused: !!isPaused(),
      transportPaused: !!isTransportPaused(),
      sawRecentProgress
    });

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        await play();
      } catch (error) {
        options.onPlayError?.({ attempt: attempt + 1, error });
      }

      await wait(delayMs);
      const currentPos = await getCurrentTime(700);
      const advanced = requireAdvance && Number.isFinite(currentPos) && Number.isFinite(previousPos)
        ? (currentPos - previousPos) >= advanceThreshold
        : false;
      const transportPaused = !!isTransportPaused();
      const paused = !!isPaused();
      const probablyPlaying = !!isProbablyPlaying();
      const hasRecent = !!hasRecentProgress(1800);
      sawRecentProgress = sawRecentProgress || hasRecent;
      const started = !transportPaused && (requireAdvance ? (advanced || hasRecent) : hasRecent);

      const payload = {
        attempt: attempt + 1,
        paused,
        transportPaused,
        probablyPlaying,
        advanced,
        hasRecentProgress: hasRecent,
        previousPos: Number((previousPos || 0).toFixed(3)),
        currentPos: Number((currentPos || 0).toFixed(3)),
        started
      };
      options.onAttempt?.(payload);
      if (started) {
        options.onSuccess?.(payload);
        return true;
      }
      previousPos = Number.isFinite(currentPos) ? currentPos : previousPos;
    }

    const finalTransportPaused = !!isTransportPaused();
    if (!finalTransportPaused && sawRecentProgress) {
      options.onFallbackSuccess?.({ sawRecentProgress: true });
      return true;
    }

    options.onFailure?.({ retries, delayMs, sawRecentProgress, transportPaused: finalTransportPaused });
    return false;
  }

  return Object.freeze({
    verifyPlaybackStarted
  });
});
