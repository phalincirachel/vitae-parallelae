export const INTRO_DEMO_LORE_ID = 9001;

function freezeSegment(id, text, audioStartSec, audioEndSec, options = {}) {
  return Object.freeze({
    id,
    text,
    audioStartSec: Number.isFinite(audioStartSec) ? Number(audioStartSec) : null,
    audioEndSec: Number.isFinite(audioEndSec) ? Number(audioEndSec) : null,
    holdDurationMs: Number.isFinite(options.holdDurationMs) ? Math.max(0, Math.trunc(options.holdDurationMs)) : 0
  });
}

function getSegmentCueTime(segment, fallbackSec = 0) {
  if (segment && Number.isFinite(segment.audioStartSec)) return Number(segment.audioStartSec);
  return Number.isFinite(fallbackSec) ? Number(fallbackSec) : 0;
}

function getSegmentVisualDurationSec(segment) {
  if (segment && Number.isFinite(segment.audioStartSec) && Number.isFinite(segment.audioEndSec)) {
    return Math.max(0, Number(segment.audioEndSec) - Number(segment.audioStartSec));
  }
  if (segment && Number.isFinite(segment.holdDurationMs) && segment.holdDurationMs > 0) {
    return segment.holdDurationMs / 1000;
  }
  return 0;
}

export const START_SCREEN_TRACK = Object.freeze([
  freezeSegment(
    'start-0',
    'Willkommen in der sch\u00f6nsten Stadt der Welt, Heydelberg. Ich bin Ihre Fremdenf\u00fchrerin Lita Helford. F\u00fcr eine optimale Erfahrung schalten Sie nun bitte Ihren Smartbone auf und w\u00e4hlen Sie sich ins ZIGZAG Netz ein. Vielen Dank.',
    1,
    23
  )
]);

export const MAIN_INTRO_TRACK = Object.freeze([
  freezeSegment('main-0', 'Sp\u00fcren Sie mich?', 23, 26.1),
  freezeSegment('main-1', 'Hier bin ich.', 26.1, 31),
  freezeSegment(
    'main-2',
    'Um Ihren Aufenthalt optimal zu gestalten, w\u00e4hlen Sie nun bitte, ob Sie lieber Bl\u00e4ttern wie in einem Buch, oder Scrollen wie in einer Schriftrolle.',
    31,
    44
  ),
  freezeSegment(
    'main-3',
    'Keine Sorge, sie k\u00f6nnen jederzeit wechseln. Ihnen stehen alle M\u00f6glichkeiten offen.',
    44,
    52
  ),
  freezeSegment(
    'main-4',
    'Wenn Sie auf das Buch klicken, gelangen Sie zum Inhaltsverzeichnis.',
    52,
    58.7
  ),
  freezeSegment(
    'main-5',
    'Hier k\u00f6nnen Sie Ihren Fortschritt speichern.',
    null,
    null,
    { holdDurationMs: 1500 }
  ),
  freezeSegment('main-6', 'Und Ihre Souveniers sind hier.', 58.7, 62),
  freezeSegment('main-7', 'Was Souveniers sind? Jeder Pilger liebt doch Souveniers, nicht?', 62, 69),
  freezeSegment('main-8', 'Sehen Sie, sie haben zwei M\u00f6glichkeiten, diese Stadt zu erfahren.', 69, 73.4),
  freezeSegment('main-9', 'Erste M\u00f6glichkeit: Sie lesen einfach nur.', 73.4, 77),
  freezeSegment(
    'main-10',
    'Sie k\u00f6nnen nat\u00fcrlich auch im Dunkeln lesen, wenn Sie m\u00f6gen. Hierzu bet\u00e4tigen Sie einfach den Lichtschalter',
    77,
    85
  ),
  freezeSegment(
    'main-11',
    'Wenn Sie nun nocheinmal darauf klicken, sehen Sie pl\u00f6tzlich, wie die Stadt dahinter auftaucht.',
    85,
    93
  ),
  freezeSegment(
    'main-12',
    'Wenn Sie dies nun dazu reizt, selbst einmal die Stadt zu erkunden, die vorgegebenen Pfade zu verlassen, dann klicken Sie doch einmal auf das Erkunden-Symbol.',
    93,
    106
  ),
  freezeSegment(
    'main-13',
    'Nun k\u00f6nnen Sie sich frei bewegen und die Stadt erkunden. Sie k\u00f6nnen jederzeit durch Blick auf die Brille zur\u00fcck in den Lesemodus gelangen',
    106,
    120
  ),
  freezeSegment(
    'main-14',
    'In diesem Erkundungs-Modus k\u00f6nnen Sie nun auch Souveniers einsammeln. Es sind die gelben Lichter, die Sie \u00fcberall in der Stadt finden.',
    120,
    128
  ),
  freezeSegment('main-15', 'Sammeln Sie beispielsweise einmal dieses gelbe Licht ein, indem Sie darauf klicken', 128, 135),
  freezeSegment(
    'main-16',
    'Rechts oben wird Ihnen angezeigt, wie viele Souveniers Sie in diesem Kapitel schon gefunden haben. Wer alle Souveniers eines Kapitels findet, bekommt eine zus\u00e4tzliche Belohnung.',
    156,
    171
  ),
  freezeSegment('main-17', 'Klicken Sie oben auf die Anzeige und Sie gelangen direkt zu ihrer Souvenier-Box.', 171, 177),
  freezeSegment('main-18', 'Nun sind Sie bereit f\u00fcr Ihre Tour.', 177, 180.8),
  freezeSegment('main-19', 'Um zu beginnen, klicken Sie auf den Button. Viel Spa\u00df.', 180.8, 184.8)
]);

