function toArray(value) {
  return Array.isArray(value) ? value : Array.from(value || []);
}

export function createChapterMenuController(options = {}) {
  const documentRef = options.document || globalThis.document || null;
  const chapterListSelector = options.chapterListSelector || '#chapterList .menu-item';
  const buttonConfigs = Array.isArray(options.buttons) ? options.buttons : [];
  const getActiveButtonId = typeof options.getActiveButtonId === 'function'
    ? options.getActiveButtonId
    : () => options.activeButtonId || '';

  function markActiveButton() {
    if (!documentRef) return null;
    const activeButtonId = getActiveButtonId();
    toArray(documentRef.querySelectorAll?.(chapterListSelector)).forEach((button) => {
      button.classList?.remove?.('active');
    });
    const activeButton = activeButtonId ? documentRef.getElementById?.(activeButtonId) || null : null;
    activeButton?.classList?.add?.('active');
    return activeButton;
  }

  function bindButton(config) {
    if (!documentRef || !config || !config.id) return null;
    const existing = documentRef.getElementById?.(config.id) || null;
    if (!existing) return null;

    let element = existing;
    if (config.rebind !== false && existing.parentNode && typeof existing.cloneNode === 'function') {
      const replacement = existing.cloneNode(true);
      existing.parentNode.replaceChild(replacement, existing);
      element = replacement;
    }

    if (typeof config.onInit === 'function') {
      config.onInit(element);
    }

    if (typeof config.onClick === 'function') {
      element.addEventListener?.('click', async (event) => {
        await config.onClick({ element, event });
      });
    }

    return element;
  }

  function render() {
    const boundButtons = buttonConfigs.map((config) => bindButton(config));
    markActiveButton();
    return boundButtons;
  }

  return {
    render,
    markActiveButton
  };
}

export default createChapterMenuController;
