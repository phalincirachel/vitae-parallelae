import installLegacyGlobals from '../shared/compat/legacy-globals.js';
import { getSceneConfig, resolveSceneFromLocation } from '../shared/data/scene-config.js';
import { loadThree } from '../scenes/liminal3d/load-three.js';

installLegacyGlobals();

export async function initLiminalApp(options = {}) {
  const locationLike = options.locationLike || globalThis.location;
  const preferredSceneKey = options.sceneKey || 'liminal_library';
  const resolvedScene = getSceneConfig(preferredSceneKey) || resolveSceneFromLocation(locationLike);
  return {
    sceneConfig: resolvedScene,
    loadThree
  };
}

export { loadThree, getSceneConfig, resolveSceneFromLocation };
