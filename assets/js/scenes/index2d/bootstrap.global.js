(function bootstrapIndexScene(globalObject) {
  const FALLBACK_CHAPTER_PROGRESS_SCENE_BY_BUTTON = Object.freeze({
    chapter1Btn: 'marktplatz',
    chapter1bBtn: 'liminal_library',
    chapter1cBtn: 'steingasse'
  });

  const FALLBACK_BOOKMARK_PAGE_KEY_MAP = Object.freeze({
    'index.html': 'kapitel1',
    'liminal library.html': 'liminal_library',
    'index.html?chapter=kapitel1c': 'kapitel1c'
  });

  function getSceneRuntime(root) {
    return root.GameboySceneRuntime || root.window?.GameboySceneRuntime || null;
  }

  function getOverlay(root) {
    return root.LoadingTutorialOverlay || root.window?.LoadingTutorialOverlay || null;
  }

  function fallbackResolveIndexLevel(locationLike) {
    const search = typeof locationLike?.search === 'string' ? locationLike.search : '';
    if (search.includes('kapitel1c')) {
      return {
        sceneName: 'steingasse',
        contentKey: 'kapitel1c',
        mapFile: 'assets/kapitel1c.png',
        audioUrl: 'assets/kapitel1c.mp3',
        subtitleFile: 'assets/kapitel1c.txt',
        activeChapterBtn: 'chapter1cBtn',
        nextChapterTarget: null,
        page: 'index.html?chapter=kapitel1c',
        chapterLabel: '1c',
        chapterTitle: 'Steingasse',
        loreProgressTotal: 5
      };
    }

    return {
      sceneName: 'marktplatz',
      contentKey: 'kapitel1',
      mapFile: 'assets/platz3.png',
      audioUrl: 'assets/kapitel1.mp3',
      subtitleFile: 'assets/kapitel1.txt',
      activeChapterBtn: 'chapter1Btn',
      nextChapterTarget: 'liminal library.html',
      page: 'index.html',
      chapterLabel: '1a',
      chapterTitle: 'Marktplatz',
      loreProgressTotal: 5
    };
  }

  function initIndexSceneBootstrap(options = {}) {
    const root = options.root || globalObject;
    const sceneRuntime = options.sceneRuntime || getSceneRuntime(root);
    const locationLike = options.locationLike || root.location;
    const level = sceneRuntime && typeof sceneRuntime.resolveIndexLevel === 'function'
      ? sceneRuntime.resolveIndexLevel(locationLike)
      : fallbackResolveIndexLevel(locationLike);

    const overlay = options.loadingTutorialOverlay || getOverlay(root);
    if (options.initOverlay !== false && overlay && typeof overlay.init === 'function') {
      overlay.init({
        pageKey: level.page,
        sceneKey: level.sceneName,
        chapterTitle: level.chapterTitle,
        loadingScreenId: options.loadingScreenId || 'loading-screen'
      });
    }

    return {
      sceneRuntime,
      level,
      sceneName: level.sceneName,
      loreProgressDefaultTotal: level.loreProgressTotal || sceneRuntime?.DEFAULT_LORE_PROGRESS_TOTAL || 5,
      chapterProgressSceneByButton: sceneRuntime?.CHAPTER_PROGRESS_SCENE_BY_BUTTON || FALLBACK_CHAPTER_PROGRESS_SCENE_BY_BUTTON,
      bookmarkPageKeyMap: sceneRuntime?.BOOKMARK_PAGE_KEY_MAP || FALLBACK_BOOKMARK_PAGE_KEY_MAP
    };
  }

  globalObject.GameboyIndexSceneBootstrap = Object.freeze({
    init: initIndexSceneBootstrap,
    fallbackResolveIndexLevel,
    FALLBACK_CHAPTER_PROGRESS_SCENE_BY_BUTTON,
    FALLBACK_BOOKMARK_PAGE_KEY_MAP
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
