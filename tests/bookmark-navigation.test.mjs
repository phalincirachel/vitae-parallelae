import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createBookmarkNavigationHelper,
  extractLoreIdFromBookmark,
  resolveBookmarkContentKey,
  resolveBookmarkDisplayChapter,
  resolveBookmarkPageKey
} from '../assets/js/shared/core/bookmark-navigation.js';

const PAGE_KEY_MAP = {
  'index.html': 'kapitel1',
  'liminal library.html': 'liminal_library',
  'index.html?chapter=kapitel1c': 'kapitel1c'
};

test('bookmark navigation resolves page, content and display chapter', () => {
  assert.equal(resolveBookmarkPageKey('liminal library.html', { pageKeyMap: PAGE_KEY_MAP }), 'liminal_library');
  assert.equal(extractLoreIdFromBookmark({ audioRef: 'assets/lore7.mp3' }), 7);
  assert.equal(resolveBookmarkContentKey({ page: 'index.html?chapter=kapitel1c' }, { pageKeyMap: PAGE_KEY_MAP }), 'kapitel1c');
  assert.equal(
    resolveBookmarkDisplayChapter(
      { page: 'custom.html', contentKey: 'liminal_library' },
      { currentPage: 'custom.html', pageKeyMap: PAGE_KEY_MAP }
    ),
    'kapitel1b'
  );
});

test('bookmark navigation helper switches into lore content', async () => {
  const waits = [];
  let activeKey = 'kapitel1';
  const helper = createBookmarkNavigationHelper({
    pageKeyMap: PAGE_KEY_MAP,
    currentPage: 'index.html',
    mainContentKey: 'kapitel1',
    getActiveContentKey: () => activeKey,
    waitForContentSwitchIdle: async (reason) => {
      waits.push(reason);
    },
    startLoreMode: async (loreId) => {
      activeKey = `lore${loreId}`;
    }
  });

  const result = await helper.ensureBookmarkContentForCurrentPage({ contentKey: 'lore3' }, 'jump');
  assert.equal(result, true);
  assert.deepEqual(waits, ['jump:pre', 'jump:switch-lore']);
  assert.equal(activeKey, 'lore3');
});

test('bookmark navigation helper restores main content', async () => {
  const waits = [];
  let activeKey = 'lore4';
  const helper = createBookmarkNavigationHelper({
    pageKeyMap: PAGE_KEY_MAP,
    currentPage: 'liminal library.html',
    mainContentKey: 'liminal_library',
    getActiveContentKey: () => activeKey,
    waitForContentSwitchIdle: async (reason) => {
      waits.push(reason);
    },
    restoreMainContent: async () => {
      activeKey = 'liminal_library';
    }
  });

  const result = await helper.ensureBookmarkContentForCurrentPage({ page: 'liminal library.html' }, 'resume');
  assert.equal(result, true);
  assert.deepEqual(waits, ['resume:pre', 'resume:switch-main']);
  assert.equal(activeKey, 'liminal_library');
});
