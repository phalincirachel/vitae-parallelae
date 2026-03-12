export function initLoadingTutorialOverlay(options = {}) {
  const overlay = options.overlay || globalThis.window?.LoadingTutorialOverlay || globalThis.LoadingTutorialOverlay || null;
  if (!overlay || typeof overlay.init !== 'function') {
    return false;
  }

  overlay.init({
    pageKey: options.pageKey || '',
    sceneKey: options.sceneKey || '',
    chapterTitle: options.chapterTitle || '',
    loadingScreenId: options.loadingScreenId || 'loading-screen'
  });
  return true;
}

export default initLoadingTutorialOverlay;
