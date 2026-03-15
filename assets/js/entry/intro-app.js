import gameState from '../shared/state/game-state.js';
import { INTRO_ROUTE, INTRO_VERSION } from '../shared/data/intro-config.js';
import { createArchiveTabsController } from '../shared/ui/archive-tabs.js';
import { createArchiveContentController } from '../shared/ui/archive-content.js';
import { createInteractiveFocusOverlay } from '../shared/ui/interactive-focus-overlay.js';
import { createInteractionGate } from '../shared/ui/interaction-gate.js';
import { createIntroController } from '../intro/intro-controller.js';
import { INTRO_DEMO_LORE_ENTRY, INTRO_DEMO_LORE_ID, INTRO_TRACKS } from '../intro/intro-script.js';
import { createIntroNarrationAdapter } from '../intro/intro-narration-adapter.js';
import { createIntroScene } from '../intro/intro-scene.js';
import { createIntroState } from '../intro/intro-state.js';
import { createIntroTextRenderer } from '../intro/intro-text-renderer.js';

function normalizeIntroLayout(value, readerApi) {
  const normalized = readerApi.normalizeSentenceLayout(value, {
    defaultValue: 'blaettern',
    flatValue: 'flat',
    blaetternValue: 'blaettern'
  });
  return normalized === 'timestamps' ? 'flat' : normalized;
}

function getDomRefs(documentRef) {
  return {
    audioPlayerUI: documentRef.getElementById('audioPlayerUI'),
    archiveModal: documentRef.getElementById('archiveModal'),
    audioToggleBtn: documentRef.getElementById('audioToggleBtn'),
    backToChapterBtn: documentRef.getElementById('backToChapterBtn'),
    bookBtn: documentRef.getElementById('bookBtn'),
    closeArchiveBtn: documentRef.getElementById('closeArchiveBtn'),
    gameCanvas: documentRef.getElementById('gameCanvas'),
    iconPause: documentRef.getElementById('iconPause'),
    iconPlay: documentRef.getElementById('iconPlay'),
    loreProgressHud: documentRef.getElementById('loreProgressHud'),
    loreProgressText: documentRef.getElementById('loreProgressText'),
    nextChapterBtn: documentRef.getElementById('nextChapterBtn'),
    readingModeBtn: documentRef.getElementById('readingModeBtn'),
    sceneDimmerOverlay: documentRef.getElementById('sceneDimmerOverlay'),
    sceneDimmerToggleBtn: documentRef.getElementById('sceneDimmerToggleBtn'),
    skipBackBtn: documentRef.getElementById('skipBackBtn'),
    skipForwardBtn: documentRef.getElementById('skipForwardBtn'),
    startScreen: documentRef.getElementById('introStartScreen'),
    startSkipBtn: documentRef.getElementById('startSkipBtn'),
    subtitleContainer: documentRef.getElementById('subtitleContainer')
  };
}

