export async function initSharedUiControllers(options = {}) {
  const documentRef = options.document || globalThis.document || null;
  const logger = options.logger || console;
  const [
    chapterProgressModule,
    stateHandoffModule,
    bookmarkNavigationModule,
    archiveTabsModule,
    archiveContentModule,
    chapterMenuModule,
    archiveInteractionsModule,
    saveDataControlsModule
  ] = await Promise.all([
    import('./chapter-progress.js'),
    import('../state/state-handoff.js'),
    import('../core/bookmark-navigation.js'),
    import('./archive-tabs.js'),
    import('./archive-content.js'),
    import('./chapter-menu.js'),
    import('./archive-interactions.js'),
    import('./save-data-controls.js')
  ]);

  const chapterProgressController = chapterProgressModule.createChapterProgressController({
    sceneName: options.sceneName || '',
    defaultTotal: options.defaultTotal,
    chapterProgressSceneByButton: options.chapterProgressSceneByButton,
    getGameState: options.getGameState,
    document: documentRef
  });

  const stateHandoffManager = stateHandoffModule.createStateHandoffManager({
    sessionStorage: options.sessionStorage || globalThis.sessionStorage,
    getPlayerStateManager: options.getPlayerStateManager,
    onWrite: options.onWrite,
    onMerge: options.onMerge,
    onMissingExpected: options.onMissingExpected,
    onZeroMerge: options.onZeroMerge,
    onError: options.onError
  });

  const bookmarkNavigationHelper = bookmarkNavigationModule.createBookmarkNavigationHelper({
    pageKeyMap: options.pageKeyMap,
    currentPage: options.currentPage || '',
    mainContentKey: options.mainContentKey || '',
    getActiveContentKey: options.getActiveContentKey,
    waitForContentSwitchIdle: options.waitForContentSwitchIdle,
    startLoreMode: options.startLoreMode,
    restoreMainContent: options.restoreMainContent,
    logger: options.bookmarkLogger || logger
  });

  const archiveTabsController = archiveTabsModule.createArchiveTabsController({
    document: documentRef,
    renderBookmarks: options.renderBookmarks,
    syncReaderSettingsUi: options.syncReaderSettingsUi,
    triggerUiHaptic: options.triggerUiHaptic,
    initialContentTab: options.initialContentTab
  });

  const archiveContentController = archiveContentModule.createArchiveContentController({
    document: documentRef,
    getGameState: options.getGameState,
    getCurrentPage: options.getCurrentPage || (() => options.currentPage || ''),
    resolveBookmarkDisplayChapter: (bookmark) => bookmarkNavigationHelper.resolveBookmarkDisplayChapter(bookmark),
    resolveBookmarkPageKey: (page) => bookmarkNavigationHelper.resolveBookmarkPageKey(page),
    resolveBookmarkContentKey: (bookmark) => bookmarkNavigationHelper.resolveBookmarkContentKey(bookmark),
    ensureBookmarkContentForCurrentPage: (bookmark, reason) => bookmarkNavigationHelper.ensureBookmarkContentForCurrentPage(bookmark, reason),
    activateLocalBookmark: options.activateLocalBookmark,
    navigateCrossPageBookmark: options.navigateCrossPageBookmark,
    onLoreSelected: options.onLoreSelected,
    isLoreActive: options.isLoreActive,
    closeArchive: options.closeArchive,
    updateChapterProgressIndicators: () => chapterProgressController.updateChapterProgressIndicators(),
    logger,
    bookmarkSelectCloseReason: options.bookmarkSelectCloseReason,
    loreSelectCloseReason: options.loreSelectCloseReason
  });

  const chapterMenuController = chapterMenuModule.createChapterMenuController({
    document: documentRef,
    activeButtonId: options.activeButtonId,
    getActiveButtonId: options.getActiveButtonId,
    buttons: options.chapterMenuButtons || [],
    chapterListSelector: options.chapterListSelector
  });

  const archiveInteractionsController = archiveInteractionsModule.createArchiveInteractionsController({
    document: documentRef,
    storage: options.storage,
    primarySeenStorageKey: options.primarySeenStorageKey,
    archiveModalId: options.archiveModalId,
    primaryInhaltButtonId: options.primaryInhaltButtonId,
    loreProgressHudId: options.loreProgressHudId,
    bookButtonId: options.bookButtonId,
    closeButtonId: options.closeButtonId,
    loreTabSelector: options.loreTabSelector,
    renderArchive: options.renderArchive,
    setVisible: options.setVisible,
    onAfterLoreHudOpen: options.onAfterLoreHudOpen
  });
  if (options.bindArchiveInteractions !== false) {
    archiveInteractionsController.bind();
  }

  const saveDataControlsController = saveDataControlsModule.createSaveDataControls({
    document: documentRef,
    getGameState: options.getGameState,
    alert: options.alert,
    location: options.location || globalThis.location,
    URL: options.URL,
    Blob: options.Blob,
    FileReader: options.FileReader,
    saveButtonId: options.saveButtonId,
    loadButtonId: options.loadButtonId,
    fileInputId: options.fileInputId,
    downloadPrefix: options.downloadPrefix,
    successMessage: options.successMessage,
    invalidMessage: options.invalidMessage
  });
  if (options.bindSaveDataControls !== false) {
    saveDataControlsController.bind();
  }

  return {
    chapterProgressController,
    stateHandoffManager,
    bookmarkNavigationHelper,
    archiveTabsController,
    archiveContentController,
    chapterMenuController,
    archiveInteractionsController,
    saveDataControlsController
  };
}

export default initSharedUiControllers;
