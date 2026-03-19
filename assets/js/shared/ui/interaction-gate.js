export function createInteractionGate(options = {}) {
  const documentRef = options.document || globalThis.document || null;
  if (!documentRef) {
    return {
      setAllowed() {},
      clear() {},
      destroy() {},
      isAllowedEventTarget() {
        return true;
      }
    };
  }

  const interactiveSelector = options.interactiveSelector
    || 'button, input, select, textarea, a[href], [role="button"], [tabindex], canvas';
  const listeners = [];
  const state = {
    allowedMatchers: [],
    allowedKeys: new Set(),
    allowCanvas: false,
    allowAll: false
  };

  function toMatcher(target) {
    if (!target) return null;
    if (typeof target === 'string') {
      const selector = target;
      return (node) => !!(node && typeof node.matches === 'function' && node.matches(selector));
    }
    if (typeof target === 'function') {
      return target;
    }
    if (target instanceof Element) {
      return (node) => node === target || !!node?.closest?.('*') && (node === target || target.contains(node));
    }
    return null;
  }

  function refreshDisabledState() {
    const interactives = Array.from(documentRef.querySelectorAll(interactiveSelector));
    interactives.forEach((element) => {
      const allowed = state.allowAll || isAllowedElement(element);
      element.toggleAttribute('data-intro-disabled', !allowed);
      if (!allowed) {
        element.setAttribute('aria-disabled', 'true');
      } else {
        element.removeAttribute('aria-disabled');
      }
    });
  }

  function isAllowedElement(node) {
    if (!node) return false;
    if (state.allowCanvas && node.tagName === 'CANVAS') return true;
    return state.allowedMatchers.some((matcher) => {
      try {
        return matcher(node);
      } catch (_) {
        return false;
      }
    });
  }

  function isAllowedEventTarget(target, event = null) {
    if (state.allowAll) return true;
    if (event && typeof event.composedPath === 'function') {
      const path = event.composedPath();
      if (Array.isArray(path)) {
        for (const node of path) {
          if (node instanceof Element && isAllowedElement(node)) return true;
        }
      }
    }
    if (!target) return false;
    if (target instanceof Element && isAllowedElement(target)) return true;
    let current = target;
    while (current && current !== documentRef) {
      if (current instanceof Element && isAllowedElement(current)) return true;
      current = current.parentNode || current.host || null;
    }
    return false;
  }

  function handlePointerLikeEvent(event) {
    if (state.allowAll) return;
    if (isAllowedEventTarget(event.target, event)) return;
    event.preventDefault?.();
    event.stopImmediatePropagation?.();
  }

  function handleKeyboardEvent(event) {
    if (state.allowAll) return;
    if (state.allowedKeys.has(event.key)) return;
    event.preventDefault?.();
    event.stopImmediatePropagation?.();
  }

  function bind(target, type, handler) {
    target.addEventListener(type, handler, true);
    listeners.push(() => target.removeEventListener(type, handler, true));
  }

  bind(documentRef, 'click', handlePointerLikeEvent);
  bind(documentRef, 'pointerdown', handlePointerLikeEvent);
  bind(documentRef, 'pointerup', handlePointerLikeEvent);
  bind(documentRef, 'mousedown', handlePointerLikeEvent);
  bind(documentRef, 'mouseup', handlePointerLikeEvent);
  bind(documentRef, 'touchstart', handlePointerLikeEvent);
  bind(documentRef, 'touchend', handlePointerLikeEvent);
  bind(documentRef, 'change', handlePointerLikeEvent);
  bind(documentRef, 'keydown', handleKeyboardEvent);
  bind(documentRef, 'keyup', handleKeyboardEvent);

  function setAllowed(config = {}) {
    const targets = Array.isArray(config.targets) ? config.targets : [];
    state.allowedMatchers = targets.map(toMatcher).filter(Boolean);
    state.allowedKeys = new Set(Array.isArray(config.keys) ? config.keys.filter(Boolean) : []);
    state.allowCanvas = config.allowCanvas === true;
    state.allowAll = config.allowAll === true;
    refreshDisabledState();
  }

  function clear() {
    state.allowedMatchers = [];
    state.allowedKeys = new Set();
    state.allowCanvas = false;
    state.allowAll = false;
    refreshDisabledState();
  }

  function destroy() {
    while (listeners.length > 0) {
      const dispose = listeners.pop();
      dispose();
    }
  }

  clear();

  return {
    setAllowed,
    clear,
    destroy,
    isAllowedEventTarget
  };
}

export default createInteractionGate;
