import {
  CHAPTER_DB,
  CONTENT_DB,
  DEFAULT_CHAPTER_LORE_TARGET,
  SCENE_ALIASES,
  getChapterLoreIds,
  normalizeSceneName
} from '../data/content-manifest.js';
import { getBookmarkScope } from '../core/bookmark-scope.js';

const WEB_SAVE_KEY = 'liminal_save';
const SESSION_KEY = 'GAME_SESSION_ACTIVE';
const READER_KEYS = Object.freeze({
  layout: 'gameboy_reader_sentence_layout',
  fontSize: 'gameboy_reader_font_size_px',
  bgColor: 'gameboy_reader_bg_color',
  textColor: 'gameboy_reader_text_color',
  textVolume: 'gameboy_reader_text_volume',
  bgVolume: 'gameboy_reader_background_volume'
});

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
    },
    removeItem(key) {
      memory.delete(key);
    }
  };
}

function createDefaultState() {
  return {
    collectedLore: [],
    collectedLights: {},
    chapterCollectibleTargets: {},
    bookmarks: []
  };
}

function normalizeNumberArray(list) {
  if (!Array.isArray(list)) return [];
  const unique = new Set();
  for (const entry of list) {
    const number = Number(entry);
    if (Number.isFinite(number)) unique.add(Math.trunc(number));
  }
  return Array.from(unique);
}

function safeJsonParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

