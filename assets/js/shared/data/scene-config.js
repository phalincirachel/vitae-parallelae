import { CHAPTER_DB, normalizeSceneName } from './content-manifest.js';

const BASE_UI_SELECTORS = Object.freeze({
  archiveModal: '#archiveModal',
  archiveTabs: '.archive-tab',
  archivePanels: '.archive-tab-content',
  bookmarkList: '#bookmarkList',
  loreList: '#loreList',
  audioPlayerUi: '#audioPlayerUI',
  subtitleContainer: '#subtitleContainer',
  bookButton: '#bookBtn',
  loreProgressHud: '#loreProgressHud',
  fullscreenButton: '#fullscreenBtn',
  readingModeButton: '#readingModeBtn'
});

export const SCENE_CONFIGS = Object.freeze({
  marktplatz: Object.freeze({
    sceneKey: 'marktplatz',
    pageId: 'index.html',
    pageKey: 'index.html',
    chapterKey: 'kapitel1',
    chapterButtonId: CHAPTER_DB.marktplatz.chapterButtonId,
    mainContent: Object.freeze({
      contentKey: 'main:index',
      audio: 'assets/kapitel1.mp3',
      text: 'assets/kapitel1.txt'
    }),
    loreIds: CHAPTER_DB.marktplatz.loreIds,
    transitions: Object.freeze({
      self: 'index.html',
      liminal_library: 'liminal library.html',
      steingasse: 'index.html?chapter=kapitel1c'
    }),
    uiSelectors: BASE_UI_SELECTORS,
    featureFlags: Object.freeze({ renderer: 'canvas-2d', supportsPinchZoom: true }),
    compatibilityFlags: Object.freeze({ preserveIOSAudioWorkarounds: true })
  }),
  steingasse: Object.freeze({
    sceneKey: 'steingasse',
    pageId: 'index.html',
    pageKey: 'index.html?chapter=kapitel1c',
    chapterKey: 'kapitel1c',
    chapterButtonId: CHAPTER_DB.steingasse.chapterButtonId,
    mainContent: Object.freeze({
      contentKey: 'main:steingasse',
      audio: 'assets/kapitel1c.mp3',
      text: 'assets/kapitel1c.txt'
    }),
    loreIds: CHAPTER_DB.steingasse.loreIds,
    transitions: Object.freeze({
      marktplatz: 'index.html',
      liminal_library: 'liminal library.html',
      self: 'index.html?chapter=kapitel1c'
    }),
    uiSelectors: BASE_UI_SELECTORS,
    featureFlags: Object.freeze({ renderer: 'canvas-2d', supportsPinchZoom: true }),
    compatibilityFlags: Object.freeze({ preserveIOSAudioWorkarounds: true })
  }),
  liminal_library: Object.freeze({
    sceneKey: 'liminal_library',
    pageId: 'liminal library.html',
    pageKey: 'liminal library.html',
    chapterKey: 'kapitel1b',
    chapterButtonId: CHAPTER_DB.liminal_library.chapterButtonId,
    mainContent: Object.freeze({
      contentKey: 'main:liminal',
      audio: 'assets/kapitel1b.mp3',
      text: 'assets/kapitel1b.txt'
    }),
    loreIds: CHAPTER_DB.liminal_library.loreIds,
    transitions: Object.freeze({
      marktplatz: 'index.html',
      self: 'liminal library.html',
      steingasse: 'index.html?chapter=kapitel1c'
    }),
    uiSelectors: BASE_UI_SELECTORS,
    featureFlags: Object.freeze({ renderer: 'three-3d', supports2dFallback: true }),
    compatibilityFlags: Object.freeze({ preserveIOSAudioWorkarounds: true, preserveThreeFallback: true })
  })
});

export function getSceneConfig(sceneName) {
  const key = normalizeSceneName(sceneName);
  return SCENE_CONFIGS[key] || null;
}

export function getAllSceneConfigs() {
  return SCENE_CONFIGS;
}

export function resolveSceneFromLocation(locationLike = globalThis.location) {
  const pathname = typeof locationLike?.pathname === 'string' ? locationLike.pathname : '';
  const href = typeof locationLike?.href === 'string' ? locationLike.href : pathname;
  const search = typeof locationLike?.search === 'string' ? locationLike.search : '';
  const fileName = pathname.split('/').filter(Boolean).pop() || href.split('/').filter(Boolean).pop() || 'index.html';
  const params = new URLSearchParams(search || '');
  const chapter = normalizeSceneName(params.get('chapter') || '');

  if (chapter === 'steingasse') return SCENE_CONFIGS.steingasse;
  if (fileName.toLowerCase() === 'liminal library.html') return SCENE_CONFIGS.liminal_library;
  return SCENE_CONFIGS.marktplatz;
}

export function listSceneAssetPaths() {
  const assets = [];
  for (const config of Object.values(SCENE_CONFIGS)) {
    assets.push(config.mainContent.audio, config.mainContent.text);
  }
  return Array.from(new Set(assets));
}
