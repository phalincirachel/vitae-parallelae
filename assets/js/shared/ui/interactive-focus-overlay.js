export function createInteractiveFocusOverlay(options = {}) {
  const documentRef = options.document || globalThis.document || null;
  if (!documentRef || !documentRef.body) {
    return {
      highlightRect() {},
      highlightElements() {},
      highlightSelectors() {},
      clear() {},
      destroy() {}
    };
  }

  const root = documentRef.createElement('div');
  root.className = 'intro-focus-overlay';
  root.setAttribute('aria-hidden', 'true');

  const masks = ['top', 'right', 'bottom', 'left'].map((key) => {
    const mask = documentRef.createElement('div');
    mask.className = `intro-focus-mask intro-focus-mask--${key}`;
    root.appendChild(mask);
    return mask;
  });

  const ring = documentRef.createElement('div');
  ring.className = 'intro-focus-ring';
  root.appendChild(ring);
  documentRef.body.appendChild(root);

  function hide() {
    root.dataset.active = 'false';
    ring.style.opacity = '0';
    masks.forEach((mask) => {
      mask.style.opacity = '0';
    });
  }

  function normalizeRect(rect) {
    if (!rect) return null;
    const width = Number(rect.width || 0);
    const height = Number(rect.height || 0);
    if (width <= 0 || height <= 0) return null;
    const left = Number(rect.left || 0);
    const top = Number(rect.top || 0);
    return {
      left,
      top,
      width,
      height,
      right: left + width,
      bottom: top + height
    };
  }

  function unionRects(rects) {
    const normalized = rects.map(normalizeRect).filter(Boolean);
    if (!normalized.length) return null;
    const left = Math.min(...normalized.map((rect) => rect.left));
    const top = Math.min(...normalized.map((rect) => rect.top));
    const right = Math.max(...normalized.map((rect) => rect.right));
    const bottom = Math.max(...normalized.map((rect) => rect.bottom));
    return {
      left,
      top,
      right,
      bottom,
      width: right - left,
      height: bottom - top
    };
  }

  function applyRect(rect) {
    const normalized = normalizeRect(rect);
    if (!normalized) {
      hide();
      return null;
    }

    const paddingX = Number.isFinite(Number(rect?.paddingX))
      ? Number(rect.paddingX)
      : (Number.isFinite(Number(rect?.padding)) ? Number(rect.padding) : 18);
    const paddingY = Number.isFinite(Number(rect?.paddingY))
      ? Number(rect.paddingY)
      : (Number.isFinite(Number(rect?.padding)) ? Number(rect.padding) : 18);
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const inset = Number.isFinite(Number(rect?.inset)) ? Number(rect.inset) : 8;
    let left = normalized.left - paddingX;
    let top = normalized.top - paddingY;
    let right = normalized.right + paddingX;
    let bottom = normalized.bottom + paddingY;

    if (left < inset) {
      right = Math.min(viewportWidth - inset, right + (inset - left));
      left = inset;
    }
    if (right > (viewportWidth - inset)) {
      left = Math.max(inset, left - (right - (viewportWidth - inset)));
      right = viewportWidth - inset;
    }
    if (top < inset) {
      bottom = Math.min(viewportHeight - inset, bottom + (inset - top));
      top = inset;
    }
    if (bottom > (viewportHeight - inset)) {
      top = Math.max(inset, top - (bottom - (viewportHeight - inset)));
      bottom = viewportHeight - inset;
    }

    const frame = { left, top, right, bottom };
    frame.width = Math.max(16, frame.right - frame.left);
    frame.height = Math.max(16, frame.bottom - frame.top);

    root.dataset.active = 'true';
    masks[0].style.cssText = `left:0;top:0;width:${viewportWidth}px;height:${frame.top}px;opacity:1;`;
    masks[1].style.cssText = `left:${frame.right}px;top:${frame.top}px;width:${Math.max(0, viewportWidth - frame.right)}px;height:${frame.height}px;opacity:1;`;
    masks[2].style.cssText = `left:0;top:${frame.bottom}px;width:${viewportWidth}px;height:${Math.max(0, viewportHeight - frame.bottom)}px;opacity:1;`;
    masks[3].style.cssText = `left:0;top:${frame.top}px;width:${frame.left}px;height:${frame.height}px;opacity:1;`;
    ring.style.cssText = `left:${frame.left}px;top:${frame.top}px;width:${frame.width}px;height:${frame.height}px;opacity:1;`;
    return frame;
  }

  function highlightRect(rect) {
    if (!rect) {
      hide();
      return null;
    }
    return applyRect(rect);
  }

  function highlightElements(elements = []) {
    const rects = Array.from(elements)
      .filter(Boolean)
      .map((element) => element.getBoundingClientRect?.())
      .filter(Boolean);
    return applyRect(unionRects(rects));
  }

  function highlightSelectors(selectors = []) {
    const elements = [];
    for (const selector of selectors) {
      if (!selector) continue;
      elements.push(...documentRef.querySelectorAll(selector));
    }
    return highlightElements(elements);
  }

  function clear() {
    hide();
  }

  function destroy() {
    root.remove();
  }

  hide();

  return {
    highlightRect,
    highlightElements,
    highlightSelectors,
    clear,
    destroy
  };
}

export default createInteractiveFocusOverlay;
