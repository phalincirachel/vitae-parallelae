import test from 'node:test';
import assert from 'node:assert/strict';

await import('../assets/js/shared/ui/reader-settings-controller.global.js');

const readerSettingsApi = globalThis.GameboyReaderSettings;

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

function createStyle() {
  return {
    background: '',
    properties: new Map(),
    setProperty(name, value) {
      this.properties.set(name, value);
    },
    removeProperty(name) {
      this.properties.delete(name);
    },
    getPropertyValue(name) {
      return this.properties.get(name);
    }
  };
}

function createInput(value = '') {
  const listeners = new Map();
  return {
    value,
    checked: false,
    hidden: true,
    dataset: {},
    classList: createClassList(),
    attributes: {},
    style: createStyle(),
    setAttribute(name, nextValue) {
      this.attributes[name] = nextValue;
    },
    addEventListener(type, handler) {
      const handlers = listeners.get(type) || [];
      handlers.push(handler);
      listeners.set(type, handlers);
    },
    dispatch(type, event = {}) {
      const handlers = listeners.get(type) || [];
      const mergedEvent = { target: this, preventDefault() {}, ...event };
      handlers.forEach((handler) => handler(mergedEvent));
    },
    contains(target) {
      return target === this;
    }
  };
}

function createStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    }
  };
}

