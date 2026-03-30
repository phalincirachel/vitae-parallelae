(function bootstrapWordImageOverlay(root, factory) {
  root.GameboyWordImageOverlay = factory(root);
})(typeof globalThis !== 'undefined' ? globalThis : this, function createWordImageOverlayApi(globalObject) {
  const OVERLAY_ROOT_ID = 'wordImageOverlayRoot';
  const OVERLAY_ROOT_CLASS = 'word-image-overlay-root';
  const OVERLAY_LAYER_CLASS = 'word-image-overlay-layer';
  const OVERLAY_IMAGE_CLASS = 'word-image-overlay-image';
  const PASS_THROUGH_EVENT_TYPES = Object.freeze([
    'pointerdown',
    'pointermove',
    'pointerup',
    'pointercancel',
    'mousedown',
    'mousemove',
    'mouseup',
    'click',
    'dblclick',
    'auxclick',
    'contextmenu',
    'touchstart',
    'touchmove',
    'touchend',
    'touchcancel'
  ]);

  const DEFAULT_MAX_CONCURRENT_MOBILE = 1;
  const DEFAULT_MAX_CONCURRENT_DESKTOP = 2;
  const DEFAULT_ESTIMATED_SIZE_BYTES = 4 * 1024 * 1024;
  const PRELOAD_THROTTLE_MS = 220;
  const DEFAULT_FADE_IN_SECONDS = 3;
  const DEFAULT_HOLD_SECONDS = 3;
  const DEFAULT_FADE_OUT_SECONDS = 3;

  const DEFAULT_TEST_CUES = Object.freeze([
    Object.freeze({
      id: 'index-aerger',
      sceneKeys: Object.freeze(['marktplatz']),
      contentRefs: Object.freeze(['assets/kapitel1.txt']),
      word: '\u00c4rger',
      sentenceHint: 'Du hast vielleicht \u00c4rger empfunden oder',
      imageUrl: 'https://drive.google.com/file/d/1oMDq1s3AA74V2VF3W3guQRm0C6TFgDHs/view?usp=sharing',
      estimatedSizeBytes: 6 * 1024 * 1024
    }),
    Object.freeze({
      id: 'index-verschuettung',
      sceneKeys: Object.freeze(['marktplatz']),
      contentRefs: Object.freeze(['assets/kapitel1.txt']),
      word: 'Versch\u00fcttung',
      sentenceHint: 'Unter der Versch\u00fcttung der Jahrzehnte lag ich und schrieb nicht',
      imageUrl: 'https://drive.google.com/file/d/1Vrba02S1M_tGg6GKYNgGM800_tyC_AN_/view?usp=sharing',
      estimatedSizeBytes: 6 * 1024 * 1024
    }),
    Object.freeze({
      id: 'liminal-buecherregale',
      sceneKeys: Object.freeze(['liminal_library']),
      contentRefs: Object.freeze(['assets/kapitel1b.txt']),
      word: 'B\u00fccherregale',
      sentenceHint: 'Dann erscheinen vor mir meterhohe B\u00fccherregale in einem nach hinten gel\u00e4ngten Gesch\u00e4ft',
      imageUrl: 'https://drive.google.com/file/d/1T9N5vvmWsq8CipKZy7I2IQrUflddP4gr/view?usp=sharing',
      estimatedSizeBytes: 6 * 1024 * 1024
    })
  ]);

  function toFiniteNumber(value, fallback = NaN) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function normalizeText(value) {
    if (typeof value !== 'string') return '';
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function normalizePathRef(value) {
    if (typeof value !== 'string') return '';
    return value.replace(/\\/g, '/').toLowerCase().trim();
  }

  function normalizeSceneKey(value) {
    return normalizeText(value).replace(/\s+/g, '_');
  }

  function pathRefMatches(activeRef, cueRef) {
    const active = normalizePathRef(activeRef);
    const cue = normalizePathRef(cueRef);
    if (!cue) return false;
    if (!active) return true;
    return active === cue || active.endsWith(`/${cue}`) || cue.endsWith(`/${active}`);
  }

  function sanitizeCueId(value, fallbackIndex = 0) {
    const raw = typeof value === 'string' ? value.trim() : '';
    if (raw) return raw.replace(/[^a-z0-9._:-]+/gi, '-').toLowerCase();
    return `cue-${fallbackIndex + 1}`;
  }

  function copyCue(cue, fallbackIndex = 0) {
    const sceneKeys = Array.isArray(cue && cue.sceneKeys)
      ? cue.sceneKeys.map((entry) => normalizeSceneKey(entry)).filter(Boolean)
      : [];
    const contentRefs = Array.isArray(cue && cue.contentRefs)
      ? cue.contentRefs.map((entry) => normalizePathRef(entry)).filter(Boolean)
      : [];

    return {
      id: sanitizeCueId(cue && cue.id, fallbackIndex),
      sceneKeys,
      contentRefs,
      word: typeof cue?.word === 'string' ? cue.word : '',
      sentenceHint: typeof cue?.sentenceHint === 'string' ? cue.sentenceHint : '',
      imageUrl: typeof cue?.imageUrl === 'string' ? cue.imageUrl.trim() : '',
      estimatedSizeBytes: Math.max(120 * 1024, toFiniteNumber(cue?.estimatedSizeBytes, DEFAULT_ESTIMATED_SIZE_BYTES))
    };
  }

  function normalizeCueDefinitions(cues) {
    const source = Array.isArray(cues) ? cues : [];
    const normalized = source
      .map((cue, index) => copyCue(cue, index))
      .filter((cue) => cue.word && cue.imageUrl);
    const seen = new Set();
    normalized.forEach((cue, index) => {
      let nextId = cue.id;
      let suffix = 2;
      while (seen.has(nextId)) {
        nextId = `${cue.id}-${suffix}`;
        suffix += 1;
      }
      cue.id = nextId;
      seen.add(nextId);
      if (!cue.id) cue.id = `cue-${index + 1}`;
    });
    return normalized;
  }

  function tokenizeWords(text) {
    if (typeof text !== 'string') return [];
    const matches = text.match(/[A-Za-z0-9\u00c0-\u024f\u1e00-\u1eff]+/g);
    return Array.isArray(matches) ? matches : [];
  }

  function resolveWordRatio(trackText, targetWord) {
    const normalizedLine = normalizeText(trackText);
    const normalizedWord = normalizeText(targetWord);
    if (!normalizedLine || !normalizedWord) return 0;

    const charPosition = normalizedLine.indexOf(normalizedWord);
    const charRatio = charPosition >= 0
      ? clamp(charPosition / Math.max(1, normalizedLine.length), 0, 1)
      : 0;

    const tokens = tokenizeWords(trackText);
    if (!tokens.length) return charRatio;
    const normalizedTokens = tokens.map((token) => normalizeText(token));
    const tokenIndex = normalizedTokens.findIndex((token) => token === normalizedWord || token.includes(normalizedWord));
    if (tokenIndex < 0) return charRatio;
    return clamp(tokenIndex / Math.max(1, normalizedTokens.length), 0, 1);
  }

  function resolveTrackIndexForCue(cue, tracks) {
    if (!Array.isArray(tracks) || !tracks.length) return -1;
    const sentenceHint = normalizeText(cue.sentenceHint);
    if (sentenceHint) {
      const sentenceIndex = tracks.findIndex((track) => normalizeText(track?.text || track?.rawText || '').includes(sentenceHint));
      if (sentenceIndex >= 0) return sentenceIndex;
    }

    const word = normalizeText(cue.word);
    if (!word) return -1;
    return tracks.findIndex((track) => normalizeText(track?.text || track?.rawText || '').includes(word));
  }

  function resolveImageUrlCandidates(rawUrl) {
    const trimmed = typeof rawUrl === 'string' ? rawUrl.trim() : '';
    if (!trimmed) return [];

    const candidates = [];
    const push = (value) => {
      if (!value) return;
      if (!candidates.includes(value)) candidates.push(value);
    };

    push(trimmed);

    const driveMatch = trimmed.match(/drive\.google\.com\/file\/d\/([^/?#]+)/i);
    if (driveMatch && driveMatch[1]) {
      const fileId = driveMatch[1];
      push(`https://drive.google.com/uc?export=view&id=${fileId}`);
      push(`https://drive.google.com/uc?export=download&id=${fileId}`);
      push(`https://drive.google.com/thumbnail?id=${fileId}&sz=w4096`);
    }

    return candidates;
  }

  function estimateNetworkDownlinkMbps(windowObject) {
    const downlink = toFiniteNumber(windowObject?.navigator?.connection?.downlink, NaN);
    if (Number.isFinite(downlink) && downlink > 0) return downlink;
    const isLikelyMobile = !!windowObject?.matchMedia && windowObject.matchMedia('(pointer: coarse)').matches;
    return isLikelyMobile ? 2.2 : 6.5;
  }

  function estimateLeadSeconds(estimatedSizeBytes, downlinkMbps) {
    const bytes = Math.max(120 * 1024, toFiniteNumber(estimatedSizeBytes, DEFAULT_ESTIMATED_SIZE_BYTES));
    const mbps = Math.max(0.4, toFiniteNumber(downlinkMbps, 3));
    const downloadSeconds = (bytes * 8) / (mbps * 1000 * 1000);
    const decodeSeconds = clamp(bytes / (8 * 1024 * 1024), 0.18, 1.3);
    const leadSeconds = downloadSeconds + decodeSeconds + 0.75;
    return clamp(leadSeconds, 1.4, 12);
  }

  function resolveEnvelopeAtTime(entry, timeSec) {
    const t = toFiniteNumber(timeSec, NaN);
    if (!Number.isFinite(t)) return 0;
    if (!entry) return 0;
    if (t < entry.start || t > entry.end) return 0;

    if (t < entry.holdStart) {
      if (entry.fadeInDuration <= 0) return 1;
      return clamp((t - entry.start) / entry.fadeInDuration, 0, 1);
    }

    if (t <= entry.holdEnd) {
      return 1;
    }

    if (entry.fadeOutDuration <= 0) return 0;
    return clamp(1 - ((t - entry.holdEnd) / entry.fadeOutDuration), 0, 1);
  }

  function resolveActiveWeights(entries, timeSec) {
    const active = [];
    let sum = 0;

    for (const entry of entries || []) {
      const envelope = resolveEnvelopeAtTime(entry, timeSec);
      if (envelope <= 0.0001) continue;
      active.push({ entry, envelope });
      sum += envelope;
    }

    if (!active.length) return [];
    const normalization = sum > 1 ? (1 / sum) : 1;
    return active.map((payload) => ({
      entry: payload.entry,
      envelope: payload.envelope,
      weight: clamp(payload.envelope * normalization, 0, 1)
    }));
  }

  function setOverlayElementNonInteractive(element, isRoot = false) {
    if (!element) return;
    if (typeof element.setAttribute === 'function') {
      element.setAttribute('aria-hidden', 'true');
      if (isRoot) element.setAttribute('role', 'presentation');
    }
    if (element.style) {
      element.style.pointerEvents = 'none';
      element.style.touchAction = 'none';
      element.style.userSelect = 'none';
      element.style.webkitUserSelect = 'none';
      element.style.webkitTouchCallout = 'none';
      element.style.webkitTapHighlightColor = 'transparent';
    }
    if (isRoot) {
      try {
        element.tabIndex = -1;
      } catch (_) {
        // ignore readonly targets
      }
      try {
        element.inert = true;
      } catch (_) {
        // inert is not universally writable
      }
    }
  }

  function isWithinOverlay(rootEl, target) {
    if (!rootEl || !target) return false;
    if (target === rootEl) return true;
    if (typeof rootEl.contains === 'function') {
      try {
        return !!rootEl.contains(target);
      } catch (_) {
        return false;
      }
    }
    return false;
  }

  function resolveEventClientPoint(event) {
    const directX = toFiniteNumber(event && event.clientX, NaN);
    const directY = toFiniteNumber(event && event.clientY, NaN);
    if (Number.isFinite(directX) && Number.isFinite(directY)) {
      return { clientX: directX, clientY: directY };
    }

    const changedTouch = event && event.changedTouches && event.changedTouches[0];
    const touch = changedTouch || (event && event.touches && event.touches[0]) || null;
    const touchX = toFiniteNumber(touch && touch.clientX, NaN);
    const touchY = toFiniteNumber(touch && touch.clientY, NaN);
    return { clientX: touchX, clientY: touchY };
  }

  function resolveUnderlyingTargetAtPoint(documentObject, rootEl, clientX, clientY) {
    if (!documentObject || typeof documentObject.elementFromPoint !== 'function') return null;
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return null;

    const style = rootEl && rootEl.style ? rootEl.style : null;
    const previousVisibility = style ? style.visibility : '';
    const previousPointerEvents = style ? style.pointerEvents : '';
    if (style) {
      style.visibility = 'hidden';
      style.pointerEvents = 'none';
    }

    let target = null;
    try {
      target = documentObject.elementFromPoint(clientX, clientY);
    } catch (_) {
      target = null;
    }

    if (style) {
      style.visibility = previousVisibility;
      style.pointerEvents = previousPointerEvents || 'none';
    }

    if (!target || target === rootEl || isWithinOverlay(rootEl, target)) return null;
    return target;
  }

  function createMouseEventInit(sourceEvent, point) {
    return {
      bubbles: true,
      cancelable: true,
      composed: true,
      clientX: Number.isFinite(point.clientX) ? point.clientX : 0,
      clientY: Number.isFinite(point.clientY) ? point.clientY : 0,
      screenX: toFiniteNumber(sourceEvent && sourceEvent.screenX, 0),
      screenY: toFiniteNumber(sourceEvent && sourceEvent.screenY, 0),
      button: toFiniteNumber(sourceEvent && sourceEvent.button, 0),
      buttons: toFiniteNumber(sourceEvent && sourceEvent.buttons, 1),
      detail: toFiniteNumber(sourceEvent && sourceEvent.detail, 1),
      ctrlKey: !!(sourceEvent && sourceEvent.ctrlKey),
      shiftKey: !!(sourceEvent && sourceEvent.shiftKey),
      altKey: !!(sourceEvent && sourceEvent.altKey),
      metaKey: !!(sourceEvent && sourceEvent.metaKey)
    };
  }

  function createPointerEventInit(sourceEvent, point, forcedType = '') {
    const mouseInit = createMouseEventInit(sourceEvent, point);
    return Object.assign(mouseInit, {
      pointerId: Math.max(1, Math.floor(toFiniteNumber(sourceEvent && sourceEvent.pointerId, 1))),
      pointerType: forcedType || (typeof sourceEvent?.pointerType === 'string' ? sourceEvent.pointerType : 'mouse'),
      isPrimary: sourceEvent && typeof sourceEvent.isPrimary === 'boolean' ? sourceEvent.isPrimary : true,
      pressure: clamp(toFiniteNumber(sourceEvent && sourceEvent.pressure, 0.5), 0, 1),
      width: Math.max(1, toFiniteNumber(sourceEvent && sourceEvent.width, 1)),
      height: Math.max(1, toFiniteNumber(sourceEvent && sourceEvent.height, 1)),
      tiltX: clamp(toFiniteNumber(sourceEvent && sourceEvent.tiltX, 0), -90, 90),
      tiltY: clamp(toFiniteNumber(sourceEvent && sourceEvent.tiltY, 0), -90, 90),
      twist: clamp(toFiniteNumber(sourceEvent && sourceEvent.twist, 0), 0, 359)
    });
  }

  function dispatchRetargetedEvent(target, sourceEvent, point, windowObject) {
    if (!target) return false;
    const sourceType = String(sourceEvent && sourceEvent.type || '').toLowerCase();
    const PointerCtor = windowObject && windowObject.PointerEvent ? windowObject.PointerEvent : null;
    const MouseCtor = windowObject && windowObject.MouseEvent ? windowObject.MouseEvent : null;

    const dispatch = (eventObject) => {
      if (!eventObject) return false;
      if (typeof target.dispatchEvent === 'function') {
        try {
          return target.dispatchEvent(eventObject);
        } catch (_) {
          return false;
        }
      }
      return false;
    };

    if (sourceType.startsWith('pointer') && PointerCtor) {
      return dispatch(new PointerCtor(sourceType, createPointerEventInit(sourceEvent, point)));
    }

    if (sourceType === 'touchstart' || sourceType === 'touchmove' || sourceType === 'touchend' || sourceType === 'touchcancel') {
      if (PointerCtor) {
        const mappedType = sourceType === 'touchstart'
          ? 'pointerdown'
          : sourceType === 'touchmove'
            ? 'pointermove'
            : sourceType === 'touchend'
              ? 'pointerup'
              : 'pointercancel';
        return dispatch(new PointerCtor(mappedType, createPointerEventInit(sourceEvent, point, 'touch')));
      }
      if (MouseCtor) {
        const mappedType = sourceType === 'touchstart'
          ? 'mousedown'
          : sourceType === 'touchmove'
            ? 'mousemove'
            : 'mouseup';
        const ok = dispatch(new MouseCtor(mappedType, createMouseEventInit(sourceEvent, point)));
        if (ok && sourceType === 'touchend') {
          dispatch(new MouseCtor('click', createMouseEventInit(sourceEvent, point)));
        }
        return ok;
      }
    }

    const isMouseLike = sourceType === 'click'
      || sourceType === 'dblclick'
      || sourceType === 'auxclick'
      || sourceType === 'contextmenu'
      || sourceType === 'mousedown'
      || sourceType === 'mousemove'
      || sourceType === 'mouseup';

    if (isMouseLike && MouseCtor) {
      return dispatch(new MouseCtor(sourceType, createMouseEventInit(sourceEvent, point)));
    }

    if (sourceType === 'click' && typeof target.click === 'function') {
      try {
        target.click();
        return true;
      } catch (_) {
        return false;
      }
    }

    return false;
  }

  function handleBlockedOverlayEvent(event, documentObject, windowObject, rootEl) {
    if (!event || !rootEl) return false;
    if (!isWithinOverlay(rootEl, event.target)) return false;

    if (typeof event.preventDefault === 'function') event.preventDefault();
    if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
    else if (typeof event.stopPropagation === 'function') event.stopPropagation();

    const point = resolveEventClientPoint(event);
    const target = resolveUnderlyingTargetAtPoint(documentObject, rootEl, point.clientX, point.clientY);
    if (!target) return true;
    dispatchRetargetedEvent(target, event, point, windowObject);
    return true;
  }

  function installOverlayPassthroughGuard(documentObject, windowObject, rootEl) {
    if (!documentObject || typeof documentObject.addEventListener !== 'function' || !rootEl) {
      return () => {};
    }

    const handler = (event) => {
      handleBlockedOverlayEvent(event, documentObject, windowObject, rootEl);
    };

    for (const type of PASS_THROUGH_EVENT_TYPES) {
      documentObject.addEventListener(type, handler, true);
    }

    return () => {
      if (typeof documentObject.removeEventListener !== 'function') return;
      for (const type of PASS_THROUGH_EVENT_TYPES) {
        documentObject.removeEventListener(type, handler, true);
      }
    };
  }

  function buildTimelineEntries(cues, context = {}) {
    const normalizedCues = normalizeCueDefinitions(cues);
    const tracks = Array.isArray(context.tracks) ? context.tracks : [];
    const sceneKey = normalizeSceneKey(context.sceneKey);
    const contentRef = normalizePathRef(context.contentRef);
    const durationSec = toFiniteNumber(context.durationSec, NaN);
    const entries = [];

    for (const cue of normalizedCues) {
      if (cue.sceneKeys.length && !cue.sceneKeys.includes(sceneKey)) continue;
      if (cue.contentRefs.length && !cue.contentRefs.some((ref) => pathRefMatches(contentRef, ref))) continue;

      const trackIndex = resolveTrackIndexForCue(cue, tracks);
      if (trackIndex < 0) continue;

      const track = tracks[trackIndex];
      const lineStart = toFiniteNumber(track?.time, NaN);
      if (!Number.isFinite(lineStart)) continue;

      const nextTrack = tracks[trackIndex + 1] || null;
      let lineEnd = toFiniteNumber(nextTrack?.time, NaN);
      if (!Number.isFinite(lineEnd) || lineEnd <= lineStart) {
        lineEnd = lineStart + 3;
      }
      const lineDuration = Math.max(0.12, lineEnd - lineStart);
      const ratio = resolveWordRatio(track?.text || track?.rawText || '', cue.word);
      let anchor = lineStart + (lineDuration * ratio);

      let maxPlayableTime = Number.isFinite(durationSec) && durationSec > 0 ? durationSec : (lineEnd + 2);
      if (!Number.isFinite(maxPlayableTime) || maxPlayableTime < 0) maxPlayableTime = lineEnd + 2;
      anchor = clamp(anchor, 0, maxPlayableTime);

      const fadeInDuration = clamp(Math.min(DEFAULT_FADE_IN_SECONDS, anchor), 0, DEFAULT_FADE_IN_SECONDS);
      let holdDuration = DEFAULT_HOLD_SECONDS;
      if (anchor + holdDuration > maxPlayableTime) {
        holdDuration = Math.max(0, maxPlayableTime - anchor);
      }
      const holdStart = anchor;
      const holdEnd = holdStart + holdDuration;
      const fadeOutDuration = clamp(Math.min(DEFAULT_FADE_OUT_SECONDS, Math.max(0, maxPlayableTime - holdEnd)), 0, DEFAULT_FADE_OUT_SECONDS);
      const start = holdStart - fadeInDuration;
      const end = holdEnd + fadeOutDuration;
      if (end <= start + 0.01) continue;

      entries.push({
        id: cue.id,
        cue,
        trackIndex,
        lineStart,
        lineEnd,
        lineDuration,
        anchor,
        start,
        holdStart,
        holdEnd,
        end,
        fadeInDuration,
        holdDuration,
        fadeOutDuration,
        estimatedSizeBytes: cue.estimatedSizeBytes,
        imageCandidates: resolveImageUrlCandidates(cue.imageUrl),
        preferredImageUrl: cue.imageUrl
      });
    }

    entries.sort((left, right) => left.start - right.start);
    return entries;
  }

  function ensureOverlayRoot(documentObject) {
    if (!documentObject || typeof documentObject.createElement !== 'function') return null;
    const existing = documentObject.getElementById
      ? documentObject.getElementById(OVERLAY_ROOT_ID)
      : null;
    if (existing) {
      setOverlayElementNonInteractive(existing, true);
      return existing;
    }

    const rootEl = documentObject.createElement('div');
    rootEl.id = OVERLAY_ROOT_ID;
    rootEl.className = OVERLAY_ROOT_CLASS;
    setOverlayElementNonInteractive(rootEl, true);
    rootEl.style.display = 'none';

    const host = documentObject.body || documentObject.documentElement || null;
    if (host && typeof host.appendChild === 'function') {
      host.appendChild(rootEl);
    }
    return rootEl;
  }

  function createNoopController() {
    const noop = () => {};
    return Object.freeze({
      setCueDefinitions: noop,
      setTimelineContext: () => [],
      onTimeUpdate: noop,
      onSeek: noop,
      clear: noop,
      destroy: noop,
      getDiagnostics: () => ({ disabled: true, timelineCount: 0, readyCount: 0 })
    });
  }

  function initController(options = {}) {
    const documentObject = options.document || globalObject.document || null;
    const windowObject = options.window || globalObject.window || globalObject;
    if (!documentObject || typeof documentObject.createElement !== 'function') {
      return createNoopController();
    }

    const state = {
      cues: normalizeCueDefinitions(options.cues || DEFAULT_TEST_CUES),
      timelineEntries: [],
      queue: [],
      imageRecords: new Map(),
      layerByCueId: new Map(),
      activeLoads: 0,
      lastPreloadAt: 0,
      lastTimeSec: 0,
      overlayRoot: null,
      overlayPassthroughCleanup: null,
      destroyed: false,
      downlinkMbps: estimateNetworkDownlinkMbps(windowObject),
      maxConcurrent: Math.max(
        1,
        toFiniteNumber(
          options.maxConcurrent,
          (windowObject?.matchMedia && windowObject.matchMedia('(pointer: coarse)').matches)
            ? DEFAULT_MAX_CONCURRENT_MOBILE
            : DEFAULT_MAX_CONCURRENT_DESKTOP
        )
      )
    };

    function getDurationSec() {
      if (typeof options.getDurationSec === 'function') {
        return toFiniteNumber(options.getDurationSec(), NaN);
      }
      return NaN;
    }

    function ensureRecord(entry) {
      if (state.imageRecords.has(entry.id)) {
        return state.imageRecords.get(entry.id);
      }
      const record = {
        status: 'idle',
        queued: false,
        image: null,
        resolvedUrl: '',
        error: null
      };
      state.imageRecords.set(entry.id, record);
      return record;
    }

    function ensureLayer(entry, record) {
      const existing = state.layerByCueId.get(entry.id);
      if (existing) {
        setOverlayElementNonInteractive(existing.layer, false);
        setOverlayElementNonInteractive(existing.img, false);
        if (record && record.resolvedUrl && existing.img.src !== record.resolvedUrl) {
          existing.img.src = record.resolvedUrl;
        }
        return existing;
      }

      const rootEl = state.overlayRoot || ensureOverlayRoot(documentObject);
      state.overlayRoot = rootEl;
      if (!rootEl || typeof documentObject.createElement !== 'function') return null;

      const layerEl = documentObject.createElement('div');
      layerEl.className = OVERLAY_LAYER_CLASS;
      setOverlayElementNonInteractive(layerEl, false);
      layerEl.style.opacity = '0';
      layerEl.style.display = 'none';

      const imageEl = documentObject.createElement('img');
      imageEl.className = OVERLAY_IMAGE_CLASS;
      imageEl.alt = '';
      setOverlayElementNonInteractive(imageEl, false);
      imageEl.draggable = false;
      imageEl.decoding = 'async';
      if (record && record.resolvedUrl) imageEl.src = record.resolvedUrl;

      layerEl.appendChild(imageEl);
      rootEl.appendChild(layerEl);

      const payload = { layer: layerEl, img: imageEl };
      state.layerByCueId.set(entry.id, payload);
      return payload;
    }

    function hideAllLayers() {
      for (const payload of state.layerByCueId.values()) {
        if (!payload || !payload.layer || !payload.layer.style) continue;
        payload.layer.style.opacity = '0';
        payload.layer.style.display = 'none';
      }
      if (state.overlayRoot && state.overlayRoot.style) {
        state.overlayRoot.style.display = 'none';
      }
    }

    function loadImageCandidate(url, priority) {
      const ImageCtor = windowObject && windowObject.Image ? windowObject.Image : null;
      if (!ImageCtor) return Promise.reject(new Error('Image constructor missing'));

      return new Promise((resolve, reject) => {
        const image = new ImageCtor();
        let settled = false;

        const finalize = (fn, value) => {
          if (settled) return;
          settled = true;
          image.onload = null;
          image.onerror = null;
          fn(value);
        };

        try {
          image.decoding = 'async';
          image.loading = 'eager';
          image.fetchPriority = priority;
        } catch (_) {
          // Some browsers do not expose these properties.
        }

        image.onload = async () => {
          if (typeof image.decode === 'function') {
            try {
              await image.decode();
            } catch (_) {
              // decode may throw for already decoded images; keep successful load.
            }
          }
          finalize(resolve, { image, resolvedUrl: url });
        };
        image.onerror = () => finalize(reject, new Error(`Image load failed: ${url}`));
        image.src = url;
      });
    }

    async function loadEntryImage(entry) {
      const record = ensureRecord(entry);
      const candidates = Array.isArray(entry.imageCandidates) && entry.imageCandidates.length
        ? entry.imageCandidates
        : [entry.preferredImageUrl];
      let lastError = null;
      const priority = 'high';

      for (const candidate of candidates) {
        try {
          const result = await loadImageCandidate(candidate, priority);
          record.image = result.image;
          record.resolvedUrl = result.resolvedUrl;
          record.error = null;
          return true;
        } catch (error) {
          lastError = error;
        }
      }

      record.error = lastError || new Error(`No image candidate succeeded for ${entry.id}`);
      return false;
    }

    function pumpQueue() {
      if (state.destroyed) return;
      if (!state.queue.length) return;

      while (state.activeLoads < state.maxConcurrent && state.queue.length) {
        const job = state.queue.shift();
        if (!job || !job.entry) continue;
        const entry = job.entry;
        const record = ensureRecord(entry);
        record.queued = false;
        if (record.status === 'ready' || record.status === 'loading') continue;

        record.status = 'loading';
        state.activeLoads += 1;
        loadEntryImage(entry)
          .then((ok) => {
            record.status = ok ? 'ready' : 'error';
          })
          .catch((error) => {
            record.status = 'error';
            record.error = error;
          })
          .finally(() => {
            state.activeLoads = Math.max(0, state.activeLoads - 1);
            pumpQueue();
          });
      }
    }

    function enqueuePreload(entry, priority, deltaSec) {
      const record = ensureRecord(entry);
      if (record.status === 'ready' || record.status === 'loading' || record.queued) return;
      record.queued = true;
      state.queue.push({ entry, priority, deltaSec });
      state.queue.sort((left, right) => {
        if (left.priority !== right.priority) return left.priority - right.priority;
        return left.deltaSec - right.deltaSec;
      });
    }

    function schedulePreloads(currentTimeSec, force = false) {
      if (state.destroyed) return;
      const now = Date.now();
      if (!force && (now - state.lastPreloadAt) < PRELOAD_THROTTLE_MS) return;
      state.lastPreloadAt = now;

      const pending = [];
      for (const entry of state.timelineEntries) {
        if (entry.end < (currentTimeSec - 0.75)) continue;
        const record = ensureRecord(entry);
        if (record.status === 'ready' || record.status === 'loading' || record.queued) continue;

        const leadSec = estimateLeadSeconds(entry.estimatedSizeBytes, state.downlinkMbps);
        const delta = entry.start - currentTimeSec;
        if (!force && delta > leadSec * 4) continue;
        let priority = 2;
        if (delta <= leadSec) priority = 0;
        else if (delta <= leadSec * 2.5) priority = 1;
        pending.push({ entry, priority, delta });
      }

      pending.sort((left, right) => {
        if (left.priority !== right.priority) return left.priority - right.priority;
        return left.delta - right.delta;
      });

      const maxNewJobs = force ? 4 : 2;
      for (let i = 0; i < Math.min(maxNewJobs, pending.length); i += 1) {
        enqueuePreload(pending[i].entry, pending[i].priority, pending[i].delta);
      }
      pumpQueue();
    }

    function renderAtTime(currentTimeSec) {
      if (state.destroyed) return;
      const rootEl = state.overlayRoot || ensureOverlayRoot(documentObject);
      state.overlayRoot = rootEl;
      if (!rootEl) return;

      const activeWeights = resolveActiveWeights(state.timelineEntries, currentTimeSec);
      const visibleCueIds = new Set();

      for (const payload of activeWeights) {
        const entry = payload.entry;
        const record = ensureRecord(entry);
        if (record.status !== 'ready' || !record.resolvedUrl) {
          enqueuePreload(entry, 0, entry.start - currentTimeSec);
          continue;
        }
        const layer = ensureLayer(entry, record);
        if (!layer || !layer.layer || !layer.layer.style) continue;

        layer.layer.style.display = 'block';
        layer.layer.style.opacity = payload.weight.toFixed(4);
        visibleCueIds.add(entry.id);
      }

      for (const [cueId, payload] of state.layerByCueId.entries()) {
        if (visibleCueIds.has(cueId)) continue;
        if (!payload || !payload.layer || !payload.layer.style) continue;
        payload.layer.style.opacity = '0';
        payload.layer.style.display = 'none';
      }

      rootEl.style.display = visibleCueIds.size ? 'block' : 'none';
      pumpQueue();
    }

    function setTimelineContext(context = {}) {
      if (state.destroyed) return [];
      const nextContext = {
        sceneKey: context.sceneKey || options.sceneKey || '',
        contentRef: context.contentRef || options.contentRef || '',
        tracks: Array.isArray(context.tracks) ? context.tracks : [],
        durationSec: Number.isFinite(context.durationSec) ? context.durationSec : getDurationSec()
      };
      state.timelineEntries = buildTimelineEntries(state.cues, nextContext);
      hideAllLayers();
      schedulePreloads(state.lastTimeSec || 0, true);
      return state.timelineEntries.slice();
    }

    function onTimeUpdate(timeSec) {
      if (state.destroyed) return;
      const currentTimeSec = Math.max(0, toFiniteNumber(timeSec, 0));
      state.lastTimeSec = currentTimeSec;
      schedulePreloads(currentTimeSec, false);
      renderAtTime(currentTimeSec);
    }

    function onSeek(timeSec) {
      if (state.destroyed) return;
      for (const record of state.imageRecords.values()) {
        record.queued = false;
      }
      state.queue.length = 0;
      const currentTimeSec = Math.max(0, toFiniteNumber(timeSec, 0));
      state.lastTimeSec = currentTimeSec;
      schedulePreloads(currentTimeSec, true);
      renderAtTime(currentTimeSec);
    }

    function setCueDefinitions(cues) {
      if (state.destroyed) return;
      state.cues = normalizeCueDefinitions(cues);
      state.timelineEntries = [];
      hideAllLayers();
    }

    function clear() {
      if (state.destroyed) return;
      state.timelineEntries = [];
      hideAllLayers();
    }

    function destroy() {
      if (state.destroyed) return;
      state.destroyed = true;
      state.queue.length = 0;
      if (typeof state.overlayPassthroughCleanup === 'function') {
        try {
          state.overlayPassthroughCleanup();
        } catch (_) {
          // ignore cleanup issues
        }
      }
      state.overlayPassthroughCleanup = null;
      for (const record of state.imageRecords.values()) {
        record.queued = false;
      }
      if (state.overlayRoot && state.overlayRoot.parentNode && typeof state.overlayRoot.parentNode.removeChild === 'function') {
        state.overlayRoot.parentNode.removeChild(state.overlayRoot);
      }
      state.layerByCueId.clear();
      state.imageRecords.clear();
    }

    function getDiagnostics() {
      let readyCount = 0;
      for (const record of state.imageRecords.values()) {
        if (record.status === 'ready') readyCount += 1;
      }
      return {
        disabled: false,
        timelineCount: state.timelineEntries.length,
        queueLength: state.queue.length,
        readyCount,
        loadingCount: state.activeLoads,
        maxConcurrent: state.maxConcurrent
      };
    }

    state.overlayRoot = ensureOverlayRoot(documentObject);
    state.overlayPassthroughCleanup = installOverlayPassthroughGuard(documentObject, windowObject, state.overlayRoot);

    return Object.freeze({
      setCueDefinitions,
      setTimelineContext,
      onTimeUpdate,
      onSeek,
      clear,
      destroy,
      getDiagnostics
    });
  }

  function getDefaultCueDefinitions() {
    return normalizeCueDefinitions(DEFAULT_TEST_CUES);
  }

  return Object.freeze({
    initController,
    getDefaultCueDefinitions,
    __test: Object.freeze({
      normalizeText,
      resolveImageUrlCandidates,
      buildTimelineEntries,
      resolveEnvelopeAtTime,
      resolveActiveWeights,
      estimateLeadSeconds,
      setOverlayElementNonInteractive,
      handleBlockedOverlayEvent
    })
  });
});
