/**
 * Global lookup entries for inline subtitle links.
 *
 * Subtitle markup:
 * - underline only: <u>word</u> or [u]word[/u]
 * - underline + info overlay: <u:key>word</u> or [u:key]word[/u]
 */
(function initSubtitleInfoLibrary(globalScope) {
    'use strict';

    const entries = {
        demo_rundbrief: {
            title: 'Rundbrief-Konsortium (fiktiv)',
            image: 'assets/platz3.png',
            text: 'Ein geheimer Verteilerkreis aus Chronisten, die verlorene Stadtprotokolle als private Rundbriefe zirkulieren lassen.'
        },
        demo_schuttarchiv: {
            title: 'Schuttarchiv 2069 (fiktiv)',
            image: 'assets/platz2.png',
            text: 'Unter den Truemmern der Altstadt sollen versiegelte Mini-Archive liegen, die nur von Eingeweihten geortet werden koennen.'
        },
        demo_zigzag: {
            title: 'ZIGZAG-Protokoll (fiktiv)',
            image: 'assets/platz.png',
            text: 'Ein postklassisches Nachrichtensystem mit fragmentierten Kanalpfaden. Nachrichten erscheinen zeitversetzt in mehreren Fassungen.'
        },
        antiquariat_hannrath: {
            title: 'Antiquariat Hannrath',
            image: 'assets/platz.png',
            text: 'Ein Heidelberger Antiquariat in der Hauptstrasse. In den Texten fungiert es als zentraler Ort fuer Fundstuecke und Erinnerungsfragmente.'
        },
        neckar: {
            title: 'Neckar',
            image: '',
            text: 'Der Neckar praegt Stadtbild und Stimmung in mehreren Passagen. In den Erzaehlungen steht er fuer Verfall, Zeit und Uebergang.'
        },
        pilgrims: {
            title: 'Pilgerzug',
            image: '',
            text: 'Die Pilgerfiguren markieren die verdichtete, ritualhafte Bewegung durch die Stadt und geben dem Kapitel seine soziale Textur.'
        }
    };

    const api = {
        entries: Object.freeze({ ...entries }),
        get(key) {
            if (!key) return null;
            const lookupKey = String(key).trim();
            if (!lookupKey) return null;
            return this.entries[lookupKey] || null;
        }
    };

    globalScope.SubtitleInfoLibrary = Object.freeze(api);
})(typeof window !== 'undefined' ? window : globalThis);