function createDocument({ layoutInputs = [], alignInputs = [], fontButtons = [], byId = {} } = {}) {
  const listeners = new Map();
  return {
    getElementById(id) {
      return byId[id] || null;
    },
    querySelectorAll(selector) {
      if (selector === 'input[name="readerSentenceLayout"]') return layoutInputs;
      if (selector === 'input[name="readerTextAlign"]') return alignInputs;
      if (selector === '.reader-font-option') return fontButtons;
      return [];
    },
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


function createEventHub() {
  const listeners = new Map();
  return {
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

test('reader settings api normalizes reader settings values and font stacks', () => {
  const fontFamilies = {
    grotesk: 'Grotesk Stack',
    baroque: 'Baroque Stack',
    renaissance: 'Renaissance Stack'
  };

  assert.equal(readerSettingsApi.normalizeSentenceLayout('kindle', { blaetternValue: 'blaettern', timestampsValue: 'timestamps', flatValue: 'flat' }), 'blaettern');
  assert.equal(readerSettingsApi.normalizeSentenceLayout('timestamp', { blaetternValue: 'blaettern', timestampsValue: 'timestamps', flatValue: 'flat' }), 'timestamps');
  assert.equal(readerSettingsApi.normalizeSentenceLayout('flat', { blaetternValue: 'blaettern', timestampsValue: 'timestamps', flatValue: 'flat' }), 'flat');
  assert.equal(readerSettingsApi.normalizeTextAlign('Blocksatz', { justifyValue: 'justify', leftValue: 'left', defaultValue: 'justify' }), 'justify');
  assert.equal(readerSettingsApi.normalizeTextAlign('flattersatz', { justifyValue: 'justify', leftValue: 'left', defaultValue: 'justify' }), 'left');
  assert.equal(readerSettingsApi.normalizeFontSize('31', { min: 14, max: 30, defaultValue: 18 }), 30);
  assert.equal(readerSettingsApi.normalizeFontFamilyKey('Georgia', { fontFamilies, defaultValue: 'grotesk' }), 'baroque');
  assert.equal(readerSettingsApi.normalizeFontFamilyKey('constantia', { fontFamilies, defaultValue: 'grotesk' }), 'renaissance');
  assert.equal(readerSettingsApi.getFontFamilyStack('segoe', { fontFamilies, defaultValue: 'grotesk' }), 'Grotesk Stack');
  assert.equal(readerSettingsApi.normalizeVolume('75', { defaultValue: 1 }), 0.75);
  assert.equal(readerSettingsApi.normalizeVolume('', { defaultValue: 1 }), 1);
});

test('reader settings api resolves and syncs mode dimmer levels', () => {
  let currentLevel = 10;
  const tintCalls = [];
  const levelChanges = [];
  const globalVisualDimmer = {
    isFrozen() {
      return false;
    },
    getLevel() {
      return currentLevel;
    },
    setLevel(nextLevel) {
      currentLevel = nextLevel;
    }
  };

  assert.equal(readerSettingsApi.getModeDimLevel({ isReadingMode: false, gameLevel: 0, readingLevel: 50 }), 0);
  assert.equal(readerSettingsApi.getModeDimLevel({ isReadingMode: true, gameLevel: 0, readingLevel: 50 }), 50);

  const first = readerSettingsApi.syncModeDimmerLevel({
    globalVisualDimmer,
    isReadingMode: true,
    gameLevel: 0,
    readingLevel: 50,
    onManualBackgroundDimLevelChange: (level) => levelChanges.push(level),
    applyTint: () => tintCalls.push('tint')
  });
  assert.equal(first, 50);
  assert.equal(currentLevel, 50);

  const second = readerSettingsApi.syncModeDimmerLevel({
    globalVisualDimmer,
    isReadingMode: true,
    gameLevel: 0,
    readingLevel: 50,
    onManualBackgroundDimLevelChange: (level) => levelChanges.push(level),
    applyTint: () => tintCalls.push('tint')
  });
  assert.equal(second, 50);
  assert.deepEqual(levelChanges, [50, 50]);
  assert.deepEqual(tintCalls, ['tint', 'tint']);
});

test('reader settings api resolves fallback colors and applies dimmer tint', () => {
  const bodyClassList = createClassList();
  const overlay = { style: createStyle() };
  const documentRef = {
    body: { classList: bodyClassList },
    getElementById(id) {
      return id === 'sceneDimmerOverlay' ? overlay : null;
    }
  };

  assert.equal(readerSettingsApi.getFallbackBgColor({ document: documentRef }), '#11161d');
  assert.equal(readerSettingsApi.getFallbackTextColor({ document: documentRef }), '#f2ecdc');

  bodyClassList.add('scene-dimmer-light-mode');
  assert.equal(readerSettingsApi.getFallbackBgColor({ document: documentRef }), '#ede6d6');
  assert.equal(readerSettingsApi.getFallbackTextColor({ document: documentRef }), '#1f1d18');

  assert.equal(readerSettingsApi.mixHexColors('#000000', '#ffffff', 0.5), '#808080');
  assert.equal(readerSettingsApi.applyDimmerTint({ document: documentRef, manualBackgroundDimLevel: 0, readerBgColor: '#abcdef' }), '#ffffff');
  assert.equal(overlay.style.backgroundColor, '#ffffff');
  assert.equal(readerSettingsApi.applyDimmerTint({ document: documentRef, manualBackgroundDimLevel: 100, readerBgColor: '#ff0000' }), '#ff8080');
  assert.equal(overlay.style.backgroundColor, '#ff8080');
});

test('reader settings api normalizes hex colors and converts wheel colors', () => {
  assert.equal(readerSettingsApi.clamp01(1.4), 1);
  assert.equal(readerSettingsApi.clamp01(-0.5), 0);
  assert.equal(readerSettingsApi.normalizeHexColor(' abc ', null), '#aabbcc');
  assert.equal(readerSettingsApi.normalizeHexColor('#ABCDEF', null), '#abcdef');
  assert.equal(readerSettingsApi.normalizeHexColor('nope', 'fallback'), 'fallback');
  assert.deepEqual(readerSettingsApi.hexToRgb('#336699'), { r: 51, g: 102, b: 153 });
  assert.equal(readerSettingsApi.rgbToHex(51, 102, 153), '#336699');
  assert.deepEqual(readerSettingsApi.rgbToHsl(255, 0, 0), { h: 0, s: 1, l: 0.5 });
  assert.deepEqual(readerSettingsApi.hslToRgb(240, 1, 0.5), { r: 0, g: 0, b: 255 });
  assert.deepEqual(readerSettingsApi.mixWheelRgb({ r: 0, g: 0, b: 0 }, { r: 200, g: 100, b: 50 }, 0.5), { r: 100, g: 50, b: 25 });
  assert.equal(readerSettingsApi.getWheelColorAtOffset(0, 0, 40), '#ffffff');
  assert.deepEqual(readerSettingsApi.getWheelRgbAtOffset(20, 0, 40), { r: 255, g: 0, b: 0 });
});

test('reader settings api draws goethe color wheel and positions marker', () => {
  const calls = [];
  const image = { data: new Uint8ClampedArray(4 * 4 * 4) };
  const ctx = {
    createImageData(width, height) {
      assert.equal(width, 4);
      assert.equal(height, 4);
      return image;
    },
    clearRect(...args) {
      calls.push(['clearRect', ...args]);
    },
    putImageData(payload, x, y) {
      calls.push(['putImageData', payload === image, x, y]);
    },
    save() {
      calls.push(['save']);
    },
    beginPath() {
      calls.push(['beginPath']);
    },
    arc(...args) {
      calls.push(['arc', ...args]);
    },
    stroke() {
      calls.push(['stroke']);
    },
    restore() {
      calls.push(['restore']);
    },
    set strokeStyle(value) {
      calls.push(['strokeStyle', value]);
    },
    set lineWidth(value) {
      calls.push(['lineWidth', value]);
    }
  };
  const canvas = {
    width: 4,
    height: 4,
    getContext(type) {
      assert.equal(type, '2d');
      return ctx;
    }
  };
  const marker = { style: createStyle() };
  const wheel = { clientWidth: 100, clientHeight: 100, width: 100, height: 100 };

  readerSettingsApi.drawGoetheColorWheel(canvas);
  readerSettingsApi.setWheelMarkerFromHex(marker, wheel, '#ff0000');

  assert.equal(calls.some((entry) => entry[0] === 'putImageData'), true);
  assert.equal(marker.style.left, '75px');
  assert.equal(marker.style.top, '50px');
});

test('reader settings api initializes color wheel control and forwards pointer picks', () => {
  const canvas = createInput();
  canvas.getBoundingClientRect = () => ({ left: 10, top: 20, width: 100, height: 80 });
  const marker = createInput();
  const preview = createInput();
  const documentRef = createDocument({
    byId: {
      readerBgColorWheel: canvas,
      readerBgColorMarker: marker,
      readerBgColorPreview: preview
    }
  });
  const windowRef = createEventHub();
  const drawCalls = [];
  const markerCalls = [];
  const picked = [];

  const sync = readerSettingsApi.initColorWheelControl({
    document: documentRef,
    window: windowRef,
    canvasId: 'readerBgColorWheel',
    markerId: 'readerBgColorMarker',
    previewId: 'readerBgColorPreview',
    onPick: (hex) => picked.push(hex),
    normalizeHexColor: (value) => value,
    drawWheel: (canvasEl) => drawCalls.push(canvasEl),
    setMarkerFromHex: (markerEl, canvasEl, hexColor) => markerCalls.push([markerEl, canvasEl, hexColor]),
    getColorAtOffset: (x, y, radius) => String(Math.round(x)) + ',' + String(Math.round(y)) + ',' + String(radius)
  });

  sync('#123456', { ensureCanvas: true });
  canvas.dispatch('pointerdown', { clientX: 40, clientY: 60 });
  windowRef.dispatch('pointermove', { clientX: 50, clientY: 70 });
  windowRef.dispatch('pointerup');
  windowRef.dispatch('pointermove', { clientX: 55, clientY: 75 });

  assert.equal(preview.style.background, '#123456');
  assert.equal(drawCalls.length, 1);
  assert.deepEqual(markerCalls[0], [marker, canvas, '#123456']);
  assert.deepEqual(picked, ['-20,0,40', '-10,10,40']);
});

test('reader settings api binds color popovers and reset action once', () => {
  const bgButton = createInput();
  const bgPopover = createInput();
  const textButton = createInput();
  const textPopover = createInput();
  const resetButton = createInput();
  const outsideTarget = createInput();
  const documentRef = createDocument();
  const state = { activeKey: null };
  const syncCalls = [];
  let resetCalls = 0;

  const binding = readerSettingsApi.bindColorPopoverControls({
    document: documentRef,
    state,
    controls: {
      bg: {
        key: 'bg',
        button: bgButton,
        popover: bgPopover,
        sync: () => syncCalls.push('bg')
      },
      text: {
        key: 'text',
        button: textButton,
        popover: textPopover,
        sync: () => syncCalls.push('text')
      }
    },
    resetButton,
    onReset: () => { resetCalls += 1; }
  });

  binding.bind();
  bgButton.dispatch('click');
  assert.equal(state.activeKey, 'bg');
  assert.equal(bgPopover.hidden, false);
  assert.equal(bgButton.attributes['aria-expanded'], 'true');
  assert.deepEqual(syncCalls, ['bg']);

  bgButton.dispatch('click');
  assert.equal(state.activeKey, null);
  assert.equal(bgPopover.hidden, true);

  textButton.dispatch('click');
  documentRef.dispatch('click', { target: outsideTarget });
  assert.equal(state.activeKey, null);
  assert.equal(textPopover.hidden, true);

  textButton.dispatch('click');
  documentRef.dispatch('keydown', { key: 'Escape' });
  assert.equal(state.activeKey, null);

  resetButton.dispatch('click');
  assert.equal(resetCalls, 1);
});

test('reader settings controller applies subtitle layout classes and rerender hooks', () => {
  const bookmarkButton = { classList: createClassList(['bookmark-btn', 'visible']) };
  const subtitleContainer = {
    classList: createClassList(),
    style: createStyle(),
    dataset: { version: 'old' },
    querySelectorAll(selector) {
      if (selector === '.bookmark-btn.visible') return [bookmarkButton];
      return [];
    }
  };

  const calls = {
    color: 0,
    paginationDirty: 0,
    syncReason: null,
    hideBookmark: 0,
    rerender: 0
  };

  const controller = readerSettingsApi.createController({
    subtitleContainer,
    state: {
      sentenceLayout: 'flat',
      textAlign: 'left',
      fontSizePx: 21,
      fontFamilyKey: 'bodoni',
      textVolume: 0.5,
      backgroundVolume: 0.25,
      bgColor: '#111111',
      textColor: '#eeeeee'
    },
    getReaderFontFamilyStack: (fontKey) => `stack:${fontKey}`,
    applyReaderColorSettings: () => { calls.color += 1; },
    markBlaetternPaginationDirty: () => { calls.paginationDirty += 1; },
    syncBlaetternUiState: (reason) => { calls.syncReason = reason; },
    hideBlaetternBookmarkButton: () => { calls.hideBookmark += 1; },
    rerenderSubtitles: () => { calls.rerender += 1; },
    flatLayoutValue: 'flat',
    blaetternLayoutValue: 'blaettern',
    textAlignLeftValue: 'left',
    textAlignJustifyValue: 'justify'
  });

  controller.applyTextSettings();

  assert.equal(subtitleContainer.classList.contains('reader-layout-flat'), true);
  assert.equal(subtitleContainer.classList.contains('reader-layout-blaettern'), false);
  assert.equal(subtitleContainer.classList.contains('reader-layout-timestamps'), false);
  assert.equal(subtitleContainer.classList.contains('reader-text-left'), true);
  assert.equal(subtitleContainer.classList.contains('reader-text-justify'), false);
  assert.equal(subtitleContainer.style.getPropertyValue('--reader-font-size'), '21px');
  assert.equal(subtitleContainer.style.getPropertyValue('--reader-font-family'), 'stack:bodoni');
  assert.equal(subtitleContainer.style.getPropertyValue('--reader-text-align'), 'left');
  assert.equal(bookmarkButton.classList.contains('visible'), false);
  assert.equal(subtitleContainer.dataset.version, '');
  assert.equal(calls.color, 1);
  assert.equal(calls.paginationDirty, 1);
  assert.equal(calls.syncReason, 'reader-settings');
  assert.equal(calls.hideBookmark, 1);
  assert.equal(calls.rerender, 1);
});

test('reader settings controller syncs inputs, previews and slider fills', () => {
  const layoutFlat = createInput('flat');
  const layoutTimed = createInput('timestamps');
  const alignLeft = createInput('left');
  const alignJustify = createInput('justify');
  const fontGrotesk = createInput();
  fontGrotesk.dataset.font = 'grotesk';
  const fontBodoni = createInput();
  fontBodoni.dataset.font = 'bodoni';

  const byId = {
    readerFontSizeRange: createInput(),
    readerFontSizeNumber: createInput(),
    readerTextVolumeRange: createInput(),
    readerTextVolumeNumber: createInput(),
    readerBackgroundVolumeRange: createInput(),
    readerBackgroundVolumeNumber: createInput(),
    readerBgColorPreview: { style: createStyle() },
    readerTextColorPreview: { style: createStyle() }
  };

  const wheelSyncCalls = [];
  const controller = readerSettingsApi.createController({
    document: createDocument({
      layoutInputs: [layoutFlat, layoutTimed],
      alignInputs: [alignLeft, alignJustify],
      fontButtons: [fontGrotesk, fontBodoni],
      byId
    }),
    state: {
      sentenceLayout: 'flat',
      textAlign: 'justify',
      fontSizePx: 19,
      fontFamilyKey: 'bodoni',
      textVolume: 0.23,
      backgroundVolume: 0.67,
      bgColor: null,
      textColor: '#101010'
    },
    getReaderFallbackBgColor: () => '#f0f0f0',
    getReaderFallbackTextColor: () => '#101010',
    readerColorWheelSync: {
      bg: (value) => wheelSyncCalls.push(['bg', value]),
      text: (value) => wheelSyncCalls.push(['text', value])
    }
  });

  controller.syncUi();

  assert.equal(layoutFlat.checked, true);
  assert.equal(layoutTimed.checked, false);
  assert.equal(alignLeft.checked, false);
  assert.equal(alignJustify.checked, true);
  assert.equal(byId.readerFontSizeRange.value, '19');
  assert.equal(byId.readerFontSizeNumber.value, '19');
  assert.equal(fontGrotesk.classList.contains('is-active'), false);
  assert.equal(fontBodoni.classList.contains('is-active'), true);
  assert.equal(fontBodoni.attributes['aria-pressed'], 'true');
  assert.equal(byId.readerTextVolumeRange.value, '23');
  assert.equal(byId.readerBackgroundVolumeRange.value, '67');
  assert.equal(byId.readerBgColorPreview.style.background, '#f0f0f0');
  assert.equal(byId.readerTextColorPreview.style.background, '#101010');
  assert.deepEqual(wheelSyncCalls, [['bg', '#f0f0f0'], ['text', '#101010']]);
  assert.equal(byId.readerFontSizeRange.style.background, '');
  assert.equal(byId.readerTextVolumeRange.style.background, '');
  assert.equal(byId.readerBackgroundVolumeRange.style.background, '');
});


test('reader settings controller binds basic controls once and routes DOM events to setters', () => {
  const layoutFlat = createInput('flat');
  const alignLeft = createInput('left');
  const fontBodoni = createInput();
  fontBodoni.dataset.font = 'bodoni';

  const byId = {
    readerFontSizeRange: createInput('18'),
    readerFontSizeNumber: createInput('18'),
    readerTextVolumeRange: createInput('50'),
    readerTextVolumeNumber: createInput('50'),
    readerBackgroundVolumeRange: createInput('40'),
    readerBackgroundVolumeNumber: createInput('40')
  };

  const storage = createStorage();
  const state = {
    sentenceLayout: 'timestamps',
    textAlign: 'justify',
    fontSizePx: 18,
    fontFamilyKey: 'grotesk',
    textVolume: 0.5,
    backgroundVolume: 0.4,
    bgColor: null,
    textColor: null
  };

  const controller = readerSettingsApi.createController({
    document: createDocument({
      layoutInputs: [layoutFlat],
      alignInputs: [alignLeft],
      fontButtons: [fontBodoni],
      byId
    }),
    storage,
    subtitleContainer: {
      classList: createClassList(),
      style: createStyle(),
      dataset: {},
      querySelectorAll() {
        return [];
      }
    },
    state,
    normalizeReaderSentenceLayout: (value) => String(value),
    normalizeReaderTextAlign: (value) => String(value),
    normalizeReaderFontFamilyKey: (value) => String(value),
    normalizeReaderFontSize: (value) => Number(value),
    normalizeReaderVolume: (value) => Number(value),
    flatLayoutValue: 'flat',
    blaetternLayoutValue: 'blaettern',
    textAlignLeftValue: 'left',
    textAlignJustifyValue: 'justify'
  });

  controller.bindBasicControls();
  controller.bindBasicControls();

  layoutFlat.checked = true;
  layoutFlat.dispatch('change');
  alignLeft.checked = true;
  alignLeft.dispatch('change');
  fontBodoni.dispatch('click');
  byId.readerFontSizeRange.value = '22';
  byId.readerFontSizeRange.dispatch('input');
  byId.readerTextVolumeRange.value = '0.3';
  byId.readerTextVolumeRange.dispatch('input');
  byId.readerBackgroundVolumeNumber.value = '0.8';
  byId.readerBackgroundVolumeNumber.dispatch('change');

  assert.equal(state.sentenceLayout, 'flat');
  assert.equal(state.textAlign, 'left');
  assert.equal(state.fontFamilyKey, 'bodoni');
  assert.equal(state.fontSizePx, 22);
  assert.equal(state.textVolume, 0.3);
  assert.equal(state.backgroundVolume, 0.8);
  assert.equal(storage.getItem('gameboy_reader_font_size_px'), '22');
  assert.equal(storage.getItem('gameboy_reader_text_volume'), '0.3');
  assert.equal(storage.getItem('gameboy_reader_background_volume'), '0.8');
});

test('reader settings controller setters persist state and invoke side effects', () => {
  const storage = createStorage();
  const state = {
    sentenceLayout: 'timestamps',
    textAlign: 'justify',
    fontSizePx: 16,
    fontFamilyKey: 'grotesk',
    textVolume: 0.5,
    backgroundVolume: 0.4,
    bgColor: '#ffffff',
    textColor: '#000000'
  };
  const subtitleContainer = {
    classList: createClassList(),
    style: createStyle(),
    dataset: { version: 'x' },
    querySelectorAll() {
      return [];
    }
  };
  let fontFamilyChanges = 0;
  let textVolumeValue = null;
  let backgroundVolumeChanges = 0;

  const controller = readerSettingsApi.createController({
    storage,
    subtitleContainer,
    state,
    getReaderFontFamilyStack: (fontKey) => `stack:${fontKey}`,
    normalizeReaderFontFamilyKey: (value) => String(value),
    normalizeReaderVolume: (value) => Number(value),
    normalizeReaderHexColor: (value, fallback) => value || fallback,
    onFontFamilyChange: () => { fontFamilyChanges += 1; },
    onTextVolumeChange: (value) => { textVolumeValue = value; },
    onBackgroundVolumeChange: () => { backgroundVolumeChanges += 1; },
    flatLayoutValue: 'flat',
    blaetternLayoutValue: 'blaettern',
    textAlignLeftValue: 'left',
    textAlignJustifyValue: 'justify'
  });

  controller.setFontFamily('bodoni');
  controller.setTextVolume(0.25);
  controller.setBackgroundVolume(0.75);
  controller.setBgColor(null);
  controller.setTextColor('#222222');

  assert.equal(state.fontFamilyKey, 'bodoni');
  assert.equal(storage.getItem('gameboy_reader_font_family'), 'bodoni');
  assert.equal(fontFamilyChanges, 1);
  assert.equal(state.textVolume, 0.25);
  assert.equal(storage.getItem('gameboy_reader_text_volume'), '0.25');
  assert.equal(textVolumeValue, 0.25);
  assert.equal(state.backgroundVolume, 0.75);
  assert.equal(storage.getItem('gameboy_reader_background_volume'), '0.75');
  assert.equal(backgroundVolumeChanges, 1);
  assert.equal(state.bgColor, null);
  assert.equal(storage.getItem('gameboy_reader_bg_color'), null);
  assert.equal(state.textColor, '#222222');
  assert.equal(storage.getItem('gameboy_reader_text_color'), '#222222');
});
