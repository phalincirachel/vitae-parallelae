export const INTRO_DEMO_LORE_ID = 9001;

export const START_SCREEN_TRACK = Object.freeze([
  Object.freeze({ id: 'start-0', text: 'Willkommen in der sch\u00f6nsten Stadt der Welt, Heydelberg. Ich bin Ihre Fremdenf\u00fchrerin Lita Helford.' }),
  Object.freeze({ id: 'start-1', text: 'F\u00fcr eine optimale Erfahrung schalten Sie nun bitte Ihren Smartbone auf und w\u00e4hlen Sie sich ins ZIGZAG Netz ein. Vielen Dank.' })
]);

export const MAIN_INTRO_TRACK = Object.freeze([
  Object.freeze({ id: 'main-0', text: 'Sp\u00fcren Sie mich?' }),
  Object.freeze({ id: 'main-1', text: 'Hier bin ich.' }),
  Object.freeze({ id: 'main-2', text: 'Um Ihren Aufenthalt optimal zu gestalten, w\u00e4hlen Sie nun bitte, ob Sie lieber Bl\u00e4ttern wie in einem Buch, oder Scrollen wie in einer Schriftrolle.' }),
  Object.freeze({ id: 'main-3', text: 'Keine Sorge, sie k\u00f6nnen jederzeit wechseln. Ihnen stehen alle M\u00f6glichkeiten offen.' }),
  Object.freeze({ id: 'main-4', text: 'Wenn Sie auf das Buch klicken, gelangen Sie zum Inhaltsverzeichnis.' }),
  Object.freeze({ id: 'main-5', text: 'Hier k\u00f6nnen Sie Ihren Fortschritt speichern.' }),
  Object.freeze({ id: 'main-6', text: 'Und Ihre Souveniers sind hier.' }),
  Object.freeze({ id: 'main-7', text: 'Was Souveniers sind? Jeder Pilger liebt doch Souveniers, nicht?' }),
  Object.freeze({ id: 'main-8', text: 'Sehen Sie, sie haben zwei M\u00f6glichkeiten, diese Stadt zu erfahren.' }),
  Object.freeze({ id: 'main-9', text: 'Erste M\u00f6glichkeit: Sie lesen einfach nur.' }),
  Object.freeze({ id: 'main-10', text: 'Sie k\u00f6nnen nat\u00fcrlich auch im Dunkeln lesen, wenn Sie m\u00f6gen. Hierzu bet\u00e4tigen Sie einfach den Lichtschalter' }),
  Object.freeze({ id: 'main-11', text: 'Wenn Sie nun nocheinmal darauf klicken, sehen Sie pl\u00f6tzlich, wie die Stadt dahinter auftaucht.' }),
  Object.freeze({ id: 'main-12', text: 'Wenn Sie dies nun dazu reizt, selbst einmal die Stadt zu erkunden, die vorgegebenen Pfade zu verlassen, dann klicken Sie doch einmal auf das Erkunden-Symbol.' }),
  Object.freeze({ id: 'main-13', text: 'Nun k\u00f6nnen Sie sich frei bewegen und die Stadt erkunden. Sie k\u00f6nnen jederzeit durch Blick auf die Brille zur\u00fcck in den Lesemodus gelangen' }),
  Object.freeze({ id: 'main-14', text: 'In diesem Erkundungs-Modus k\u00f6nnen Sie nun auch Souveniers einsammeln. Es sind die gelben Lichter, die Sie \u00fcberall in der Stadt finden.' }),
  Object.freeze({ id: 'main-15', text: 'Sammeln Sie beispielsweise einmal dieses gelbe Licht ein, indem Sie darauf klicken' }),
  Object.freeze({ id: 'main-16', text: 'Rechts oben wird Ihnen angezeigt, wie viele Souveniers Sie in diesem Kapitel schon gefunden haben. Wer alle Souveniers eines Kapitels findet, bekommt eine zus\u00e4tzliche Belohnung.' }),
  Object.freeze({ id: 'main-17', text: 'Klicken Sie oben auf die Anzeige' }),
  Object.freeze({ id: 'main-18', text: 'und Sie gelangen direkt zu ihrer Souvenier-Box.' }),
  Object.freeze({ id: 'main-19', text: 'Nun sind Sie bereit f\u00fcr Ihre Tour. Um zu beginnen, klicken Sie auf den Button.' })
]);

export const SOUVENIR_DEMO_TRACK = Object.freeze([
  Object.freeze({ id: 'souvenir-0', text: 'In den Souveniers liegen Kleinode versteckt. Hier k\u00f6nnen Sie etwas \u00fcber Geschichte der Stadt oder \u00fcber die Werke ihrer Bewohner erfahren.' }),
  Object.freeze({ id: 'souvenir-1', text: 'Wenn Sie sie fertig gelesen haben, kehrt es automatisch zum Kapitel zur\u00fcck. Oder Sie klick auf \u201eZur\u00fcck zum Kapitel\u201c.' })
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

export default {
  INTRO_DEMO_LORE_ENTRY,
  INTRO_DEMO_LORE_ID,
  INTRO_STEP_SCHEMA,
  INTRO_TRACKS,
  MAIN_INTRO_TRACK,
  SOUVENIR_DEMO_TRACK,
  START_SCREEN_TRACK,
  getTrackText
};
