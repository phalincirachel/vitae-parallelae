/**
 * Adaptive subtitle readability cloud.
 * Adds a soft, dark "cloud" behind bright-background subtitle lines in reading mode.
 */
(function initAdaptiveSubtitleCloud() {
    const CLOUD_CLASS = 'adaptive-readability-cloud';
    const STYLE_KEYS = ['--adaptive-cloud-alpha', '--adaptive-cloud-blur', '--adaptive-cloud-scale'];

    function clamp(value, min, max) {
        const num = Number(value);
        if (!Number.isFinite(num)) return min;
        return Math.max(min, Math.min(max, num));
    }

    function remap01(value, from, to) {
        if (!(to > from)) return 0;
        return clamp((value - from) / (to - from), 0, 1);
    }

    function lumaFromRgb(r, g, b) {
        return ((0.2126 * r) + (0.7152 * g) + (0.0722 * b)) / 255;
    }

    function parseCssColorLuma(colorText) {
        const fallback = { luma: 1, alpha: 1 };
        if (!colorText || typeof colorText !== 'string') return fallback;
        const match = colorText.match(/rgba?\(([^)]+)\)/i);
        if (!match) return fallback;
        const parts = match[1].split(',').map((p) => parseFloat(p.trim()));
        if (!Number.isFinite(parts[0]) || !Number.isFinite(parts[1]) || !Number.isFinite(parts[2])) {
            return fallback;
        }
        const alpha = Number.isFinite(parts[3]) ? clamp(parts[3], 0, 1) : 1;
        return {
            luma: lumaFromRgb(parts[0], parts[1], parts[2]),
            alpha
        };
    }

    function intersects(a, b, margin = 0) {
        if (!a || !b) return false;
        return !(
            a.right < (b.left - margin)
            || a.left > (b.right + margin)
            || a.bottom < (b.top - margin)
            || a.top > (b.bottom + margin)
        );
    }

    function elementIsVisible(el) {
        if (!el) return false;
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        return el.getClientRects().length > 0;
    }

    function createController(options = {}) {
        const subtitleContainer = options.subtitleContainer || document.getElementById('subtitleContainer');
        if (!subtitleContainer) return null;

        const audioUi = options.audioUi || document.getElementById('audioPlayerUI');
        const dimmerButton = options.dimmerButton || document.getElementById('sceneDimmerToggleBtn');
        const sceneOverlay = options.sceneOverlay || document.getElementById('sceneDimmerOverlay');

        const config = {
            activeIntervalMs: Math.max(80, Number(options.activeIntervalMs) || 140),
            inactiveIntervalMs: Math.max(300, Number(options.inactiveIntervalMs) || 900),
            maxVisibleLines: Math.max(8, Number(options.maxVisibleLines) || 42),
            sampleScale: clamp(Number(options.sampleScale) || 0.34, 0.16, 1),
            thresholdLuma: clamp(Number(options.thresholdLuma) || 0.72, 0.5, 0.95),
            fullLuma: clamp(Number(options.fullLuma) || 0.94, 0.6, 1),
            minAlpha: clamp(Number(options.minAlpha) || 0.05, 0, 1),
            maxAlpha: clamp(Number(options.maxAlpha) || 0.72, 0, 1)
        };

        const state = {
            running: false,
            rafId: 0,
            lastUpdateTs: 0,
            activeLines: new Set(),
            sampleCanvas: null,
            sampleCtx: null,
            mutationObserver: null,
            modeObserver: null,
            dimmerUnsubscribe: null,
            onScroll: null,
            onResize: null,
            onVisibility: null,
            onDimmerClick: null
        };

        function resolveSceneCanvas() {
            const renderer = window.renderer;
            if (renderer && renderer.domElement instanceof HTMLCanvasElement) return renderer.domElement;
            const gameCanvas = document.getElementById('gameCanvas');
            if (gameCanvas instanceof HTMLCanvasElement) return gameCanvas;
            const anyCanvas = document.querySelector('canvas');
            return anyCanvas instanceof HTMLCanvasElement ? anyCanvas : null;
        }

        function isBrightestMode() {
            const dimState = dimmerButton && dimmerButton.dataset ? dimmerButton.dataset.dimState : '';
            if (dimState) return dimState === 'off';

            if (sceneOverlay) {
                const opacity = parseFloat(window.getComputedStyle(sceneOverlay).opacity || '0');
                return !(Number.isFinite(opacity) && opacity > 0.02);
            }
            return true;
        }

        function isReadingMode() {
            return !!(audioUi && audioUi.classList.contains('reading-mode'));
        }

        function isActiveMode() {
            if (!isReadingMode()) return false;
            if (!elementIsVisible(subtitleContainer)) return false;
            if (document.body && document.body.classList.contains('scene-dimmer-light-mode')) return false;
            return isBrightestMode();
        }

        function ensureSampleCanvas(width, height) {
            if (!(width > 0 && height > 0)) return false;

            if (!state.sampleCanvas) {
                state.sampleCanvas = document.createElement('canvas');
                state.sampleCtx = state.sampleCanvas.getContext('2d', { willReadFrequently: true });
            }
            if (!state.sampleCtx) return false;

            if (state.sampleCanvas.width !== width || state.sampleCanvas.height !== height) {
                state.sampleCanvas.width = width;
                state.sampleCanvas.height = height;
            }
            return true;
        }

        function captureSceneFrame(sceneCanvas, sceneRect) {
            if (!sceneCanvas || !sceneRect || !sceneRect.width || !sceneRect.height) return null;
            const sampleWidth = Math.max(16, Math.round(sceneRect.width * config.sampleScale));
            const sampleHeight = Math.max(16, Math.round(sceneRect.height * config.sampleScale));
            if (!ensureSampleCanvas(sampleWidth, sampleHeight)) return null;

            try {
                state.sampleCtx.clearRect(0, 0, sampleWidth, sampleHeight);
                state.sampleCtx.drawImage(
                    sceneCanvas,
                    0,
                    0,
                    sceneCanvas.width || 1,
                    sceneCanvas.height || 1,
                    0,
                    0,
                    sampleWidth,
                    sampleHeight
                );
                const imageData = state.sampleCtx.getImageData(0, 0, sampleWidth, sampleHeight);
                return {
                    width: sampleWidth,
                    height: sampleHeight,
                    data: imageData.data
                };
            } catch (_) {
                return null;
            }
        }

        function sampleLuma(frame, sceneRect, viewportX, viewportY) {
            if (!frame || !sceneRect) return 0;
            const relX = (viewportX - sceneRect.left) / sceneRect.width;
            const relY = (viewportY - sceneRect.top) / sceneRect.height;
            if (relX < 0 || relX > 1 || relY < 0 || relY > 1) return 0;

            const x = clamp(Math.round(relX * (frame.width - 1)), 0, frame.width - 1);
            const y = clamp(Math.round(relY * (frame.height - 1)), 0, frame.height - 1);
            const idx = ((y * frame.width) + x) * 4;
            return lumaFromRgb(frame.data[idx], frame.data[idx + 1], frame.data[idx + 2]);
        }

        function getLineTextRects(lineEl, containerRect) {
            const rects = [];
            if (!lineEl) return rects;

            const walker = document.createTreeWalker(
                lineEl,
                NodeFilter.SHOW_TEXT,
                {
                    acceptNode(node) {
                        if (!(node.nodeValue || '').trim()) return NodeFilter.FILTER_REJECT;
                        const parent = node.parentElement;
                        if (!parent) return NodeFilter.FILTER_REJECT;
                        if (parent.closest && parent.closest('.bookmark-btn')) return NodeFilter.FILTER_REJECT;
                        return NodeFilter.FILTER_ACCEPT;
                    }
                }
            );

            while (walker.nextNode()) {
                const textNode = walker.currentNode;
                const range = document.createRange();
                range.selectNodeContents(textNode);
                const nodeRects = range.getClientRects();
                for (let i = 0; i < nodeRects.length; i++) {
                    const rect = nodeRects[i];
                    if (rect.width <= 0 || rect.height <= 0) continue;
                    if (!intersects(rect, containerRect, 18)) continue;
                    rects.push(rect);
                }
            }

            if (!rects.length) {
                const fallback = lineEl.getBoundingClientRect();
                if (fallback.width > 0 && fallback.height > 0 && intersects(fallback, containerRect, 18)) {
                    rects.push(fallback);
                }
            }
            return rects;
        }

        function sampleRectMaxLuma(frame, sceneRect, rects) {
            let maxLuma = 0;
            const points = [
                [0.5, 0.5],
                [0.2, 0.5],
                [0.8, 0.5],
                [0.5, 0.2],
                [0.5, 0.8]
            ];

            for (let i = 0; i < rects.length; i++) {
                const rect = rects[i];
                const width = Math.max(1, rect.width);
                const height = Math.max(1, rect.height);
                for (let p = 0; p < points.length; p++) {
                    const fx = points[p][0];
                    const fy = points[p][1];
                    const x = rect.left + (width * fx);
                    const y = rect.top + (height * fy);
                    const luma = sampleLuma(frame, sceneRect, x, y);
                    if (luma > maxLuma) maxLuma = luma;
                }
            }
            return maxLuma;
        }

        function computeCloudAlpha(sceneLuma, textLuma, textAlpha) {
            const lightTextFactor = remap01(textLuma, 0.58, 0.92) * clamp(textAlpha, 0, 1);
            if (lightTextFactor <= 0) return 0;
            const sceneFactor = remap01(sceneLuma, config.thresholdLuma, config.fullLuma);
            return clamp(sceneFactor * lightTextFactor * config.maxAlpha, 0, config.maxAlpha);
        }

        function clearCloud(lineEl) {
            if (!lineEl) return;
            lineEl.classList.remove(CLOUD_CLASS);
            STYLE_KEYS.forEach((key) => lineEl.style.removeProperty(key));
        }

        function applyCloud(lineEl, alpha) {
            const a = clamp(alpha, 0, config.maxAlpha);
            if (a < config.minAlpha) {
                clearCloud(lineEl);
                return false;
            }

            const t = clamp(a / Math.max(0.001, config.maxAlpha), 0, 1);
            const blur = 7 + (14 * t);
            const scale = 1 + (0.18 * t);

            lineEl.classList.add(CLOUD_CLASS);
            lineEl.style.setProperty('--adaptive-cloud-alpha', a.toFixed(3));
            lineEl.style.setProperty('--adaptive-cloud-blur', `${blur.toFixed(2)}px`);
            lineEl.style.setProperty('--adaptive-cloud-scale', scale.toFixed(3));
            return true;
        }

        function clearAllClouds() {
            state.activeLines.forEach((lineEl) => {
                if (lineEl && lineEl.isConnected) clearCloud(lineEl);
            });
            state.activeLines.clear();
            subtitleContainer.querySelectorAll(`.subtitle-line.${CLOUD_CLASS}`).forEach((lineEl) => clearCloud(lineEl));
        }

        function collectVisibleLines(sceneRect) {
            const lines = subtitleContainer.querySelectorAll('.subtitle-line');
            if (!lines.length) return [];

            const containerRect = subtitleContainer.getBoundingClientRect();
            const visible = [];

            for (let i = 0; i < lines.length; i++) {
                if (visible.length >= config.maxVisibleLines) break;
                const lineEl = lines[i];
                if (!lineEl || !lineEl.isConnected) continue;
                const lineRect = lineEl.getBoundingClientRect();
                if (lineRect.width <= 0 || lineRect.height <= 0) continue;
                if (!intersects(lineRect, containerRect, 18)) continue;
                if (!intersects(lineRect, sceneRect, 18)) continue;

                const rects = getLineTextRects(lineEl, containerRect).filter((rect) => intersects(rect, sceneRect, 10));
                if (!rects.length) continue;
                visible.push({ lineEl, rects });
            }

            return visible;
        }

        function renderClouds() {
            if (!isActiveMode()) {
                clearAllClouds();
                return;
            }

            const sceneCanvas = resolveSceneCanvas();
            if (!(sceneCanvas instanceof HTMLCanvasElement)) {
                clearAllClouds();
                return;
            }

            const sceneRect = sceneCanvas.getBoundingClientRect();
            if (!sceneRect.width || !sceneRect.height) {
                clearAllClouds();
                return;
            }

            const frame = captureSceneFrame(sceneCanvas, sceneRect);
            if (!frame) {
                clearAllClouds();
                return;
            }

            const nextActive = new Set();
            const visibleLines = collectVisibleLines(sceneRect);

            for (let i = 0; i < visibleLines.length; i++) {
                const { lineEl, rects } = visibleLines[i];
                const colorInfo = parseCssColorLuma(window.getComputedStyle(lineEl).color);
                const sceneLuma = sampleRectMaxLuma(frame, sceneRect, rects);
                const alpha = computeCloudAlpha(sceneLuma, colorInfo.luma, colorInfo.alpha);
                const isActive = applyCloud(lineEl, alpha);
                if (isActive) nextActive.add(lineEl);
            }

            state.activeLines.forEach((lineEl) => {
                if (!nextActive.has(lineEl)) clearCloud(lineEl);
            });
            state.activeLines = nextActive;
        }

        function schedule() {
            state.lastUpdateTs = 0;
        }

        function desiredIntervalMs() {
            return isActiveMode() ? config.activeIntervalMs : config.inactiveIntervalMs;
        }

        function tick(ts) {
            if (!state.running) return;
            const interval = desiredIntervalMs();
            if (!state.lastUpdateTs || (ts - state.lastUpdateTs) >= interval) {
                state.lastUpdateTs = ts;
                renderClouds();
            }
            state.rafId = window.requestAnimationFrame(tick);
        }

        function bind() {
            state.onScroll = () => schedule();
            state.onResize = () => schedule();
            state.onVisibility = () => schedule();
            state.onDimmerClick = () => schedule();

            subtitleContainer.addEventListener('scroll', state.onScroll, { passive: true });
            window.addEventListener('resize', state.onResize);
            window.addEventListener('orientationchange', state.onResize);
            document.addEventListener('visibilitychange', state.onVisibility);
            if (dimmerButton) dimmerButton.addEventListener('click', state.onDimmerClick);

            state.mutationObserver = new MutationObserver(() => schedule());
            state.mutationObserver.observe(subtitleContainer, { childList: true, subtree: true });

            state.modeObserver = new MutationObserver(() => schedule());
            if (audioUi) {
                state.modeObserver.observe(audioUi, { attributes: true, attributeFilter: ['class'] });
            }
            if (dimmerButton) {
                state.modeObserver.observe(dimmerButton, { attributes: true, attributeFilter: ['data-dim-state'] });
            }

            if (window.GlobalVisualDimmer && typeof window.GlobalVisualDimmer.onChange === 'function') {
                state.dimmerUnsubscribe = window.GlobalVisualDimmer.onChange(() => schedule());
            }
        }

        function unbind() {
            subtitleContainer.removeEventListener('scroll', state.onScroll);
            window.removeEventListener('resize', state.onResize);
            window.removeEventListener('orientationchange', state.onResize);
            document.removeEventListener('visibilitychange', state.onVisibility);
            if (dimmerButton) dimmerButton.removeEventListener('click', state.onDimmerClick);

            if (state.mutationObserver) {
                state.mutationObserver.disconnect();
                state.mutationObserver = null;
            }
            if (state.modeObserver) {
                state.modeObserver.disconnect();
                state.modeObserver = null;
            }
            if (typeof state.dimmerUnsubscribe === 'function') {
                state.dimmerUnsubscribe();
                state.dimmerUnsubscribe = null;
            }
        }

        function start() {
            if (state.running) return;
            state.running = true;
            schedule();
            state.rafId = window.requestAnimationFrame(tick);
        }

        function stop() {
            state.running = false;
            if (state.rafId) {
                window.cancelAnimationFrame(state.rafId);
                state.rafId = 0;
            }
            clearAllClouds();
        }

        function destroy() {
            stop();
            unbind();
        }

        bind();

        return {
            start,
            stop,
            destroy,
            schedule,
            update: renderClouds
        };
    }

    let defaultController = null;

    function autoInit() {
        if (defaultController) return;
        const subtitleContainer = document.getElementById('subtitleContainer');
        if (!subtitleContainer) return;
        defaultController = createController({ subtitleContainer });
        if (defaultController) defaultController.start();
    }

    window.AdaptiveSubtitleCloud = {
        init(options = {}) {
            const controller = createController(options);
            if (controller) controller.start();
            return controller;
        },
        getDefaultController() {
            return defaultController;
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', autoInit, { once: true });
    } else {
        autoInit();
    }
})();
