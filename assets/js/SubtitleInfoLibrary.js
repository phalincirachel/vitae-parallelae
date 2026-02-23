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
