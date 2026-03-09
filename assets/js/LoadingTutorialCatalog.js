(function initLoadingTutorialCatalog() {
    const cards = [
        {
            id: 'book_menu',
            scenes: ['marktplatz', 'steingasse', 'liminal_library'],
            devices: ['mobile', 'desktop'],
            order: 10,
            mode: 'ui-clone-single',
            copy: 'Kapitelmenü hier öffnen.',
            target: {
                stage: 'hud',
                selector: '[data-loading-source-id="bookBtn"]'
            },
            measurementState: 'hud',
            animationPreset: 'soft-pulse'
        },
        {
            id: 'mode_toggle',
            scenes: ['marktplatz', 'steingasse', 'liminal_library'],
            devices: ['mobile', 'desktop'],
            order: 20,
            mode: 'ui-clone-single',
            copy: 'Modus hier wechseln.',
            target: {
                stage: 'hud',
                selector: '[data-loading-source-id="readingModeBtn"]'
            },
            measurementState: 'hud',
            animationPreset: 'soft-pulse'
        },
        {
            id: 'scene_dimmer',
            scenes: ['marktplatz', 'steingasse', 'liminal_library'],
            devices: ['mobile', 'desktop'],
            order: 30,
            mode: 'ui-clone-single',
            copy: 'Szene dunkler schalten.',
            target: {
                stage: 'hud',
                selector: '[data-loading-source-id="sceneDimmerToggleBtn"]'
            },
            measurementState: 'hud',
            animationPreset: 'soft-pulse'
        },
        {
            id: 'fullscreen',
            scenes: ['marktplatz', 'steingasse', 'liminal_library'],
            devices: ['mobile', 'desktop'],
            order: 40,
            mode: 'ui-clone-single',
            copy: 'Ansicht ins Vollbild.',
            target: {
                stage: 'hud',
                selector: '[data-loading-source-id="fullscreenBtn"]'
            },
            measurementState: 'hud',
            animationPreset: 'soft-pulse'
        },
        {
            id: 'reader_layouts',
            scenes: ['marktplatz', 'steingasse', 'liminal_library'],
            devices: ['mobile', 'desktop'],
            order: 50,
            mode: 'ui-clone-group',
            copy: 'Texte hier umstellen.',
            target: {
                stage: 'archive',
                selector: '[data-loading-tutorial="layout-group"]'
            },
            measurementState: 'archive-settings',
            previewLayout: 'settings-group',
            previewContext: 'settings',
            contextLabel: 'Kapitelmenü',
            animationPreset: 'soft-fade'
        },
        {
            id: 'funde_tab',
            scenes: ['marktplatz', 'steingasse', 'liminal_library'],
            devices: ['mobile', 'desktop'],
            order: 60,
            mode: 'ui-clone-group',
            copy: 'Funde hier öffnen.',
            target: {
                stage: 'archive',
                selectors: ['[data-loading-tutorial="lore-tab"]', '[data-loading-preview="lore-item"]'],
                focusSelector: '[data-loading-tutorial="lore-tab"]'
            },
            measurementState: 'archive-lore',
            previewLayout: 'tab-item',
            previewContext: 'inhalt',
            previewTab: 'lore',
            contextLabel: 'Kapitelmenü',
            animationPreset: 'soft-fade'
        },
        {
            id: 'bookmark_tab',
            scenes: ['marktplatz', 'steingasse', 'liminal_library'],
            devices: ['mobile', 'desktop'],
            order: 70,
            mode: 'ui-clone-group',
            copy: 'Lesezeichen hier öffnen.',
            target: {
                stage: 'archive',
                selectors: ['[data-loading-tutorial="bookmark-tab"]', '[data-loading-preview="bookmark-item"]'],
                focusSelector: '[data-loading-tutorial="bookmark-tab"]'
            },
            measurementState: 'archive-bookmarks',
            previewLayout: 'tab-item',
            previewContext: 'inhalt',
            previewTab: 'lesezeichen',
            contextLabel: 'Kapitelmenü',
            animationPreset: 'soft-fade'
        },
        {
            id: 'volume_controls',
            scenes: ['marktplatz', 'steingasse', 'liminal_library'],
            devices: ['mobile', 'desktop'],
            order: 80,
            mode: 'ui-clone-group',
            copy: 'Ton getrennt regeln.',
            target: {
                stage: 'archive',
                selector: '[data-loading-tutorial="volume-group"]'
            },
            measurementState: 'archive-settings',
            previewLayout: 'settings-group',
            previewContext: 'settings',
            contextLabel: 'Kapitelmenü',
            animationPreset: 'soft-fade'
        },
        {
            id: 'save_load',
            scenes: ['marktplatz', 'steingasse', 'liminal_library'],
            devices: ['mobile', 'desktop'],
            order: 90,
            mode: 'ui-clone-group',
            copy: 'Spielstand sichern, laden.',
            target: {
                stage: 'archive',
                selector: '[data-loading-tutorial="save-load-footer"]'
            },
            measurementState: 'archive-kapitel',
            previewLayout: 'footer',
            previewContext: 'inhalt',
            previewTab: 'kapitel',
            contextLabel: 'Kapitelmenü',
            animationPreset: 'soft-fade'
        },
        {
            id: 'bookmark_create',
            scenes: ['marktplatz', 'steingasse', 'liminal_library'],
            devices: ['mobile', 'desktop'],
            order: 100,
            mode: 'press-hold-demo',
            copy: 'Textstelle gedrückt halten.',
            target: null,
            measurementState: 'demo',
            animationPreset: 'hold-ring'
        },
        {
            id: 'lore_progress',
            scenes: ['marktplatz', 'steingasse', 'liminal_library'],
            devices: ['mobile', 'desktop'],
            order: 110,
            mode: 'ui-clone-single',
            copy: 'Funde hier verfolgen.',
            target: {
                stage: 'hud',
                selector: '[data-loading-source-id="loreProgressHud"]'
            },
            measurementState: 'hud',
            animationPreset: 'soft-pulse'
        },
        {
            id: 'index_drag_camera_mobile',
            scenes: ['marktplatz', 'steingasse'],
            devices: ['mobile'],
            order: 120,
            mode: 'gesture-demo',
            copy: 'Kamera durch Ziehen.',
            target: null,
            measurementState: 'demo',
            animationPreset: 'drag-path'
        },
        {
            id: 'index_pinch_zoom_mobile',
            scenes: ['marktplatz', 'steingasse'],
            devices: ['mobile'],
            order: 130,
            mode: 'gesture-demo',
            copy: 'Mit zwei Fingern zoomen.',
            target: null,
            measurementState: 'demo',
            animationPreset: 'pinch'
        },
        {
            id: 'index_collect_lights',
            scenes: ['marktplatz', 'steingasse'],
            devices: ['mobile', 'desktop'],
            order: 140,
            mode: 'collectible-demo',
            copy: 'Orbs schalten Funde frei.',
            target: null,
            measurementState: 'demo',
            animationPreset: 'light-to-hud'
        },
        {
            id: 'liminal_swipe_look_mobile',
            scenes: ['liminal_library'],
            devices: ['mobile'],
            order: 120,
            mode: 'gesture-demo',
            copy: 'Blick durch Wischen lenken.',
            target: null,
            measurementState: 'demo',
            animationPreset: 'swipe-look'
        },
        {
            id: 'liminal_wasd_mouse_desktop',
            scenes: ['liminal_library'],
            devices: ['desktop'],
            order: 130,
            mode: 'gesture-demo',
            copy: 'WASD und Maus nutzen.',
            target: null,
            measurementState: 'demo',
            animationPreset: 'wasd-mouse'
        },
        {
            id: 'liminal_collect_books',
            scenes: ['liminal_library'],
            devices: ['mobile', 'desktop'],
            order: 140,
            mode: 'collectible-demo',
            copy: 'Bücher schalten Funde frei.',
            target: null,
            measurementState: 'demo',
            animationPreset: 'book-to-hud'
        }
    ];

    function matchesScene(card, sceneKey) {
        return Array.isArray(card.scenes) && card.scenes.indexOf(sceneKey) >= 0;
    }

    function matchesDevice(card, deviceProfile) {
        return Array.isArray(card.devices) && card.devices.indexOf(deviceProfile) >= 0;
    }

    function getCards(sceneKey, deviceProfile) {
        return cards
            .filter((card) => matchesScene(card, sceneKey) && matchesDevice(card, deviceProfile))
            .sort((left, right) => {
                if (left.order !== right.order) return left.order - right.order;
                return left.id.localeCompare(right.id);
            });
    }

    window.LoadingTutorialCatalog = {
        cards,
        getCards
    };
})();
