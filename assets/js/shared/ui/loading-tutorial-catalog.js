export const LOADING_TUTORIAL_CARDS = Object.freeze([
  Object.freeze({ id: 'book_menu', scenes: Object.freeze(['marktplatz', 'steingasse', 'liminal_library']), devices: Object.freeze(['mobile', 'desktop']), order: 10, mode: 'ui-clone-single', copy: 'Inhaltsverzeichnis und Einstellungen.', target: Object.freeze({ stage: 'hud', selector: '#bookBtn' }), measurementState: 'hud', animationPreset: 'soft-pulse' }),
  Object.freeze({ id: 'mode_toggle', scenes: Object.freeze(['marktplatz', 'steingasse', 'liminal_library']), devices: Object.freeze(['mobile', 'desktop']), order: 20, mode: 'ui-clone-single', copy: 'Zwischen Spielemodus und Lesemodus wechseln', target: Object.freeze({ stage: 'hud', selector: '#readingModeBtn' }), measurementState: 'hud', animationPreset: 'soft-pulse' }),
  Object.freeze({ id: 'scene_dimmer', scenes: Object.freeze(['marktplatz', 'steingasse', 'liminal_library']), devices: Object.freeze(['mobile', 'desktop']), order: 30, mode: 'ui-clone-single', copy: 'Hintergrund und Helligkeit sind frei wählbar', target: Object.freeze({ stage: 'hud', selector: '#sceneDimmerToggleBtn' }), measurementState: 'hud', animationPreset: 'soft-pulse' }),
  Object.freeze({ id: 'reader_layouts', scenes: Object.freeze(['marktplatz', 'steingasse', 'liminal_library']), devices: Object.freeze(['mobile', 'desktop']), order: 40, mode: 'ui-clone-group', copy: 'Anzeige wie in einem Buch (nach rechts) oder wie eine Schriftrolle (nach unten)', target: Object.freeze({ stage: 'archive', selector: '[data-loading-tutorial="layout-group"]' }), measurementState: 'archive-settings', previewLayout: 'settings-group', previewContext: 'settings', contextLabel: 'book-icon', animationPreset: 'soft-fade' }),
  Object.freeze({ id: 'volume_controls', scenes: Object.freeze(['marktplatz', 'steingasse', 'liminal_library']), devices: Object.freeze(['mobile', 'desktop']), order: 50, mode: 'ui-clone-group', copy: 'Lautstärken sind in den Einstellungen getrennt regelbar', target: Object.freeze({ stage: 'archive', selector: '[data-loading-tutorial="volume-group"]' }), measurementState: 'archive-settings', previewLayout: 'settings-group', previewContext: 'settings', contextLabel: 'book-icon', animationPreset: 'soft-fade' }),
  Object.freeze({ id: 'save_load', scenes: Object.freeze(['marktplatz', 'steingasse', 'liminal_library']), devices: Object.freeze(['mobile', 'desktop']), order: 60, mode: 'ui-clone-group', copy: 'Spielstand sichern, laden.', target: Object.freeze({ stage: 'archive', selector: '[data-loading-tutorial="save-load-footer"]' }), measurementState: 'archive-kapitel', previewLayout: 'footer', previewContext: 'inhalt', previewTab: 'kapitel', contextLabel: 'book-icon', animationPreset: 'soft-fade' }),
  Object.freeze({ id: 'bookmark_create', scenes: Object.freeze(['marktplatz', 'steingasse', 'liminal_library']), devices: Object.freeze(['mobile', 'desktop']), order: 70, mode: 'press-hold-demo', copy: 'Für Lesezeichen: Textstelle gedrückt halten.', target: null, measurementState: 'demo', animationPreset: 'hold-ring' }),
  Object.freeze({ id: 'lore_progress', scenes: Object.freeze(['marktplatz', 'steingasse', 'liminal_library']), devices: Object.freeze(['mobile', 'desktop']), order: 80, mode: 'ui-clone-single', copy: 'Textfunde werden hier angezeigt und gesammelt.', target: Object.freeze({ stage: 'hud', selector: '#loreProgressHud' }), measurementState: 'hud', animationPreset: 'soft-pulse' }),
  Object.freeze({ id: 'index_drag_camera_mobile', scenes: Object.freeze(['marktplatz', 'steingasse']), devices: Object.freeze(['mobile']), order: 90, mode: 'gesture-demo', copy: 'Ziehen, um Kamera zu bewegen.', target: null, measurementState: 'demo', animationPreset: 'drag-path' }),
  Object.freeze({ id: 'index_pinch_zoom_mobile', scenes: Object.freeze(['marktplatz', 'steingasse']), devices: Object.freeze(['mobile']), order: 100, mode: 'gesture-demo', copy: 'Mit zwei Fingern zoomen.', target: null, measurementState: 'demo', animationPreset: 'pinch' })
]);

export function getLoadingTutorialCards(sceneKey, deviceProfile) {
  return LOADING_TUTORIAL_CARDS
    .filter((card) => card.scenes.includes(sceneKey) && card.devices.includes(deviceProfile))
    .slice()
    .sort((left, right) => (left.order - right.order) || left.id.localeCompare(right.id));
}

export default {
  cards: LOADING_TUTORIAL_CARDS,
  getCards: getLoadingTutorialCards
};
