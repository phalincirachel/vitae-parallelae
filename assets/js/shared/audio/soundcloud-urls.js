export const SC_URLS = Object.freeze({
  KAPITEL_1: 'https://api.soundcloud.com/tracks/2250158609?secret_token=s-yW40KmlWr2b',
  KAPITEL_1C: 'https://api.soundcloud.com/tracks/2250158603?secret_token=s-Aj6rsLMlFG1',
  LIMINAL_LIBRARY: 'https://api.soundcloud.com/tracks/2250158606?secret_token=s-2olKSU8eJOH',
  FOOTSTEPS: 'https://api.soundcloud.com/tracks/2250168038?secret_token=s-smAaGD2jllB',
  AMBIENT_MEDIEVAL: 'https://api.soundcloud.com/tracks/2250168437?secret_token=s-Fl8XM07fVzj',
  SHIMMER: 'https://api.soundcloud.com/tracks/2250168776?secret_token=s-3bZeXboRF2l',
  LORE_1: 'https://api.soundcloud.com/tracks/2250892529?secret_token=s-XrlxZtj8935',
  LORE_2: 'https://api.soundcloud.com/tracks/2268724265?secret_token=s-8pz7WG4egJJ',
  LORE_3: 'https://api.soundcloud.com/tracks/2268724358?secret_token=s-t5jtK51t3dK'
});

export const MP3_TO_SC_MAP = Object.freeze({
  'assets/kapitel1.mp3': SC_URLS.KAPITEL_1,
  'kapitel1.mp3': SC_URLS.KAPITEL_1,
  'assets/kapitel1c.mp3': SC_URLS.KAPITEL_1C,
  'kapitel1c.mp3': SC_URLS.KAPITEL_1C,
  'assets/liminal.mp3': SC_URLS.LIMINAL_LIBRARY,
  'liminal.mp3': SC_URLS.LIMINAL_LIBRARY,
  'assets/kapitel1b.mp3': SC_URLS.LIMINAL_LIBRARY,
  'kapitel1b.mp3': SC_URLS.LIMINAL_LIBRARY,
  'assets/lore1.mp3': SC_URLS.LORE_1,
  'lore1.mp3': SC_URLS.LORE_1,
  'assets/lore2.mp3': SC_URLS.LORE_2,
  'lore2.mp3': SC_URLS.LORE_2,
  'assets/lore3.mp3': SC_URLS.LORE_3,
  'lore3.mp3': SC_URLS.LORE_3
});

export function getSCUrl(localPath) {
  if (!localPath) return '';
  return MP3_TO_SC_MAP[localPath] || localPath;
}

export default getSCUrl;
