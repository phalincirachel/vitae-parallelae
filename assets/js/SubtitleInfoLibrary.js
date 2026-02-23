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
            text: 'Ein geheimer Verteilerkreis aus Chronisten, die verlorene Stadtprotokolle als private Rundbriefe zirkulieren lassen.\n\nDer Rundbrief wird nur in fragmentierten Fassungen versendet: jede Version traegt absichtliche Luecken, Kommentare am Rand und datierte Korrekturen aus spaeteren Jahren.\n\nIn manchen Kapiteln gilt ein Eintrag erst dann als \"echt\", wenn mindestens drei voneinander abweichende Fassungen auftauchen.\n\nFuer diese Demo dient der Begriff als Test-Link fuer ein laengeres Overlay mit Bild und mehrzeiligem Text.'
        },
        demo_schuttarchiv: {
            title: 'Schuttarchiv 2069 (fiktiv)',
            image: 'assets/platz2.png',
            text: 'Unter den Truemmern der Altstadt sollen versiegelte Mini-Archive liegen, die nur von Eingeweihten geortet werden koennen.\n\nJedes Archiv besitzt einen lokalen Namen, aber keine offizielle Kartierung. Hinweise werden in Inventarlisten versteckt, oft als unscheinbare Materialnotizen.\n\nDie Inhalte reichen von Rechnungsfragmenten bis zu handschriftlichen Briefteilen, die nie abgeschickt wurden.\n\nIn der Leselogik steht das Schuttarchiv fuer Erinnerung unter Druck: Wissen ist vorhanden, aber nur in gebrochener Form verfuegbar.'
        },
        demo_zigzag: {
            title: 'ZIGZAG-Protokoll (fiktiv)',
            image: 'assets/platz.png',
            text: 'Ein postklassisches Nachrichtensystem mit fragmentierten Kanalpfaden. Nachrichten erscheinen zeitversetzt in mehreren Fassungen.\n\nDer sogenannte ZIGZAG-Modus priorisiert Unvorhersehbarkeit ueber Effizienz: Reihenfolgen koennen kippen, Antworten treffen vor den Fragen ein, und Metadaten werden absichtlich verrauscht.\n\nBefuerworter nennen es resilient gegen zentrale Kontrolle; Kritiker sprechen von ritualisiertem Informationsverlust.\n\nAls Demo-Eintrag zeigt dieser Begriff, wie das Overlay bei langem Fliesstext, Bild und engem Viewport reagiert.'
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
