import test from 'node:test';
import assert from 'node:assert/strict';
import { createArchiveInteractionsController } from '../assets/js/shared/ui/archive-interactions.js';

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

function createElement() {
  return {
    classList: createClassList(),
    listeners: {},
    clickCalls: 0,
    addEventListener(type, handler) {
      this.listeners[type] = handler;
    },
    click() {
      this.clickCalls += 1;
      this.listeners.click?.({});
    }
  };
}

test('archive interactions controller opens archive, marks first view and opens lore tab from hud', () => {
  const storageValues = new Map();
  const storage = {
    getItem(key) {
      return storageValues.has(key) ? storageValues.get(key) : null;
    },
    setItem(key, value) {
      storageValues.set(key, String(value));
    }
  };

  const bookBtn = createElement();
  const closeBtn = createElement();
  const hud = createElement();
  const inhaltBtn = createElement();
  const loreTab = createElement();
  const modal = createElement();
  const documentRef = {
    getElementById(id) {
      if (id === 'bookBtn') return bookBtn;
      if (id === 'closeArchiveBtn') return closeBtn;
      if (id === 'loreProgressHud') return hud;
      if (id === 'archivePrimaryInhaltBtn') return inhaltBtn;
      if (id === 'archiveModal') return modal;
      return null;
    },
    querySelector(selector) {
      if (selector === '.archive-tab[data-tab="lore"]') return loreTab;
      return null;
    }
  };

  const calls = [];
  const controller = createArchiveInteractionsController({
    document: documentRef,
    storage,
    renderArchive() {
      calls.push('render');
    },
    setVisible(visible, reason) {
      calls.push(`${visible ? 'open' : 'close'}:${reason}`);
      modal.classList.toggle('visible', visible);
    },
    onAfterLoreHudOpen() {
      calls.push('after-hud');
    }
  });

  controller.bind();
  bookBtn.click();
  assert.deepEqual(calls.slice(0, 2), ['render', 'open:book-btn']);
  assert.equal(storage.getItem('gameboy_archive_primary_seen_v1'), '1');
  assert.equal(inhaltBtn.clickCalls, 1);

  hud.click();
  assert.deepEqual(calls.slice(2), ['render', 'open:lore-hud', 'after-hud']);
  assert.equal(loreTab.clickCalls, 1);

  closeBtn.click();
  assert.equal(modal.classList.contains('visible'), false);
});
