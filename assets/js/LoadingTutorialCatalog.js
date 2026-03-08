(function initLoadingTutorialCatalog() {
    const cards = [
        {
            id: 'book_menu',
            scenes: ['marktplatz', 'steingasse', 'liminal_library'],
            devices: ['mobile', 'desktop'],
            order: 10,
            mode: 'ui-clone-single',
            copy: {
                title: 'Kapitelmenue',
                body: 'Oeffnen Sie hier Kapitel, Funde, Lesezeichen und Einstellungen.'
            },
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
            copy: {
                title: 'Lesemodus',
                body: 'Wechseln Sie zwischen Spielansicht und Lesemodus.'
            },
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
            copy: {
                title: 'Helligkeit',
                body: 'Tippen Sie mehrfach, um die Szene stufenweise abzudunkeln.'
            },
            target: {
                stage: 'hud',
                selector: '#sceneDimmerToggleBtn'
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
            copy: {
                title: 'Vollbild',
                body: 'Schalten Sie die Ansicht bei Bedarf ins Vollbild.'
            },
            target: {
                stage: 'hud',
                selector: '#fullscreenBtn'
            },
            measurementState: 'hud',
            animationPreset: 'soft-pulse'
        },
        {
            id: 'lore_progress',
            scenes: ['marktplatz', 'steingasse', 'liminal_library'],
            devices: ['mobile', 'desktop'],
            order: 50,
            mode: 'ui-clone-single',
            copy: {
                title: 'Fundanzeige',
                body: 'Diese Anzeige zeigt, wie viele Fundstuecke in diesem Kapitel bereits entdeckt wurden.'
            },
            target: {
                stage: 'hud',
                selector: '#loreProgressHud'
            },
            measurementState: 'hud',
            animationPreset: 'soft-pulse'
        },
        {
            id: 'funde_tab',
            scenes: ['marktplatz', 'steingasse', 'liminal_library'],
            devices: ['mobile', 'desktop'],
            order: 60,
            mode: 'ui-clone-group',
            copy: {
                title: 'Funde',
                body: 'Im Reiter Funde erscheinen zusaetzliche Texte, die Sie in der Welt freischalten.'
            },
            target: {
                stage: 'archive',
                selectors: ['.archive-tabs', '.archive-tab-content[data-tab="lore"]'],
                focusSelector: '[data-loading-tutorial="lore-tab"]'
            },
            measurementState: 'archive-lore',
            animationPreset: 'soft-fade'
        },
        {
            id: 'reader_layouts',
            scenes: ['marktplatz', 'steingasse', 'liminal_library'],
            devices: ['mobile', 'desktop'],
            order: 70,
            mode: 'ui-clone-group',
            copy: {
                title: 'Textansicht',
                body: 'Im Kapitelmenue koennen Sie Texte als Blaettern, mit Zeitmarken oder als Feed lesen.'
            },
            target: {
                stage: 'archive',
                selector: '[data-loading-tutorial="layout-group"]'
            },
            measurementState: 'archive-settings',
            animationPreset: 'soft-fade'
        },
        {
            id: 'bookmark_create',
            scenes: ['marktplatz', 'steingasse', 'liminal_library'],
            devices: ['mobile', 'desktop'],
            order: 80,
            mode: 'press-hold-demo',
            copy: {
                title: 'Lesezeichen setzen',
                body: 'Halten Sie eine Textstelle kurz gedrueckt, um ein Lesezeichen zu setzen.'
            },
            target: null,
            measurementState: 'demo',
            animationPreset: 'hold-ring'
        },
        {
            id: 'bookmark_tab',
            scenes: ['marktplatz', 'steingasse', 'liminal_library'],
            devices: ['mobile', 'desktop'],
            order: 90,
            mode: 'ui-clone-group',
            copy: {
                title: 'Lesezeichenmenue',
                body: 'Im Reiter Lesezeichen springen Sie spaeter direkt zu markierten Stellen.'
            },
            target: {
                stage: 'archive',
                selectors: ['.archive-tabs', '[data-loading-tutorial="bookmark-list-tab"]'],
                focusSelector: '[data-loading-tutorial="bookmark-tab"]'
            },
            measurementState: 'archive-bookmarks',
            animationPreset: 'soft-fade'
        },
        {
            id: 'save_load',
            scenes: ['marktplatz', 'steingasse', 'liminal_library'],
            devices: ['mobile', 'desktop'],
            order: 100,
            mode: 'ui-clone-group',
            copy: {
                title: 'Save und Load',
                body: 'Mit Save exportieren Sie Ihren Spielstand. Mit Load laden Sie ihn wieder ein.'
            },
            target: {
                stage: 'archive',
                selector: '[data-loading-tutorial="save-load-footer"]'
            },
            measurementState: 'archive-kapitel',
            animationPreset: 'soft-fade'
        },
        {
            id: 'volume_controls',
            scenes: ['marktplatz', 'steingasse', 'liminal_library'],
            devices: ['mobile', 'desktop'],
            order: 110,
            mode: 'ui-clone-group',
            copy: {
                title: 'Lautstaerke',
                body: 'Regeln Sie Text und Hintergrund getrennt.'
            },
            target: {
                stage: 'archive',
                selector: '[data-loading-tutorial="volume-group"]'
            },
            measurementState: 'archive-settings',
            animationPreset: 'soft-fade'
        },
        {
            id: 'index_move_tap_click',
            scenes: ['marktplatz', 'steingasse'],
            devices: ['mobile', 'desktop'],
            order: 5,
            mode: 'gesture-demo',
            copy: {
                title: 'Bewegen',
                body: 'Tippen oder klicken Sie auf die Karte, um dorthin zu gehen.'
            },
            target: null,
            measurementState: 'demo',
            animationPreset: 'tap-target'
        },
        {
            id: 'index_drag_camera_mobile',
            scenes: ['marktplatz', 'steingasse'],
            devices: ['mobile'],
            order: 15,
            mode: 'gesture-demo',
            copy: {
                title: 'Kamera verschieben',
                body: 'Ziehen Sie auf der Karte, um den Bildausschnitt zu verschieben.'
            },
            target: null,
            measurementState: 'demo',
            animationPreset: 'drag-path'
        },
        {
            id: 'index_pinch_zoom_mobile',
            scenes: ['marktplatz', 'steingasse'],
            devices: ['mobile'],
            order: 25,
            mode: 'gesture-demo',
            copy: {
                title: 'Zoomen',
                body: 'Ziehen Sie zwei Finger zusammen oder auseinander, um hinein- oder herauszuzoomen.'
            },
            target: null,
            measurementState: 'demo',
            animationPreset: 'pinch'
        },
        {
            id: 'index_collect_lights',
            scenes: ['marktplatz', 'steingasse'],
            devices: ['mobile', 'desktop'],
            order: 55,
            mode: 'collectible-demo',
            copy: {
                title: 'Gelbe Lichter',
                body: 'Gelbe Lichter lassen sich sammeln und schalten neue Funde frei.'
            },
            target: null,
            measurementState: 'demo',
            animationPreset: 'light-to-hud'
        },
        {
            id: 'liminal_swipe_look_mobile',
            scenes: ['liminal_library'],
            devices: ['mobile'],
            order: 5,
            mode: 'gesture-demo',
            copy: {
                title: 'Blick lenken',
                body: 'Wischen Sie ueber den Bildschirm, um den Blick zu lenken.'
            },
            target: null,
            measurementState: 'demo',
            animationPreset: 'swipe-look'
        },
        {
            id: 'liminal_tap_move_mobile',
            scenes: ['liminal_library'],
            devices: ['mobile'],
            order: 15,
            mode: 'gesture-demo',
            copy: {
                title: 'Vorwaerts bewegen',
                body: 'Tippen Sie in den Gang, um sich dorthin zu bewegen.'
            },
            target: null,
            measurementState: 'demo',
            animationPreset: 'tap-forward'
        },
        {
            id: 'liminal_wasd_mouse_desktop',
            scenes: ['liminal_library'],
            devices: ['desktop'],
            order: 10,
            mode: 'gesture-demo',
            copy: {
                title: 'Steuerung',
                body: 'Mit W, A, S, D bewegen Sie sich. Mit der Maus steuern Sie den Blick.'
            },
            target: null,
            measurementState: 'demo',
            animationPreset: 'wasd-mouse'
        },
        {
            id: 'liminal_collect_books',
            scenes: ['liminal_library'],
            devices: ['mobile', 'desktop'],
            order: 55,
            mode: 'collectible-demo',
            copy: {
                title: 'Leuchtende Buecher',
                body: 'Leuchtende Buecher lassen sich einsammeln und schalten neue Funde frei.'
            },
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
