/**
 * SoundCloud Secret-Link Constants
 * Maps game audio assets to SoundCloud Widget API URLs
 */
const SC_URLS = {
    // Hauptkapitel
    KAPITEL_1: 'https://soundcloud.com/stephan-pfalzgraf/11x-3/s-yW40KmlWr2b?si=3b92bfbc61f04aa99d038a86584ac00a&utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing',
    KAPITEL_1C: 'https://soundcloud.com/stephan-pfalzgraf/13x-2/s-Aj6rsLMlFG1?si=f3f2b4ce0e6b41a5a651b1baef7f752f&utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing',
    LIMINAL_LIBRARY: 'https://soundcloud.com/stephan-pfalzgraf/12x-1/s-2olKSU8eJOH?si=66bccd5c06d7458990bff4a8ea14341e&utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing',

    // SFX & Ambient
    FOOTSTEPS: 'https://soundcloud.com/stephan-pfalzgraf/footsteps/s-smAaGD2jllB?si=f64eb270bdcf4362b7726ec5d33bcf93&utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing',
    AMBIENT_MEDIEVAL: 'https://soundcloud.com/stephan-pfalzgraf/medieval_town/s-Fl8XM07fVzj?si=a287eaf3e5c841149f6b8427166c0c7c&utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing',
    SHIMMER: 'https://soundcloud.com/stephan-pfalzgraf/shimmer/s-3bZeXboRF2l?si=385b602d0d7841f081c2d6ecc4861d45&utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing',

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
