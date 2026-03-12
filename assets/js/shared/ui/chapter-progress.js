const DEFAULT_LORE_PROGRESS_TOTAL = 5;

function getGameStateFromOptions(options = {}) {
  if (typeof options.getGameState === 'function') return options.getGameState();
  if (options.gameState) return options.gameState;
  return globalThis.window?.GameState || globalThis.GameState || null;
}

function normalizeTotal(total, fallback = DEFAULT_LORE_PROGRESS_TOTAL) {
  const numeric = Number(total);
  if (Number.isFinite(numeric) && numeric > 0) return Math.trunc(numeric);
  return fallback;
}

export function getChapterProgressSnapshot(sceneName, options = {}) {
  const gameState = getGameStateFromOptions(options);
  const fallbackTotal = normalizeTotal(options.defaultTotal);

  if (gameState && typeof gameState.getChapterProgress === 'function') {
    const progress = gameState.getChapterProgress(sceneName) || {};
    const collected = Number(progress.collected);
    return {
      sceneName: typeof progress.sceneName === 'string' && progress.sceneName ? progress.sceneName : sceneName,
      chapterTitle: typeof progress.chapterTitle === 'string' && progress.chapterTitle ? progress.chapterTitle : sceneName,
      collected: Number.isFinite(collected) ? collected : 0,
      total: normalizeTotal(progress.total, fallbackTotal)
    };
  }

  const fallbackLights = gameState
    && gameState.state
    && gameState.state.collectedLights
    && Array.isArray(gameState.state.collectedLights[sceneName])
    ? gameState.state.collectedLights[sceneName]
    : [];
  const collected = Math.min(fallbackLights.length, fallbackTotal);

  return {
    sceneName,
    chapterTitle: sceneName,
    collected,
    total: fallbackTotal
  };
}

export function resolveLoreProgressVisibility(options = {}) {
  if (options.forceVisible === true) return true;
  if (options.forceHidden === true) return false;
  return !options.readingModeActive && !!options.uiVisible;
}

export function createChapterProgressController(options = {}) {
  const documentRef = options.document || globalThis.document || null;
  const defaultTotal = normalizeTotal(options.defaultTotal);
  const getSceneName = typeof options.getSceneName === 'function'
    ? options.getSceneName
    : () => options.sceneName || '';
  const getElementById = typeof options.getElementById === 'function'
    ? options.getElementById
    : (id) => documentRef?.getElementById?.(id) || null;
  const chapterProgressSceneByButton = options.chapterProgressSceneByButton || {};
  const hudId = options.hudId || 'loreProgressHud';
  const labelId = options.labelId || 'loreProgressText';
  const audioPlayerUiId = options.audioPlayerUiId || 'audioPlayerUI';

  const controller = {
    getChapterProgressForScene(sceneName) {
      return getChapterProgressSnapshot(sceneName, {
        defaultTotal,
        getGameState: () => getGameStateFromOptions(options)
      });
    },

    ensureChapterProgressBadge(menuItem, sceneName) {
      if (!menuItem || typeof menuItem.querySelector !== 'function') return null;
      const mainText = menuItem.querySelector('.item-main-text');
      if (!mainText) return null;

      if (typeof menuItem.querySelectorAll === 'function') {
        menuItem.querySelectorAll('.chapter-progress-count').forEach((legacyEl) => legacyEl.remove());
      }

      let badge = typeof mainText.querySelector === 'function'
        ? mainText.querySelector('.chapter-progress-inline')
        : null;
      if (!badge && documentRef && typeof documentRef.createElement === 'function') {
        badge = documentRef.createElement('span');
        badge.className = 'chapter-progress-inline';
        mainText.appendChild(badge);
      }

      if (!badge) return null;

      mainText.classList?.add?.('with-progress');
      const progress = controller.getChapterProgressForScene(sceneName);
      badge.textContent = `${progress.collected}/${progress.total}`;
      badge.setAttribute?.('aria-label', `Lorefortschritt ${progress.collected} von ${progress.total}`);
      return progress;
    },

    updateChapterProgressIndicators() {
      Object.entries(chapterProgressSceneByButton).forEach(([buttonId, sceneName]) => {
        const menuItem = getElementById(buttonId);
        if (!menuItem) return;
        controller.ensureChapterProgressBadge(menuItem, sceneName);
      });
    },

    updateLoreProgressHud(progressOptions = {}) {
      const hud = getElementById(progressOptions.hudId || hudId);
      const label = getElementById(progressOptions.labelId || labelId);
      if (!hud || !label) return null;

      const progress = controller.getChapterProgressForScene(getSceneName());
      label.textContent = `${progress.collected}/${progress.total}`;

      const ui = getElementById(progressOptions.audioPlayerUiId || audioPlayerUiId);
      const shouldShow = resolveLoreProgressVisibility({
        forceVisible: progressOptions.forceVisible,
        forceHidden: progressOptions.forceHidden,
        readingModeActive: !!(ui && ui.classList?.contains?.('reading-mode')),
        uiVisible: !!(ui && ui.style?.display !== 'none')
      });

      hud.classList?.toggle?.('is-visible', shouldShow);
      hud.classList?.toggle?.('is-hidden', !shouldShow);
      return { progress, shouldShow };
    },

    refreshLoreProgressUi(progressOptions = {}) {
      controller.updateChapterProgressIndicators();
      return controller.updateLoreProgressHud(progressOptions);
    }
  };

  return controller;
}

export { DEFAULT_LORE_PROGRESS_TOTAL };
export default createChapterProgressController;
