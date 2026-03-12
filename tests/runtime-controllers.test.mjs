import test from 'node:test';
import assert from 'node:assert/strict';
import { initSharedUiControllers } from '../assets/js/shared/ui/runtime-controllers.js';

function createElement() {
  return {
    classList: {
      add() {},
      remove() {},
      toggle() {},
      contains() { return false; }
    },
    style: {},
    listeners: {},
    addEventListener(type, handler) {
      this.listeners[type] = handler;
    },
    click() {
      this.listeners.click?.({ target: this });
    }
  };
}

test('initSharedUiControllers creates shared controllers and bookmark helper wiring', async () => {
  const elements = new Map([
    ['bookBtn', createElement()],
    ['closeArchiveBtn', createElement()],
    ['loreProgressHud', createElement()],
    ['btnSaveData', createElement()],
    ['btnLoadData', createElement()],
    ['fileInputSave', createElement()]
  ]);

  const documentRef = {
    getElementById(id) {
      return elements.get(id) || null;
    },
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
    createElement() {
      return createElement();
    },
    body: {
      appendChild() {},
      removeChild() {}
    }
  };

  const controllers = await initSharedUiControllers({
    document: documentRef,
    sceneName: 'marktplatz',
    defaultTotal: 5,
    chapterProgressSceneByButton: { chapter1Btn: 'marktplatz' },
    getGameState: () => ({ getChapterProgress: () => ({ collected: 1, total: 5 }) }),
    sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    getPlayerStateManager: () => null,
    pageKeyMap: {
      'index.html': 'kapitel1',
      'liminal library.html': 'liminal_library'
    },
    currentPage: 'index.html',
    mainContentKey: 'kapitel1',
    getActiveContentKey: () => 'kapitel1',
    waitForContentSwitchIdle: async () => {},
    startLoreMode: async () => true,
    restoreMainContent: async () => true,
    renderBookmarks: () => 0,
    syncReaderSettingsUi: () => {},
    triggerUiHaptic: () => {},
    activateLocalBookmark: async () => {},
    navigateCrossPageBookmark: async () => {},
    onLoreSelected: async () => {},
    isLoreActive: () => false,
    closeArchive: () => {},
    getActiveButtonId: () => 'chapter1Btn',
    chapterMenuButtons: [] ,
    renderArchive: () => {},
    setVisible: () => {},
    getCurrentPage: () => 'index.html'
  });

  assert.equal(typeof controllers.chapterProgressController.updateLoreProgressHud, 'function');
  assert.equal(typeof controllers.stateHandoffManager.write, 'function');
  assert.equal(typeof controllers.bookmarkNavigationHelper.ensureBookmarkContentForCurrentPage, 'function');
  assert.equal(typeof controllers.archiveTabsController.init, 'function');
  assert.equal(typeof controllers.archiveContentController.renderBookmarks, 'function');
  assert.equal(typeof controllers.chapterMenuController.render, 'function');
  assert.equal(typeof controllers.archiveInteractionsController.openArchive, 'function');
  assert.equal(typeof controllers.saveDataControlsController.requestImport, 'function');
  assert.equal(controllers.bookmarkNavigationHelper.resolveBookmarkPageKey('liminal library.html'), 'liminal_library');
});
