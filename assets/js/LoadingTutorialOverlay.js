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
        viewportResizeHandler: null,
        loadingObserver: null
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
        const fallback = { cursor: 0, lastCardId: '' };
        const value = safeReadJson(STORAGE_KEY, fallback);
        if (!value || typeof value !== 'object') return fallback;
        const cursor = Number(value.cursor);
        return {
            cursor: Number.isFinite(cursor) && cursor >= 0 ? cursor : 0,
            lastCardId: typeof value.lastCardId === 'string' ? value.lastCardId : ''
        };
    }

    function sortCards(cards) {
        return (Array.isArray(cards) ? cards.slice() : []).sort(function (left, right) {
            if (left.order !== right.order) return left.order - right.order;
            return left.id.localeCompare(right.id);
        });
    }

    function matchesScene(card, sceneKey) {
        return !!(card && Array.isArray(card.scenes) && card.scenes.indexOf(sceneKey) >= 0);
    }

    function matchesDevice(card, deviceProfile) {
        return !!(card && Array.isArray(card.devices) && card.devices.indexOf(deviceProfile) >= 0);
    }

    function pickCard(sceneKey, deviceProfile) {
        const catalog = window.LoadingTutorialCatalog;
        const allCards = catalog ? sortCards(catalog.cards) : [];
        if (!allCards.length) return null;

        const rotation = getRotationState();
        const startIndex = rotation.cursor % allCards.length;

        function resolveCandidate(avoidLastCard) {
            for (let offset = 0; offset < allCards.length; offset += 1) {
                const index = (startIndex + offset) % allCards.length;
                const card = allCards[index];
                if (!matchesScene(card, sceneKey) || !matchesDevice(card, deviceProfile)) continue;
                if (avoidLastCard && rotation.lastCardId && rotation.lastCardId === card.id) continue;
                return { card, index };
            }
            return null;
        }

        let resolved = resolveCandidate(true);
        if (!resolved) resolved = resolveCandidate(false);
        if (!resolved) return null;

        rotation.cursor = (resolved.index + 1) % allCards.length;
        rotation.lastCardId = resolved.card.id;
        safeWriteJson(STORAGE_KEY, rotation);
        return resolved.card;
    }

    function ensureDom() {
        if (!state.loadingScreen) return;
        if (state.shell && state.shell.isConnected) return;

        const shell = createElement('div', 'loading-tutorial-shell');
        const measureRoot = createElement('div', 'loading-tutorial-measure-root');
        const focusLayer = createElement('div', 'loading-tutorial-focus-layer');
        const haloEl = createElement('div', 'loading-tutorial-halo');
        const copyBox = createElement('div', 'loading-tutorial-copy');
        const bodyEl = createElement('p', 'loading-tutorial-body');
        const progressEl = createElement('div', 'loading-tutorial-progress');
        const progressLabelEl = createElement('span', 'loading-tutorial-progress-label', 'Laden');
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
        state.kickerEl = null;
        state.titleEl = null;
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

    function disconnectLoadingObserver() {
        if (state.loadingObserver) {
            state.loadingObserver.disconnect();
            state.loadingObserver = null;
        }
    }

    function isLoadingScreenVisible() {
        if (!state.loadingScreen || !state.loadingScreen.isConnected) return false;
        const loadingStyle = window.getComputedStyle(state.loadingScreen);
        return !(loadingStyle.display === 'none' || loadingStyle.visibility === 'hidden' || Number(loadingStyle.opacity || '1') < 0.01);
    }

    function bindLoadingObserver() {
        disconnectLoadingObserver();
        if (!state.loadingScreen || typeof MutationObserver === 'undefined') return;
        state.loadingObserver = new MutationObserver(function () {
            if (!isLoadingScreenVisible()) {
                destroy('loading-hidden');
            }
        });
        state.loadingObserver.observe(state.loadingScreen, {
            attributes: true,
            attributeFilter: ['class', 'style']
        });
    }

    function destroy(reason) {
        disconnectLoadingObserver();
        clearLayers();
        if (state.shell && state.shell.isConnected) {
            state.shell.remove();
        }
        state.shell = null;
        state.measureRoot = null;
        state.focusLayer = null;
        state.copyBox = null;
        state.kickerEl = null;
        state.titleEl = null;
        state.bodyEl = null;
        state.connectorSvg = null;
        state.connectorPath = null;
        state.haloEl = null;
        state.progressEl = null;
        state.progressLabelEl = null;
        state.visible = false;
        if (state.loadingScreen) {
            state.loadingScreen.classList.remove('loading-tutorial-ready');
            state.loadingScreen.dataset.loadingTutorialHiddenReason = reason || 'destroyed';
        }
    }

    function sanitizeCloneTree(root) {
        if (!root) return root;
        const nodes = [root].concat(Array.from(root.querySelectorAll('*')));
        nodes.forEach(function (node) {
            if (!(node instanceof Element)) return;
            if (node.id) {
                node.setAttribute('data-loading-source-id', node.id);
                node.removeAttribute('id');
            }
            if (node.hasAttribute('name')) {
                node.setAttribute('data-loading-source-name', node.getAttribute('name') || '');
                node.removeAttribute('name');
            }
            if (node.tagName === 'LABEL' && node.hasAttribute('for')) {
                node.setAttribute('data-loading-source-for', node.getAttribute('for') || '');
                node.removeAttribute('for');
            }
            if (typeof node.matches === 'function' && node.matches('a, button, input, select, textarea')) {
                node.setAttribute('tabindex', '-1');
                node.setAttribute('aria-hidden', 'true');
            }
        });
        root.setAttribute('data-loading-clone', 'true');
        return root;
    }

    function findSanitizedById(root, id) {
        return root ? root.querySelector(`[data-loading-source-id="${id}"]`) : null;
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
            const audioClone = sanitizeCloneTree(audioUi.cloneNode(true));
            audioClone.style.display = 'flex';
            audioClone.style.opacity = '1';
            audioClone.style.visibility = 'visible';
            audioClone.classList.remove('mode-switching', 'reading-render-pending');
            root.appendChild(audioClone);
        }
        const loreHud = document.getElementById('loreProgressHud');
        if (loreHud) {
            const loreClone = sanitizeCloneTree(loreHud.cloneNode(true));
            loreClone.classList.remove('is-hidden');
            loreClone.classList.add('is-visible');
            loreClone.style.opacity = '1';
            loreClone.style.transform = 'translateY(0) scale(1)';
            root.appendChild(loreClone);
        }
        return root;
    }

    function setArchivePrimaryMode(archiveRoot, mode) {
        const primaryInhaltBtn = findSanitizedById(archiveRoot, 'archivePrimaryInhaltBtn');
        const primarySettingsBtn = findSanitizedById(archiveRoot, 'archivePrimarySettingsBtn');
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

    function createMockMenuItem(title, subtitle, previewKey) {
        const item = createElement('div', 'menu-item');
        const mainText = createElement('div', 'item-main-text', title);
        const subText = createElement('div', 'item-sub-text', subtitle);
        if (previewKey) item.setAttribute('data-loading-preview', previewKey);
        item.appendChild(mainText);
        item.appendChild(subText);
        return item;
    }

    function ensureArchiveMockContent(archiveRoot, measurementState) {
        if (measurementState === 'archive-lore') {
            const loreList = findSanitizedById(archiveRoot, 'loreList');
            if (loreList && !loreList.children.length) {
                loreList.appendChild(createMockMenuItem('Zusätzlicher Text', 'Aus den Funden', 'lore-item'));
            }
        }
        if (measurementState === 'archive-bookmarks') {
            const bookmarkList = findSanitizedById(archiveRoot, 'bookmarkList');
            if (bookmarkList && !bookmarkList.children.length) {
                const item = createElement('div', 'menu-item bookmark-item');
                item.setAttribute('data-loading-preview', 'bookmark-item');
                item.appendChild(createElement('div', 'item-main-text', 'Lesezeichen'));
                item.appendChild(createElement('div', 'item-sub-text', '00:34'));
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
        const archiveClone = sanitizeCloneTree(source.cloneNode(true));
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

    function collectTargetNodes(stageRoot, targetConfig) {
        if (!stageRoot || !targetConfig) return null;
        const selectors = Array.isArray(targetConfig.selectors)
            ? targetConfig.selectors.slice()
            : (targetConfig.selector ? [targetConfig.selector] : []);
        const nodes = selectors
            .map((selector) => stageRoot.querySelector(selector))
            .filter(Boolean);
        if (!nodes.length) return null;
        const focusNode = targetConfig.focusSelector ? stageRoot.querySelector(targetConfig.focusSelector) : (nodes[0] || null);
        return {
            nodes,
            focusNode
        };
    }

    function computeHudCropPlacement(cropRect) {
        return {
            left: Math.round(cropRect.left),
            top: Math.round(cropRect.top),
            width: Math.round(cropRect.width),
            height: Math.round(cropRect.height),
            scale: 1
        };
    }

    function mapRectToPlacement(rect, cropRect, placement) {
        if (!rect || !cropRect || !placement) return null;
        return {
            left: placement.left + ((rect.left - cropRect.left) * placement.scale),
            top: placement.top + ((rect.top - cropRect.top) * placement.scale),
            width: rect.width * placement.scale,
            height: rect.height * placement.scale,
            right: placement.left + ((rect.right - cropRect.left) * placement.scale),
            bottom: placement.top + ((rect.bottom - cropRect.top) * placement.scale)
        };
    }

    function buildArchivePreviewNode(card, selection) {
        const preview = createElement('div', `loading-tutorial-archive-preview loading-tutorial-archive-preview--${card.previewLayout || 'group'}`);
        const header = createElement('div', 'loading-tutorial-archive-preview-header', card.contextLabel || 'Kapitelmenü');
        const body = createElement('div', 'loading-tutorial-archive-preview-body');
        preview.appendChild(header);
        preview.appendChild(body);

        const layout = card.previewLayout || 'group';
        if (layout === 'tab-item') {
            const tabRow = createElement('div', 'loading-tutorial-archive-preview-tabrow');
            if (selection.focusNode) {
                tabRow.appendChild(selection.focusNode.cloneNode(true));
            }
            body.appendChild(tabRow);
            selection.nodes
                .filter((node) => node !== selection.focusNode)
                .forEach((node) => {
                    body.appendChild(node.cloneNode(true));
                });
        } else {
            selection.nodes.forEach((node) => {
                body.appendChild(node.cloneNode(true));
            });
        }

        return preview;
    }

    function renderArchivePreviewCard(card) {
        const stageRoot = buildArchiveStage(card.measurementState);
        if (!stageRoot || !state.measureRoot) return null;
        state.measureRoot.innerHTML = '';
        state.measureRoot.appendChild(stageRoot);

        const selection = collectTargetNodes(stageRoot, card.target);
        if (!selection || !selection.nodes.length) return null;

        const preview = buildArchivePreviewNode(card, selection);
        state.focusLayer.appendChild(preview);

        const previewRect = normalizeRect(preview.getBoundingClientRect());
        return {
            anchorRect: previewRect,
            cropRect: previewRect
        };
    }

    function findLiveTargetNodes(targetConfig) {
        if (!targetConfig) return null;
        const selectors = Array.isArray(targetConfig.selectors)
            ? targetConfig.selectors.slice()
            : (targetConfig.selector ? [targetConfig.selector] : []);
        const nodes = selectors
            .map((selector) => document.querySelector(selector))
            .filter(Boolean);
        if (!nodes.length) return null;
        const focusNode = targetConfig.focusSelector ? document.querySelector(targetConfig.focusSelector) : (nodes[0] || null);
        return {
            nodes,
            focusNode
        };
    }

    function prepareCloneForOverlay(node, card) {
        const clone = sanitizeCloneTree(node.cloneNode(true));
        clone.removeAttribute('style');
        clone.hidden = false;
        clone.removeAttribute('hidden');
        clone.classList.remove('is-hidden');
        clone.classList.add('loading-tutorial-overlay-clone');
        if (card && card.id) {
            clone.classList.add(`loading-tutorial-overlay-clone--${String(card.id).replace(/[^a-z0-9_-]+/gi, '-')}`);
            clone.setAttribute('data-loading-tutorial-card', String(card.id));
        }
        clone.style.opacity = '1';
        clone.style.visibility = 'visible';
        clone.style.transform = 'none';
        if (card && card.id === 'lore_progress') {
            clone.classList.add('is-visible');
        }
        clone.querySelectorAll('input[type="file"]').forEach((input) => input.remove());
        return clone;
    }

    function createBookButtonShell(card, extraClassName) {
        const bookButton = document.getElementById('bookBtn');
        const bookImage = bookButton ? bookButton.querySelector('img') : null;
        if (!bookImage) return null;

        const shell = createElement('div', 'audio-btn loading-tutorial-book-button-shell');
        shell.setAttribute('aria-hidden', 'true');
        shell.classList.add('loading-tutorial-overlay-clone');
        if (extraClassName) {
            String(extraClassName).split(/\s+/).filter(Boolean).forEach((className) => shell.classList.add(className));
        }
        if (card && card.id) {
            const safeCardId = String(card.id).replace(/[^a-z0-9_-]+/gi, '-');
            shell.classList.add(`loading-tutorial-overlay-clone--${safeCardId}`);
            shell.setAttribute('data-loading-tutorial-card', String(card.id));
        }

        const imageClone = sanitizeCloneTree(bookImage.cloneNode(true));
        imageClone.removeAttribute('style');
        imageClone.classList.add('loading-tutorial-book-button-image');
        imageClone.style.opacity = '1';
        imageClone.style.visibility = 'visible';
        shell.appendChild(imageClone);
        return shell;
    }

    function createCenteredFocusShell(card) {
        const shell = createElement('div', `loading-tutorial-centered-focus loading-tutorial-centered-focus--${card.mode === 'ui-clone-single' ? 'single' : 'group'}`);
        if (card && card.target && card.target.stage === 'archive') {
            const context = createElement('div', 'loading-tutorial-centered-focus-context');
            const contextButton = createBookButtonShell(null, 'loading-tutorial-context-book-button');
            if (contextButton) {
                context.appendChild(contextButton);
            }
            shell.appendChild(context);
        }
        const content = createElement('div', 'loading-tutorial-centered-focus-content');
        shell.appendChild(content);
        return { shell, content };
    }

    function renderUiCloneCard(card) {
        if (!card || !card.target) return null;
        const selection = findLiveTargetNodes(card.target);
        if (!selection || !selection.nodes.length) return null;

        const { shell, content } = createCenteredFocusShell(card);
        if (card.id === 'book_menu') {
            const bookClone = createBookButtonShell(card);
            if (bookClone) {
                content.appendChild(bookClone);
            }
        } else {
            const nodesToRender = card.mode === 'ui-clone-single'
                ? [selection.focusNode || selection.nodes[0]]
                : selection.nodes;

            nodesToRender.filter(Boolean).forEach((node) => {
                content.appendChild(prepareCloneForOverlay(node, card));
            });
        }

        if (!content.children.length) return null;
        state.focusLayer.appendChild(shell);
        const rect = normalizeRect(shell.getBoundingClientRect());
        return {
            anchorRect: rect,
            cropRect: rect
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
        const focus = createElement('div', 'loading-tutorial-bookmark-focus');
        line.appendChild(createElement('span', 'loading-tutorial-bookmark-time', '00:34'));
        focus.appendChild(createElement('span', 'loading-tutorial-bookmark-text', 'Liebe Edna, die Zeit...'));
        focus.appendChild(createElement('div', 'loading-tutorial-hold-ring'));
        line.appendChild(focus);
        demo.appendChild(line);
        const pill = createElement('div', 'loading-tutorial-bookmark-pill');
        pill.appendChild(createElement('span', 'loading-tutorial-bookmark-pill-label loading-tutorial-bookmark-pill-label--bookmark', 'Lesezeichen'));
        pill.appendChild(createElement('span', 'loading-tutorial-bookmark-pill-label loading-tutorial-bookmark-pill-label--saved', 'Gespeichert'));
        demo.appendChild(pill);
        return demo;
    }

    function createFallbackDemo(card) {
        const demo = makeDemo();
        demo.classList.add('loading-tutorial-demo--fallback');
        const fallbackText = getCardCopyText(card) || '?';
        const fallbackLabel = fallbackText.trim().charAt(0).toUpperCase() || '?';
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

    function getCardCopyText(card) {
        if (!card) return '';
        if (card.copy && typeof card.copy.body === 'string') return card.copy.body;
        return typeof card.copy === 'string' ? card.copy : '';
    }

    function setCopyContent(card) {
        if (!state.copyBox || !state.bodyEl) return;
        state.loadingScreen.style.setProperty('--loading-tutorial-font', getReaderFontStack());
        state.bodyEl.textContent = getCardCopyText(card);
    }

    function positionCopy(anchorRect, card) {
        const margin = window.innerWidth < 760 ? 18 : 24;
        const text = getCardCopyText(card);
        const estimatedWidth = Math.round(clamp(text.length * (window.innerWidth < 760 ? 9.5 : 10.4), window.innerWidth < 760 ? 190 : 220, window.innerWidth < 760 ? 318 : 360));
        const width = Math.min(window.innerWidth - (margin * 2), estimatedWidth);

        state.copyBox.style.width = `${Math.round(width)}px`;
        state.copyBox.style.maxWidth = `${Math.round(width)}px`;
        state.copyBox.style.left = '-9999px';
        state.copyBox.style.top = '-9999px';
        const height = Math.max(46, Math.ceil(state.copyBox.offsetHeight || 56));

        const anchorMidX = anchorRect ? anchorRect.left + (anchorRect.width / 2) : (window.innerWidth / 2);
        const maxLeft = Math.max(margin, window.innerWidth - width - margin);
        const left = Math.round(clamp(anchorMidX - (width / 2), margin, maxLeft));
        const isCloneCard = !!(card && (card.mode === 'ui-clone-single' || card.mode === 'ui-clone-group'));
        const gap = card && card.mode === 'ui-clone-single' ? 18 : 14;
        const bottomLimit = window.innerHeight - height - 86;
        let top = isCloneCard && anchorRect
            ? anchorRect.top - height - gap
            : (anchorRect ? anchorRect.bottom + gap : margin + 20);

        if (top < margin) {
            top = anchorRect ? anchorRect.bottom + gap : margin + 20;
        }
        if (top > bottomLimit) {
            top = bottomLimit;
        }
        top = clamp(top, margin, bottomLimit);

        const rect = {
            left,
            top: Math.round(top),
            width,
            height
        };
        rect.right = rect.left + rect.width;
        rect.bottom = rect.top + rect.height;

        state.copyBox.style.left = `${rect.left}px`;
        state.copyBox.style.top = `${rect.top}px`;
        state.copyBox.dataset.loadingTutorialPlacement = rect.top > (window.innerHeight * 0.5) ? 'bottom' : 'top';
        state.copyBox.dataset.loadingTutorialMode = card ? card.mode : 'demo';
        return rect;
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
            ].sort((leftSide, rightSide) => leftSide.value - rightSide.value);
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
        const routeDistance = Math.abs(end.x - start.x) + Math.abs(end.y - start.y);
        if (routeDistance < 64) {
            state.connectorPath.setAttribute('d', '');
            state.connectorSvg.style.opacity = '0';
            return;
        }
        const travellingDown = end.y >= start.y;
        const elbowY = travellingDown
            ? start.y + Math.max(18, (end.y - start.y) * 0.55)
            : start.y - Math.max(18, (start.y - end.y) * 0.55);
        const pathData = [
            `M ${start.x.toFixed(1)} ${start.y.toFixed(1)}`,
            `L ${start.x.toFixed(1)} ${elbowY.toFixed(1)}`,
            `L ${end.x.toFixed(1)} ${elbowY.toFixed(1)}`,
            `L ${end.x.toFixed(1)} ${end.y.toFixed(1)}`
        ].join(' ');
        state.connectorSvg.setAttribute('viewBox', `0 0 ${Math.max(1, window.innerWidth)} ${Math.max(1, window.innerHeight)}`);
        state.connectorPath.setAttribute('d', pathData);
        state.connectorSvg.style.opacity = '1';
    }

    function positionHalo(cropRect, anchorRect, mode) {
        if (!state.haloEl) return;
        state.haloEl.style.opacity = '0';
    }

    function positionProgress(anchorRect, copyRect) {
        if (!state.progressEl) return;
        const margin = 18;
        const width = window.innerWidth < 760 ? Math.min(window.innerWidth - (margin * 2), 228) : 248;
        state.progressEl.style.width = `${Math.round(width)}px`;
        const left = Math.round((window.innerWidth - width) / 2);
        const height = Math.max(42, Math.ceil(state.progressEl.offsetHeight || 46));
        const bottomCandidate = {
            left,
            top: Math.round(window.innerHeight - height - margin),
            right: left + width,
            bottom: Math.round(window.innerHeight - margin)
        };
        const topCandidate = {
            left,
            top: margin,
            right: left + width,
            bottom: margin + height
        };

        let chosen = bottomCandidate;
        if (rectIntersects(bottomCandidate, copyRect) || rectIntersects(bottomCandidate, anchorRect)) {
            chosen = topCandidate;
        }
        if (rectIntersects(chosen, copyRect) || rectIntersects(chosen, anchorRect)) {
            chosen = chosen === topCandidate ? bottomCandidate : topCandidate;
        }

        state.progressEl.style.left = `${Math.round(chosen.left)}px`;
        state.progressEl.style.top = `${Math.round(chosen.top)}px`;
        state.progressEl.classList.toggle('loading-tutorial-progress--top', chosen === topCandidate);
        state.progressEl.classList.toggle('loading-tutorial-progress--bottom', chosen !== topCandidate);
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
        const copyRect = positionCopy(anchorRect, state.card);
        positionHalo(renderResult.cropRect || anchorRect, anchorRect, state.card.mode);
        if (state.connectorSvg) {
            state.connectorSvg.style.opacity = '0';
            state.connectorPath.setAttribute('d', '');
        }
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
        destroy(reason || 'manual');
    }

    function syncLayout(reason) {
        if (!state.visible || !state.card || !state.loadingScreen || !state.shell) return;
        if (!isLoadingScreenVisible()) {
            destroy('loading-hidden');
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

        if (state.shell && state.shell.isConnected) {
            destroy('reinit');
        }

        state.options = mergedOptions;
        state.loadingScreen = loadingScreen;
        state.deviceProfile = detectDeviceProfile();
        state.card = pickCard(mergedOptions.sceneKey, state.deviceProfile);
        if (!state.card) return null;

        ensureDom();
        bindHandlers();
        bindLoadingObserver();

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





