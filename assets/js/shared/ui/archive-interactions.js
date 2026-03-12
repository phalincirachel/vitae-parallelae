function createStorageAdapter(storage) {
  if (storage && typeof storage.getItem === 'function' && typeof storage.setItem === 'function') {
    return storage;
  }

  const memory = new Map();
  return {
    getItem(key) {
      return memory.has(key) ? memory.get(key) : null;
    },
    setItem(key, value) {
      memory.set(key, String(value));
    }
  };
}

export function createArchiveInteractionsController(options = {}) {
  const documentRef = options.document || globalThis.document || null;
  const storage = createStorageAdapter(options.storage || globalThis.localStorage);
  const primarySeenStorageKey = options.primarySeenStorageKey || 'gameboy_archive_primary_seen_v1';
  const archiveModalId = options.archiveModalId || 'archiveModal';
  const primaryInhaltButtonId = options.primaryInhaltButtonId || 'archivePrimaryInhaltBtn';
  const loreProgressHudId = options.loreProgressHudId || 'loreProgressHud';
  const bookButtonId = options.bookButtonId || 'bookBtn';
  const closeButtonId = options.closeButtonId || 'closeArchiveBtn';
  const loreTabSelector = options.loreTabSelector || '.archive-tab[data-tab="lore"]';
  const renderArchive = typeof options.renderArchive === 'function' ? options.renderArchive : () => {};
  const setVisible = typeof options.setVisible === 'function'
    ? options.setVisible
    : (visible) => {
        const archiveModal = documentRef?.getElementById?.(archiveModalId) || null;
        archiveModal?.classList?.toggle?.('visible', !!visible);
      };
  const onAfterLoreHudOpen = typeof options.onAfterLoreHudOpen === 'function' ? options.onAfterLoreHudOpen : () => {};
  let initialized = false;

  function ensurePrimaryViewSeen() {
    const hasSeenPrimaryArchiveView = storage.getItem(primarySeenStorageKey) === '1';
    if (hasSeenPrimaryArchiveView) return;

    const inhaltButton = documentRef?.getElementById?.(primaryInhaltButtonId) || null;
    if (inhaltButton) inhaltButton.click?.();
    storage.setItem(primarySeenStorageKey, '1');
  }

  function openArchive(reason = 'book-btn') {
    renderArchive();
    ensurePrimaryViewSeen();
    setVisible(true, reason);
  }

  function closeArchive(reason = 'close-btn') {
    setVisible(false, reason);
  }

  function openArchiveLoreTabFromHud() {
    renderArchive();
    setVisible(true, 'lore-hud');

    const inhaltButton = documentRef?.getElementById?.(primaryInhaltButtonId) || null;
    if (inhaltButton && !inhaltButton.classList?.contains?.('active')) {
      inhaltButton.click?.();
    }

    const loreTab = documentRef?.querySelector?.(loreTabSelector) || null;
    loreTab?.click?.();
    onAfterLoreHudOpen();
  }

  function bind() {
    if (initialized || !documentRef) return controller;
    initialized = true;

    const bookButton = documentRef.getElementById?.(bookButtonId) || null;
    const closeButton = documentRef.getElementById?.(closeButtonId) || null;
    const loreProgressHud = documentRef.getElementById?.(loreProgressHudId) || null;

    bookButton?.addEventListener?.('click', () => openArchive('book-btn'));
    closeButton?.addEventListener?.('click', () => closeArchive('close-btn'));
    loreProgressHud?.addEventListener?.('click', () => openArchiveLoreTabFromHud());
    return controller;
  }

  const controller = {
    bind,
    openArchive,
    closeArchive,
    openArchiveLoreTabFromHud
  };

  return controller;
}

export default createArchiveInteractionsController;
