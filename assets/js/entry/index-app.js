import installLegacyGlobals from '../shared/compat/legacy-globals.js';
import defaultGameState, { GameState } from '../shared/state/game-state.js';
import { resolveSceneFromLocation } from '../shared/data/scene-config.js';

installLegacyGlobals();

export async function initIndexApp(options = {}) {
  const locationLike = options.locationLike || globalThis.location;
  const sceneConfig = resolveSceneFromLocation(locationLike);
  return {
    sceneConfig,
    GameState: options.gameState || GameState || defaultGameState
  };
}

export function getCurrentSceneConfig(locationLike = globalThis.location) {
  return resolveSceneFromLocation(locationLike);
}

export { GameState, defaultGameState };
