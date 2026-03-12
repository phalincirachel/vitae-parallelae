(function bootstrapReaderSettings(root, factory) {
  root.GameboyReaderSettings = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function createReaderSettingsApi() {
  function createMemoryStorage() {
    const memory = new Map();
    return {
      getItem(key) {
        return memory.has(key) ? memory.get(key) : null;
      },
      setItem(key, value) {
        memory.set(key, String(value));
      },
      removeItem(key) {
        memory.delete(key);
      }
    };
  }

  function resolveStorage(options = {}) {
    const storage = options.storage || rootSafeLocalStorage();
    if (storage
      && typeof storage.getItem === 'function'
      && typeof storage.setItem === 'function'
      && typeof storage.removeItem === 'function') {
      return storage;
    }
    return createMemoryStorage();
  }

  function rootSafeLocalStorage() {
    try {
      return globalThis.localStorage || null;
    } catch (_) {
      return null;
    }
  }

  function getDocument(options = {}) {
    return options.document || globalThis.document || null;
  }

  function getWindow(options = {}) {
    return options.window || globalThis.window || globalThis;
  }

  function clamp01(value) {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(1, value));
  }

  function normalizeHexColor(value, fallback = null) {
    if (typeof value !== 'string') return fallback;
    const cleaned = value.trim().toLowerCase();
    if (!cleaned) return fallback;
    const match = cleaned.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (!match) return fallback;
    let hex = match[1];
    if (hex.length === 3) hex = hex.split('').map((ch) => `${ch}${ch}`).join('');
    return `#${hex.toLowerCase()}`;
  }

  function hexToRgb(hex) {
    const normalized = normalizeHexColor(hex, null);
    if (!normalized) return null;
    const raw = normalized.slice(1);
    return {
      r: parseInt(raw.slice(0, 2), 16),
      g: parseInt(raw.slice(2, 4), 16),
      b: parseInt(raw.slice(4, 6), 16)
    };
  }

  function rgbToHex(r, g, b) {
    const toHex = (value) => {
      const clamped = Math.max(0, Math.min(255, Math.round(value)));
      return clamped.toString(16).padStart(2, '0');
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  function rgbToHsl(r, g, b) {
    const rr = r / 255;
    const gg = g / 255;
    const bb = b / 255;
    const max = Math.max(rr, gg, bb);
    const min = Math.min(rr, gg, bb);
    const delta = max - min;
    let h = 0;
    const l = (max + min) / 2;
    let s = 0;

    if (delta !== 0) {
      s = delta / (1 - Math.abs((2 * l) - 1));
      if (max === rr) h = 60 * (((gg - bb) / delta) % 6);
      else if (max === gg) h = 60 * (((bb - rr) / delta) + 2);
      else h = 60 * (((rr - gg) / delta) + 4);
    }

    if (!Number.isFinite(h)) h = 0;
    if (h < 0) h += 360;
    return { h, s: clamp01(s), l: clamp01(l) };
  }
  function hslToRgb(h, s, l) {
    const hue = ((Number(h) % 360) + 360) % 360;
    const sat = clamp01(s);
    const lig = clamp01(l);
    const c = (1 - Math.abs((2 * lig) - 1)) * sat;
    const hh = hue / 60;
    const x = c * (1 - Math.abs((hh % 2) - 1));
    let r1 = 0;
    let g1 = 0;
    let b1 = 0;

    if (hh >= 0 && hh < 1) { r1 = c; g1 = x; }
    else if (hh < 2) { r1 = x; g1 = c; }
    else if (hh < 3) { g1 = c; b1 = x; }
    else if (hh < 4) { g1 = x; b1 = c; }
    else if (hh < 5) { r1 = x; b1 = c; }
    else { r1 = c; b1 = x; }

    const m = lig - (c / 2);
    return {
      r: Math.round((r1 + m) * 255),
      g: Math.round((g1 + m) * 255),
      b: Math.round((b1 + m) * 255)
    };
  }

  function mixWheelRgb(startRgb, endRgb, amount) {
    const t = clamp01(amount);
    return {
      r: Math.round(startRgb.r + ((endRgb.r - startRgb.r) * t)),
      g: Math.round(startRgb.g + ((endRgb.g - startRgb.g) * t)),
      b: Math.round(startRgb.b + ((endRgb.b - startRgb.b) * t))
    };
  }

  function getWheelRgbAtOffset(offsetX, offsetY, radius) {
    const safeRadius = Math.max(1, radius);
    const distance = Math.min(1, Math.hypot(offsetX, offsetY) / safeRadius);
    const hue = ((Math.atan2(offsetY, offsetX) * (180 / Math.PI)) + 360) % 360;
    const hueRgb = hslToRgb(hue, 1, 0.5);
    if (distance <= 0.5) {
      return mixWheelRgb({ r: 255, g: 255, b: 255 }, hueRgb, distance / 0.5);
    }
    return mixWheelRgb(hueRgb, { r: 0, g: 0, b: 0 }, (distance - 0.5) / 0.5);
  }

  function getWheelColorAtOffset(offsetX, offsetY, radius) {
    const rgb = getWheelRgbAtOffset(offsetX, offsetY, radius);
    return rgbToHex(rgb.r, rgb.g, rgb.b);
  }

  function setWheelMarkerFromHex(markerEl, wheelEl, hexColor) {
    if (!markerEl || !wheelEl) return;
    const targetRgb = hexToRgb(hexColor);
    if (!targetRgb) return;
    const size = Math.min(wheelEl.clientWidth || wheelEl.width || 0, wheelEl.clientHeight || wheelEl.height || 0);
    if (!size) return;
    const radius = size / 2;
    const sampleRadius = Math.max(1, Math.round(radius));
    const radiusSq = radius * radius;
    let bestScore = Number.POSITIVE_INFINITY;
    let bestX = 0;
    let bestY = 0;

    searchLoop:
    for (let y = -sampleRadius; y <= sampleRadius; y++) {
      for (let x = -sampleRadius; x <= sampleRadius; x++) {
        const distSq = (x * x) + (y * y);
        if (distSq > radiusSq) continue;
        const rgb = getWheelRgbAtOffset(x, y, radius);
        const dr = rgb.r - targetRgb.r;
        const dg = rgb.g - targetRgb.g;
        const db = rgb.b - targetRgb.b;
        const score = (dr * dr) + (dg * dg) + (db * db);
        if (score >= bestScore) continue;
        bestScore = score;
        bestX = x;
        bestY = y;
        if (score === 0) break searchLoop;
      }
    }

    markerEl.style.left = `${radius + bestX}px`;
    markerEl.style.top = `${radius + bestY}px`;
  }

  function drawGoetheColorWheel(canvasEl) {
    if (!canvasEl) return;
    const width = Number(canvasEl.width) || 168;
    const height = Number(canvasEl.height) || 168;
    const ctx = canvasEl.getContext('2d');
    if (!ctx) return;

    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) / 2;
    const image = ctx.createImageData(width, height);
    const data = image.data;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        const dist = Math.hypot(dx, dy);
        const index = (y * width + x) * 4;
        if (dist > radius) {
          data[index + 3] = 0;
          continue;
        }
        const rgb = getWheelRgbAtOffset(dx, dy, radius);
        data[index] = rgb.r;
        data[index + 1] = rgb.g;
        data[index + 2] = rgb.b;
        data[index + 3] = 255;
      }
    }

    ctx.clearRect(0, 0, width, height);
    ctx.putImageData(image, 0, 0);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius - 0.5, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.5, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }
  function initColorWheelControl(options = {}) {
    const documentRef = getDocument(options);
    const windowRef = getWindow(options);
    const canvasEl = documentRef?.getElementById?.(options.canvasId) || null;
    const markerEl = documentRef?.getElementById?.(options.markerId) || null;
    const previewEl = documentRef?.getElementById?.(options.previewId) || null;
    if (!canvasEl || !markerEl || !previewEl || typeof options.onPick !== 'function') {
      return null;
    }

    let canvasInitialized = false;
    let pendingHexColor = null;

    function ensureCanvasReady() {
      if (canvasInitialized) return true;
      callHook(options.drawWheel, canvasEl);
      canvasInitialized = true;
      if (pendingHexColor) {
        callHook(options.setMarkerFromHex, markerEl, canvasEl, pendingHexColor);
      }
      return true;
    }

    const updatePreviewAndMarker = (hexColor, updateOptions = {}) => {
      const normalized = callHook(options.normalizeHexColor, hexColor, null);
      if (!normalized) return;
      pendingHexColor = normalized;
      if (previewEl.style) previewEl.style.background = normalized;
      if (!updateOptions.ensureCanvas && !canvasInitialized) return;
      ensureCanvasReady();
      callHook(options.setMarkerFromHex, markerEl, canvasEl, normalized);
    };

    const pickFromClientPoint = (clientX, clientY) => {
      ensureCanvasReady();
      const rect = canvasEl.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const radius = Math.min(rect.width, rect.height) / 2;
      const localX = clientX - (rect.left + (rect.width / 2));
      const localY = clientY - (rect.top + (rect.height / 2));
      const hex = callHook(options.getColorAtOffset, localX, localY, radius);
      options.onPick(hex);
    };

    let pointerActive = false;
    const onPointerMove = (event) => {
      if (!pointerActive) return;
      pickFromClientPoint(event.clientX, event.clientY);
    };
    const onPointerUp = () => {
      pointerActive = false;
    };

    canvasEl.addEventListener?.('pointerdown', (event) => {
      event.preventDefault?.();
      pointerActive = true;
      pickFromClientPoint(event.clientX, event.clientY);
    });
    windowRef.addEventListener?.('pointermove', onPointerMove);
    windowRef.addEventListener?.('pointerup', onPointerUp);
    windowRef.addEventListener?.('pointercancel', onPointerUp);

    canvasEl.addEventListener?.('touchstart', (event) => {
      if (!event.touches || !event.touches.length) return;
      const touch = event.touches[0];
      pickFromClientPoint(touch.clientX, touch.clientY);
    }, { passive: true });
    canvasEl.addEventListener?.('touchmove', (event) => {
      if (!event.touches || !event.touches.length) return;
      const touch = event.touches[0];
      pickFromClientPoint(touch.clientX, touch.clientY);
    }, { passive: true });

    return updatePreviewAndMarker;
  }

  function bindColorPopoverControls(options = {}) {
    const documentRef = getDocument(options);
    const state = options.state && typeof options.state === 'object' ? options.state : { activeKey: null };
    const controls = options.controls || {};
    const resetButton = options.resetButton
      || documentRef?.getElementById?.(options.resetButtonId || 'readerColorResetBtn')
      || null;
    let bound = false;

    const api = {
      state,

      closeAll() {
        Object.values(controls).forEach((control) => {
          if (!control || !control.popover || !control.button) return;
          control.popover.hidden = true;
          control.button.setAttribute?.('aria-expanded', 'false');
        });
        state.activeKey = null;
      },

      open(key) {
        const control = controls[key];
        if (!control || !control.popover || !control.button) return;
        api.closeAll();
        control.popover.hidden = false;
        control.button.setAttribute?.('aria-expanded', 'true');
        callHook(control.sync);
        state.activeKey = key;
      },

      bind() {
        if (bound || !documentRef) return api;
        bound = true;

        Object.values(controls).forEach((control) => {
          if (!control || !control.button || !control.popover) return;
          control.button.addEventListener?.('click', (event) => {
            event.preventDefault?.();
            const shouldOpen = state.activeKey !== control.key;
            if (shouldOpen) api.open(control.key);
            else api.closeAll();
          });
        });

        documentRef.addEventListener?.('click', (event) => {
          if (!state.activeKey) return;
          const activeControl = controls[state.activeKey];
          if (!activeControl || !activeControl.button || !activeControl.popover) return;
          const target = event.target;
          if (activeControl.button.contains?.(target) || activeControl.popover.contains?.(target)) return;
          api.closeAll();
        });

        documentRef.addEventListener?.('keydown', (event) => {
          if (event.key !== 'Escape') return;
          if (!state.activeKey) return;
          api.closeAll();
        });

        resetButton?.addEventListener?.('click', () => {
          callHook(options.onReset);
        });

        return api;
      }
    };

    if (options.autoBind !== false) api.bind();
    return api;
  }

  function readState(options = {}) {
    const state = typeof options.getState === 'function'
      ? options.getState()
      : options.state;
    return state && typeof state === 'object' ? state : {};
  }

  function writeState(options = {}, patch = {}) {
    if (!patch || typeof patch !== 'object') return;
    if (typeof options.setState === 'function') {
      options.setState(patch);
      return;
    }
    if (options.state && typeof options.state === 'object') {
      Object.assign(options.state, patch);
    }
  }

  function callHook(fn, ...args) {
    if (typeof fn === 'function') return fn(...args);
    return undefined;
  }

  function normalizeSentenceLayout(value, options = {}) {
    const timestampsValue = options.timestampsValue || 'timestamps';
    const flatValue = options.flatValue || 'flat';
    const blaetternValue = options.blaetternValue || 'blaettern';
    if (value === 'kindle') return blaetternValue;
    if (value === 'timestamp') return timestampsValue;
    if (value === timestampsValue) return timestampsValue;
    if (value === blaetternValue) return blaetternValue;
    if (value === flatValue) return flatValue;
    return blaetternValue;
  }

  function normalizeTextAlign(value, options = {}) {
    const justifyValue = options.justifyValue || 'justify';
    const leftValue = options.leftValue || 'left';
    const defaultValue = options.defaultValue || justifyValue;
    if (typeof value !== 'string') return defaultValue;
    const cleaned = value.trim().toLowerCase();
    if (cleaned === 'blocksatz' || cleaned === justifyValue) return justifyValue;
    if (cleaned === 'flattersatz' || cleaned === leftValue) return leftValue;
    return defaultValue;
  }

  function normalizeFontSize(value, options = {}) {
    const min = Number.isFinite(options.min) ? options.min : 14;
    const max = Number.isFinite(options.max) ? options.max : 30;
    const fallback = Number.isFinite(options.defaultValue) ? options.defaultValue : 18;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    const rounded = Math.round(parsed);
    return Math.max(min, Math.min(max, rounded));
  }

  function normalizeFontFamilyKey(value, options = {}) {
    const fontFamilies = options.fontFamilies || {};
    const defaultValue = options.defaultValue || 'grotesk';
    if (typeof value !== 'string') return defaultValue;
    const cleaned = value.trim().toLowerCase();
    if (cleaned === 'segoe' || cleaned === 'arial') return 'grotesk';
    if (cleaned === 'georgia' || cleaned === 'times') return 'baroque';
    if (cleaned === 'constantia') return 'renaissance';
    return Object.prototype.hasOwnProperty.call(fontFamilies, cleaned)
      ? cleaned
      : defaultValue;
  }

  function getFontFamilyStack(value, options = {}) {
    const fontFamilies = options.fontFamilies || {};
    const defaultValue = options.defaultValue || 'grotesk';
    const normalized = normalizeFontFamilyKey(value, { fontFamilies, defaultValue });
    return fontFamilies[normalized] || fontFamilies[defaultValue] || '';
  }

  function normalizeVolume(value, options = {}) {
    const fallback = Number.isFinite(options.defaultValue) ? options.defaultValue : 1;
    if (value === null || value === undefined) return fallback;
    if (typeof value === 'string' && !value.trim()) return fallback;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    const normalized = parsed > 1 ? (parsed / 100) : parsed;
    return Math.max(0, Math.min(1, normalized));
  }

  function getModeDimLevel(options = {}) {
    const gameLevel = Number.isFinite(options.gameLevel) ? options.gameLevel : 0;
    const readingLevel = Number.isFinite(options.readingLevel) ? options.readingLevel : 50;
    return options.isReadingMode ? readingLevel : gameLevel;
  }

  function syncModeDimmerLevel(options = {}) {
    const globalVisualDimmer = options.globalVisualDimmer || null;
    if (!globalVisualDimmer) return null;
    if (typeof globalVisualDimmer.isFrozen === 'function' && globalVisualDimmer.isFrozen()) return null;

    const targetLevel = getModeDimLevel(options);
    const currentLevel = typeof globalVisualDimmer.getLevel === 'function' ? globalVisualDimmer.getLevel() : null;
    if (!options.force && currentLevel === targetLevel) {
      callHook(options.onManualBackgroundDimLevelChange, currentLevel);
      callHook(options.applyTint);
      return currentLevel;
    }

    globalVisualDimmer.setLevel?.(targetLevel);
    callHook(options.onManualBackgroundDimLevelChange, targetLevel);
    callHook(options.applyTint);
    return targetLevel;
  }
  function getFallbackBgColor(options = {}) {
    const documentRef = getDocument(options);
    const body = documentRef?.body || null;
    return body?.classList?.contains?.('scene-dimmer-light-mode') ? '#ede6d6' : '#11161d';
  }

  function getFallbackTextColor(options = {}) {
    const documentRef = getDocument(options);
    const body = documentRef?.body || null;
    return body?.classList?.contains?.('scene-dimmer-light-mode') ? '#1f1d18' : '#f2ecdc';
  }

  function mixHexColors(baseHex, tintHex, alpha = 0.5) {
    const base = hexToRgb(baseHex);
    const tint = hexToRgb(tintHex);
    if (!base || !tint) return baseHex;
    const a = Math.max(0, Math.min(1, Number(alpha) || 0));
    return rgbToHex(
      (base.r * (1 - a)) + (tint.r * a),
      (base.g * (1 - a)) + (tint.g * a),
      (base.b * (1 - a)) + (tint.b * a)
    );
  }

  function applyDimmerTint(options = {}) {
    const documentRef = getDocument(options);
    const overlay = options.overlay || documentRef?.getElementById?.(options.overlayId || 'sceneDimmerOverlay') || null;
    if (!overlay?.style) return null;

    const body = documentRef?.body || null;
    const lightMode = !!body?.classList?.contains?.('scene-dimmer-light-mode');
    const base = lightMode ? '#ffffff' : '#000000';
    const isFreezeMode = Number(options.manualBackgroundDimLevel) >= 100;
    const readerBgColor = options.readerBgColor || null;
    const appliedColor = (!isFreezeMode || !readerBgColor)
      ? base
      : mixHexColors(base, readerBgColor, 0.5);

    overlay.style.backgroundColor = appliedColor;
    return appliedColor;
  }
  function createController(options = {}) {
    const documentRef = getDocument(options);
    const storage = resolveStorage(options);
    const rangeIds = Array.isArray(options.rangeIds) && options.rangeIds.length
      ? options.rangeIds
      : ['readerFontSizeRange', 'readerTextVolumeRange', 'readerBackgroundVolumeRange'];

    let basicControlsBound = false;

    const api = {
      updateSliderFill(rangeEl) {
        if (rangeEl && rangeEl.style) rangeEl.style.background = '';
      },

      updateAllSliderFills() {
        if (!documentRef || typeof documentRef.getElementById !== 'function') return;
        rangeIds.forEach((id) => {
          api.updateSliderFill(documentRef.getElementById(id));
        });
      },

      bindBasicControls() {
        if (basicControlsBound || !documentRef) return;
        basicControlsBound = true;

        const layoutInputs = documentRef.querySelectorAll?.('input[name="readerSentenceLayout"]') || [];
        layoutInputs.forEach((input) => {
          input.addEventListener?.('change', () => {
            if (!input.checked) return;
            api.setSentenceLayout(input.value);
          });
        });

        const alignInputs = documentRef.querySelectorAll?.('input[name="readerTextAlign"]') || [];
        alignInputs.forEach((input) => {
          input.addEventListener?.('change', () => {
            if (!input.checked) return;
            api.setTextAlign(input.value);
          });
        });

        const fontButtons = documentRef.querySelectorAll?.('.reader-font-option') || [];
        fontButtons.forEach((button) => {
          button.addEventListener?.('click', () => {
            const nextFont = button.dataset?.font;
            if (!nextFont) return;
            api.setFontFamily(nextFont);
          });
        });

        const rangeInput = documentRef.getElementById?.('readerFontSizeRange') || null;
        const numberInput = documentRef.getElementById?.('readerFontSizeNumber') || null;
        if (rangeInput) {
          rangeInput.addEventListener?.('input', (event) => {
            api.setFontSize(event?.target?.value);
            api.updateSliderFill(event?.target || rangeInput);
          });
        }
        if (numberInput) {
          numberInput.addEventListener?.('input', (event) => {
            api.setFontSize(event?.target?.value);
          });
          numberInput.addEventListener?.('change', (event) => {
            api.setFontSize(event?.target?.value, { force: true });
          });
        }

        const bindVolumeInputs = (rangeId, numberId, setter) => {
          const rangeEl = documentRef.getElementById?.(rangeId) || null;
          const numberEl = documentRef.getElementById?.(numberId) || null;
          if (rangeEl) {
            rangeEl.addEventListener?.('input', (event) => {
              setter(event?.target?.value);
              api.updateSliderFill(event?.target || rangeEl);
            });
          }
          if (numberEl) {
            numberEl.addEventListener?.('input', (event) => {
              setter(event?.target?.value);
            });
            numberEl.addEventListener?.('change', (event) => {
              setter(event?.target?.value, { force: true });
            });
          }
        };

        bindVolumeInputs('readerTextVolumeRange', 'readerTextVolumeNumber', (value, nextOptions) => api.setTextVolume(value, nextOptions));
        bindVolumeInputs('readerBackgroundVolumeRange', 'readerBackgroundVolumeNumber', (value, nextOptions) => api.setBackgroundVolume(value, nextOptions));
      },

      applyTextSettings(applyOptions = {}) {
        const subtitleContainer = callHook(options.getSubtitleContainer) || options.subtitleContainer || null;
        if (!subtitleContainer) return;

        const state = readState(options);
        const rerender = applyOptions.rerender !== false;
        const flatLayoutValue = options.flatLayoutValue || 'flat';
        const blaetternLayoutValue = options.blaetternLayoutValue || 'blaettern';
        const textAlignLeftValue = options.textAlignLeftValue || 'left';
        const textAlignJustifyValue = options.textAlignJustifyValue || 'justify';
        const isFlatLayout = state.sentenceLayout === flatLayoutValue;
        const isBlaetternLayout = state.sentenceLayout === blaetternLayoutValue;
        const isLeftAlignedText = state.textAlign === textAlignLeftValue;

        subtitleContainer.classList?.toggle?.('reader-layout-flat', isFlatLayout);
        subtitleContainer.classList?.toggle?.('reader-layout-blaettern', isBlaetternLayout);
        subtitleContainer.classList?.toggle?.('reader-layout-timestamps', !isFlatLayout && !isBlaetternLayout);
        subtitleContainer.classList?.toggle?.('reader-text-left', isLeftAlignedText);
        subtitleContainer.classList?.toggle?.('reader-text-justify', !isLeftAlignedText);
        subtitleContainer.style?.setProperty?.('--reader-font-size', `${state.fontSizePx}px`);
        subtitleContainer.style?.setProperty?.(
          '--reader-font-family',
          callHook(options.getReaderFontFamilyStack, state.fontFamilyKey) || ''
        );
        subtitleContainer.style?.setProperty?.(
          '--reader-text-align',
          isLeftAlignedText ? textAlignLeftValue : textAlignJustifyValue
        );

        callHook(options.applyReaderColorSettings);
        callHook(options.markBlaetternPaginationDirty);
        callHook(options.syncBlaetternUiState, 'reader-settings');

        if (typeof subtitleContainer.querySelectorAll === 'function') {
          subtitleContainer.querySelectorAll('.bookmark-btn.visible').forEach((button) => {
            button.classList?.remove?.('visible');
          });
        }
        callHook(options.hideBlaetternBookmarkButton);

        if (rerender) {
          if (subtitleContainer.dataset) subtitleContainer.dataset.version = '';
          callHook(options.rerenderSubtitles);
        }
      },

      syncUi() {
        if (!documentRef) return;

        const state = readState(options);
        const layoutInputs = documentRef.querySelectorAll?.('input[name="readerSentenceLayout"]') || [];
        layoutInputs.forEach((input) => {
          input.checked = input.value === state.sentenceLayout;
        });

        const alignInputs = documentRef.querySelectorAll?.('input[name="readerTextAlign"]') || [];
        alignInputs.forEach((input) => {
          input.checked = input.value === state.textAlign;
        });

        const rangeInput = documentRef.getElementById?.('readerFontSizeRange') || null;
        const numberInput = documentRef.getElementById?.('readerFontSizeNumber') || null;
        const valueAsText = String(state.fontSizePx);
        if (rangeInput) rangeInput.value = valueAsText;
        if (numberInput) numberInput.value = valueAsText;

        const fontOptionButtons = documentRef.querySelectorAll?.('.reader-font-option') || [];
        fontOptionButtons.forEach((button) => {
          const isActive = button.dataset?.font === state.fontFamilyKey;
          button.classList?.toggle?.('is-active', isActive);
          button.setAttribute?.('aria-pressed', isActive ? 'true' : 'false');
        });

        const textVolumeRange = documentRef.getElementById?.('readerTextVolumeRange') || null;
        const textVolumeNumber = documentRef.getElementById?.('readerTextVolumeNumber') || null;
        const bgVolumeRange = documentRef.getElementById?.('readerBackgroundVolumeRange') || null;
        const bgVolumeNumber = documentRef.getElementById?.('readerBackgroundVolumeNumber') || null;
        const textVolumeValue = String(Math.round((Number(state.textVolume) || 0) * 100));
        const bgVolumeValue = String(Math.round((Number(state.backgroundVolume) || 0) * 100));
        if (textVolumeRange) textVolumeRange.value = textVolumeValue;
        if (textVolumeNumber) textVolumeNumber.value = textVolumeValue;
        if (bgVolumeRange) bgVolumeRange.value = bgVolumeValue;
        if (bgVolumeNumber) bgVolumeNumber.value = bgVolumeValue;

        const effectiveBg = state.bgColor || callHook(options.getReaderFallbackBgColor) || '';
        const effectiveText = state.textColor || callHook(options.getReaderFallbackTextColor) || '';
        const bgPreview = documentRef.getElementById?.('readerBgColorPreview') || null;
        const textPreview = documentRef.getElementById?.('readerTextColorPreview') || null;
        if (bgPreview?.style) bgPreview.style.background = effectiveBg;
        if (textPreview?.style) textPreview.style.background = effectiveText;

        const wheelSync = options.readerColorWheelSync || {};
        callHook(wheelSync.bg, effectiveBg);
        callHook(wheelSync.text, effectiveText);

        api.updateAllSliderFills();
      },

      setSentenceLayout(nextLayout, setterOptions = {}) {
        const state = readState(options);
        const normalized = callHook(options.normalizeReaderSentenceLayout, nextLayout) ?? nextLayout;
        if (!setterOptions.force && normalized === state.sentenceLayout) return;
        writeState(options, { sentenceLayout: normalized });
        storage.setItem(options.layoutStorageKey || 'gameboy_reader_sentence_layout', normalized);
        api.applyTextSettings({ rerender: true });
        api.syncUi();
      },

      setFontSize(nextSize, setterOptions = {}) {
        const state = readState(options);
        const normalized = callHook(options.normalizeReaderFontSize, nextSize) ?? nextSize;
        if (!setterOptions.force && normalized === state.fontSizePx) return;
        writeState(options, { fontSizePx: normalized });
        storage.setItem(options.fontSizeStorageKey || 'gameboy_reader_font_size_px', String(normalized));
        api.applyTextSettings({
          rerender: state.sentenceLayout === (options.flatLayoutValue || 'flat')
            || state.sentenceLayout === (options.blaetternLayoutValue || 'blaettern')
        });
        api.syncUi();
      },

      setFontFamily(nextFont, setterOptions = {}) {
        const state = readState(options);
        const normalized = callHook(options.normalizeReaderFontFamilyKey, nextFont) ?? nextFont;
        if (!setterOptions.force && normalized === state.fontFamilyKey) return;
        writeState(options, { fontFamilyKey: normalized });
        storage.setItem(options.fontFamilyStorageKey || 'gameboy_reader_font_family', normalized);
        callHook(options.onFontFamilyChange, normalized);
        api.applyTextSettings({
          rerender: state.sentenceLayout === (options.flatLayoutValue || 'flat')
            || state.sentenceLayout === (options.blaetternLayoutValue || 'blaettern')
        });
        api.syncUi();
      },

      setTextAlign(nextAlign, setterOptions = {}) {
        const state = readState(options);
        const normalized = callHook(options.normalizeReaderTextAlign, nextAlign) ?? nextAlign;
        if (!setterOptions.force && normalized === state.textAlign) return;
        writeState(options, { textAlign: normalized });
        storage.setItem(options.textAlignStorageKey || 'gameboy_reader_text_align', normalized);
        api.applyTextSettings({
          rerender: state.sentenceLayout === (options.flatLayoutValue || 'flat')
            || state.sentenceLayout === (options.blaetternLayoutValue || 'blaettern')
        });
        api.syncUi();
      },

      setTextVolume(nextVolume, setterOptions = {}) {
        const state = readState(options);
        const normalized = callHook(options.normalizeReaderVolume, nextVolume) ?? nextVolume;
        if (!setterOptions.force && normalized === state.textVolume) return;
        writeState(options, { textVolume: normalized });
        storage.setItem(options.textVolumeStorageKey || 'gameboy_reader_text_volume', String(normalized));
        callHook(options.onTextVolumeChange, normalized);
        api.syncUi();
      },

      setBackgroundVolume(nextVolume, setterOptions = {}) {
        const state = readState(options);
        const normalized = callHook(options.normalizeReaderVolume, nextVolume) ?? nextVolume;
        if (!setterOptions.force && normalized === state.backgroundVolume) return;
        writeState(options, { backgroundVolume: normalized });
        storage.setItem(options.backgroundVolumeStorageKey || 'gameboy_reader_background_volume', String(normalized));
        callHook(options.onBackgroundVolumeChange, normalized);
        api.syncUi();
      },

      setBgColor(nextColor, setterOptions = {}) {
        const state = readState(options);
        const normalized = callHook(options.normalizeReaderHexColor, nextColor, null);
        if (!setterOptions.force && normalized === state.bgColor) return;
        writeState(options, { bgColor: normalized });
        if (normalized) storage.setItem(options.bgColorStorageKey || 'gameboy_reader_bg_color', normalized);
        else storage.removeItem(options.bgColorStorageKey || 'gameboy_reader_bg_color');
        api.applyTextSettings({ rerender: false });
        api.syncUi();
      },

      setTextColor(nextColor, setterOptions = {}) {
        const state = readState(options);
        const normalized = callHook(options.normalizeReaderHexColor, nextColor, null);
        if (!setterOptions.force && normalized === state.textColor) return;
        writeState(options, { textColor: normalized });
        if (normalized) storage.setItem(options.textColorStorageKey || 'gameboy_reader_text_color', normalized);
        else storage.removeItem(options.textColorStorageKey || 'gameboy_reader_text_color');
        api.applyTextSettings({ rerender: false });
        api.syncUi();
      }
    };

    return api;
  }

  return Object.freeze({
    createController,
    initColorWheelControl,
    bindColorPopoverControls,
    clamp01,
    normalizeHexColor,
    hexToRgb,
    rgbToHex,
    rgbToHsl,
    hslToRgb,
    mixWheelRgb,
    getWheelRgbAtOffset,
    getWheelColorAtOffset,
    setWheelMarkerFromHex,
    drawGoetheColorWheel,
    normalizeSentenceLayout,
    normalizeTextAlign,
    normalizeFontSize,
    normalizeFontFamilyKey,
    getFontFamilyStack,
    normalizeVolume,
    getModeDimLevel,
    syncModeDimmerLevel,
    getFallbackBgColor,
    getFallbackTextColor,
    mixHexColors,
    applyDimmerTint
  });
});
