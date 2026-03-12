function getGameState(options = {}) {
  if (typeof options.getGameState === 'function') return options.getGameState();
  return options.gameState || globalThis.window?.GameState || globalThis.GameState || null;
}

function getDocument(options = {}) {
  return options.document || globalThis.document || null;
}

function getCurrentPage(options = {}) {
  return typeof options.getCurrentPage === 'function' ? options.getCurrentPage() : (options.currentPage || '');
}

function createItemTextElement(documentRef, className, text) {
  const element = documentRef.createElement('div');
  element.className = className;
  element.innerText = text;
  element.textContent = text;
  return element;
}

export function createArchiveContentController(options = {}) {
  const documentRef = getDocument(options);
  const bookmarkListId = options.bookmarkListId || 'bookmarkList';
  const loreListId = options.loreListId || 'loreList';
  const resolveBookmarkDisplayChapter = typeof options.resolveBookmarkDisplayChapter === 'function'
    ? options.resolveBookmarkDisplayChapter
    : () => 'kapitel1a';
  const resolveBookmarkPageKey = typeof options.resolveBookmarkPageKey === 'function'
    ? options.resolveBookmarkPageKey
    : (page) => page;
  const resolveBookmarkContentKey = typeof options.resolveBookmarkContentKey === 'function'
    ? options.resolveBookmarkContentKey
    : () => '';
  const ensureBookmarkContentForCurrentPage = typeof options.ensureBookmarkContentForCurrentPage === 'function'
    ? options.ensureBookmarkContentForCurrentPage
    : async () => true;
  const activateLocalBookmark = typeof options.activateLocalBookmark === 'function'
    ? options.activateLocalBookmark
    : async () => {};
  const navigateCrossPageBookmark = typeof options.navigateCrossPageBookmark === 'function'
    ? options.navigateCrossPageBookmark
    : async () => {};
  const onLoreSelected = typeof options.onLoreSelected === 'function'
    ? options.onLoreSelected
    : async () => {};
  const isLoreActive = typeof options.isLoreActive === 'function'
    ? options.isLoreActive
    : () => false;
  const closeArchive = typeof options.closeArchive === 'function'
    ? options.closeArchive
    : () => {};
  const updateChapterProgressIndicators = typeof options.updateChapterProgressIndicators === 'function'
    ? options.updateChapterProgressIndicators
    : () => {};
  const logger = options.logger || console;

  const controller = {
    renderBookmarks() {
      const list = documentRef?.getElementById?.(bookmarkListId) || null;
      if (!list || !documentRef) return 0;
      list.innerHTML = '';

      const gameState = getGameState(options);
      if (!gameState || typeof gameState.getBookmarks !== 'function') return 0;
      const bookmarks = gameState.getBookmarks();
      if (!Array.isArray(bookmarks) || bookmarks.length === 0) return 0;

      bookmarks.forEach((bookmark) => {
        const item = documentRef.createElement('div');
        item.className = 'menu-item bookmark-item';

        const timeStr = typeof gameState.formatBookmarkTime === 'function'
          ? gameState.formatBookmarkTime(bookmark.time)
          : String(bookmark.time || 0);
        const mainText = createItemTextElement(
          documentRef,
          'item-main-text',
          `${resolveBookmarkDisplayChapter(bookmark)} - ${timeStr}`
        );
        const subText = createItemTextElement(documentRef, 'item-sub-text', bookmark.textPreview || '');

        const deleteButton = documentRef.createElement('button');
        deleteButton.className = 'bookmark-delete-btn';
        deleteButton.innerHTML = '&times;';
        deleteButton.addEventListener?.('click', async (event) => {
          event?.stopPropagation?.();
          if (typeof gameState.removeBookmark === 'function') {
            await gameState.removeBookmark(bookmark.id);
          }
          controller.renderBookmarks();
        });

        item.appendChild(mainText);
        item.appendChild(subText);
        item.appendChild(deleteButton);

        item.addEventListener?.('click', async () => {
          closeArchive(options.bookmarkSelectCloseReason || 'bookmark-select');
          const targetPage = typeof bookmark.page === 'string' && bookmark.page ? bookmark.page : getCurrentPage(options);
          const targetContentKey = resolveBookmarkContentKey(bookmark);
          const isLoreBookmark = /^lore\d+$/i.test(targetContentKey);

          if (targetPage === getCurrentPage(options) || isLoreBookmark) {
            const reason = isLoreBookmark
              ? `bookmark:${bookmark.id}:lore-local`
              : `bookmark:${bookmark.id}:same-page`;
            const ready = await ensureBookmarkContentForCurrentPage(bookmark, reason);
            if (!ready) {
              logger.warn?.('[Bookmark] Could not activate target content on current page.', bookmark);
              return;
            }
            await activateLocalBookmark(bookmark, { reason, isLoreBookmark, targetContentKey });
            return;
          }

          const targetPageKey = resolveBookmarkPageKey(targetPage);
          await navigateCrossPageBookmark(bookmark, {
            targetPage,
            targetPageKey,
            targetContentKey
          });
        });

        list.appendChild(item);
      });

      return bookmarks.length;
    },

    renderLoreList() {
      const list = documentRef?.getElementById?.(loreListId) || null;
      if (!list || !documentRef) return 0;
      list.innerHTML = '';
      updateChapterProgressIndicators();

      const gameState = getGameState(options);
      if (!gameState || typeof gameState.getAllLore !== 'function') return 0;

      const db = gameState.getAllLore();
      const collectedIds = Array.isArray(gameState.state?.collectedLore)
        ? [...gameState.state.collectedLore].sort((left, right) => left - right)
        : [];

      collectedIds.forEach((id) => {
        const content = db[id];
        if (!content) return;

        const item = documentRef.createElement('div');
        item.className = 'menu-item';
        if (isLoreActive(id)) item.classList?.add?.('active');

        item.appendChild(createItemTextElement(documentRef, 'item-main-text', content.title));
        item.appendChild(createItemTextElement(documentRef, 'item-sub-text', content.duration));
        item.addEventListener?.('click', async () => {
          closeArchive(options.loreSelectCloseReason || 'lore-select');
          await onLoreSelected(id);
        });

        list.appendChild(item);
      });

      updateChapterProgressIndicators();
      return collectedIds.length;
    }
  };

  return controller;
}

export default createArchiveContentController;
