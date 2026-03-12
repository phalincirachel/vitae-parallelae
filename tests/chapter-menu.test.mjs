import test from 'node:test';
import assert from 'node:assert/strict';
import { createChapterMenuController } from '../assets/js/shared/ui/chapter-menu.js';

function createClassList(initial = []) {
  const set = new Set(initial);
  return {
    add(...classes) {
      classes.forEach((className) => set.add(className));
    },
    remove(...classes) {
      classes.forEach((className) => set.delete(className));
    },
    contains(className) {
      return set.has(className);
    }
  };
}

function createElement(id, label) {
  const element = {
    id,
    label,
    className: 'menu-item',
    classList: createClassList(id === 'chapter1bBtn' ? ['active'] : []),
    listeners: {},
    parentNode: null,
    attributes: {},
    addEventListener(type, handler) {
      this.listeners[type] = handler;
    },
    cloneNode() {
      return createElement(id, label);
    },
    async click() {
      if (this.listeners.click) {
        await this.listeners.click({});
      }
    }
  };
  return element;
}

test('chapter menu controller binds cloned buttons and marks active chapter', async () => {
  const elements = new Map();
  const chapterList = ['chapter1Btn', 'chapter1bBtn', 'chapter1cBtn'].map((id) => createElement(id, id));
  const parentNode = {
    replaceChild(next, previous) {
      next.parentNode = this;
      const index = chapterList.indexOf(previous);
      chapterList[index] = next;
      elements.set(next.id, next);

    }
  };
  chapterList.forEach((element) => {
    element.parentNode = parentNode;
    elements.set(element.id, element);
  });

  const documentRef = {
    querySelectorAll(selector) {
      if (selector === '#chapterList .menu-item') return chapterList;
      return [];
    },
    getElementById(id) {
      return elements.get(id) || null;
    }
  };

  const calls = [];
  const controller = createChapterMenuController({
    document: documentRef,
    activeButtonId: 'chapter1cBtn',
    buttons: [
      {
        id: 'chapter1Btn',
        onClick() {
          calls.push('chapter1');
        }
      },
      {
        id: 'chapter1bBtn',
        onInit(element) {
          element.classList.remove('locked');
          calls.push('init1b');
        },
        onClick() {
          calls.push('chapter1b');
        }
      },
      {
        id: 'chapter1cBtn',
        onClick() {
          calls.push('chapter1c');
        }
      }
    ]
  });

  controller.render();
  assert.equal(documentRef.getElementById('chapter1cBtn').classList.contains('active'), true);
  assert.equal(documentRef.getElementById('chapter1bBtn').classList.contains('active'), false);
  assert.deepEqual(calls, ['init1b']);

  await documentRef.getElementById('chapter1Btn').click();
  await documentRef.getElementById('chapter1bBtn').click();
  assert.deepEqual(calls, ['init1b', 'chapter1', 'chapter1b']);
});
