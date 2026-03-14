(function initIndexLoopRuntime(globalObject) {
  function initIndexLoopRuntime(options = {}) {
    const root = options.root || globalObject;
    const windowObject = options.window || root.window || root;
    const documentObject = options.document || root.document || null;
    const requestFrame = typeof options.requestAnimationFrame === 'function'
      ? options.requestAnimationFrame
      : (callback) => windowObject.requestAnimationFrame(callback);
    const hideLoadingScreenSafely = typeof options.hideLoadingScreenSafely === 'function'
      ? options.hideLoadingScreenSafely
      : () => {};
    const update = typeof options.update === 'function' ? options.update : () => {};
    const updateLoreSystem = typeof options.updateLoreSystem === 'function' ? options.updateLoreSystem : () => {};
    const draw = typeof options.draw === 'function' ? options.draw : () => {};
    const getGameReady = typeof options.getGameReady === 'function' ? options.getGameReady : () => false;
    const getLastTime = typeof options.getLastTime === 'function' ? options.getLastTime : () => 0;
    const setLastTime = typeof options.setLastTime === 'function' ? options.setLastTime : () => {};
    const log = typeof options.log === 'function' ? options.log : () => {};

    function gameLoop(timestamp) {
      if (windowObject.visualFreezeActive) {
        windowObject.gameLoopRunning = false;
        return false;
      }

      if (windowObject.gamePaused) {
        requestFrame(gameLoop);
        return true;
      }

      let lastTime = getLastTime();
      if (!lastTime) lastTime = timestamp;
      let dt = (timestamp - lastTime) / 1000;
      setLastTime(timestamp);

      if (dt > 0.1) dt = 0.1;
      if (dt > 0.1) dt = 0.1;

      update(dt);
      updateLoreSystem();
      draw();
      requestFrame(gameLoop);
      return dt;
    }

    function startGameLoop() {
      if (windowObject.gameLoopRunning) return false;
      if (windowObject.visualFreezeActive) return false;
      windowObject.gameLoopRunning = true;
      setLastTime(0);
      if (getGameReady()) {
        hideLoadingScreenSafely('start-game-loop');
        const processingInfoEl = documentObject && typeof documentObject.getElementById === 'function'
          ? documentObject.getElementById('processingInfo')
          : null;
        if (processingInfoEl && processingInfoEl.style) {
          processingInfoEl.style.display = 'none';
        }
      }
      log('startGameLoop');
      requestFrame(gameLoop);
      return true;
    }

    return {
      startGameLoop,
      gameLoop
    };
  }

  globalObject.GameboyIndexLoopRuntime = Object.freeze({
    init: initIndexLoopRuntime
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
