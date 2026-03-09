(function initLoadingTutorialCatalog() {
    const cards = [
        {
            id: 'book_menu',
            scenes: ['marktplatz', 'steingasse', 'liminal_library'],
            devices: ['mobile', 'desktop'],
            order: 10,
            mode: 'ui-clone-single',
            copy: 'Inhaltsverzeichnis und Einstellungen.',
            target: {
                stage: 'hud',
                selector: '#bookBtn'
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
            copy: 'Spielen / Lesen.',
            target: {
                stage: 'hud',
                selector: '#readingModeBtn'
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
            copy: 'Hintergrund und Helligkeit.',
            target: {
                stage: 'hud',
                selector: '#sceneDimmerToggleBtn'
            },
            measurementState: 'hud',
            animationPreset: 'soft-pulse'
        },
        {
            id: 'reader_layouts',
            scenes: ['marktplatz', 'steingasse', 'liminal_library'],
            devices: ['mobile', 'desktop'],
            order: 40,
            mode: 'ui-clone-group',
            copy: 'Blättern oder Schriftrolle.',
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
            id: 'volume_controls',
            scenes: ['marktplatz', 'steingasse', 'liminal_library'],
            devices: ['mobile', 'desktop'],
            order: 50,
            mode: 'ui-clone-group',
            copy: 'Lautstärken sind getrennt regelbar.',
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
            order: 60,
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
            order: 70,
            mode: 'press-hold-demo',
            copy: 'Für Lesezeichen: Textstelle gedrückt halten.',
            target: null,
            measurementState: 'demo',
            animationPreset: 'hold-ring'
        },
        {
            id: 'lore_progress',
            scenes: ['marktplatz', 'steingasse', 'liminal_library'],
            devices: ['mobile', 'desktop'],
            order: 80,
            mode: 'ui-clone-single',
            copy: 'Textfunde werden hier angezeigt und gesammelt.',
            target: {
                stage: 'hud',
                selector: '#loreProgressHud'
            },
            measurementState: 'hud',
            animationPreset: 'soft-pulse'
        },
        {
            id: 'index_drag_camera_mobile',
            scenes: ['marktplatz', 'steingasse'],
            devices: ['mobile'],
            order: 90,
            mode: 'gesture-demo',
            copy: 'Ziehen, um Kamera zu bewegen.',
            target: null,
            measurementState: 'demo',
            animationPreset: 'drag-path'
        },
        {
            id: 'index_pinch_zoom_mobile',
            scenes: ['marktplatz', 'steingasse'],
            devices: ['mobile'],
            order: 100,
            mode: 'gesture-demo',
            copy: 'Mit zwei Fingern zoomen.',
            target: null,
            measurementState: 'demo',
            animationPreset: 'pinch'
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
