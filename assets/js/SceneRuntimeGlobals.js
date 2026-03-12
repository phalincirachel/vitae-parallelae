(function bootstrapSceneRuntime(root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  root.GameboySceneRuntime = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createSceneRuntime() {
  const BOOKMARK_PAGE_KEY_MAP = Object.freeze({
    'index.html': 'kapitel1',
    'liminal library.html': 'liminal_library',
    'index.html?chapter=kapitel1c': 'kapitel1c'
  });

  const CHAPTER_PROGRESS_SCENE_BY_BUTTON = Object.freeze({
    chapter1Btn: 'marktplatz',
    chapter1bBtn: 'liminal_library',
    chapter1cBtn: 'steingasse'
  });

  const DEFAULT_LORE_PROGRESS_TOTAL = 5;

  const INDEX_LEVELS = Object.freeze({
    kapitel1: Object.freeze({
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
      loreProgressTotal: DEFAULT_LORE_PROGRESS_TOTAL
    }),
    kapitel1c: Object.freeze({
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
      loreProgressTotal: DEFAULT_LORE_PROGRESS_TOTAL
    })
  });

  const LIMINAL_SCENE = Object.freeze({
    sceneName: 'liminal_library',
    contentKey: 'liminal_library',
    audioUrl: 'assets/kapitel1b.mp3',
    subtitleFile: 'assets/kapitel1b.txt',
    activeChapterBtn: 'chapter1bBtn',
    nextChapterTarget: 'index.html?chapter=kapitel1c',
    page: 'liminal library.html',
    chapterLabel: '1b',
    chapterTitle: 'Antiquariat Hannrath',
    loreProgressTotal: DEFAULT_LORE_PROGRESS_TOTAL
  });

  function resolveIndexLevel(locationLike) {
    const search = typeof locationLike?.search === 'string' ? locationLike.search : '';
    const params = new URLSearchParams(search || '');
    const chapter = params.get('chapter');
    return INDEX_LEVELS[chapter] || INDEX_LEVELS.kapitel1;
  }

  function getLiminalSceneRuntime() {
    return LIMINAL_SCENE;
  }

  function getBookmarkPageKeyMap() {
    return BOOKMARK_PAGE_KEY_MAP;
  }

  function getChapterProgressSceneByButton() {
    return CHAPTER_PROGRESS_SCENE_BY_BUTTON;
  }

  return Object.freeze({
    BOOKMARK_PAGE_KEY_MAP,
    CHAPTER_PROGRESS_SCENE_BY_BUTTON,
    DEFAULT_LORE_PROGRESS_TOTAL,
    INDEX_LEVELS,
    LIMINAL_SCENE,
    resolveIndexLevel,
    getLiminalSceneRuntime,
    getBookmarkPageKeyMap,
    getChapterProgressSceneByButton
  });
});