export function createGameState(options = {}) {
  const logger = options.logger || console;
  const localStorageRef = createStorageAdapter(options.localStorage || globalThis.localStorage);
  const sessionStorageRef = createStorageAdapter(options.sessionStorage || globalThis.sessionStorage);
  const getElectronAPI = typeof options.getElectronAPI === 'function'
    ? options.getElectronAPI
    : () => globalThis.window?.electronAPI || globalThis.electronAPI || null;
  const getPlayerStateManager = typeof options.getPlayerStateManager === 'function'
    ? options.getPlayerStateManager
    : () => globalThis.window?.PlayerStateManager || globalThis.PlayerStateManager || null;

  const stateApi = {
    DEFAULT_CHAPTER_LORE_TARGET,
    CHAPTER_DB,
    SCENE_ALIASES,
    CONTENT_DB,
    state: createDefaultState(),

    _createDefaultState: createDefaultState,

    _normalizeNumberArray: normalizeNumberArray,

    _normalizeSceneName(sceneName) {
      return normalizeSceneName(sceneName);
    },

    _ensureStateShape() {
      if (!this.state || typeof this.state !== 'object') {
        this.state = createDefaultState();
      }

      this.state.collectedLore = normalizeNumberArray(this.state.collectedLore);
      if (!this.state.collectedLights || typeof this.state.collectedLights !== 'object') {
        this.state.collectedLights = {};
      }

      const normalizedLights = {};
      for (const [sceneKey, values] of Object.entries(this.state.collectedLights)) {
        const normalizedKey = normalizeSceneName(sceneKey) || sceneKey;
        const normalizedValues = normalizeNumberArray(values);
        normalizedLights[normalizedKey] = normalizeNumberArray([...(normalizedLights[normalizedKey] || []), ...normalizedValues]);
      }
      this.state.collectedLights = normalizedLights;

      if (!this.state.chapterCollectibleTargets || typeof this.state.chapterCollectibleTargets !== 'object') {
        this.state.chapterCollectibleTargets = {};
      }

      const normalizedTargets = {};
      for (const [sceneKey, value] of Object.entries(this.state.chapterCollectibleTargets)) {
        const normalizedKey = normalizeSceneName(sceneKey) || sceneKey;
        const numericValue = Number(value);
        if (Number.isFinite(numericValue) && numericValue > 0) {
          normalizedTargets[normalizedKey] = Math.trunc(numericValue);
        }
      }
      this.state.chapterCollectibleTargets = normalizedTargets;

      if (!Array.isArray(this.state.bookmarks)) this.state.bookmarks = [];
    },

    async init() {
      const electronAPI = getElectronAPI();
      const playerStateManager = getPlayerStateManager();

      if (!electronAPI) {
        const saved = safeJsonParse(localStorageRef.getItem(WEB_SAVE_KEY), null);
        this.state = saved || createDefaultState();
        if (playerStateManager && this.state.audioPositions) {
          playerStateManager.importStates(this.state.audioPositions);
        }
      } else {
        try {
          if (!sessionStorageRef.getItem(SESSION_KEY)) {
            sessionStorageRef.setItem(SESSION_KEY, 'true');
            this.state = createDefaultState();
            await electronAPI.saveGame(this.state);
          } else {
            this.state = (await electronAPI.loadGame()) || createDefaultState();
          }

          if (playerStateManager && this.state.audioPositions) {
            playerStateManager.importStates(this.state.audioPositions);
          }
        } catch (error) {
          logger.warn?.('[GameState] Load Error:', error);
          this.state = createDefaultState();
        }
      }

      this._ensureStateShape();
    },

    getChapterDefinitions() {
      return this.CHAPTER_DB;
    },

    getChapterConfig(sceneName) {
      const key = normalizeSceneName(sceneName);
      return this.CHAPTER_DB[key] || null;
    },

    getChapterLoreIds(sceneName) {
      return getChapterLoreIds(sceneName);
    },

    getChapterCollectibleTarget(sceneName) {
      const key = normalizeSceneName(sceneName);
      const stateOverride = Number(this.state.chapterCollectibleTargets?.[key]);
      if (Number.isFinite(stateOverride) && stateOverride > 0) return Math.trunc(stateOverride);
      const config = this.CHAPTER_DB[key];
      if (config && Number.isFinite(config.totalCollectibles) && config.totalCollectibles > 0) {
        return Math.trunc(config.totalCollectibles);
      }
      return this.DEFAULT_CHAPTER_LORE_TARGET;
    },

    getChapterCollectedCount(sceneName, countOptions = {}) {
      const key = normalizeSceneName(sceneName);
      const bucket = Array.isArray(this.state.collectedLights?.[key]) ? this.state.collectedLights[key] : [];
      const rawCount = bucket.length;
      return countOptions.raw === true ? rawCount : Math.min(rawCount, this.getChapterCollectibleTarget(key));
    },

    getChapterProgress(sceneName) {
      const key = normalizeSceneName(sceneName);
      const config = this.CHAPTER_DB[key];
      return {
        sceneName: key,
        chapterCode: config ? config.code : '',
        chapterTitle: config ? config.title : key,
        collected: this.getChapterCollectedCount(key),
        total: this.getChapterCollectibleTarget(key)
      };
    },

    getAllChapterProgress() {
      const progress = {};
      for (const sceneName of Object.keys(this.CHAPTER_DB)) {
        progress[sceneName] = this.getChapterProgress(sceneName);
      }
      return progress;
    },

    getLore(id) {
      return this.CONTENT_DB[Math.trunc(Number(id))] || null;
    },

    getAllLore() {
      return this.CONTENT_DB;
    },

    isUnlocked(id) {
      return this.state.collectedLore.includes(Math.trunc(Number(id)));
    },

    isLightCollected(sceneName, lightId) {
      const key = normalizeSceneName(sceneName);
      return Array.isArray(this.state.collectedLights?.[key])
        && this.state.collectedLights[key].includes(Math.trunc(Number(lightId)));
    },

    getNextLockedLoreIdForScene(sceneName) {
      for (const id of getChapterLoreIds(sceneName)) {
        if (!this.state.collectedLore.includes(id)) return id;
      }
      return null;
    },

    getNextLockedLoreId() {
      const ids = Object.keys(this.CONTENT_DB).map((id) => Number(id)).sort((left, right) => left - right);
      return ids.find((id) => !this.state.collectedLore.includes(id)) || null;
    },

    async collectLight(sceneName, lightId) {
      const sceneKey = normalizeSceneName(sceneName);
      const numericLightId = Math.trunc(Number(lightId));
      if (!sceneKey || !Number.isFinite(numericLightId)) return null;

      if (!this.state.collectedLights[sceneKey]) this.state.collectedLights[sceneKey] = [];
      if (this.state.collectedLights[sceneKey].includes(numericLightId)) return null;

      const target = this.getChapterCollectibleTarget(sceneKey);
      this.state.collectedLights[sceneKey].push(numericLightId);
      if (this.state.collectedLights[sceneKey].length > target) {
        await this.save();
        return null;
      }

      const nextId = this.getNextLockedLoreIdForScene(sceneKey);
      if (nextId && !this.state.collectedLore.includes(nextId)) {
        this.state.collectedLore.push(nextId);
        await this.save();
        return nextId;
      }

      await this.save();
      return null;
    },

    async unlockLore(id) {
      const numericId = Math.trunc(Number(id));
      if (!this.isUnlocked(numericId)) {
        this.state.collectedLore.push(numericId);
        await this.save();
        return true;
      }
      return false;
    },

    async reset() {
      this.state = createDefaultState();
      await this.save();
    },

    async save() {
      this._ensureStateShape();
      const electronAPI = getElectronAPI();
      const playerStateManager = getPlayerStateManager();

      if (playerStateManager && typeof playerStateManager.exportStates === 'function') {
        this.state.audioPositions = playerStateManager.exportStates();
      }

      this.state.readerSettings = {
        layout: localStorageRef.getItem(READER_KEYS.layout),
        fontSize: localStorageRef.getItem(READER_KEYS.fontSize),
        bgColor: localStorageRef.getItem(READER_KEYS.bgColor),
        textColor: localStorageRef.getItem(READER_KEYS.textColor),
        textVolume: localStorageRef.getItem(READER_KEYS.textVolume),
        bgVolume: localStorageRef.getItem(READER_KEYS.bgVolume)
      };

      if (electronAPI) {
        await electronAPI.saveGame(this.state);
        return;
      }

      localStorageRef.setItem(WEB_SAVE_KEY, JSON.stringify(this.state));
    },

    exportState() {
      return JSON.stringify(this.state, null, 2);
    },

    async importState(jsonString) {
      try {
        const data = JSON.parse(jsonString);
        if (!Array.isArray(data.collectedLore)) return false;

        this.state = data;
        this._ensureStateShape();
        const playerStateManager = getPlayerStateManager();
        if (playerStateManager && this.state.audioPositions) {
          playerStateManager.importStates(this.state.audioPositions, { replace: true });
        }

        const readerSettings = data.readerSettings || {};
        for (const [key, storageKey] of Object.entries(READER_KEYS)) {
          const value = readerSettings[key];
          if (value !== null && value !== undefined) {
            localStorageRef.setItem(storageKey, value);
          }
        }

        await this.save();
        return true;
      } catch (error) {
        logger.error?.('[GameState] Import Error:', error);
        return false;
      }
    },

    getBookmarks() {
      if (!Array.isArray(this.state.bookmarks)) this.state.bookmarks = [];
      return this.state.bookmarks;
    },

    async addBookmark(bookmark) {
      if (!Array.isArray(this.state.bookmarks)) this.state.bookmarks = [];
      const exists = this.state.bookmarks.some((entry) => entry.page === bookmark.page && getBookmarkScope(entry) === getBookmarkScope(bookmark) && Math.abs(Number(entry.time) - Number(bookmark.time)) < 1);
      if (exists) return false;
      this.state.bookmarks.unshift(bookmark);
      await this.save();
      return true;
    },

    async removeBookmark(id) {
      if (!Array.isArray(this.state.bookmarks)) return false;
      const before = this.state.bookmarks.length;
      this.state.bookmarks = this.state.bookmarks.filter((entry) => entry.id !== id);
      if (this.state.bookmarks.length < before) {
        await this.save();
        return true;
      }
      return false;
    },

    formatBookmarkTime(seconds) {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      const whole = Math.floor(secs);
      let fraction = Math.round((secs - whole) * 100);
      let minuteValue = mins;
      let wholeSeconds = whole;
      if (fraction >= 100) {
        fraction = 0;
        wholeSeconds += 1;
      }
      if (wholeSeconds >= 60) {
        wholeSeconds -= 60;
        minuteValue += 1;
      }
      return `${minuteValue}:${wholeSeconds.toString().padStart(2, '0')}.${fraction.toString().padStart(2, '0')}`;
    }
  };

  return stateApi;
}

export const defaultGameState = createGameState();
export const GameState = defaultGameState;
export default defaultGameState;
