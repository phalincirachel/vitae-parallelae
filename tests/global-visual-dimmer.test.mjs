import test from 'node:test';
import assert from 'node:assert/strict';

function createClassList(initial = []) {
  const values = new Set(initial);
  return {
    add(token) {
      values.add(token);
    },
    remove(token) {
      values.delete(token);
    },
    toggle(token, force) {
      if (force === undefined) {
        if (values.has(token)) {
          values.delete(token);
          return false;
        }
        values.add(token);
        return true;
      }
      if (force) values.add(token);
      else values.delete(token);
      return !!force;
    },
    contains(token) {
      return values.has(token);
    }
  };
}

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
    clear() {
      values.clear();
    }
  };
}

function createStyle() {
  return {
    display: '',
    opacity: '',
    backgroundColor: ''
  };
}

function createElement() {
  return {
    style: createStyle(),
    classList: createClassList(),
    dataset: {},
    attributes: {},
    listeners: new Map(),
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
    addEventListener(type, handler) {
      const handlers = this.listeners.get(type) || [];
      handlers.push(handler);
      this.listeners.set(type, handlers);
    },
    dispatch(type, event = {}) {
      const handlers = this.listeners.get(type) || [];
      handlers.forEach((handler) => handler({ preventDefault() {}, ...event }));
    }
  };
}

function createWindow() {
  const listeners = new Map();
  return {
    visualFreezeActive: false,
    addEventListener(type, handler) {
      const handlers = listeners.get(type) || [];
      handlers.push(handler);
      listeners.set(type, handlers);
    },
    dispatch(type, event = {}) {
      const handlers = listeners.get(type) || [];
      handlers.forEach((handler) => handler(event));
    }
  };
}

const elements = {
  sceneDimmerOverlay: createElement(),
  sceneDimmerToggleBtn: createElement(),
  sceneDimmerIconFull: createElement(),
  sceneDimmerIconHalf: createElement(),
  sceneDimmerIconCrescent: createElement(),
  sceneDimmerIconSun: createElement()
};

const bodyClassList = createClassList();
const htmlClassList = createClassList();
const storage = createStorage();
const windowObject = createWindow();
const documentObject = {
  body: { classList: bodyClassList },
  documentElement: { classList: htmlClassList },
  getElementById(id) {
    return elements[id] || null;
  }
};

globalThis.window = windowObject;
globalThis.document = documentObject;
globalThis.localStorage = storage;

await import('../assets/js/GlobalVisualDimmer.js');

const dimmer = windowObject.GlobalVisualDimmer;

test('global visual dimmer cycles white -> black -> reading-half -> reading-clear and repeats', () => {
  storage.clear();
  bodyClassList.remove('scene-dimmer-light-mode');
  htmlClassList.remove('scene-dimmer-light-mode');

  dimmer.init();
  assert.equal(elements.sceneDimmerToggleBtn.dataset.dimState, 'off');

  dimmer.cycleLevel();
  assert.equal(elements.sceneDimmerToggleBtn.dataset.dimState, 'white-freeze');
  assert.equal(elements.sceneDimmerOverlay.style.backgroundColor, '#ffffff');
  assert.equal(bodyClassList.contains('scene-dimmer-light-mode'), true);

  dimmer.cycleLevel();
  assert.equal(elements.sceneDimmerToggleBtn.dataset.dimState, 'black-freeze');
  assert.equal(elements.sceneDimmerOverlay.style.backgroundColor, '#000000');
  assert.equal(bodyClassList.contains('scene-dimmer-light-mode'), false);

  dimmer.cycleLevel();
  assert.equal(elements.sceneDimmerToggleBtn.dataset.dimState, 'reading-half');
  assert.equal(elements.sceneDimmerOverlay.style.opacity, '0.500');

  dimmer.cycleLevel();
  assert.equal(elements.sceneDimmerToggleBtn.dataset.dimState, 'reading-clear');
  assert.equal(elements.sceneDimmerOverlay.style.opacity, '0.000');

  dimmer.cycleLevel();
  assert.equal(elements.sceneDimmerToggleBtn.dataset.dimState, 'white-freeze');
});

test('global visual dimmer setLevel(0) resets to neutral off state', () => {
  storage.clear();
  dimmer.init();

  dimmer.cycleLevel();
  assert.equal(elements.sceneDimmerToggleBtn.dataset.dimState, 'white-freeze');

  dimmer.setLevel(0, { forceEmit: true });
  assert.equal(elements.sceneDimmerToggleBtn.dataset.dimState, 'off');
  assert.equal(storage.getItem('gb_background_dim_mode'), 'off');

  dimmer.cycleLevel();
  assert.equal(elements.sceneDimmerToggleBtn.dataset.dimState, 'white-freeze');
});

test('global visual dimmer migrates legacy phase storage', () => {
  storage.clear();
  storage.setItem('gb_background_dim_level', '50');
  storage.setItem('gb_background_dim_phase', '1');

  dimmer.init();

  assert.equal(elements.sceneDimmerToggleBtn.dataset.dimState, 'reading-half');
  assert.equal(storage.getItem('gb_background_dim_mode'), 'reading-half');
  assert.equal(storage.getItem('gb_background_dim_phase'), '3');

  storage.clear();
  storage.setItem('gb_background_dim_level', '100');
  storage.setItem('gb_background_dim_phase', '3');

  dimmer.init();

  assert.equal(elements.sceneDimmerToggleBtn.dataset.dimState, 'black-freeze');
  assert.equal(storage.getItem('gb_background_dim_mode'), 'black-freeze');
  assert.equal(storage.getItem('gb_background_dim_phase'), '2');
});
