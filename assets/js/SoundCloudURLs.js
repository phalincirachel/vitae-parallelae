/**
 * SoundCloud Secret-Link Constants
 * Maps game audio assets to SoundCloud Widget API URLs
 */
const SC_URLS = {
    // Hauptkapitel (mit si= Parameter für Authentifizierung)
    KAPITEL_1: 'https://soundcloud.com/stephan-pfalzgraf/11x-3/s-yW40KmlWr2b?si=6cea02cbd20e455ca01d05fa0b6ed748',
    KAPITEL_1C: 'https://soundcloud.com/stephan-pfalzgraf/13x-2/s-Aj6rsLMlFG1?si=6cea02cbd20e455ca01d05fa0b6ed748',
    LIMINAL_LIBRARY: 'https://soundcloud.com/stephan-pfalzgraf/12x-1/s-2olKSU8eJOH?si=6cea02cbd20e455ca01d05fa0b6ed748',

    // SFX & Ambient
    FOOTSTEPS: 'https://soundcloud.com/stephan-pfalzgraf/footsteps/s-smAaGD2jllB?si=c69973f289364d24b979a8b0ef19a5e3',
    AMBIENT_MEDIEVAL: 'https://soundcloud.com/stephan-pfalzgraf/medieval_town/s-Fl8XM07fVzj?si=46227f8ef1ed418cbcd8fd4830bc0fd7',
    SHIMMER: 'https://soundcloud.com/stephan-pfalzgraf/shimmer/s-3bZeXboRF2l?si=1046b2dd473449fcb31daea579c232cc',

    // Lore-Tracks (Beispiele - erweitern nach Bedarf)
    LORE_BUCH_1: 'PLACEHOLDER_SC_LINK_LORE_BUCH_1',
    LORE_BUCH_2: 'PLACEHOLDER_SC_LINK_LORE_BUCH_2'
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

    // Liminal Library (Kapitel 1b)
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
    'assets/shimmer.mp3': SC_URLS.SHIMMER
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
