(function bootstrapLiminalScene(globalObject) {
  const FALLBACK_LIMINAL_SCENE = Object.freeze({
    sceneName: 'liminal_library',
    contentKey: 'liminal_library',
    audioUrl: 'assets/kapitel1b.mp3',
    subtitleFile: 'assets/kapitel1b.txt',
    activeChapterBtn: 'chapter1bBtn',
    nextChapterTarget: 'index.html?chapter=kapitel1c',
    page: 'liminal library.html',
    chapterLabel: '1b',
    chapterTitle: 'Antiquariat Hannrath',
    loreProgressTotal: 5
  });

  const currentScriptUrl = (() => {
    const scriptSrc = globalObject.document?.currentScript?.src || '';
    if (scriptSrc) return new URL(scriptSrc, globalObject.location?.href || 'file:///');
    return new URL('assets/js/scenes/liminal3d/bootstrap.global.js', globalObject.location?.href || 'file:///');
  })();

  function getSceneRuntime(root) {
    return root.GameboySceneRuntime || root.window?.GameboySceneRuntime || null;
  }

  function getOverlay(root) {
    return root.LoadingTutorialOverlay || root.window?.LoadingTutorialOverlay || null;
  }

  function getLiminalScene(sceneRuntime) {
    return sceneRuntime && typeof sceneRuntime.getLiminalSceneRuntime === 'function'
      ? sceneRuntime.getLiminalSceneRuntime()
      : FALLBACK_LIMINAL_SCENE;
  }

  function resolveEntryModuleHref() {
    return new URL('../../entry/liminal-app.js', currentScriptUrl).href;
  }

  async function initLiminalSceneBootstrap(options = {}) {
    const root = options.root || globalObject;
    const sceneRuntime = options.sceneRuntime || getSceneRuntime(root);
    const liminalScene = options.liminalScene || getLiminalScene(sceneRuntime);
    const overlay = options.loadingTutorialOverlay || getOverlay(root);

    if (options.initOverlay !== false && overlay && typeof overlay.init === 'function') {
      overlay.init({
        pageKey: liminalScene.page,
        sceneKey: liminalScene.sceneName,
        chapterTitle: liminalScene.chapterTitle,
        loadingScreenId: options.loadingScreenId || 'loading-screen'
      });
    }

    const importEntryModule = typeof options.importEntryModule === 'function'
      ? options.importEntryModule
      : () => import(resolveEntryModuleHref());

    const entryModule = await importEntryModule();
    const entryRuntime = typeof entryModule?.initLiminalApp === 'function'
      ? await entryModule.initLiminalApp({
          locationLike: options.locationLike || root.location,
          sceneKey: liminalScene.sceneName
        })
      : entryModule;

    if (!entryRuntime || typeof entryRuntime.loadThree !== 'function') {
      throw new Error('Liminal entry module did not provide a three loader');
    }

    const threeResult = await entryRuntime.loadThree();
    if (options.assignThreeToWindow !== false && threeResult?.THREE && root.window) {
      root.window.THREE = threeResult.THREE;
    }

    return {
      sceneRuntime,
      liminalScene,
      entryRuntime,
      threeResult
    };
  }

  globalObject.GameboyLiminalSceneBootstrap = Object.freeze({
    init: initLiminalSceneBootstrap,
    getLiminalScene,
    FALLBACK_LIMINAL_SCENE,
    resolveEntryModuleHref
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
