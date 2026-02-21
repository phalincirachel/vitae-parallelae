/**
 * SoundCloud Secret-Link Constants
 * Maps game audio assets to SoundCloud Widget API URLs
 */
const SC_URLS = {
    // Hauptkapitel (API Format für Private Tracks: api.soundcloud.com/tracks/[ID]?secret_token=[TOKEN])

    // Kapitel 1 (Marktplatz): ID 2250158609, Token s-yW40KmlWr2b
    KAPITEL_1: 'https://api.soundcloud.com/tracks/2250158609?secret_token=s-yW40KmlWr2b',

    // Kapitel 1c (Steingasse): ID 2250158603, Token s-Aj6rsLMlFG1
    KAPITEL_1C: 'https://api.soundcloud.com/tracks/2250158603?secret_token=s-Aj6rsLMlFG1',

    // Kapitel 1b (Antiquariat Hannrath): ID 2250158606, Token s-2olKSU8eJOH
    LIMINAL_LIBRARY: 'https://api.soundcloud.com/tracks/2250158606?secret_token=s-2olKSU8eJOH',

    // SFX & Ambient

    // Footsteps: ID 2250168038, Token s-smAaGD2jllB
    FOOTSTEPS: 'https://api.soundcloud.com/tracks/2250168038?secret_token=s-smAaGD2jllB',

    // Medieval Town: ID 2250168437, Token s-Fl8XM07fVzj
    AMBIENT_MEDIEVAL: 'https://api.soundcloud.com/tracks/2250168437?secret_token=s-Fl8XM07fVzj',

    // Shimmer: ID 2250168776, Token s-3bZeXboRF2l
    SHIMMER: 'https://api.soundcloud.com/tracks/2250168776?secret_token=s-3bZeXboRF2l',

    // Lore-Tracks
    // Lore1: ID 2250892529, Token s-XrlxZtj8935
    LORE_1: 'https://api.soundcloud.com/tracks/2250892529?secret_token=s-XrlxZtj8935',

    // Lore2: ID 2268724265, Token s-8pz7WG4egJJ
    LORE_2: 'https://api.soundcloud.com/tracks/2268724265?secret_token=s-8pz7WG4egJJ',

    // Lore3: ID 2268724358, Token s-t5jtK51t3dK
    LORE_3: 'https://api.soundcloud.com/tracks/2268724358?secret_token=s-t5jtK51t3dK'
};

/**
 * Mapping von alten MP3-Pfaden zu SC-URLs
 */
const MP3_TO_SC_MAP = {
    // Kapitel 1
    'assets/kapitel1.mp3': SC_URLS.KAPITEL_1,
    'kapitel1.mp3': SC_URLS.KAPITEL_1,

    // Kapitel 1c
    'assets/kapitel1c.mp3': SC_URLS.KAPITEL_1C,
    'kapitel1c.mp3': SC_URLS.KAPITEL_1C,

    // Antiquariat Hannrath (Kapitel 1b)
    'assets/liminal.mp3': SC_URLS.LIMINAL_LIBRARY,
    'liminal.mp3': SC_URLS.LIMINAL_LIBRARY,
    'assets/kapitel1b.mp3': SC_URLS.LIMINAL_LIBRARY, // Alias wie angefordert
    'kapitel1b.mp3': SC_URLS.LIMINAL_LIBRARY, // Alias wie angefordert

    // Ambient
    'medieval_town.mp3': SC_URLS.AMBIENT_MEDIEVAL,
    'assets/medieval_town.mp3': SC_URLS.AMBIENT_MEDIEVAL,

    // SFX
    'footsteps.mp3': SC_URLS.FOOTSTEPS,
    'assets/footsteps.mp3': SC_URLS.FOOTSTEPS,
    'shimmer.mp3': SC_URLS.SHIMMER,
    'assets/shimmer.mp3': SC_URLS.SHIMMER,

    // Lore Tracks
    'assets/lore1.mp3': SC_URLS.LORE_1,
    'lore1.mp3': SC_URLS.LORE_1,
    'assets/lore2.mp3': SC_URLS.LORE_2,
    'lore2.mp3': SC_URLS.LORE_2,
    'assets/lore3.mp3': SC_URLS.LORE_3,
    'lore3.mp3': SC_URLS.LORE_3
};

/**
 * Konvertiert einen lokalen MP3-Pfad in eine SoundCloud-URL.
 * Falls kein Mapping existiert, wird der Originalpfad zurückgegeben.
 * 
 * @param {string} localPath Der Pfad zur MP3-Datei
 * @returns {string} Die SoundCloud-URL oder der Originalpfad
 */
function getSCUrl(localPath) {
    if (!localPath) return '';
    return MP3_TO_SC_MAP[localPath] || localPath;
}

// Global verfügbar machen falls nötig (für Module)
if (typeof window !== 'undefined') {
    window.getSCUrl = getSCUrl;
}
