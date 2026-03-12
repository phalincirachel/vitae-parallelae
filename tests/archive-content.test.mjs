import test from 'node:test';
import assert from 'node:assert/strict';
import { createArchiveContentController } from '../assets/js/shared/ui/archive-content.js';

function createClassList(initial = []) {
  const set = new Set(initial);
  return {
    add(...classes) {
      classes.forEach((className) => set.add(className));
    },
    remove(...classes) {
      classes.forEach((className) => set.delete(className));
    },
    toggle(className, force) {
      if (force) set.add(className);
      else set.delete(className);
      return force;
    },
    contains(className) {
      return set.has(className);
    }
  };
}

function createFakeElement(tagName = 'div') {
  return {
    tagName,
    className: '',
    classList: createClassList(),
    children: [],
    style: { display: '' },
    listeners: {},
    parentNode: null,
    _innerHTML: '',
    _textContent: '',
    appendChild(child) {
      child.parentNode = this;
      this.children.push(child);
      return child;
    },
    addEventListener(type, handler) {
      this.listeners[type] = handler;
    },
    async click() {
      if (this.listeners.click) {
        await this.listeners.click({ stopPropagation() {} });
      }
    },
    set innerHTML(value) {
      this._innerHTML = value;
      this.children = [];
    },
    get innerHTML() {
      return this._innerHTML;
    },
    set innerText(value) {
      this._textContent = String(value);
    },
    get innerText() {
      return this._textContent;
    },
    set textContent(value) {
      this._textContent = String(value);
    },
    get textContent() {
      return this._textContent;
    }
  };
}

test('archive content controller renders bookmarks and activates local bookmark flow', async () => {
  const bookmarkList = createFakeElement('div');
  const loreList = createFakeElement('div');
  const documentRef = {
    createElement(tagName) {
      return createFakeElement(tagName);
    },
    getElementById(id) {
      if (id === 'bookmarkList') return bookmarkList;
      if (id === 'loreList') return loreList;
      return null;
    }
  };

  const calls = [];
  const gameState = {
    getBookmarks() {
      return [{ id: 'bm1', page: 'index.html', time: 12.34, textPreview: 'Preview', contentKey: 'kapitel1' }];
    },
    formatBookmarkTime() {
      return '0:12.34';
    },
    async removeBookmark(id) {
      calls.push(['remove', id]);
    },
    getAllLore() {
      return { 3: { title: 'Lore 3', duration: '1:00' } };
    },
    state: { collectedLore: [3] }
  };

  const controller = createArchiveContentController({
    document: documentRef,
    currentPage: 'index.html',
    gameState,
    resolveBookmarkDisplayChapter: () => 'kapitel1a',
    resolveBookmarkPageKey: (page) => page === 'index.html' ? 'kapitel1' : page,
    resolveBookmarkContentKey: (bookmark) => bookmark.contentKey,
    async ensureBookmarkContentForCurrentPage(bookmark, reason) {
      calls.push(['ensure', bookmark.id, reason]);
      return true;
    },
    async activateLocalBookmark(bookmark, context) {
      calls.push(['activate', bookmark.id, context.reason]);
    },
    closeArchive(reason) {
      calls.push(['close', reason]);
    },
    updateChapterProgressIndicators() {
      calls.push(['progress']);
    },
    async onLoreSelected(id) {
      calls.push(['lore', id]);
    },
    isLoreActive(id) {
      return id === 3;
    }
  });

  assert.equal(controller.renderBookmarks(), 1);
  assert.equal(bookmarkList.children.length, 1);
  await bookmarkList.children[0].click();

  assert.deepEqual(calls.slice(0, 3), [
    ['close', 'bookmark-select'],
    ['ensure', 'bm1', 'bookmark:bm1:same-page'],
    ['activate', 'bm1', 'bookmark:bm1:same-page']
  ]);

  calls.length = 0;
  assert.equal(controller.renderLoreList(), 1);
  assert.equal(loreList.children.length, 1);
  assert.equal(loreList.children[0].classList.contains('active'), true);
  await loreList.children[0].click();
  assert.deepEqual(calls, [
    ['progress'],
    ['progress'],
    ['close', 'lore-select'],
    ['lore', 3]
  ]);
});
