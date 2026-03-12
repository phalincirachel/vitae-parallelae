function getPageKeyMap(options = {}) {
  return options.pageKeyMap || {};
}

export function resolveBookmarkPageKey(page, options = {}) {
  return getPageKeyMap(options)[page] || options.defaultPageKey || 'kapitel1';
}

export function extractLoreIdFromBookmark(bookmark, fallbackKey = '') {
  const directLoreId = Number(bookmark && bookmark.loreId);
  if (Number.isFinite(directLoreId) && directLoreId > 0) return Math.trunc(directLoreId);

  const keyCandidate = typeof fallbackKey === 'string' && fallbackKey
    ? fallbackKey
    : (typeof (bookmark && bookmark.contentKey) === 'string' ? bookmark.contentKey : '');
  const keyMatch = keyCandidate.match(/^lore(\d+)$/i);
  if (keyMatch) return Number(keyMatch[1]);

  const chapterMatch = (typeof (bookmark && bookmark.chapter) === 'string' ? bookmark.chapter : '').match(/^lore(\d+)$/i);
  if (chapterMatch) return Number(chapterMatch[1]);

  const refs = [
    typeof (bookmark && bookmark.audioRef) === 'string' ? bookmark.audioRef : '',
    typeof (bookmark && bookmark.textRef) === 'string' ? bookmark.textRef : ''
  ];

  for (const ref of refs) {
    const match = ref.match(/lore(\d+)\.(?:mp3|txt)/i);
    if (match) return Number(match[1]);
  }

  return null;
}

export function resolveBookmarkContentKey(bookmark, options = {}) {
  if (bookmark && typeof bookmark.contentKey === 'string' && bookmark.contentKey.trim()) {
    return bookmark.contentKey.trim();
  }

  const loreId = extractLoreIdFromBookmark(bookmark);
  if (Number.isFinite(loreId) && loreId > 0) return `lore${loreId}`;

  if (bookmark && typeof bookmark.page === 'string' && getPageKeyMap(options)[bookmark.page]) {
    return getPageKeyMap(options)[bookmark.page];
  }

  return '';
}

export function resolveBookmarkDisplayChapter(bookmark, options = {}) {
  const currentPage = options.currentPage || '';
  const page = bookmark && typeof bookmark.page === 'string' && bookmark.page.trim()
    ? bookmark.page.trim()
    : currentPage;

  if (page === 'liminal library.html') return 'kapitel1b';
  if (page === 'index.html?chapter=kapitel1c') return 'kapitel1c';
  if (page === 'index.html') return 'kapitel1a';

  const contentKey = resolveBookmarkContentKey(bookmark, options);
  if (contentKey === 'liminal_library') return 'kapitel1b';
  if (contentKey === 'kapitel1c') return 'kapitel1c';
  if (contentKey === 'kapitel1') return 'kapitel1a';

  const chapter = typeof (bookmark && bookmark.chapter) === 'string'
    ? bookmark.chapter.trim().toLowerCase()
    : '';
  if (chapter === '1b' || chapter === 'kapitel1b') return 'kapitel1b';
  if (chapter === '1c' || chapter === 'kapitel1c') return 'kapitel1c';
  return options.defaultDisplayChapter || 'kapitel1a';
}

export function createBookmarkNavigationHelper(options = {}) {
  const mainContentKey = options.mainContentKey || '';
  const getActiveContentKey = typeof options.getActiveContentKey === 'function'
    ? options.getActiveContentKey
    : () => mainContentKey;
  const waitForContentSwitchIdle = typeof options.waitForContentSwitchIdle === 'function'
    ? options.waitForContentSwitchIdle
    : async () => {};
  const startLoreMode = typeof options.startLoreMode === 'function' ? options.startLoreMode : null;
  const restoreMainContent = typeof options.restoreMainContent === 'function' ? options.restoreMainContent : null;
  const logger = options.logger || console;

  const helper = {
    resolveBookmarkPageKey(page) {
      return resolveBookmarkPageKey(page, options);
    },

    extractLoreIdFromBookmark(bookmark, fallbackKey = '') {
      return extractLoreIdFromBookmark(bookmark, fallbackKey);
    },

    resolveBookmarkContentKey(bookmark) {
      return resolveBookmarkContentKey(bookmark, options);
    },

    resolveBookmarkDisplayChapter(bookmark) {
      return resolveBookmarkDisplayChapter(bookmark, options);
    },

    async ensureBookmarkContentForCurrentPage(bookmark, reason = 'bookmark') {
      await waitForContentSwitchIdle(`${reason}:pre`);

      const targetKey = helper.resolveBookmarkContentKey(bookmark);
      if (!targetKey) return true;

      const currentKey = getActiveContentKey();
      if (targetKey === currentKey) return true;

      if (/^lore\d+$/i.test(targetKey)) {
        const loreId = helper.extractLoreIdFromBookmark(bookmark, targetKey);
        if (!Number.isFinite(loreId) || loreId <= 0) {
          logger.warn?.('[Bookmark] Invalid lore target:', bookmark);
          return false;
        }

        if (!startLoreMode) return false;
        const loreResult = await startLoreMode(loreId, {
          reason,
          targetKey,
          bookmark
        });
        if (loreResult === false) return false;

        await waitForContentSwitchIdle(`${reason}:switch-lore`);
        return getActiveContentKey() === `lore${loreId}`;
      }

      if (targetKey === mainContentKey) {
        if (getActiveContentKey() !== mainContentKey) {
          if (!restoreMainContent) return false;
          const restoreResult = await restoreMainContent({
            reason,
            targetKey,
            bookmark,
            saveCurrent: true
          });
          if (restoreResult === false) return false;
          await waitForContentSwitchIdle(`${reason}:switch-main`);
        }
        return getActiveContentKey() === mainContentKey;
      }

      return false;
    }
  };

  return helper;
}

export default createBookmarkNavigationHelper;
