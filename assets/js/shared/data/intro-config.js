export const INTRO_VERSION = 2;

export const INTRO_ASSET_PATHS = Object.freeze([
  'assets/intro/start.png',
  'assets/intro/einfuehrungsplatz.png',
  'assets/intro/placeholder.txt',
  'assets/intro/silence.wav'
]);

export const INTRO_ROUTE = Object.freeze({
  introFile: 'intro.html',
  gameFile: 'index.html'
});

export function listIntroAssetPaths() {
  return INTRO_ASSET_PATHS.slice();
}

export default {
  INTRO_VERSION,
  INTRO_ASSET_PATHS,
  INTRO_ROUTE,
  listIntroAssetPaths
};
