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
    const TUNING_STORAGE_KEY = 'gb_adaptive_cloud_tuning_v1';
    const TUNING_RANGES = {
        // Size and shape
        cloudInsetXEm: { min: 0.4, max: 3.4, step: 0.05 },
        cloudInsetYEm: { min: 0.2, max: 1.8, step: 0.05 },
        cloudFlatInsetXEm: { min: 0.5, max: 3.8, step: 0.05 },
        cloudFlatInsetYEm: { min: 0.2, max: 2.0, step: 0.05 },
        cloudRadiusEm: { min: 0.4, max: 3.0, step: 0.05 },
        cloudGradientWidthPct: { min: 110, max: 280, step: 5 },
        cloudGradientHeightPct: { min: 120, max: 300, step: 5 },
        cloudBlurBasePx: { min: 2, max: 28, step: 0.5 },
        cloudBlurRangePx: { min: 2, max: 44, step: 0.5 },
        cloudScaleBase: { min: 0.9, max: 1.9, step: 0.01 },
        cloudScaleRange: { min: 0.05, max: 0.9, step: 0.01 },

        // Responsiveness and thresholds
        activeIntervalMs: { min: 120, max: 900, step: 10 },
        inactiveIntervalMs: { min: 300, max: 2800, step: 50 },
        eventLatencyMs: { min: 0, max: 900, step: 10 },
        eventMinIntervalMs: { min: 80, max: 700, step: 10 },
        thresholdLuma: { min: 0.45, max: 0.9, step: 0.01 },
        fullLuma: { min: 0.62, max: 1.0, step: 0.01 },
        maxAlpha: { min: 0.2, max: 1.0, step: 0.01 },
        minAlpha: { min: 0, max: 0.25, step: 0.005 },
        activationAlpha: { min: 0.01, max: 0.3, step: 0.005 },
        deactivationAlpha: { min: 0.005, max: 0.25, step: 0.005 },
        alphaQuantStep: { min: 0.001, max: 0.08, step: 0.001 },
        alphaRiseSmoothing: { min: 0.05, max: 0.9, step: 0.01 },
        alphaFallSmoothing: { min: 0.05, max: 0.7, step: 0.01 },
        lumaRiseSmoothing: { min: 0.03, max: 0.95, step: 0.01 },
        lumaFallSmoothing: { min: 0.03, max: 0.85, step: 0.01 },
        alphaDeadband: { min: 0.001, max: 0.12, step: 0.001 },
        brightenDelayMs: { min: 0, max: 1800, step: 10 },
        darkenDelayMs: { min: 0, max: 2600, step: 10 },
        minDisplayHoldMs: { min: 0, max: 2200, step: 10 },

        // Layout helpers
        maxVisibleLines: { min: 8, max: 120, step: 1 },
        sampleScale: { min: 0.16, max: 1.0, step: 0.01 },
        minBands: { min: 2, max: 12, step: 1 },
        maxBands: { min: 3, max: 16, step: 1 },
        bandVerticalPaddingPx: { min: 0, max: 120, step: 1 },
        bandHorizontalInsetPx: { min: 0, max: 220, step: 1 }
    };
    const DEFAULT_TUNING = {
        cloudInsetXEm: 1.28,
        cloudInsetYEm: 0.62,
        cloudFlatInsetXEm: 1.45,
        cloudFlatInsetYEm: 0.72,
        cloudRadiusEm: 1.4,
        cloudGradientWidthPct: 165,
        cloudGradientHeightPct: 180,
        cloudBlurBasePx: 11,
        cloudBlurRangePx: 18,
        cloudScaleBase: 1.14,
        cloudScaleRange: 0.28,

        activeIntervalMs: 260,
        inactiveIntervalMs: 1400,
        eventLatencyMs: 140,
        eventMinIntervalMs: 200,
        maxVisibleLines: 48,
        sampleScale: 0.34,
        thresholdLuma: 0.66,
        fullLuma: 0.89,
        minAlpha: 0.03,
        maxAlpha: 0.78,
        minBands: 4,
        maxBands: 7,
        bandVerticalPaddingPx: 22,
        bandHorizontalInsetPx: 32,
        alphaRiseSmoothing: 0.28,
        alphaFallSmoothing: 0.14,
        activationAlpha: 0.065,
        deactivationAlpha: 0.04,
        alphaQuantStep: 0.015,
        lumaRiseSmoothing: 0.34,
        lumaFallSmoothing: 0.16,
        alphaDeadband: 0.018,
        brightenDelayMs: 320,
        darkenDelayMs: 780,
        minDisplayHoldMs: 360
    };
    const PANEL_ID = 'adaptiveCloudSettingsPanel';
    const PANEL_SLIDER_DEFS = [
        { key: 'cloudInsetXEm', label: 'Wolke Breite', unit: 'em' },
        { key: 'cloudInsetYEm', label: 'Wolke Hoehe', unit: 'em' },
        { key: 'cloudBlurBasePx', label: 'Blur Basis', unit: 'px' },
        { key: 'cloudBlurRangePx', label: 'Blur Dynamik', unit: 'px' },
        { key: 'thresholdLuma', label: 'Schwelle Hell', unit: '' },
        { key: 'maxAlpha', label: 'Wolke Staerke', unit: '' },
        { key: 'activeIntervalMs', label: 'Check Intervall', unit: 'ms' },
        { key: 'brightenDelayMs', label: 'Ein Latenz', unit: 'ms' },
        { key: 'darkenDelayMs', label: 'Aus Latenz', unit: 'ms' },
        { key: 'alphaDeadband', label: 'Toleranz', unit: '' }
    ];
    const PANEL_PRESETS = {
        responsive: {
            thresholdLuma: 0.62,
            fullLuma: 0.86,
            maxAlpha: 0.86,
            activeIntervalMs: 190,
            eventLatencyMs: 70,
            brightenDelayMs: 140,
            darkenDelayMs: 460,
            alphaDeadband: 0.01
        },
        large: {
            cloudInsetXEm: 2.05,
            cloudInsetYEm: 0.98,
            cloudFlatInsetXEm: 2.35,
            cloudFlatInsetYEm: 1.12,
            cloudBlurBasePx: 13,
            cloudBlurRangePx: 22,
            cloudScaleBase: 1.2,
            cloudScaleRange: 0.36
        }
    };

    function clamp(value, min, max) {
        const num = Number(value);
        if (!Number.isFinite(num)) return min;
        return Math.max(min, Math.min(max, num));
    }

    function clonePlainObject(obj) {
        return Object.assign({}, obj || {});
    }

    function deepCloneJsonSafe(obj) {
        try {
            return JSON.parse(JSON.stringify(obj));
        } catch (_) {
            return clonePlainObject(obj);
        }
    }

    function decimalsFromStep(stepValue) {
        const text = String(stepValue);
        const dot = text.indexOf('.');
        return dot >= 0 ? (text.length - dot - 1) : 0;
    }

    function formatForInput(value, decimals) {
        const num = Number(value);
        if (!Number.isFinite(num)) return '';
        if (!decimals) return String(Math.round(num));
        return num.toFixed(decimals);
    }

    function getRangeForKey(key) {
        return TUNING_RANGES[key] || null;
    }

    function sanitizeTuningValue(key, value, fallback) {
        const range = getRangeForKey(key);
        if (!range) {
            const num = Number(value);
            return Number.isFinite(num) ? num : fallback;
        }
        const raw = Number(value);
        if (!Number.isFinite(raw)) return fallback;
        const clamped = clamp(raw, range.min, range.max);
        const step = Number(range.step);
        if (!Number.isFinite(step) || step <= 0) return clamped;
        return Math.round(clamped / step) * step;
    }

    function normalizeTuning(input = {}) {
        const out = {};
        const src = input && typeof input === 'object' ? input : {};
        Object.keys(DEFAULT_TUNING).forEach((key) => {
            out[key] = sanitizeTuningValue(key, src[key], DEFAULT_TUNING[key]);
        });
        if (out.deactivationAlpha > out.activationAlpha) {
            out.deactivationAlpha = Math.max(0, out.activationAlpha * 0.7);
        }
        if (out.maxBands < out.minBands) {
            out.maxBands = out.minBands;
        }
        return out;
    }

    function readStoredTuning() {
        try {
            const raw = localStorage.getItem(TUNING_STORAGE_KEY);
            if (!raw) return {};
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch (_) {
            return {};
        }
    }

    function writeStoredTuning(tuning) {
        try {
            localStorage.setItem(TUNING_STORAGE_KEY, JSON.stringify(tuning));
        } catch (_) {
            // Ignore storage errors.
        }
    }

    function clearStoredTuning() {
        try {
            localStorage.removeItem(TUNING_STORAGE_KEY);
        } catch (_) {
            // Ignore storage errors.
        }
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

        const optionTuningOverrides = {};
        Object.keys(DEFAULT_TUNING).forEach((key) => {
            if (options[key] !== undefined) optionTuningOverrides[key] = options[key];
        });
        if (options.tuning && typeof options.tuning === 'object') {
            Object.assign(optionTuningOverrides, options.tuning);
        }

        const initialTuning = normalizeTuning(Object.assign({}, readStoredTuning(), optionTuningOverrides));
        const config = clonePlainObject(initialTuning);

        const state = {
            running: false,
            rafId: 0,
            lastUpdateTs: 0,
            forceUpdateAtTs: 0,
            tuning: initialTuning,
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

        function applyTuningToConfig(tuning) {
            Object.keys(DEFAULT_TUNING).forEach((key) => {
                config[key] = tuning[key];
            });
            if (config.deactivationAlpha > config.activationAlpha) {
                config.deactivationAlpha = Math.max(0, config.activationAlpha * 0.7);
            }
            if (config.maxBands < config.minBands) {
                config.maxBands = config.minBands;
            }
        }

        function applyTuningCssVariables(tuning) {
            if (!subtitleContainer || !subtitleContainer.style) return;
            subtitleContainer.style.setProperty('--adaptive-cloud-inset-x', `${tuning.cloudInsetXEm.toFixed(2)}em`);
            subtitleContainer.style.setProperty('--adaptive-cloud-inset-y', `${tuning.cloudInsetYEm.toFixed(2)}em`);
            subtitleContainer.style.setProperty('--adaptive-cloud-flat-inset-x', `${tuning.cloudFlatInsetXEm.toFixed(2)}em`);
            subtitleContainer.style.setProperty('--adaptive-cloud-flat-inset-y', `${tuning.cloudFlatInsetYEm.toFixed(2)}em`);
            subtitleContainer.style.setProperty('--adaptive-cloud-radius', `${tuning.cloudRadiusEm.toFixed(2)}em`);
            subtitleContainer.style.setProperty('--adaptive-cloud-grad-w', `${Math.round(tuning.cloudGradientWidthPct)}%`);
            subtitleContainer.style.setProperty('--adaptive-cloud-grad-h', `${Math.round(tuning.cloudGradientHeightPct)}%`);
        }

        function getTuning() {
            return clonePlainObject(state.tuning);
        }

        function setTuning(nextPartial = {}, options = {}) {
            const merged = Object.assign({}, state.tuning, (nextPartial && typeof nextPartial === 'object') ? nextPartial : {});
            const normalized = normalizeTuning(merged);
            state.tuning = normalized;
            applyTuningToConfig(normalized);
            applyTuningCssVariables(normalized);

            // Reset temporal caches so new values take effect immediately.
            state.bandAlphaMap.clear();
            state.bandMetaMap.clear();
            clearAllClouds();

            if (!options.skipPersist) {
                writeStoredTuning(normalized);
            }
            schedule();
            return getTuning();
        }

        function resetTuning(options = {}) {
            const normalized = normalizeTuning(DEFAULT_TUNING);
            state.tuning = normalized;
            applyTuningToConfig(normalized);
            applyTuningCssVariables(normalized);
            state.bandAlphaMap.clear();
            state.bandMetaMap.clear();
            clearAllClouds();

            if (!options.skipPersist) {
                if (options.clearStorage) clearStoredTuning();
                else writeStoredTuning(normalized);
            }
            schedule();
            return getTuning();
        }

        applyTuningToConfig(state.tuning);
        applyTuningCssVariables(state.tuning);

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
            const blur = config.cloudBlurBasePx + (config.cloudBlurRangePx * t);
            const scale = config.cloudScaleBase + (config.cloudScaleRange * t);

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
            update: renderClouds,
            getTuning,
            setTuning,
            resetTuning,
            getTuningRanges: () => deepCloneJsonSafe(TUNING_RANGES),
            getDefaultTuning: () => clonePlainObject(DEFAULT_TUNING)
        };
    }

    function mountTuningPanel(controller) {
        if (!controller || typeof controller.getTuning !== 'function') return;
        if (document.getElementById(PANEL_ID)) return;

        const host = document.querySelector('.reader-settings-panel');
        if (!host) return;

        const ranges = (typeof controller.getTuningRanges === 'function')
            ? controller.getTuningRanges()
            : deepCloneJsonSafe(TUNING_RANGES);

        const group = document.createElement('div');
        group.id = PANEL_ID;
        group.className = 'reader-settings-group adaptive-cloud-settings-group';

        const title = document.createElement('div');
        title.className = 'reader-settings-title';
        title.textContent = 'Textschutz-Wolke';
        group.appendChild(title);

        const note = document.createElement('div');
        note.className = 'adaptive-cloud-settings-note';
        note.textContent = 'Regler fuer Groesse und Reaktionsverhalten der Schutzwolke.';
        group.appendChild(note);

        const controlsWrap = document.createElement('div');
        controlsWrap.className = 'adaptive-cloud-controls';
        group.appendChild(controlsWrap);

        const controlMap = new Map();
        let syncing = false;

        function syncFromTuning(tuning) {
            if (!tuning || typeof tuning !== 'object') return;
            syncing = true;
            for (const [key, refs] of controlMap.entries()) {
                const value = Number(tuning[key]);
                if (!Number.isFinite(value)) continue;
                refs.range.value = String(value);
                refs.number.value = formatForInput(value, refs.decimals);
            }
            syncing = false;
        }

        function setPartial(key, rawValue) {
            if (syncing) return;
            const partial = {};
            partial[key] = rawValue;
            const next = controller.setTuning(partial);
            syncFromTuning(next);
        }

        PANEL_SLIDER_DEFS.forEach((def, idx) => {
            const range = ranges[def.key];
            if (!range) return;
            const decimals = decimalsFromStep(range.step);

            const row = document.createElement('div');
            row.className = 'reader-volume-row adaptive-cloud-row';

            const label = document.createElement('label');
            label.className = 'reader-volume-label';
            label.setAttribute('for', `adaptiveCloudRange_${def.key}`);
            label.textContent = def.label;

            const rangeInput = document.createElement('input');
            rangeInput.id = `adaptiveCloudRange_${def.key}`;
            rangeInput.type = 'range';
            rangeInput.className = 'adaptive-cloud-range';
            rangeInput.min = String(range.min);
            rangeInput.max = String(range.max);
            rangeInput.step = String(range.step);

            const numberInput = document.createElement('input');
            numberInput.id = `adaptiveCloudNumber_${def.key}`;
            numberInput.type = 'number';
            numberInput.className = 'adaptive-cloud-number';
            numberInput.min = String(range.min);
            numberInput.max = String(range.max);
            numberInput.step = String(range.step);

            const unit = document.createElement('span');
            unit.className = 'reader-size-unit';
            unit.textContent = def.unit || '';

            rangeInput.addEventListener('input', () => {
                numberInput.value = formatForInput(rangeInput.value, decimals);
                setPartial(def.key, rangeInput.value);
            });
            numberInput.addEventListener('input', () => {
                setPartial(def.key, numberInput.value);
            });
            numberInput.addEventListener('change', () => {
                setPartial(def.key, numberInput.value);
            });

            row.appendChild(label);
            row.appendChild(rangeInput);
            row.appendChild(numberInput);
            row.appendChild(unit);
            controlsWrap.appendChild(row);

            controlMap.set(def.key, {
                range: rangeInput,
                number: numberInput,
                decimals
            });

            // Visual spacer for better scanning.
            if (idx === 3 || idx === 5) {
                const separator = document.createElement('div');
                separator.className = 'adaptive-cloud-separator';
                controlsWrap.appendChild(separator);
            }
        });

        const actions = document.createElement('div');
        actions.className = 'adaptive-cloud-actions';

        const btnResponsive = document.createElement('button');
        btnResponsive.type = 'button';
        btnResponsive.className = 'reader-color-reset-btn adaptive-cloud-action-btn';
        btnResponsive.textContent = 'Preset Reaktiv';
        btnResponsive.addEventListener('click', () => {
            const next = controller.setTuning(PANEL_PRESETS.responsive);
            syncFromTuning(next);
        });

        const btnLarge = document.createElement('button');
        btnLarge.type = 'button';
        btnLarge.className = 'reader-color-reset-btn adaptive-cloud-action-btn';
        btnLarge.textContent = 'Preset Gross';
        btnLarge.addEventListener('click', () => {
            const next = controller.setTuning(PANEL_PRESETS.large);
            syncFromTuning(next);
        });

        const btnReset = document.createElement('button');
        btnReset.type = 'button';
        btnReset.className = 'reader-color-reset-btn adaptive-cloud-action-btn';
        btnReset.textContent = 'Werte Zuruecksetzen';
        btnReset.addEventListener('click', () => {
            const next = controller.resetTuning();
            syncFromTuning(next);
        });

        actions.appendChild(btnResponsive);
        actions.appendChild(btnLarge);
        actions.appendChild(btnReset);
        group.appendChild(actions);

        host.appendChild(group);
        syncFromTuning(controller.getTuning());
    }

    function shouldMountTuningPanelOnThisPage() {
        const rawPath = (window.location && window.location.pathname ? window.location.pathname : '');
        const path = String(rawPath).toLowerCase().replace(/\\/g, '/');
        const cleanPath = path.split('?')[0].split('#')[0];
        const file = cleanPath.split('/').pop() || '';
        return file === '' || file === 'index.html';
    }

    let defaultController = null;

    function autoInit() {
        if (defaultController) return;
        const subtitleContainer = document.getElementById('subtitleContainer');
        if (!subtitleContainer) return;

        defaultController = createController({ subtitleContainer });
        if (defaultController) {
            defaultController.start();
            if (shouldMountTuningPanelOnThisPage()) {
                mountTuningPanel(defaultController);
            }
        }
    }

    window.AdaptiveSubtitleCloud = {
        init(options = {}) {
            const controller = createController(options);
            if (controller) controller.start();
            return controller;
        },
        getDefaultController() {
            return defaultController;
        },
        getTuningRanges() {
            return deepCloneJsonSafe(TUNING_RANGES);
        },
        getRegler() {
            return deepCloneJsonSafe(TUNING_RANGES);
        },
        getDefaultTuning() {
            return clonePlainObject(DEFAULT_TUNING);
        },
        getTuning() {
            return defaultController && typeof defaultController.getTuning === 'function'
                ? defaultController.getTuning()
                : normalizeTuning(readStoredTuning());
        },
        setTuning(partial = {}) {
            if (defaultController && typeof defaultController.setTuning === 'function') {
                return defaultController.setTuning(partial);
            }
            const merged = normalizeTuning(Object.assign({}, readStoredTuning(), partial || {}));
            writeStoredTuning(merged);
            return merged;
        },
        setRegler(partial = {}) {
            return this.setTuning(partial);
        },
        resetTuning(options = {}) {
            if (defaultController && typeof defaultController.resetTuning === 'function') {
                return defaultController.resetTuning(options);
            }
            if (options && options.clearStorage) {
                clearStoredTuning();
            } else {
                writeStoredTuning(normalizeTuning(DEFAULT_TUNING));
            }
            return normalizeTuning(DEFAULT_TUNING);
        },
        resetRegler(options = {}) {
            return this.resetTuning(options);
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', autoInit, { once: true });
    } else {
        autoInit();
    }
})();
