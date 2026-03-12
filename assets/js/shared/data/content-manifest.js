export const DEFAULT_CHAPTER_LORE_TARGET = 5;

export const CHAPTER_DB = Object.freeze({
  marktplatz: Object.freeze({
    id: 'marktplatz',
    code: '1a',
    title: 'Marktplatz',
    totalCollectibles: 5,
    loreIds: Object.freeze([1]),
    chapterButtonId: 'chapter1Btn'
  }),
  liminal_library: Object.freeze({
    id: 'liminal_library',
    code: '1b',
    title: 'Antiquariat Hannrath',
    totalCollectibles: 5,
    loreIds: Object.freeze([2]),
    chapterButtonId: 'chapter1bBtn'
  }),
  steingasse: Object.freeze({
    id: 'steingasse',
    code: '1c',
    title: 'Steingasse',
    totalCollectibles: 5,
    loreIds: Object.freeze([3]),
    chapterButtonId: 'chapter1cBtn'
  })
});

export const SCENE_ALIASES = Object.freeze({
  index: 'marktplatz',
  kapitel1: 'marktplatz',
  chapter1: 'marktplatz',
  chapter1a: 'marktplatz',
  marktplatz: 'marktplatz',
  liminal: 'liminal_library',
  chapter1b: 'liminal_library',
  kapitel1b: 'liminal_library',
  liminal_library: 'liminal_library',
  chapter1c: 'steingasse',
  kapitel1c: 'steingasse',
  steingasse: 'steingasse'
});

export const CONTENT_DB = Object.freeze({
  1: Object.freeze({
    id: 1,
    title: 'Der verborgene Pfad',
    audio: 'assets/lore1.mp3',
    text: 'assets/lore1.txt',
    duration: '0:45',
    chapter: 'marktplatz'
  }),
  2: Object.freeze({
    id: 2,
    title: 'Das Flüstern',
    audio: 'assets/lore2.mp3',
    text: 'assets/lore2.txt',
    duration: '1:20',
    chapter: 'liminal_library'
  }),
  3: Object.freeze({
    id: 3,
    title: 'Verlorene Echos',
    audio: 'assets/lore3.mp3',
    text: 'assets/lore3.txt',
    duration: '0:55',
    chapter: 'steingasse'
  })
});

function uniqueSortedNumbers(values) {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values.map((entry) => Number(entry)).filter((entry) => Number.isFinite(entry)).map((entry) => Math.trunc(entry)))).sort((left, right) => left - right);
}

export function normalizeSceneName(sceneName) {
  if (typeof sceneName !== 'string') return '';
  const raw = sceneName.trim().toLowerCase();
  if (!raw) return '';
  return SCENE_ALIASES[raw] || raw;
}

export function getChapterConfig(sceneName) {
  const key = normalizeSceneName(sceneName);
  return CHAPTER_DB[key] || null;
}

export function getChapterLoreIds(sceneName) {
  const config = getChapterConfig(sceneName);
  return config ? uniqueSortedNumbers(config.loreIds) : [];
}

export function getContent(id) {
  return CONTENT_DB[Math.trunc(Number(id))] || null;
}

export function getAllContent() {
  return CONTENT_DB;
}

export function listRuntimeAssetPaths() {
  const assets = [
    'assets/kapitel1.txt',
    'assets/kapitel1b.txt',
    'assets/kapitel1c.txt',
    'assets/kapitel1c.png',
    'assets/platz.png',
    'assets/platz2.png',
    'assets/platz3.png',
    'assets/sprite.png',
    'assets/spriteneu.png',
    'assets/spriteruecken.png',
    'assets/spriterueckenneu.png',
    'assets/seitlich.png',
    'assets/seitlichneu.png',
    'assets/medieval_town.mp3',
    'assets/footsteps.mp3',
    'assets/shimmer.mp3'
  ];

  for (const content of Object.values(CONTENT_DB)) {
    assets.push(content.audio, content.text);
  }

  return Array.from(new Set(assets));
}
