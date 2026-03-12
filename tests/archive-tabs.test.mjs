import test from 'node:test';
import assert from 'node:assert/strict';
import { createArchiveTabsController } from '../assets/js/shared/ui/archive-tabs.js';

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
      if (force === undefined) {
        if (set.has(className)) {
          set.delete(className);
          return false;
        }
        set.add(className);
        return true;
      }
      if (force) set.add(className);
      else set.delete(className);
      return force;
    },
    contains(className) {
      return set.has(className);
    }
  };
}

function createElement(attributes = {}, initialClasses = []) {
  return {
    attributes: { ...attributes },
    classList: createClassList(initialClasses),
    style: { display: '' },
    listeners: {},
    offsetWidth: 0,
    getAttribute(name) {
      return this.attributes[name] || null;
    },
    addEventListener(type, handler) {
      this.listeners[type] = handler;
    },
    click() {
      this.listeners.click?.({ stopPropagation() {} });
    }
  };
}

test('archive tabs controller toggles tabs and settings view', () => {
  const tabs = [
    createElement({ 'data-tab': 'kapitel' }, ['active']),
    createElement({ 'data-tab': 'lore' }),
    createElement({ 'data-tab': 'lesezeichen' })
  ];
  const panels = [
    createElement({ 'data-tab': 'kapitel' }, ['active']),
    createElement({ 'data-tab': 'lore' }),
    createElement({ 'data-tab': 'lesezeichen' }),
    createElement({ 'data-tab': 'einstellungen' })
  ];
  const tabsBar = createElement();
  const footer = createElement();
  const primaryInhaltBtn = createElement();
  const primarySettingsBtn = createElement();
  const queryMap = {
    '.archive-tabs': tabsBar,
    '#archiveModal .archive-footer': footer,
    '.archive-tab-content[data-tab="einstellungen"]': panels[3],
    '.archive-tab-content[data-tab="kapitel"]': panels[0],
    '.archive-tab-content[data-tab="lore"]': panels[1],
    '.archive-tab-content[data-tab="lesezeichen"]': panels[2]
  };
  const documentRef = {
    querySelectorAll(selector) {
      if (selector === '.archive-tab') return tabs;
      if (selector === '.archive-tab-content') return panels;
      return [];
    },
    querySelector(selector) {
      return queryMap[selector] || null;
    },
    getElementById(id) {
      if (id === 'archivePrimaryInhaltBtn') return primaryInhaltBtn;
      if (id === 'archivePrimarySettingsBtn') return primarySettingsBtn;
      return null;
    }
  };

  let renderBookmarksCalls = 0;
  let syncReaderSettingsCalls = 0;
  const controller = createArchiveTabsController({
    document: documentRef,
    renderBookmarks() {
      renderBookmarksCalls += 1;
    },
    syncReaderSettingsUi() {
      syncReaderSettingsCalls += 1;
    },
    triggerUiHaptic() {}
  });

  controller.init();
  assert.equal(controller.getLastContentTab(), 'kapitel');
  assert.equal(renderBookmarksCalls, 0);

  tabs[2].click();
  assert.equal(controller.getLastContentTab(), 'lesezeichen');
  assert.equal(renderBookmarksCalls, 1);
  assert.equal(panels[2].classList.contains('active'), true);

  primarySettingsBtn.click();
  assert.equal(syncReaderSettingsCalls, 1);
  assert.equal(panels[3].classList.contains('active'), true);
  assert.equal(tabsBar.style.display, 'none');
  assert.equal(footer.style.display, 'none');
});
