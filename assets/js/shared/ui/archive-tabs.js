function toArray(value) {
  return Array.isArray(value) ? value : Array.from(value || []);
}

export function createArchiveTabsController(options = {}) {
  const documentRef = options.document || globalThis.document || null;
  const onRenderBookmarks = typeof options.renderBookmarks === 'function' ? options.renderBookmarks : () => {};
  const onSyncReaderSettingsUi = typeof options.syncReaderSettingsUi === 'function' ? options.syncReaderSettingsUi : () => {};
  const onTriggerUiHaptic = typeof options.triggerUiHaptic === 'function' ? options.triggerUiHaptic : () => {};

  let tabs = [];
  let panels = [];
  let tabsBar = null;
  let archiveFooter = null;
  let primaryInhaltBtn = null;
  let primarySettingsBtn = null;
  let settingsPanel = null;
  let lastContentTab = options.initialContentTab || 'kapitel';
  let initialized = false;

  function hydrate() {
    tabs = toArray(documentRef?.querySelectorAll?.('.archive-tab'));
    panels = toArray(documentRef?.querySelectorAll?.('.archive-tab-content'));
    tabsBar = documentRef?.querySelector?.('.archive-tabs') || null;
    archiveFooter = documentRef?.querySelector?.('#archiveModal .archive-footer') || null;
    primaryInhaltBtn = documentRef?.getElementById?.('archivePrimaryInhaltBtn') || null;
    primarySettingsBtn = documentRef?.getElementById?.('archivePrimarySettingsBtn') || null;
    settingsPanel = documentRef?.querySelector?.('.archive-tab-content[data-tab="einstellungen"]') || null;
  }

  function setPrimaryMode(mode) {
    const normalized = mode === 'einstellungen' ? 'einstellungen' : 'inhalt';

    primaryInhaltBtn?.classList?.toggle?.('active', normalized === 'inhalt');
    primarySettingsBtn?.classList?.toggle?.('active', normalized === 'einstellungen');
    if (tabsBar?.style) tabsBar.style.display = normalized === 'inhalt' ? '' : 'none';
    if (archiveFooter?.style) archiveFooter.style.display = normalized === 'inhalt' ? '' : 'none';
    return normalized;
  }

  function showContentTab(target, activeTab = null) {
    if (!tabs.length && documentRef) hydrate();

    tabs.forEach((tab) => tab.classList?.remove?.('active'));
    panels.forEach((panel) => panel.classList?.remove?.('active'));

    const matchedTab = activeTab || tabs.find((tab) => tab.getAttribute?.('data-tab') === target) || null;
    if (matchedTab) {
      matchedTab.classList?.add?.('active');
      lastContentTab = matchedTab.getAttribute?.('data-tab') || lastContentTab;
    }

    const panel = documentRef?.querySelector?.(`.archive-tab-content[data-tab="${lastContentTab}"]`) || null;
    panel?.classList?.add?.('active');
    if (lastContentTab === 'lesezeichen') onRenderBookmarks();
    return lastContentTab;
  }

  function showSettingsPanel() {
    if (!tabs.length && documentRef) hydrate();

    tabs.forEach((tab) => tab.classList?.remove?.('active'));
    panels.forEach((panel) => panel.classList?.remove?.('active'));
    settingsPanel?.classList?.add?.('active');
    onSyncReaderSettingsUi();
    return 'einstellungen';
  }

  function attachTabListener(tab) {
    tab.addEventListener?.('click', () => {
      onTriggerUiHaptic(7);
      tab.classList?.remove?.('pressed');
      void tab.offsetWidth;
      tab.classList?.add?.('pressed');
      setTimeout(() => tab.classList?.remove?.('pressed'), 170);
      const target = tab.getAttribute?.('data-tab');
      setPrimaryMode('inhalt');
      showContentTab(target, tab);
    });
  }

  function init() {
    if (initialized || !documentRef) return controller;
    hydrate();
    initialized = true;

    tabs.forEach(attachTabListener);

    primaryInhaltBtn?.addEventListener?.('click', () => {
      onTriggerUiHaptic(7);
      setPrimaryMode('inhalt');
      showContentTab(lastContentTab);
    });

    primarySettingsBtn?.addEventListener?.('click', () => {
      onTriggerUiHaptic(7);
      setPrimaryMode('einstellungen');
      showSettingsPanel();
    });

    const initiallyActiveTab = tabs.find((tab) => tab.classList?.contains?.('active')) || null;
    if (initiallyActiveTab) {
      lastContentTab = initiallyActiveTab.getAttribute?.('data-tab') || lastContentTab;
    }

    setPrimaryMode('inhalt');
    showContentTab(lastContentTab, initiallyActiveTab || undefined);
    return controller;
  }

  const controller = {
    init,
    setPrimaryMode,
    showContentTab,
    showSettingsPanel,
    getLastContentTab() {
      return lastContentTab;
    }
  };

  return controller;
}

export default createArchiveTabsController;