async function initIntroApp() {
  await gameState.init();
  const documentRef = globalThis.document;
  const windowRef = globalThis.window || globalThis;
  const refs = getDomRefs(documentRef);
  const readerApi = windowRef.GameboyReaderSettings;
  if (!readerApi) {
    throw new Error('Reader settings controller not available.');
  }

  const state = createIntroState({
    sentenceLayout: normalizeIntroLayout(windowRef.localStorage?.getItem?.('gameboy_reader_sentence_layout'), readerApi)
  });

  const textRenderer = createIntroTextRenderer({
    document: documentRef,
    container: refs.subtitleContainer,
    getLayout: () => state.sentenceLayout
  });

  const readerState = {
    sentenceLayout: state.sentenceLayout,
    textAlign: readerApi.normalizeTextAlign(windowRef.localStorage?.getItem?.('gameboy_reader_text_align'), { defaultValue: 'justify' }),
    fontSizePx: readerApi.normalizeFontSize(windowRef.localStorage?.getItem?.('gameboy_reader_font_size_px'), { defaultValue: 18 }),
    fontFamilyKey: readerApi.normalizeFontFamilyKey(windowRef.localStorage?.getItem?.('gameboy_reader_font_family'), { defaultValue: 'grotesk' }),
    textVolume: readerApi.normalizeVolume(windowRef.localStorage?.getItem?.('gameboy_reader_text_volume'), { defaultValue: 1 }),
    backgroundVolume: readerApi.normalizeVolume(windowRef.localStorage?.getItem?.('gameboy_reader_background_volume'), { defaultValue: 1 }),
    bgColor: readerApi.normalizeHexColor(windowRef.localStorage?.getItem?.('gameboy_reader_bg_color'), null),
    textColor: readerApi.normalizeHexColor(windowRef.localStorage?.getItem?.('gameboy_reader_text_color'), null)
  };

  const readerSettingsController = readerApi.createController({
    document: documentRef,
    storage: windowRef.localStorage,
    getSubtitleContainer: () => refs.subtitleContainer,
    getState: () => ({ ...readerState }),
    setState: (patch) => {
      Object.assign(readerState, patch);
      if (Object.prototype.hasOwnProperty.call(patch, 'sentenceLayout')) {
        state.sentenceLayout = patch.sentenceLayout;
      }
    },
    getReaderFontFamilyStack: (fontKey) => readerApi.getFontFamilyStack(fontKey),
    getReaderFallbackBgColor: () => readerApi.getFallbackBgColor({ document: documentRef }),
    getReaderFallbackTextColor: () => readerApi.getFallbackTextColor({ document: documentRef }),
    applyReaderColorSettings: () => {},
    markBlaetternPaginationDirty: () => {},
    syncBlaetternUiState: () => {},
    hideBlaetternBookmarkButton: () => {},
    rerenderSubtitles: () => textRenderer.render(),
    normalizeReaderSentenceLayout: (value) => normalizeIntroLayout(value, readerApi),
    normalizeReaderFontSize: (value) => readerApi.normalizeFontSize(value, { defaultValue: 18 }),
    normalizeReaderFontFamilyKey: (value) => readerApi.normalizeFontFamilyKey(value, { defaultValue: 'grotesk' }),
    normalizeReaderTextAlign: (value) => readerApi.normalizeTextAlign(value, { defaultValue: 'justify' }),
    normalizeReaderVolume: (value) => readerApi.normalizeVolume(value, { defaultValue: 1 }),
    normalizeReaderHexColor: (value, fallback) => readerApi.normalizeHexColor(value, fallback),
    readerColorWheelSync: {},
    flatLayoutValue: 'flat',
    blaetternLayoutValue: 'blaettern'
  });
  readerSettingsController.bindBasicControls();
  readerSettingsController.syncUi();
  readerSettingsController.applyTextSettings({ rerender: true });

  const demoGameState = {
    demoLoreId: INTRO_DEMO_LORE_ID,
    state: { collectedLore: [] },
    getAllLore() {
      return {
        [INTRO_DEMO_LORE_ID]: INTRO_DEMO_LORE_ENTRY
      };
    },
    getBookmarks() {
      return [];
    },
    formatBookmarkTime(value) {
      return String(value || 0);
    }
  };

  const archiveTabsController = createArchiveTabsController({
    document: documentRef,
    syncReaderSettingsUi: () => readerSettingsController.syncUi(),
    initialContentTab: 'kapitel'
  });
  archiveTabsController.init();

  const archiveContentController = createArchiveContentController({
    document: documentRef,
    getGameState: () => demoGameState,
    getCurrentPage: () => 'intro.html',
    onLoreSelected: async () => {},
    isLoreActive: (id) => demoGameState.state.collectedLore.includes(id),
    closeArchive: () => {
      refs.archiveModal.classList.remove('visible');
    }
  });
  archiveContentController.renderLoreList();

  const narration = createIntroNarrationAdapter();
  const focusOverlay = createInteractiveFocusOverlay({ document: documentRef });
  const interactionGate = createInteractionGate({ document: documentRef });

  let controller = null;
  const scene = await createIntroScene({
    document: documentRef,
    window: windowRef,
    canvas: refs.gameCanvas,
    sceneAssetPath: 'assets/intro/einfuehrungsplatz.png',
    getIsReadingMode: () => state.isReadingMode,
    getCanCollectOrb: () => state.waitingAction === 'collect-orb',
    onOrbCollected: (light) => {
      controller?.resolveAction?.('collect-orb', light);
    }
  });
  const sceneReadyPromise = scene.preload();

  controller = createIntroController({
    window: windowRef,
    document: documentRef,
    state,
    refs,
    narration,
    textRenderer,
    interactionGate,
    focusOverlay,
    readerSettingsController,
    archiveTabsController,
    archiveContentController,
    demoGameState,
    scene,
    sceneReadyPromise,
    gameState,
    introVersion: INTRO_VERSION,
    gameFile: INTRO_ROUTE.gameFile,
    tracks: INTRO_TRACKS
  });

  await controller.start();
}

void initIntroApp();
