import { GameState } from '../state/game-state.js';
import { PlayerStateManager } from '../state/player-state-manager.js';
import { getSCUrl, SC_URLS, MP3_TO_SC_MAP } from '../audio/soundcloud-urls.js';
import defaultChapterAutoplayIntent from '../core/chapter-autoplay-intent.js';
import loadingTutorialCatalog, { LOADING_TUTORIAL_CARDS, getLoadingTutorialCards } from '../ui/loading-tutorial-catalog.js';

export function installLegacyGlobals(options = {}) {
  if (typeof window === 'undefined') return null;
  const force = options.force === true;

  if (force || !window.GameState) window.GameState = GameState;
  if (force || !window.PlayerStateManager) window.PlayerStateManager = PlayerStateManager;
  if (force || !window.getSCUrl) window.getSCUrl = getSCUrl;
  if (force || !window.SC_URLS) window.SC_URLS = SC_URLS;
  if (force || !window.MP3_TO_SC_MAP) window.MP3_TO_SC_MAP = MP3_TO_SC_MAP;
  if (force || !window.ChapterAutoplayIntent) window.ChapterAutoplayIntent = defaultChapterAutoplayIntent;
  if (force || !window.LoadingTutorialCatalog) window.LoadingTutorialCatalog = loadingTutorialCatalog;
  if (force || !window.__GAMEBOY_LOADING_TUTORIAL_CARDS__) window.__GAMEBOY_LOADING_TUTORIAL_CARDS__ = LOADING_TUTORIAL_CARDS;
  if (force || !window.__GAMEBOY_GET_LOADING_TUTORIAL_CARDS__) window.__GAMEBOY_GET_LOADING_TUTORIAL_CARDS__ = getLoadingTutorialCards;

  return window;
}

export default installLegacyGlobals;
