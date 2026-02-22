/**
 * Adaptive subtitle readability cloud.
 * Adds a soft, dark cloud behind bright-background subtitle lines in reading mode.
 *
 * Strategy:
 * - Sample background brightness from the scene canvas.
 * - Compute cloud intensity per horizontal band (not per word/letter).
 * - Apply temporal smoothing and hysteresis to avoid flicker.
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

    function createRect(left, top, right, bottom) {
        return {
            left,
            top,
            right,
            bottom,
            width: Math.max(0, right - left),
            height: Math.max(0, bottom - top)
        };
    }

    function createController(options = {}) {
        const subtitleContainer = options.subtitleContainer || document.getElementById('subtitleContainer');
        if (!subtitleContainer) return null;

        const audioUi = options.audioUi || document.getElementById('audioPlayerUI');
        const dimmerButton = options.dimmerButton || document.getElementById('sceneDimmerToggleBtn');
        const sceneOverlay = options.sceneOverlay || document.getElementById('sceneDimmerOverlay');

        const config = {
            activeIntervalMs: Math.max(180, Number(options.activeIntervalMs) || 260),
            inactiveIntervalMs: Math.max(600, Number(options.inactiveIntervalMs) || 1400),
            eventLatencyMs: Math.max(0, Number(options.eventLatencyMs) || 140),
            eventMinIntervalMs: Math.max(120, Number(options.eventMinIntervalMs) || 200),
            maxVisibleLines: Math.max(10, Number(options.maxVisibleLines) || 48),

            sampleScale: clamp(Number(options.sampleScale) || 0.34, 0.16, 1),
            thresholdLuma: clamp(Number(options.thresholdLuma) || 0.66, 0.5, 0.95),
            fullLuma: clamp(Number(options.fullLuma) || 0.89, 0.6, 1),
            minAlpha: clamp(Number(options.minAlpha) || 0.03, 0, 1),
            maxAlpha: clamp(Number(options.maxAlpha) || 0.78, 0, 1),

            minBands: Math.max(3, Number(options.minBands) || 4),
            maxBands: Math.max(4, Number(options.maxBands) || 7),
            bandVerticalPaddingPx: Math.max(0, Number(options.bandVerticalPaddingPx) || 22),
            bandHorizontalInsetPx: Math.max(0, Number(options.bandHorizontalInsetPx) || 32),

            alphaRiseSmoothing: clamp(Number(options.alphaRiseSmoothing) || 0.28, 0.05, 1),
            alphaFallSmoothing: clamp(Number(options.alphaFallSmoothing) || 0.14, 0.05, 1),
            activationAlpha: clamp(Number(options.activationAlpha) || 0.065, 0, 1),
            deactivationAlpha: clamp(Number(options.deactivationAlpha) || 0.04, 0, 1),
            alphaQuantStep: clamp(Number(options.alphaQuantStep) || 0.015, 0.001, 0.25),

            lumaRiseSmoothing: clamp(Number(options.lumaRiseSmoothing) || 0.34, 0.03, 1),
            lumaFallSmoothing: clamp(Number(options.lumaFallSmoothing) || 0.16, 0.03, 1),
            alphaDeadband: clamp(Number(options.alphaDeadband) || 0.018, 0.001, 0.2),
            brightenDelayMs: Math.max(0, Number(options.brightenDelayMs) || 320),
            darkenDelayMs: Math.max(0, Number(options.darkenDelayMs) || 780),
            minDisplayHoldMs: Math.max(0, Number(options.minDisplayHoldMs) || 360)
        };

        if (config.deactivationAlpha > config.activationAlpha) {
            config.deactivationAlpha = Math.max(0, config.activationAlpha * 0.7);
        }

        const state = {
            running: false,
            rafId: 0,
            lastUpdateTs: 0,
            forceUpdateAtTs: 0,
            activeLines: new Set(),
            bandAlphaMap: new Map(),
            bandMetaMap: new Map(),

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

        function sampleAreaLuma(frame, sceneRect, areaRect) {
            if (!frame || !sceneRect || !areaRect || areaRect.width <= 0 || areaRect.height <= 0) return 0;

            const cols = 6;
            const rows = 4;
            let sum = 0;
            let maxLuma = 0;
            let count = 0;

            for (let yi = 0; yi < rows; yi++) {
                const y = areaRect.top + (((yi + 0.5) / rows) * areaRect.height);
                for (let xi = 0; xi < cols; xi++) {
                    const x = areaRect.left + (((xi + 0.5) / cols) * areaRect.width);
                    const luma = sampleLuma(frame, sceneRect, x, y);
                    sum += luma;
                    if (luma > maxLuma) maxLuma = luma;
                    count += 1;
                }
            }

            if (!count) return 0;
            const avg = sum / count;
            return (avg * 0.72) + (maxLuma * 0.28);
        }

        function computeCloudAlpha(sceneLuma, textLuma, textAlpha) {
            const lightTextFactor = remap01(textLuma, 0.58, 0.92) * clamp(textAlpha, 0, 1);
            if (lightTextFactor <= 0) return 0;
            const sceneFactor = remap01(sceneLuma, config.thresholdLuma, config.fullLuma);
            return clamp(sceneFactor * lightTextFactor * config.maxAlpha, 0, config.maxAlpha);
        }

        function quantizeAlpha(alpha) {
            const clamped = clamp(alpha, 0, config.maxAlpha);
            return Math.round(clamped / config.alphaQuantStep) * config.alphaQuantStep;
        }

        function getBandMeta(bandKey) {
            let meta = state.bandMetaMap.get(bandKey);
            if (meta) return meta;
            meta = {
                smoothedLuma: 0,
                committedAlpha: 0,
                candidateAlpha: 0,
                candidateSinceTs: 0,
                lastCommitTs: 0
            };
            state.bandMetaMap.set(bandKey, meta);
            return meta;
        }

        function resolveBandTargetAlpha(bandKey, rawSceneLuma, textColor, nowTs) {
            const meta = getBandMeta(bandKey);

            const riseLuma = rawSceneLuma > meta.smoothedLuma;
            const lumaRate = riseLuma ? config.lumaRiseSmoothing : config.lumaFallSmoothing;
            meta.smoothedLuma += (rawSceneLuma - meta.smoothedLuma) * lumaRate;

            const rawAlpha = quantizeAlpha(
                computeCloudAlpha(meta.smoothedLuma, textColor.luma, textColor.alpha)
            );
            const committed = meta.committedAlpha || 0;
            const delta = rawAlpha - committed;

            if (Math.abs(delta) <= config.alphaDeadband) {
                meta.candidateSinceTs = 0;
                meta.candidateAlpha = committed;
                return committed;
            }

            const elapsedSinceCommit = nowTs - (meta.lastCommitTs || 0);
            if ((meta.lastCommitTs || 0) > 0 && elapsedSinceCommit < config.minDisplayHoldMs) {
                return committed;
            }

            const directionUp = delta > 0;
            const delayMs = directionUp ? config.brightenDelayMs : config.darkenDelayMs;
            if (!meta.candidateSinceTs) {
                meta.candidateSinceTs = nowTs;
                meta.candidateAlpha = rawAlpha;
                return committed;
            }

            // Keep the timer stable; adapt candidate gradually instead of resetting it.
            meta.candidateAlpha = quantizeAlpha(
                (meta.candidateAlpha || 0) + ((rawAlpha - (meta.candidateAlpha || 0)) * 0.32)
            );

            if ((nowTs - meta.candidateSinceTs) < delayMs) {
                return committed;
            }

            const commitAlpha = meta.candidateAlpha;
            if (Math.abs(commitAlpha - committed) <= config.alphaDeadband) {
                meta.candidateSinceTs = 0;
                return committed;
            }

            meta.committedAlpha = commitAlpha;
            meta.lastCommitTs = nowTs;
            meta.candidateSinceTs = 0;
            return commitAlpha;
        }

        function smoothBandAlpha(bandKey, targetAlpha) {
            const prev = state.bandAlphaMap.get(bandKey) || 0;
            const rise = targetAlpha > prev;
            const rate = rise ? config.alphaRiseSmoothing : config.alphaFallSmoothing;
            let next = prev + ((targetAlpha - prev) * rate);

            const wasActive = prev >= config.activationAlpha;
            if (wasActive) {
                if (next < config.deactivationAlpha && targetAlpha < config.deactivationAlpha) {
                    next = 0;
                }
            } else if (next < config.activationAlpha && targetAlpha < config.activationAlpha) {
                next = 0;
            }

            next = quantizeAlpha(next);
            state.bandAlphaMap.set(bandKey, next);
            return next;
        }

        function decayStaleBandAlphas(activeBandKeys) {
            for (const [bandKey, value] of state.bandAlphaMap.entries()) {
                if (activeBandKeys.has(bandKey)) continue;
                const decayed = quantizeAlpha(value * (1 - config.alphaFallSmoothing));
                if (decayed < config.deactivationAlpha) {
                    state.bandAlphaMap.delete(bandKey);
                    state.bandMetaMap.delete(bandKey);
                } else {
                    state.bandAlphaMap.set(bandKey, decayed);
                    const meta = state.bandMetaMap.get(bandKey);
                    if (meta) {
                        meta.committedAlpha = Math.min(meta.committedAlpha || 0, decayed);
                        meta.candidateSinceTs = 0;
                    }
                }
            }

            for (const bandKey of state.bandMetaMap.keys()) {
                if (activeBandKeys.has(bandKey)) continue;
                if (!state.bandAlphaMap.has(bandKey)) {
                    state.bandMetaMap.delete(bandKey);
                }
            }
        }

        function clearCloud(lineEl) {
            if (!lineEl) return;
            lineEl.classList.remove(CLOUD_CLASS);
            for (let i = 0; i < STYLE_KEYS.length; i++) {
                lineEl.style.removeProperty(STYLE_KEYS[i]);
            }
        }

        function applyCloud(lineEl, alpha) {
            const a = clamp(alpha, 0, config.maxAlpha);
            if (a < config.minAlpha) {
                clearCloud(lineEl);
                return false;
            }

            const t = clamp(a / Math.max(0.001, config.maxAlpha), 0, 1);
            const blur = 11 + (18 * t);
            const scale = 1.14 + (0.28 * t);

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

            subtitleContainer.querySelectorAll(`.subtitle-line.${CLOUD_CLASS}`).forEach((lineEl) => {
                clearCloud(lineEl);
            });
        }

        function collectVisibleLines(sceneRect) {
            const lines = subtitleContainer.querySelectorAll('.subtitle-line');
            if (!lines.length) {
                return { visibleLines: [], containerRect: subtitleContainer.getBoundingClientRect(), bandCount: 0, bandHeight: 0 };
            }

            const containerRect = subtitleContainer.getBoundingClientRect();
            const dynamicBandCount = clamp(
                Math.round((containerRect.height || 1) / 145),
                config.minBands,
                config.maxBands
            );
            const bandHeight = Math.max(1, (containerRect.height || 1) / dynamicBandCount);
            const visibleLines = [];

            for (let i = 0; i < lines.length; i++) {
                if (visibleLines.length >= config.maxVisibleLines) break;

                const lineEl = lines[i];
                if (!lineEl || !lineEl.isConnected) continue;

                const lineRect = lineEl.getBoundingClientRect();
                if (lineRect.width <= 0 || lineRect.height <= 0) continue;
                if (!intersects(lineRect, containerRect, 18)) continue;
                if (!intersects(lineRect, sceneRect, 16)) continue;

                const centerY = lineRect.top + (lineRect.height * 0.5);
                const bandIndex = clamp(
                    Math.floor((centerY - containerRect.top) / bandHeight),
                    0,
                    dynamicBandCount - 1
                );

                visibleLines.push({
                    lineEl,
                    lineRect,
                    bandIndex
                });
            }

            return {
                visibleLines,
                containerRect,
                bandCount: dynamicBandCount,
                bandHeight
            };
        }

        function buildBandSampleRect(containerRect, sceneRect, bandIndex, bandHeight) {
            if (!containerRect || !sceneRect || !(bandHeight > 0)) return null;

            let left = containerRect.left + config.bandHorizontalInsetPx;
            let right = containerRect.right - config.bandHorizontalInsetPx;
            if ((right - left) < 80) {
                left = containerRect.left + 8;
                right = containerRect.right - 8;
            }

            const top = (containerRect.top + (bandIndex * bandHeight)) - config.bandVerticalPaddingPx;
            const bottom = (containerRect.top + ((bandIndex + 1) * bandHeight)) + config.bandVerticalPaddingPx;

            const clipLeft = Math.max(left, sceneRect.left);
            const clipRight = Math.min(right, sceneRect.right);
            const clipTop = Math.max(top, sceneRect.top);
            const clipBottom = Math.min(bottom, sceneRect.bottom);

            const rect = createRect(clipLeft, clipTop, clipRight, clipBottom);
            if (rect.width <= 1 || rect.height <= 1) return null;
            return rect;
        }

        function renderClouds(nowTs = (typeof performance !== 'undefined' ? performance.now() : Date.now())) {
            if (!isActiveMode()) {
                clearAllClouds();
                state.bandAlphaMap.clear();
                state.bandMetaMap.clear();
                return;
            }

            const sceneCanvas = resolveSceneCanvas();
            if (!(sceneCanvas instanceof HTMLCanvasElement)) {
                clearAllClouds();
                state.bandAlphaMap.clear();
                state.bandMetaMap.clear();
                return;
            }

            const sceneRect = sceneCanvas.getBoundingClientRect();
            if (!sceneRect.width || !sceneRect.height) {
                clearAllClouds();
                state.bandAlphaMap.clear();
                state.bandMetaMap.clear();
                return;
            }

            const frame = captureSceneFrame(sceneCanvas, sceneRect);
            if (!frame) {
                clearAllClouds();
                state.bandAlphaMap.clear();
                state.bandMetaMap.clear();
                return;
            }

            const { visibleLines, containerRect, bandCount, bandHeight } = collectVisibleLines(sceneRect);
            if (!visibleLines.length) {
                clearAllClouds();
                decayStaleBandAlphas(new Set());
                return;
            }

            const baseTextColor = parseCssColorLuma(window.getComputedStyle(visibleLines[0].lineEl).color);

            const linesByBand = new Map();
            for (let i = 0; i < visibleLines.length; i++) {
                const item = visibleLines[i];
                const key = `${item.bandIndex}/${bandCount}`;
                if (!linesByBand.has(key)) {
                    linesByBand.set(key, {
                        bandIndex: item.bandIndex,
                        lines: []
                    });
                }
                linesByBand.get(key).lines.push(item);
            }

            const activeBandKeys = new Set();
            const nextActiveLines = new Set();

            for (const [bandKey, band] of linesByBand.entries()) {
                const bandRect = buildBandSampleRect(containerRect, sceneRect, band.bandIndex, bandHeight);
                if (!bandRect) continue;

                const sceneLuma = sampleAreaLuma(frame, sceneRect, bandRect);
                const targetAlpha = resolveBandTargetAlpha(bandKey, sceneLuma, baseTextColor, nowTs);
                const smoothAlpha = smoothBandAlpha(bandKey, targetAlpha);

                activeBandKeys.add(bandKey);

                for (let i = 0; i < band.lines.length; i++) {
                    const lineEl = band.lines[i].lineEl;
                    const isActive = applyCloud(lineEl, smoothAlpha);
                    if (isActive) nextActiveLines.add(lineEl);
                }
            }

            decayStaleBandAlphas(activeBandKeys);

            state.activeLines.forEach((lineEl) => {
                if (!nextActiveLines.has(lineEl)) clearCloud(lineEl);
            });
            state.activeLines = nextActiveLines;
        }

        function schedule() {
            const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
            const at = now + config.eventLatencyMs;
            state.forceUpdateAtTs = at;
        }

        function desiredIntervalMs() {
            return isActiveMode() ? config.activeIntervalMs : config.inactiveIntervalMs;
        }

        function tick(ts) {
            if (!state.running) return;

            const interval = desiredIntervalMs();
            const elapsed = state.lastUpdateTs ? (ts - state.lastUpdateTs) : Number.POSITIVE_INFINITY;
            const forcedReady =
                !!state.forceUpdateAtTs
                && ts >= state.forceUpdateAtTs
                && elapsed >= config.eventMinIntervalMs;

            if (!state.lastUpdateTs || elapsed >= interval || forcedReady) {
                state.lastUpdateTs = ts;
                state.forceUpdateAtTs = 0;
                renderClouds(ts);
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
            state.lastUpdateTs = 0;
            state.forceUpdateAtTs = 0;
            schedule();
            state.rafId = window.requestAnimationFrame(tick);
        }

        function stop() {
            state.running = false;
            if (state.rafId) {
                window.cancelAnimationFrame(state.rafId);
                state.rafId = 0;
            }
            state.forceUpdateAtTs = 0;
            clearAllClouds();
            state.bandAlphaMap.clear();
            state.bandMetaMap.clear();
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
