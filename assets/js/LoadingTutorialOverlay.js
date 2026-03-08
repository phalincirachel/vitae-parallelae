(function initLoadingTutorialOverlay() {
    const STORAGE_KEY = 'gb_loading_tutorial_rotation_v1';
    const FONT_STORAGE_KEY = 'gameboy_reader_font_family';
    const MOBILE_BREAKPOINT = 900;
    const FONT_STACKS = {
        grotesk: '"Reader Grotesk", "IBM Plex Sans", "Roboto", "Noto Sans", "Segoe UI", "Franklin Gothic Book", "Gill Sans MT", "Trebuchet MS", system-ui, sans-serif',
        renaissance: '"Reader Renaissance", "EB Garamond", "Noto Serif", "Droid Serif", "Garamond", "Palatino Linotype", "Book Antiqua", Palatino, serif',
        baroque: '"Reader Baroque", "Libre Baskerville", "Noto Serif Display", "Noto Serif", "Baskerville Old Face", Baskerville, "Times New Roman", Times, serif',
        neoclassical: '"Reader Neoclassical", "Bodoni Moda", "Noto Serif", "Bodoni MT", Didot, "Modern No. 20", "Times New Roman", Times, serif'
    };

    const state = {
        options: null,
        loadingScreen: null,
        shell: null,
        measureRoot: null,
        focusLayer: null,
        copyBox: null,
        kickerEl: null,
        titleEl: null,
        bodyEl: null,
        connectorSvg: null,
        connectorPath: null,
        haloEl: null,
        progressEl: null,
        progressLabelEl: null,
        card: null,
        deviceProfile: 'desktop',
        bound: false,
        visible: false,
        resizeHandler: null,
        viewportResizeHandler: null
    };

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function createElement(tagName, className, textContent) {
        const el = document.createElement(tagName);
        if (className) el.className = className;
        if (typeof textContent === 'string') el.textContent = textContent;
        return el;
    }

    function createSvgElement(tagName) {
        return document.createElementNS('http://www.w3.org/2000/svg', tagName);
    }

    function safeReadJson(key, fallbackValue) {
        try {
            const raw = window.localStorage.getItem(key);
            if (!raw) return fallbackValue;
            return JSON.parse(raw);
        } catch (_) {
            return fallbackValue;
        }
    }

    function safeWriteJson(key, value) {
        try {
            window.localStorage.setItem(key, JSON.stringify(value));
        } catch (_) {
            // Ignore localStorage failures.
        }
    }

    function getReaderFontStack() {
        try {
            const fontKey = window.localStorage.getItem(FONT_STORAGE_KEY) || 'grotesk';
            return FONT_STACKS[fontKey] || FONT_STACKS.grotesk;
        } catch (_) {
            return FONT_STACKS.grotesk;
        }
    }

    function detectDeviceProfile() {
        const coarsePointer = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
        const touchPoints = typeof navigator !== 'undefined' ? Number(navigator.maxTouchPoints || 0) : 0;
        if (coarsePointer || touchPoints > 0 || window.innerWidth <= MOBILE_BREAKPOINT) {
            return 'mobile';
        }
        return 'desktop';
    }

    function getRotationState() {
        const fallback = { buckets: {}, lastCardId: '' };
        const value = safeReadJson(STORAGE_KEY, fallback);
        if (!value || typeof value !== 'object') return fallback;
        if (!value.buckets || typeof value.buckets !== 'object') value.buckets = {};
        if (typeof value.lastCardId !== 'string') value.lastCardId = '';
        return value;
    }

    function pickCard(sceneKey, deviceProfile) {
        const catalog = window.LoadingTutorialCatalog;
        if (!catalog || typeof catalog.getCards !== 'function') return null;
        const candidates = catalog.getCards(sceneKey, deviceProfile);
        if (!Array.isArray(candidates) || !candidates.length) return null;

        const rotation = getRotationState();
        const bucketKey = `${sceneKey}::${deviceProfile}`;
        let index = Number(rotation.buckets[bucketKey]);
        if (!Number.isFinite(index) || index < 0) index = 0;
        index = index % candidates.length;

        let chosen = candidates[index];
        let chosenIndex = index;
        if (candidates.length > 1 && rotation.lastCardId === chosen.id) {
            chosenIndex = (chosenIndex + 1) % candidates.length;
            chosen = candidates[chosenIndex];
        }

        rotation.buckets[bucketKey] = (chosenIndex + 1) % candidates.length;
        rotation.lastCardId = chosen.id;
        safeWriteJson(STORAGE_KEY, rotation);
        return chosen;
    }

    function ensureDom() {
        if (!state.loadingScreen) return;
        if (state.shell && state.shell.isConnected) return;

        const shell = createElement('div', 'loading-tutorial-shell');
        const measureRoot = createElement('div', 'loading-tutorial-measure-root');
        const focusLayer = createElement('div', 'loading-tutorial-focus-layer');
        const haloEl = createElement('div', 'loading-tutorial-halo');
        const copyBox = createElement('div', 'loading-tutorial-copy');
        const kickerEl = createElement('div', 'loading-tutorial-kicker');
        const titleEl = createElement('h2', 'loading-tutorial-title');
        const bodyEl = createElement('p', 'loading-tutorial-body');
        const progressEl = createElement('div', 'loading-tutorial-progress');
        const progressLabelEl = createElement('span', 'loading-tutorial-progress-label', 'Kapitel wird geladen');
        const progressTrack = createElement('div', 'loading-tutorial-progress-track');
        const progressBar = createElement('div', 'loading-tutorial-progress-bar');

        const connectorSvg = createSvgElement('svg');
        connectorSvg.setAttribute('class', 'loading-tutorial-connector');
        connectorSvg.setAttribute('viewBox', `0 0 ${Math.max(1, window.innerWidth)} ${Math.max(1, window.innerHeight)}`);
        connectorSvg.setAttribute('preserveAspectRatio', 'none');

        const defs = createSvgElement('defs');
        const marker = createSvgElement('marker');
        marker.setAttribute('id', 'loadingTutorialArrowMarker');
        marker.setAttribute('markerWidth', '10');
        marker.setAttribute('markerHeight', '10');
        marker.setAttribute('refX', '8');
        marker.setAttribute('refY', '3.5');
        marker.setAttribute('orient', 'auto');
        const markerPath = createSvgElement('path');
        markerPath.setAttribute('d', 'M0,0 L8,3.5 L0,7 Z');
        markerPath.setAttribute('fill', 'rgba(239, 236, 229, 0.9)');
        marker.appendChild(markerPath);
        defs.appendChild(marker);
        connectorSvg.appendChild(defs);
        const connectorPath = createSvgElement('path');
        connectorPath.setAttribute('class', 'loading-tutorial-connector-path');
        connectorSvg.appendChild(connectorPath);

        progressTrack.appendChild(progressBar);
        progressEl.appendChild(progressLabelEl);
        progressEl.appendChild(progressTrack);

        copyBox.appendChild(kickerEl);
        copyBox.appendChild(titleEl);
        copyBox.appendChild(bodyEl);

        shell.appendChild(measureRoot);
        shell.appendChild(focusLayer);
        shell.appendChild(connectorSvg);
        shell.appendChild(haloEl);
        shell.appendChild(copyBox);
        shell.appendChild(progressEl);

        state.loadingScreen.appendChild(shell);

        state.shell = shell;
        state.measureRoot = measureRoot;
        state.focusLayer = focusLayer;
        state.copyBox = copyBox;
        state.kickerEl = kickerEl;
        state.titleEl = titleEl;
        state.bodyEl = bodyEl;
        state.connectorSvg = connectorSvg;
        state.connectorPath = connectorPath;
        state.haloEl = haloEl;
        state.progressEl = progressEl;
        state.progressLabelEl = progressLabelEl;
    }

    function bindHandlers() {
        if (state.bound) return;
        state.resizeHandler = function () {
            window.requestAnimationFrame(function () {
                syncLayout('resize');
            });
        };
        window.addEventListener('resize', state.resizeHandler);
        window.addEventListener('orientationchange', state.resizeHandler);
        if (window.visualViewport) {
            state.viewportResizeHandler = function () {
                window.requestAnimationFrame(function () {
                    syncLayout('visual-viewport');
                });
            };
            window.visualViewport.addEventListener('resize', state.viewportResizeHandler);
        }
        state.bound = true;
    }

    function clearLayers() {
        if (state.measureRoot) state.measureRoot.innerHTML = '';
        if (state.focusLayer) state.focusLayer.innerHTML = '';
        if (state.connectorPath) state.connectorPath.setAttribute('d', '');
        if (state.connectorSvg) state.connectorSvg.style.opacity = '0';
        if (state.haloEl) state.haloEl.style.opacity = '0';
    }

    function normalizeRect(rect) {
        if (!rect) return null;
        const width = Number(rect.width || 0);
        const height = Number(rect.height || 0);
        if (width <= 0 || height <= 0) return null;
        return {
            left: Number(rect.left || 0),
            top: Number(rect.top || 0),
            width,
            height,
            right: Number(rect.left || 0) + width,
            bottom: Number(rect.top || 0) + height
        };
    }

    function unionRects(rects) {
        if (!Array.isArray(rects) || !rects.length) return null;
        let left = Number.POSITIVE_INFINITY;
        let top = Number.POSITIVE_INFINITY;
        let right = Number.NEGATIVE_INFINITY;
        let bottom = Number.NEGATIVE_INFINITY;
        rects.forEach((rect) => {
            if (!rect) return;
            left = Math.min(left, rect.left);
            top = Math.min(top, rect.top);
            right = Math.max(right, rect.right);
            bottom = Math.max(bottom, rect.bottom);
        });
        if (!Number.isFinite(left) || !Number.isFinite(top) || !Number.isFinite(right) || !Number.isFinite(bottom)) {
            return null;
        }
        return {
            left,
            top,
            width: Math.max(1, right - left),
            height: Math.max(1, bottom - top),
            right,
            bottom
        };
    }

    function rectIntersects(leftRect, rightRect) {
        if (!leftRect || !rightRect) return false;
        return !(leftRect.right < rightRect.left || leftRect.left > rightRect.right || leftRect.bottom < rightRect.top || leftRect.top > rightRect.bottom);
    }

    function createStageRoot(stageName) {
        const root = createElement('div', `loading-tutorial-stage loading-tutorial-stage--${stageName}`);
        root.setAttribute('aria-hidden', 'true');
        return root;
    }

    function buildHudStage() {
        const root = createStageRoot('hud');
        const audioUi = document.getElementById('audioPlayerUI');
        if (audioUi) {
            const audioClone = audioUi.cloneNode(true);
            audioClone.style.display = 'flex';
            audioClone.style.opacity = '1';
            audioClone.style.visibility = 'visible';
            audioClone.classList.remove('mode-switching', 'reading-render-pending');
            root.appendChild(audioClone);
        }
        const loreHud = document.getElementById('loreProgressHud');
        if (loreHud) {
            const loreClone = loreHud.cloneNode(true);
            loreClone.classList.remove('is-hidden');
            loreClone.classList.add('is-visible');
            loreClone.style.opacity = '1';
            loreClone.style.transform = 'translateY(0) scale(1)';
            root.appendChild(loreClone);
        }
        return root;
    }

    function setArchivePrimaryMode(archiveRoot, mode) {
        const primaryInhaltBtn = archiveRoot.querySelector('#archivePrimaryInhaltBtn');
        const primarySettingsBtn = archiveRoot.querySelector('#archivePrimarySettingsBtn');
        const tabsBar = archiveRoot.querySelector('.archive-tabs');
        const footer = archiveRoot.querySelector('.archive-footer');
        const normalizedMode = mode === 'einstellungen' ? 'einstellungen' : 'inhalt';
        if (primaryInhaltBtn) primaryInhaltBtn.classList.toggle('active', normalizedMode === 'inhalt');
        if (primarySettingsBtn) primarySettingsBtn.classList.toggle('active', normalizedMode === 'einstellungen');
        if (tabsBar) tabsBar.style.display = normalizedMode === 'inhalt' ? '' : 'none';
        if (footer) footer.style.display = normalizedMode === 'inhalt' ? '' : 'none';
    }

    function activateArchiveTab(archiveRoot, tabName) {
        const tabs = Array.from(archiveRoot.querySelectorAll('.archive-tab'));
        const panels = Array.from(archiveRoot.querySelectorAll('.archive-tab-content'));
        tabs.forEach((tab) => {
            tab.classList.toggle('active', tab.getAttribute('data-tab') === tabName);
        });
        panels.forEach((panel) => {
            panel.classList.toggle('active', panel.getAttribute('data-tab') === tabName);
        });
    }

    function createMockMenuItem(title, subtitle) {
        const item = createElement('div', 'menu-item');
        const mainText = createElement('div', 'item-main-text', title);
        const subText = createElement('div', 'item-sub-text', subtitle);
        item.appendChild(mainText);
        item.appendChild(subText);
        return item;
    }

    function ensureArchiveMockContent(archiveRoot, measurementState) {
        if (measurementState === 'archive-lore') {
            const loreList = archiveRoot.querySelector('#loreList');
            if (loreList && !loreList.children.length) {
                loreList.appendChild(createMockMenuItem('Das Fluestern', 'Zusaetzlicher Text aus der Welt'));
            }
        }
        if (measurementState === 'archive-bookmarks') {
            const bookmarkList = archiveRoot.querySelector('#bookmarkList');
            if (bookmarkList && !bookmarkList.children.length) {
                const item = createElement('div', 'menu-item bookmark-item');
                item.appendChild(createElement('div', 'item-main-text', 'Antiquariat Hannrath - 00:34'));
                item.appendChild(createElement('div', 'item-sub-text', 'Markierte Stelle zum schnellen Wiederfinden'));
                const deleteBtn = createElement('button', 'bookmark-delete-btn', 'x');
                item.appendChild(deleteBtn);
                bookmarkList.appendChild(item);
            }
        }
    }

    function buildArchiveStage(measurementState) {
        const source = document.getElementById('archiveModal');
        if (!source) return null;
        const root = createStageRoot('archive');
        const archiveClone = source.cloneNode(true);
        archiveClone.classList.add('visible');
        archiveClone.style.display = 'flex';
        root.appendChild(archiveClone);

        if (measurementState === 'archive-settings') {
            setArchivePrimaryMode(archiveClone, 'einstellungen');
            activateArchiveTab(archiveClone, 'kapitel');
            const panels = Array.from(archiveClone.querySelectorAll('.archive-tab-content'));
            panels.forEach((panel) => {
                panel.classList.toggle('active', panel.getAttribute('data-tab') === 'einstellungen');
            });
        } else {
            setArchivePrimaryMode(archiveClone, 'inhalt');
            if (measurementState === 'archive-lore') {
                activateArchiveTab(archiveClone, 'lore');
            } else if (measurementState === 'archive-bookmarks') {
                activateArchiveTab(archiveClone, 'lesezeichen');
            } else {
                activateArchiveTab(archiveClone, 'kapitel');
            }
        }

        ensureArchiveMockContent(archiveClone, measurementState);
        return root;
    }

    function resolveTargetSelection(stageRoot, targetConfig) {
        if (!stageRoot || !targetConfig) return null;
        const selectors = Array.isArray(targetConfig.selectors)
            ? targetConfig.selectors.slice()
            : (targetConfig.selector ? [targetConfig.selector] : []);
        const nodes = selectors
            .map((selector) => stageRoot.querySelector(selector))
            .filter(Boolean)
            .filter((node) => normalizeRect(node.getBoundingClientRect()));
        if (!nodes.length) return null;
        const rects = nodes.map((node) => normalizeRect(node.getBoundingClientRect())).filter(Boolean);
        const cropRect = unionRects(rects);
        let focusRect = cropRect;
        if (targetConfig.focusSelector) {
            const focusNode = stageRoot.querySelector(targetConfig.focusSelector);
            const measuredFocusRect = focusNode ? normalizeRect(focusNode.getBoundingClientRect()) : null;
            if (measuredFocusRect) focusRect = measuredFocusRect;
        }
        return {
            cropRect,
            focusRect
        };
    }

    function buildStageForCard(card) {
        if (!card || !card.target) return null;
        if (card.target.stage === 'hud') {
            return buildHudStage();
        }
        if (card.target.stage === 'archive') {
            return buildArchiveStage(card.measurementState);
        }
        return null;
    }

    function renderUiCloneCard(card) {
        const stageRoot = buildStageForCard(card);
        if (!stageRoot || !state.measureRoot) return null;
        state.measureRoot.innerHTML = '';
        state.measureRoot.appendChild(stageRoot);
        const selection = resolveTargetSelection(stageRoot, card.target);
        if (!selection || !selection.cropRect) return null;

        const crop = createElement('div', `loading-tutorial-ui-crop ${card.mode === 'ui-clone-group' ? 'loading-tutorial-ui-crop--group' : 'loading-tutorial-ui-crop--single'}`);
        crop.style.left = `${Math.round(selection.cropRect.left)}px`;
        crop.style.top = `${Math.round(selection.cropRect.top)}px`;
        crop.style.width = `${Math.round(selection.cropRect.width)}px`;
        crop.style.height = `${Math.round(selection.cropRect.height)}px`;

        const visibleClone = stageRoot.cloneNode(true);
        visibleClone.classList.add('loading-tutorial-stage-clone');
        visibleClone.style.left = `${Math.round(-selection.cropRect.left)}px`;
        visibleClone.style.top = `${Math.round(-selection.cropRect.top)}px`;
        crop.appendChild(visibleClone);
        state.focusLayer.appendChild(crop);

        return {
            anchorRect: selection.focusRect || selection.cropRect,
            cropRect: selection.cropRect
        };
    }

    function makeDemo() {
        return createElement('div', 'loading-tutorial-demo');
    }

    function makeFrame(extraClass) {
        const frame = createElement('div', `loading-tutorial-demo-frame ${extraClass || ''}`.trim());
        return frame;
    }

    function createTapTargetDemo() {
        const demo = makeDemo();
        demo.classList.add('loading-tutorial-demo--tap-target');
        demo.appendChild(makeFrame('loading-tutorial-demo-frame--map'));
        demo.appendChild(createElement('div', 'loading-tutorial-touch-dot loading-tutorial-touch-dot--origin'));
        demo.appendChild(createElement('div', 'loading-tutorial-target-point'));
        demo.appendChild(createElement('div', 'loading-tutorial-ripple loading-tutorial-ripple--target'));
        demo.appendChild(createElement('div', 'loading-tutorial-arrow loading-tutorial-arrow--move-diagonal'));
        return demo;
    }

    function createDragPathDemo() {
        const demo = makeDemo();
        demo.classList.add('loading-tutorial-demo--drag-path');
        demo.appendChild(makeFrame('loading-tutorial-demo-frame--map'));
        demo.appendChild(createElement('div', 'loading-tutorial-touch-dot loading-tutorial-touch-dot--drag'));
        demo.appendChild(createElement('div', 'loading-tutorial-arrow loading-tutorial-arrow--drag'));
        return demo;
    }

    function createPinchDemo() {
        const demo = makeDemo();
        demo.classList.add('loading-tutorial-demo--pinch');
        demo.appendChild(makeFrame('loading-tutorial-demo-frame--zoom'));
        demo.appendChild(createElement('div', 'loading-tutorial-demo-inner-frame'));
        demo.appendChild(createElement('div', 'loading-tutorial-touch-dot loading-tutorial-touch-dot--pinch-left'));
        demo.appendChild(createElement('div', 'loading-tutorial-touch-dot loading-tutorial-touch-dot--pinch-right'));
        demo.appendChild(createElement('div', 'loading-tutorial-arrow loading-tutorial-arrow--pinch-left'));
        demo.appendChild(createElement('div', 'loading-tutorial-arrow loading-tutorial-arrow--pinch-right'));
        return demo;
    }

    function createSwipeLookDemo() {
        const demo = makeDemo();
        demo.classList.add('loading-tutorial-demo--swipe-look');
        demo.appendChild(makeFrame('loading-tutorial-demo-frame--corridor'));
        demo.appendChild(createElement('div', 'loading-tutorial-touch-dot loading-tutorial-touch-dot--swipe'));
        demo.appendChild(createElement('div', 'loading-tutorial-arrow loading-tutorial-arrow--swipe'));
        return demo;
    }

    function createTapForwardDemo() {
        const demo = makeDemo();
        demo.classList.add('loading-tutorial-demo--tap-forward');
        demo.appendChild(makeFrame('loading-tutorial-demo-frame--corridor'));
        demo.appendChild(createElement('div', 'loading-tutorial-touch-dot loading-tutorial-touch-dot--tap-forward'));
        demo.appendChild(createElement('div', 'loading-tutorial-ripple loading-tutorial-ripple--forward'));
        demo.appendChild(createElement('div', 'loading-tutorial-arrow loading-tutorial-arrow--forward'));
        return demo;
    }

    function createWasdMouseDemo() {
        const demo = makeDemo();
        demo.classList.add('loading-tutorial-demo--wasd-mouse');
        const wasd = createElement('div', 'loading-tutorial-wasd-grid');
        ['W', 'A', 'S', 'D'].forEach((keyLabel, index) => {
            const key = createElement('div', `loading-tutorial-key loading-tutorial-key--${index}`, keyLabel);
            wasd.appendChild(key);
        });
        const mouse = createElement('div', 'loading-tutorial-mouse');
        mouse.appendChild(createElement('div', 'loading-tutorial-mouse-split'));
        mouse.appendChild(createElement('div', 'loading-tutorial-mouse-arc'));
        demo.appendChild(wasd);
        demo.appendChild(mouse);
        return demo;
    }

    function createCollectibleDemo(isBook) {
        const demo = makeDemo();
        demo.classList.add('loading-tutorial-demo--collectible');
        const item = createElement('div', isBook ? 'loading-tutorial-book' : 'loading-tutorial-orb');
        const hud = createElement('div', 'loading-tutorial-hud-chip');
        hud.appendChild(createElement('span', 'loading-tutorial-hud-chip-light'));
        hud.appendChild(createElement('span', 'loading-tutorial-hud-chip-text', '1 / 5'));
        demo.appendChild(item);
        demo.appendChild(createElement('div', 'loading-tutorial-demo-link'));
        demo.appendChild(hud);
        return demo;
    }

    function createHoldDemo() {
        const demo = makeDemo();
        demo.classList.add('loading-tutorial-demo--hold');
        const line = createElement('div', 'loading-tutorial-bookmark-line');
        line.appendChild(createElement('span', 'loading-tutorial-bookmark-time', '00:34'));
        line.appendChild(createElement('span', 'loading-tutorial-bookmark-text', 'Eine markierte Stelle bleibt griffbereit.'));
        demo.appendChild(line);
        demo.appendChild(createElement('div', 'loading-tutorial-hold-ring'));
        demo.appendChild(createElement('div', 'loading-tutorial-bookmark-pill', 'Lesezeichen'));
        return demo;
    }

    function createFallbackDemo(card) {
        const demo = makeDemo();
        demo.classList.add('loading-tutorial-demo--fallback');
        const fallbackLabel = card && card.copy && card.copy.title ? card.copy.title.charAt(0).toUpperCase() : '?';
        demo.appendChild(createElement('div', 'loading-tutorial-fallback-badge', fallbackLabel));
        return demo;
    }

    function appendDemoToFocus(demo) {
        state.focusLayer.appendChild(demo);
        const rect = normalizeRect(demo.getBoundingClientRect());
        return {
            anchorRect: rect,
            cropRect: rect
        };
    }

    function renderGestureDemo(card) {
        let demo = null;
        switch (card.animationPreset) {
            case 'tap-target':
                demo = createTapTargetDemo();
                break;
            case 'drag-path':
                demo = createDragPathDemo();
                break;
            case 'pinch':
                demo = createPinchDemo();
                break;
            case 'swipe-look':
                demo = createSwipeLookDemo();
                break;
            case 'tap-forward':
                demo = createTapForwardDemo();
                break;
            case 'wasd-mouse':
                demo = createWasdMouseDemo();
                break;
            default:
                demo = createFallbackDemo(card);
                break;
        }
        return appendDemoToFocus(demo);
    }

    function renderCollectibleDemo(card) {
        const isBook = card.animationPreset === 'book-to-hud';
        return appendDemoToFocus(createCollectibleDemo(isBook));
    }

    function renderPressHoldDemo() {
        return appendDemoToFocus(createHoldDemo());
    }

    function renderFallbackCard(card) {
        return appendDemoToFocus(createFallbackDemo(card));
    }

    function setCopyContent(card) {
        if (!state.copyBox) return;
        state.loadingScreen.style.setProperty('--loading-tutorial-font', getReaderFontStack());
        state.kickerEl.textContent = state.options && state.options.chapterTitle ? state.options.chapterTitle : 'Kapitel';
        state.titleEl.textContent = card && card.copy ? card.copy.title : 'Hinweis';
        state.bodyEl.textContent = card && card.copy ? card.copy.body : '';
    }

    function positionCopy(anchorRect) {
        const margin = window.innerWidth < 760 ? 18 : 24;
        const gap = window.innerWidth < 760 ? 18 : 28;
        const width = window.innerWidth < 760
            ? Math.min(window.innerWidth - (margin * 2), 348)
            : Math.min(390, Math.max(300, Math.round(window.innerWidth * 0.32)));

        state.copyBox.style.width = `${Math.round(width)}px`;
        state.copyBox.style.maxWidth = `${Math.round(width)}px`;
        state.copyBox.style.left = '-9999px';
        state.copyBox.style.top = '-9999px';
        const height = Math.max(110, Math.ceil(state.copyBox.offsetHeight || 140));

        const anchorMidX = anchorRect.left + (anchorRect.width / 2);
        const anchorMidY = anchorRect.top + (anchorRect.height / 2);
        const maxLeft = window.innerWidth - width - margin;
        const maxTop = window.innerHeight - height - margin;
        const candidateLookup = {
            right: {
                name: 'right',
                left: anchorRect.right + gap,
                top: clamp(anchorMidY - (height / 2), margin, maxTop),
                width,
                height
            },
            left: {
                name: 'left',
                left: anchorRect.left - width - gap,
                top: clamp(anchorMidY - (height / 2), margin, maxTop),
                width,
                height
            },
            bottom: {
                name: 'bottom',
                left: clamp(anchorMidX - (width / 2), margin, maxLeft),
                top: anchorRect.bottom + gap,
                width,
                height
            },
            top: {
                name: 'top',
                left: clamp(anchorMidX - (width / 2), margin, maxLeft),
                top: anchorRect.top - height - gap,
                width,
                height
            }
        };
        const orderedNames = window.innerWidth < 760
            ? ['bottom', 'top', 'right', 'left']
            : ['right', 'left', 'bottom', 'top'];

        let best = null;
        let bestScore = Number.NEGATIVE_INFINITY;
        orderedNames.forEach((name, orderIndex) => {
            const candidate = candidateLookup[name];
            candidate.right = candidate.left + candidate.width;
            candidate.bottom = candidate.top + candidate.height;
            const overflowX = Math.max(0, margin - candidate.left) + Math.max(0, candidate.right - (window.innerWidth - margin));
            const overflowY = Math.max(0, margin - candidate.top) + Math.max(0, candidate.bottom - (window.innerHeight - margin));
            const distance = Math.hypot((candidate.left + (candidate.width / 2)) - anchorMidX, (candidate.top + (candidate.height / 2)) - anchorMidY);
            const score = (orderedNames.length - orderIndex) * 40 - distance - ((overflowX + overflowY) * 60);
            if (score > bestScore) {
                bestScore = score;
                best = candidate;
            }
        });

        best.left = clamp(best.left, margin, maxLeft);
        best.top = clamp(best.top, margin, maxTop);
        best.right = best.left + best.width;
        best.bottom = best.top + best.height;

        state.copyBox.style.left = `${Math.round(best.left)}px`;
        state.copyBox.style.top = `${Math.round(best.top)}px`;

        return best;
    }

    function nearestPointOnRect(rect, point) {
        if (!rect || !point) return { x: 0, y: 0 };
        let x = clamp(point.x, rect.left, rect.right);
        let y = clamp(point.y, rect.top, rect.bottom);
        if (point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom) {
            const distances = [
                { edge: 'left', value: Math.abs(point.x - rect.left) },
                { edge: 'right', value: Math.abs(point.x - rect.right) },
                { edge: 'top', value: Math.abs(point.y - rect.top) },
                { edge: 'bottom', value: Math.abs(point.y - rect.bottom) }
            ].sort((left, right) => left.value - right.value);
            switch (distances[0].edge) {
                case 'left':
                    x = rect.left;
                    y = point.y;
                    break;
                case 'right':
                    x = rect.right;
                    y = point.y;
                    break;
                case 'top':
                    x = point.x;
                    y = rect.top;
                    break;
                default:
                    x = point.x;
                    y = rect.bottom;
                    break;
            }
        }
        return { x, y };
    }

    function drawConnector(copyRect, anchorRect) {
        if (!state.connectorSvg || !state.connectorPath || !copyRect || !anchorRect) return;
        const anchorCenter = {
            x: anchorRect.left + (anchorRect.width / 2),
            y: anchorRect.top + (anchorRect.height / 2)
        };
        const start = nearestPointOnRect(copyRect, anchorCenter);
        const end = nearestPointOnRect(anchorRect, start);
        const deltaX = Math.max(24, Math.abs(end.x - start.x) * 0.38);
        const controlOffset = start.x <= end.x ? deltaX : -deltaX;
        const pathData = `M ${start.x.toFixed(1)} ${start.y.toFixed(1)} C ${(start.x + controlOffset).toFixed(1)} ${start.y.toFixed(1)}, ${(end.x - controlOffset).toFixed(1)} ${end.y.toFixed(1)}, ${end.x.toFixed(1)} ${end.y.toFixed(1)}`;
        state.connectorSvg.setAttribute('viewBox', `0 0 ${Math.max(1, window.innerWidth)} ${Math.max(1, window.innerHeight)}`);
        state.connectorPath.setAttribute('d', pathData);
        state.connectorSvg.style.opacity = '1';
    }

    function positionHalo(cropRect, anchorRect, mode) {
        if (!state.haloEl) return;
        const focusRect = mode === 'ui-clone-group' ? (cropRect || anchorRect) : anchorRect;
        if (!focusRect) {
            state.haloEl.style.opacity = '0';
            return;
        }
        const pad = mode === 'ui-clone-group' ? 12 : 8;
        state.haloEl.style.left = `${Math.round(focusRect.left - pad)}px`;
        state.haloEl.style.top = `${Math.round(focusRect.top - pad)}px`;
        state.haloEl.style.width = `${Math.round(focusRect.width + (pad * 2))}px`;
        state.haloEl.style.height = `${Math.round(focusRect.height + (pad * 2))}px`;
        state.haloEl.style.opacity = '1';
    }

    function positionProgress(anchorRect, copyRect) {
        if (!state.progressEl) return;
        const margin = 16;
        const width = window.innerWidth < 760 ? Math.min(window.innerWidth - (margin * 2), 220) : 248;
        state.progressEl.style.width = `${Math.round(width)}px`;
        state.progressEl.style.left = '-9999px';
        state.progressEl.style.top = '-9999px';
        const height = Math.max(48, Math.ceil(state.progressEl.offsetHeight || 54));

        const preferBottom = anchorRect.top < (window.innerHeight * 0.5);
        let top = preferBottom ? window.innerHeight - height - margin : margin;
        let left = anchorRect.left < (window.innerWidth * 0.5)
            ? window.innerWidth - width - margin
            : margin;

        const proposed = {
            left,
            top,
            right: left + width,
            bottom: top + height
        };
        if (rectIntersects(proposed, copyRect) || rectIntersects(proposed, anchorRect)) {
            top = preferBottom ? margin : window.innerHeight - height - margin;
        }

        left = clamp(left, margin, window.innerWidth - width - margin);
        top = clamp(top, margin, window.innerHeight - height - margin);
        state.progressEl.style.left = `${Math.round(left)}px`;
        state.progressEl.style.top = `${Math.round(top)}px`;
        state.progressEl.classList.toggle('loading-tutorial-progress--top', top < (window.innerHeight * 0.5));
        state.progressEl.classList.toggle('loading-tutorial-progress--bottom', top >= (window.innerHeight * 0.5));
    }

    function renderCurrentCard(reason) {
        if (!state.card || !state.loadingScreen || !state.shell) return;
        clearLayers();
        setCopyContent(state.card);

        let renderResult = null;
        switch (state.card.mode) {
            case 'ui-clone-single':
            case 'ui-clone-group':
                renderResult = renderUiCloneCard(state.card);
                break;
            case 'gesture-demo':
                renderResult = renderGestureDemo(state.card);
                break;
            case 'collectible-demo':
                renderResult = renderCollectibleDemo(state.card);
                break;
            case 'press-hold-demo':
                renderResult = renderPressHoldDemo();
                break;
            default:
                renderResult = renderFallbackCard(state.card);
                break;
        }

        if (!renderResult || !renderResult.anchorRect) {
            renderResult = renderFallbackCard(state.card);
        }
        if (!renderResult || !renderResult.anchorRect) return;

        const anchorRect = normalizeRect(renderResult.anchorRect);
        const copyRect = positionCopy(anchorRect);
        positionHalo(renderResult.cropRect || anchorRect, anchorRect, state.card.mode);
        drawConnector(copyRect, anchorRect);
        positionProgress(anchorRect, copyRect);
        state.loadingScreen.dataset.loadingTutorialCard = state.card.id;
        state.loadingScreen.dataset.loadingTutorialReason = reason || 'render';
    }

    function show() {
        if (!state.shell) return;
        state.shell.classList.remove('is-hidden');
        state.visible = true;
    }

    function hide(reason) {
        if (!state.shell) return;
        state.shell.classList.add('is-hidden');
        state.visible = false;
        if (state.loadingScreen) {
            state.loadingScreen.dataset.loadingTutorialHiddenReason = reason || 'manual';
        }
    }

    function syncLayout(reason) {
        if (!state.visible || !state.card || !state.loadingScreen) return;
        const loadingStyle = window.getComputedStyle(state.loadingScreen);
        if (loadingStyle.display === 'none' || loadingStyle.visibility === 'hidden' || Number(loadingStyle.opacity || '1') < 0.01) {
            return;
        }
        renderCurrentCard(reason || 'layout');
    }

    function init(options) {
        const mergedOptions = Object.assign({
            pageKey: '',
            sceneKey: '',
            chapterTitle: 'Kapitel',
            loadingScreenId: 'loading-screen'
        }, options || {});
        const loadingScreen = document.getElementById(mergedOptions.loadingScreenId);
        if (!loadingScreen) return null;

        state.options = mergedOptions;
        state.loadingScreen = loadingScreen;
        state.deviceProfile = detectDeviceProfile();
        state.card = pickCard(mergedOptions.sceneKey, state.deviceProfile);
        if (!state.card) return null;

        ensureDom();
        bindHandlers();

        state.loadingScreen.classList.add('loading-tutorial-ready');
        state.loadingScreen.style.setProperty('--loading-tutorial-font', getReaderFontStack());
        renderCurrentCard('init');
        show();
        return state.card;
    }

    window.LoadingTutorialOverlay = {
        init,
        show,
        hide,
        syncLayout
    };
})();