export const SOUVENIR_DEMO_TRACK = Object.freeze([
  freezeSegment(
    'souvenir-0',
    'In den Souveniers liegen Kleinode versteckt. Hier k\u00f6nnen Sie etwas \u00fcber Geschichte der Stadt oder \u00fcber die Werke ihrer Bewohner erfahren.',
    135,
    147
  ),
  freezeSegment(
    'souvenir-1',
    'Wenn Sie sie fertig gelesen haben, kehrt es automatisch zum Kapitel zur\u00fcck. Oder Sie klick auf \u201eZur\u00fcck zum Kapitel\u201c.',
    147,
    156
  )
]);

export const INTRO_TRACKS = Object.freeze({
  start: START_SCREEN_TRACK,
  main: MAIN_INTRO_TRACK,
  souvenir: SOUVENIR_DEMO_TRACK
});

export const INTRO_DEMO_LORE_ENTRY = Object.freeze({
  title: 'Einf\u00fchrungs-Souvenier',
  duration: 'Demo-Fund'
});

export const INTRO_STEP_SCHEMA = Object.freeze([
  Object.freeze({
    id: 'layout-choice',
    track: 'main',
    segmentIndexRange: Object.freeze([0, 2]),
    checkpointAction: 'choose-layout',
    highlightTargets: Object.freeze(['[data-loading-tutorial="layout-group"]']),
    allowedInteractions: Object.freeze([
      'input[name="readerSentenceLayout"][value="blaettern"]',
      'input[name="readerSentenceLayout"][value="flat"]',
      '.reader-radio-option[data-layout="blaettern"]',
      '.reader-radio-option[data-layout="flat"]'
    ]),
    enterState: 'archive-settings',
    exitState: 'archive-close',
    resumeBehavior: 'continue-main'
  }),
  Object.freeze({
    id: 'book-open',
    track: 'main',
    segmentIndexRange: Object.freeze([3, 4]),
    checkpointAction: 'open-book',
    highlightTargets: Object.freeze(['#bookBtn']),
    allowedInteractions: Object.freeze(['#bookBtn']),
    enterState: 'reader',
    exitState: 'archive-inhalt',
    resumeBehavior: 'continue-main'
  }),
  Object.freeze({
    id: 'dimmer-dark',
    track: 'main',
    segmentIndexRange: Object.freeze([9, 10]),
    checkpointAction: 'dimmer-dark',
    highlightTargets: Object.freeze(['#sceneDimmerToggleBtn']),
    allowedInteractions: Object.freeze(['#sceneDimmerToggleBtn']),
    enterState: 'reader-white',
    exitState: 'reader-dark',
    resumeBehavior: 'continue-main'
  }),
  Object.freeze({
    id: 'dimmer-light',
    track: 'main',
    segmentIndexRange: Object.freeze([10, 11]),
    checkpointAction: 'dimmer-light',
    highlightTargets: Object.freeze(['#sceneDimmerToggleBtn']),
    allowedInteractions: Object.freeze(['#sceneDimmerToggleBtn']),
    enterState: 'reader-dark',
    exitState: 'reader-scene-visible',
    resumeBehavior: 'continue-main'
  }),
  Object.freeze({
    id: 'enter-explore',
    track: 'main',
    segmentIndexRange: Object.freeze([11, 12]),
    checkpointAction: 'enter-explore',
    highlightTargets: Object.freeze(['#readingModeBtn']),
    allowedInteractions: Object.freeze(['#readingModeBtn']),
    enterState: 'reader-scene-visible',
    exitState: 'game-mode',
    resumeBehavior: 'continue-main'
  }),
  Object.freeze({
    id: 'collect-orb',
    track: 'main',
    segmentIndexRange: Object.freeze([13, 15]),
    checkpointAction: 'collect-orb',
    highlightTargets: Object.freeze(['#gameCanvas']),
    allowedInteractions: Object.freeze(['#gameCanvas']),
    enterState: 'game-mode',
    exitState: 'souvenir-reader',
    resumeBehavior: 'switch-track'
  }),
  Object.freeze({
    id: 'back-to-chapter',
    track: 'souvenir',
    segmentIndexRange: Object.freeze([0, 1]),
    checkpointAction: 'back-to-chapter',
    highlightTargets: Object.freeze(['#backToChapterBtn']),
    allowedInteractions: Object.freeze(['#backToChapterBtn']),
    enterState: 'souvenir-reader',
    exitState: 'main-reader',
    resumeBehavior: 'return-main'
  }),
  Object.freeze({
    id: 'open-lore-hud',
    track: 'main',
    segmentIndexRange: Object.freeze([16, 17]),
    checkpointAction: 'open-lore-hud',
    highlightTargets: Object.freeze(['#loreProgressHud']),
    allowedInteractions: Object.freeze(['#loreProgressHud']),
    enterState: 'main-reader',
    exitState: 'archive-lore',
    resumeBehavior: 'continue-main'
  })
]);

export function getTrackText(trackName) {
  const track = INTRO_TRACKS[trackName] || [];
  return track.map((segment) => segment.text).join('\n\n');
}

export function getTrackEntries(trackName) {
  const track = INTRO_TRACKS[trackName] || [];
  let fallbackSec = 0;
  return track.map((segment) => {
    const entry = Object.freeze({
      time: getSegmentCueTime(segment, fallbackSec),
      text: segment.text
    });
    fallbackSec = entry.time + getSegmentVisualDurationSec(segment);
    return entry;
  });
}

export default {
  INTRO_DEMO_LORE_ENTRY,
  INTRO_DEMO_LORE_ID,
  INTRO_STEP_SCHEMA,
  INTRO_TRACKS,
  MAIN_INTRO_TRACK,
  SOUVENIR_DEMO_TRACK,
  START_SCREEN_TRACK,
  getTrackEntries,
  getTrackText
};

