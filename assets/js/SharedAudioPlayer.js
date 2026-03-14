window.SharedAudioPlayer = class SharedAudioPlayer {
    constructor(audioUrl, textUrl, options = {}) {
        // SC Integration: Nutze Adapter und konvertiere URL
        const scUrl = typeof getSCUrl === 'function' ? getSCUrl(audioUrl) : audioUrl;

        if (typeof SCAudioAdapter !== 'undefined') {
            this.audio = new SCAudioAdapter(options.iframeId || 'sc-widget-shared');
            this.audio.src = scUrl;
        } else {
            this.audio = new Audio(audioUrl);
        }

        this.subtitleTracks = [];
        this.currentSubtitleIndex = -1;
        this.renderVersion = 0;
        this.currentScrollAnimation = null;
        this.container = options.container || document.getElementById('subtitleContainer');
        if (this.container && window.SubtitleRichText && typeof window.SubtitleRichText.initOverlay === 'function') {
            window.SubtitleRichText.initOverlay({
                container: this.container
            });
        }
        this.isReadingMode = options.isReadingMode || false;
        this.onLineRender = options.onLineRender || null;
        this.canSeek = (typeof options.canSeek === 'function') ? options.canSeek : null;
        this._textLoadRequestId = 0;
        this._activeTextAbortController = null;
        this._flatCompMeasureCanvas = null;
        this._flatCompMeasureCtx = null;
        this._flatCompMeasureCache = new Map();
        this._seekGuard = { index: -1, target: NaN, at: 0 };
        this._pendingReadingLayoutFrame = 0;
        this._pendingReadingLayoutSettleFrame = 0;
        this._pendingReadingLayoutTimer = null;
        this._lastReadingLayoutSignature = '';

        // Default volumes
        const requestedVolume = Number(options.volume ?? 1.0);
        this.audio.volume = Number.isFinite(requestedVolume) ? Math.max(0, Math.min(1, requestedVolume)) : 1.0;

        // Load Text & Parse
        if (textUrl) {
            this.loadText(textUrl);
        }

        // Bind Events
        this.audio.addEventListener('timeupdate', () => this.onTimeUpdate());
        this.audio.addEventListener('ended', () => {
            if (this.onEnded) this.onEnded();
        });
    }

    async loadText(url) {
        const requestId = ++this._textLoadRequestId;

        if (this._activeTextAbortController) {
            try {
                this._activeTextAbortController.abort();
            } catch (_) {
                // no-op: abort may throw in rare polyfill edge-cases
            }
        }

        const abortController = (typeof AbortController !== 'undefined') ? new AbortController() : null;
        this._activeTextAbortController = abortController;

        try {
            const response = await fetch(url, abortController ? { signal: abortController.signal } : undefined);
            if (requestId !== this._textLoadRequestId) return false;
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const text = await response.text();
            if (requestId !== this._textLoadRequestId) return false;
            this.parseSubtitles(text);
            return true;
        } catch (e) {
            if (e && e.name === 'AbortError') return false;
            if (requestId !== this._textLoadRequestId) return false;
            console.error("SharedAudioPlayer: Failed to load text", e);
            if (this.container) {
                this.container.innerHTML = '';
                const errorLine = document.createElement('div');
                errorLine.className = 'subtitle-line subtitle-current';
                errorLine.textContent = `Fehler beim Laden des Textes: ${url}`;
                this.container.appendChild(errorLine);
            }
            return false;
        } finally {
            if (this._activeTextAbortController === abortController) {
                this._activeTextAbortController = null;
            }
        }
    }

    _wait(ms) {
        return new Promise(resolve => setTimeout(resolve, Math.max(0, ms || 0)));
    }

    _isDuplicateSeekRequest(index, targetSec, maxAgeMs = 420) {
        const now = Date.now();
        const safeTarget = Number(targetSec) || 0;
        const isDuplicate =
            this._seekGuard.index === index
            && Math.abs((this._seekGuard.target || 0) - safeTarget) < 0.001
            && (now - this._seekGuard.at) < Math.max(80, Number(maxAgeMs) || 0);

        if (!isDuplicate) {
            this._seekGuard.index = index;
            this._seekGuard.target = safeTarget;
            this._seekGuard.at = now;
        }
        return isDuplicate;
    }

    async seekToTime(targetSec, options = {}) {
        if (this.canSeek && !this.canSeek()) {
            return {
                ok: false,
                blocked: true,
                target: Math.max(0, Number(targetSec) || 0),
                position: this.audio.currentTime || 0,
                attempts: 0
            };
        }
        const target = Math.max(0, Number(targetSec) || 0);
        const autoplay = options.autoplay !== false;
        const wasPlayingBeforeSeek = (typeof this.audio.isProbablyPlaying === 'function')
            ? this.audio.isProbablyPlaying()
            : !this.audio.paused;
        let result = { ok: false, target, position: this.audio.currentTime || 0, attempts: 0 };

        try {
            if (typeof this.audio.seekAndConfirm === 'function') {
                result = await this.audio.seekAndConfirm(target, {
                    maxAttempts: 5,
                    settleMs: 220,
                    tolerance: 0.9
                });
            } else {
                this.audio.currentTime = target;
                await this._wait(260);
                const pos = (typeof this.audio.getAccurateCurrentTime === 'function')
                    ? await this.audio.getAccurateCurrentTime(900)
                    : (this.audio.currentTime || 0);
                result = {
                    ok: Math.abs(pos - target) <= 1.0 || pos >= target - 1.0,
                    target,
                    position: pos,
                    attempts: 1
                };
            }
        } catch (e) {
            console.warn('SharedAudioPlayer seekToTime failed:', e);
        }

        const effectiveTime = Number.isFinite(result.position) ? result.position : target;
        this.currentSubtitleIndex = this.subtitleTracks.length ? this.findSubtitleIndexForTime(effectiveTime) : 0;
        this.renderLines(this.currentSubtitleIndex);

        if (autoplay && (!wasPlayingBeforeSeek || this.audio.paused)) {
            try {
                await this.audio.play();
            } catch (e) {
                console.warn('SharedAudioPlayer autoplay after seek failed:', e);
            }
        }
        return result;
    }

    findSubtitleIndexForTime(timeSec) {
        if (!this.subtitleTracks || this.subtitleTracks.length === 0) return 0;
        for (let i = this.subtitleTracks.length - 1; i >= 0; i--) {
            if (timeSec >= this.subtitleTracks[i].time) return i;
        }
        return 0;
    }

    parseSubtitles(rawText) {
        this.subtitleTracks = [];
        this.currentSubtitleIndex = -1;
        const lines = rawText.split(/\r?\n/);
        const timeReg = /^\[(\d{1,2}):(\d{2})([:.])(\d{1,2}(?:\.\d+)?)\]\s*(.*)|\[(\d{1,2}):(\d{2})\]\s*(.*)/;

        lines.forEach((line) => {
            const match = line.match(timeReg);
            if (match) {
                let totalSeconds = 0;
                let text = '';

                if (match[1] !== undefined) {
                    const first = parseFloat(match[1]);
                    const second = parseFloat(match[2]);
                    const separator = match[3];
                    const third = parseFloat(match[4]);
                    text = match[5] ? match[5].trim() : '';

                    if (separator === ':') {
                        totalSeconds = first * 3600 + second * 60 + third;
                    } else {
                        totalSeconds = first * 60 + second + (third / 100);
                    }
                } else {
                    const first = parseFloat(match[6]);
                    const second = parseFloat(match[7]);
                    text = match[8] ? match[8].trim() : '';
                    totalSeconds = first * 60 + second;
                }

                if (text) {
                    const rich = (window.SubtitleRichText && typeof window.SubtitleRichText.parse === 'function')
                        ? window.SubtitleRichText.parse(text)
                        : null;
                    const plainText = rich ? String(rich.plainText || '') : text;
                    const richTokens = rich && Array.isArray(rich.tokens) ? rich.tokens : null;

                    if (!plainText) return;

                    this.subtitleTracks.push({
                        time: totalSeconds,
                        text: plainText,
                        richTokens,
                        rawText: text
                    });
                }
            }
        });

        this.subtitleTracks.sort((a, b) => a.time - b.time);
        this.renderVersion += 1;
        this.renderLines(0);
        console.log(`SharedAudioPlayer: Parsed ${this.subtitleTracks.length} lines.`);
    }

    onTimeUpdate() {
        const t = this.audio.currentTime;
        let newIndex = -1;
        // Find current line
        for (let i = this.subtitleTracks.length - 1; i >= 0; i--) {
            if (t >= this.subtitleTracks[i].time) {
                newIndex = i;
                break;
            }
        }
        if (newIndex !== this.currentSubtitleIndex) {
            this.currentSubtitleIndex = newIndex;
            this.renderLines(Math.max(0, newIndex));
        }
        // Custom Hook
        if (this.onUpdate) this.onUpdate(t);
    }

    _renderSubtitleTrackContent(lineEl, track) {
        if (!lineEl) return;
        const safeTrack = track || { text: '' };
        const disableInfoLinks = false;
        if (window.SubtitleRichText && typeof window.SubtitleRichText.renderTrackInto === 'function') {
            window.SubtitleRichText.renderTrackInto(lineEl, safeTrack, {
                container: this.container,
                isPlaybackRunning: () => {
                    if (!this.audio) return false;
                    if (typeof this.audio.isProbablyPlaying === 'function') {
                        return this.audio.isProbablyPlaying();
                    }
                    return !this.audio.paused;
                },
                pausePlayback: () => {
                    if (!this.audio || typeof this.audio.pause !== 'function') return;
                    this.audio.pause();
                },
                resumePlayback: () => {
                    if (!this.audio || typeof this.audio.play !== 'function') return Promise.resolve();
                    return this.audio.play();
                },
                disableInfoLinks
            });
            return;
        }
        lineEl.textContent = safeTrack.text || '';
    }

    _tokenizeFlatText(text) {
        if (!text) return [];
        const tokens = String(text).match(/\S+\s*|\s+/gu);
        return Array.isArray(tokens) && tokens.length ? tokens : [String(text)];
    }

    _wrapFlatTextFragments(lineEl, force = false) {
        if (!lineEl || !this.container) return;
        const isSupportedLayout = this.container.classList.contains('reader-layout-flat')
            || this.container.classList.contains('reader-layout-timestamps');
        if (!isSupportedLayout) return;

        if (force && lineEl.dataset.fragmentMode === 'tokenized') {
            const sourceText = lineEl.dataset.fragmentSource || lineEl.textContent || '';
            lineEl.textContent = sourceText;
        }

        if (lineEl.childElementCount > 0) return;
        const text = lineEl.dataset.fragmentSource || lineEl.textContent || '';
        const tokens = this._tokenizeFlatText(text);
        if (tokens.length <= 1) {
            lineEl.removeAttribute('data-fragment-mode');
            lineEl.removeAttribute('data-fragment-source');
            return;
        }

        lineEl.dataset.fragmentMode = 'tokenized';
        lineEl.dataset.fragmentSource = text;
        lineEl.textContent = '';
        tokens.forEach((token) => {
            const fragmentEl = document.createElement('span');
            fragmentEl.className = 'subtitle-fragment';
            fragmentEl.textContent = token;
            lineEl.appendChild(fragmentEl);
        });
    }

    _getRenderedFragmentTextSegments(fragmentEl) {
        if (!fragmentEl || fragmentEl.childElementCount > 0) return [];
        const textNode = Array.from(fragmentEl.childNodes).find((node) => node && node.nodeType === Node.TEXT_NODE && node.textContent);
        if (!textNode) return [];
        const text = textNode.textContent || '';
        if (text.length < 4) return [];
        const fragmentRects = this._getFlatLineClientRects(fragmentEl);
        if (fragmentRects.length <= 1) return [];

        const glyphs = Array.from(text);
        const segments = [];
        const range = document.createRange();
        let codeUnitOffset = 0;
        let currentSegment = null;

        glyphs.forEach((glyph) => {
            const nextOffset = codeUnitOffset + glyph.length;
            range.setStart(textNode, codeUnitOffset);
            range.setEnd(textNode, nextOffset);
            const rect = Array.from(range.getClientRects()).find((entry) => entry.width > 0.2 && entry.height > 0.2) || null;
            if (!rect) {
                if (!currentSegment) {
                    currentSegment = { top: null, text: glyph };
                } else {
                    currentSegment.text += glyph;
                }
                codeUnitOffset = nextOffset;
                return;
            }

            const topKey = Math.round(rect.top * 2) / 2;
            if (!currentSegment || currentSegment.top === null || Math.abs(currentSegment.top - topKey) > 0.6) {
                if (currentSegment && currentSegment.text) segments.push(currentSegment);
                currentSegment = { top: topKey, text: glyph };
            } else {
                currentSegment.text += glyph;
            }
            codeUnitOffset = nextOffset;
        });

        if (currentSegment && currentSegment.text) segments.push(currentSegment);
        if (typeof range.detach === 'function') range.detach();
        return segments.filter((segment) => segment && segment.text);
    }

    _shouldAppendSyntheticHyphen(segmentText, nextSegmentText) {
        const trimmedEnd = String(segmentText || '').trimEnd();
        const trimmedStart = String(nextSegmentText || '').trimStart();
        if (!trimmedEnd || !trimmedStart) return false;
        if (/[-\u2010\u2011\u2012\u2013\u2014]$/u.test(trimmedEnd)) return false;
        if (/[.,;:!?\u2026)\]"'\u00bb\u201d\u2019]$/u.test(trimmedEnd)) return false;
        if (/^[,.;:!?\u2026)\]"'\u00bb\u201d\u2019]/u.test(trimmedStart)) return false;
        if (/^\s/u.test(nextSegmentText || '')) return false;
        const lastChar = Array.from(trimmedEnd).pop() || '';
        const nextChar = Array.from(trimmedStart)[0] || '';
        return /[\p{L}\p{N}]/u.test(lastChar) && /[\p{L}\p{N}]/u.test(nextChar);
    }

    _expandAutoHyphenatedFragments(lineEl) {
        if (!lineEl) return;
        const fragments = Array.from(lineEl.querySelectorAll('.subtitle-fragment')).filter((fragmentEl) => fragmentEl.childElementCount === 0);
        fragments.forEach((fragmentEl) => {
            const segments = this._getRenderedFragmentTextSegments(fragmentEl);
            if (segments.length <= 1) return;
            const replacement = document.createDocumentFragment();
            segments.forEach((segment, index) => {
                const pieceEl = document.createElement('span');
                pieceEl.className = 'subtitle-fragment subtitle-fragment-fixed-break';
                let pieceText = segment.text;
                if (index < segments.length - 1 && this._shouldAppendSyntheticHyphen(segment.text, segments[index + 1].text)) {
                    pieceText += '-';
                    pieceEl.dataset.syntheticHyphen = 'true';
                }
                pieceEl.textContent = pieceText;
                replacement.appendChild(pieceEl);
            });
            fragmentEl.replaceWith(replacement);
        });
    }

    _getFlatLeadingCompensationPx(text, sampleEl) {
        if (!this.container || !this.container.classList.contains('reader-layout-flat')) return 0;
        if (!sampleEl || !text) return 0;
        if (typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') return 0;

        if (!this._flatCompMeasureCanvas) {
            this._flatCompMeasureCanvas = document.createElement('canvas');
            this._flatCompMeasureCtx = this._flatCompMeasureCanvas.getContext('2d');
        }
        if (!this._flatCompMeasureCtx) return 0;

        const styles = window.getComputedStyle(sampleEl);
        const fontFamily = styles.fontFamily || 'serif';
        const fontSize = styles.fontSize || '18px';
        const fontStyle = styles.fontStyle || 'normal';
        const fontVariant = styles.fontVariant || 'normal';
        const cacheKey = `${fontStyle}|${fontVariant}|${fontSize}|${fontFamily}|${text}`;
        if (this._flatCompMeasureCache.has(cacheKey)) {
            return this._flatCompMeasureCache.get(cacheKey);
        }

        this._flatCompMeasureCtx.font = `${fontStyle} ${fontVariant} 400 ${fontSize} ${fontFamily}`;
        const normalWidth = this._flatCompMeasureCtx.measureText(text).width;
        this._flatCompMeasureCtx.font = `${fontStyle} ${fontVariant} 500 ${fontSize} ${fontFamily}`;
        const boldWidth = this._flatCompMeasureCtx.measureText(text).width;
        const compensationPx = Math.max(0, Math.ceil((boldWidth - normalWidth) * 100) / 100);
        this._flatCompMeasureCache.set(cacheKey, compensationPx);
        return compensationPx;
    }

    _applyFlatLeadingCompensation(lineEl, text) {
        if (!lineEl) return;
        if (!this.container || !this.container.classList.contains('reader-layout-flat')) {
            lineEl.style.removeProperty('--flat-leading-comp');
            return;
        }
        const compensationPx = this._getFlatLeadingCompensationPx(text, lineEl);
        lineEl.style.setProperty('--flat-leading-comp', `${compensationPx}px`);
    }

    _getTimestampBoundaryGapEm(currentText, nextText, options = {}) {
        if (!nextText) return 0;
        const baseEm = Number(options.baseEm) || 0.12;
        const minorEm = Number(options.minorEm) || baseEm;
        const sentenceEm = Number(options.sentenceEm) || Math.max(minorEm, baseEm);
        const text = (currentText || "").trim();
        if (!text) return baseEm;

        const nextTrimmed = (nextText || "").trim();
        if (!nextTrimmed) return 0;

        const closingTrail = String.raw`(?:["'\u00bb\u201c\u201d\u2018\u2019)\]])*`;
        const sentencePattern = new RegExp(`[.!?\u2026]${closingTrail}$`);
        const weakSentencePattern = new RegExp(`[:;]${closingTrail}$`);
        const pausePattern = new RegExp(`[,]${closingTrail}$`);
        const hyphenPattern = /(?:-|\u2010|\u2011|\u2012|\u2013|\u2014)$/;
        const continuationPattern = /^[\"'\u00bb\u201c\u201d\u2018\u2019(\[]*[a-z\u00e4\u00f6\u00fc\u00df]/;
        const tightLeadingPattern = /^[,.;:!?\u2026)\]\u201d\u2019]/;

        if (hyphenPattern.test(text) || tightLeadingPattern.test(nextTrimmed)) return 0;

        if (sentencePattern.test(text)) {
            if (continuationPattern.test(nextTrimmed)) {
                return Math.max(minorEm, baseEm + 0.02);
            }
            return sentenceEm;
        }
        if (weakSentencePattern.test(text)) return Math.max(minorEm, baseEm + 0.03);
        if (pausePattern.test(text)) return minorEm;
        if (continuationPattern.test(nextTrimmed)) return Math.max(0.04, Math.min(baseEm, baseEm * 0.45));
        return baseEm;
    }

    _getTimestampBoundarySeparatorText(currentText, nextText) {
        const nextTrimmed = (nextText || "").trim();
        if (!nextTrimmed) return "";
        const text = (currentText || "").trim();
        if (!text) return " ";

        const hyphenPattern = /(?:-|\u2010|\u2011|\u2012|\u2013|\u2014)$/;
        const tightLeadingPattern = /^[,.;:!?\u2026)\]\u201d\u2019]/;
        if (hyphenPattern.test(text) || tightLeadingPattern.test(nextTrimmed)) return "";
        return " ";
    }

    _applyFlatTimestampBoundaryGap(lineEl, index) {
        if (!lineEl) return;
        if (!this.container || !this.container.classList.contains('reader-layout-flat')) {
            lineEl.style.removeProperty('--timestamp-gap');
            return;
        }
        if (!Array.isArray(this.subtitleTracks) || index < 0 || index >= this.subtitleTracks.length) {
            lineEl.style.removeProperty('--timestamp-gap');
            return;
        }
        const currentText = this.subtitleTracks[index] && typeof this.subtitleTracks[index].text === 'string'
            ? this.subtitleTracks[index].text
            : '';
        const nextText = this.subtitleTracks[index + 1] && typeof this.subtitleTracks[index + 1].text === 'string'
            ? this.subtitleTracks[index + 1].text
            : '';
        const gapEm = this._getTimestampBoundaryGapEm(currentText, nextText, {
            baseEm: 0.12,
            minorEm: 0.16,
            sentenceEm: 0.24
        });
        lineEl.style.setProperty('--timestamp-gap', `${gapEm.toFixed(3)}em`);
    }

    _isDesktopPointerLayout() {
        return !!(typeof window !== 'undefined'
            && typeof window.matchMedia === 'function'
            && window.matchMedia('(hover: hover) and (pointer: fine)').matches);
    }

    _clearFlatSmartLineStyle(lineEl) {
        if (!lineEl) return;
        lineEl.classList.remove('flat-line-smart');
        lineEl.style.removeProperty('--flat-smart-word-spacing');
        lineEl.style.removeProperty('--flat-smart-letter-spacing');
        lineEl.style.removeProperty('--flat-smart-stretch');
        lineEl.style.removeProperty('--flat-smart-wdth');
        lineEl.style.removeProperty('margin-left');
        lineEl.style.removeProperty('margin-right');
    }

    _getFlatLineClientRects(lineEl) {
        if (!lineEl || typeof lineEl.getClientRects !== 'function') return [];
        return Array.from(lineEl.getClientRects()).filter((rect) => rect.width > 1 && rect.height > 1);
    }

    _getFlatLineBoundaryGapPx(elements) {
        if (!Array.isArray(elements) || elements.length <= 1) return 0;
        if (typeof window === "undefined" || typeof window.getComputedStyle !== "function") return 0;
        let total = 0;
        for (let i = 0; i < elements.length - 1; i += 1) {
            total += parseFloat(window.getComputedStyle(elements[i]).marginRight) || 0;
        }
        return total;
    }

    _getTrailingHangingPunctuationPx(lineEl) {
        if (!lineEl || typeof window === "undefined" || typeof window.getComputedStyle !== "function") return 0;
        const text = (lineEl.textContent || "").trim();
        if (!text) return 0;

        const trailing = text.match(/([,.;:!?\u2026\-\u2010\u2011\u2012\u2013\u2014]+|[)\]"'\u00bb\u201d\u2019]+)$/u);
        if (!trailing) return 0;

        let sample = trailing[0];
        let coreChar = sample.charAt(sample.length - 1);
        while (/[)\]"'\u00bb\u201d\u2019]/u.test(coreChar) && sample.length > 1) {
            sample = sample.slice(0, -1);
            coreChar = sample.charAt(sample.length - 1);
        }

        const fontSize = parseFloat(window.getComputedStyle(lineEl).fontSize) || 16;
        if (/[.\u2026]/u.test(coreChar)) return -Math.min(fontSize * 0.18, 4.8);
        if (/[,;:]/u.test(coreChar)) return -Math.min(fontSize * 0.26, 6.4);
        if (/[!?]/u.test(coreChar)) return -Math.min(fontSize * 0.16, 4.4);
        if (/[\-\u2010\u2011\u2012\u2013\u2014]/u.test(coreChar)) return -Math.min(fontSize * 0.34, 8.4);
        return 0;
    }

    _captureFlatLineGeometry(elements, containerRect) {
        const geometry = new Map();
        if (!Array.isArray(elements)) return geometry;
        elements.forEach((el) => {
            const rects = this._getFlatLineClientRects(el);
            if (rects.length !== 1) return;
            const rect = rects[0];
            geometry.set(el, {
                left: Math.round((rect.left - containerRect.left) * 10) / 10,
                right: Math.round((rect.right - containerRect.left) * 10) / 10
            });
        });
        return geometry;
    }

    _didFlatLineGeometryChange(elements, containerRect, baselineGeometry) {
        if (!(baselineGeometry instanceof Map) || baselineGeometry.size !== elements.length) return true;
        for (const el of elements) {
            const rects = this._getFlatLineClientRects(el);
            if (rects.length !== 1) return true;
            const rect = rects[0];
            const current = {
                left: Math.round((rect.left - containerRect.left) * 10) / 10,
                right: Math.round((rect.right - containerRect.left) * 10) / 10
            };
            const baseline = baselineGeometry.get(el);
            if (!baseline) return true;
            if (Math.abs(current.left - baseline.left) > 0.6 || Math.abs(current.right - baseline.right) > 0.6) {
                return true;
            }
        }
        return false;
    }

    _applyFlatSmartJustification() {
        if (!this.container) return;
        const lineElements = Array.from(this.container.querySelectorAll('.subtitle-line'));
        if (!lineElements.length) return;

        const isFlatLayout = this.container.classList.contains('reader-layout-flat');
        const isTimestampLayout = this.container.classList.contains('reader-layout-timestamps');

        lineElements.forEach((lineEl) => {
            this._clearFlatSmartLineStyle(lineEl);
            this._wrapFlatTextFragments(lineEl, true);
            this._expandAutoHyphenatedFragments(lineEl);
            Array.from(lineEl.querySelectorAll('.subtitle-fragment')).forEach((fragmentEl) => {
                this._clearFlatSmartLineStyle(fragmentEl);
            });
        });

        if (!isFlatLayout && !isTimestampLayout) return;
        if (this._isDesktopPointerLayout()) return;
        if (typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') return;

        const containerRect = this.container.getBoundingClientRect();
        const containerStyle = window.getComputedStyle(this.container);
        const paddingLeft = parseFloat(containerStyle.paddingLeft) || 0;
        const paddingRight = parseFloat(containerStyle.paddingRight) || 0;
        const innerWidth = Math.max(1, this.container.clientWidth - paddingLeft - paddingRight);
        if (innerWidth <= 20) return;

        const elementRectCount = new Map();
        const linesByTop = new Map();
        const measureElements = [];

        lineElements.forEach((lineEl) => {
            const fragments = Array.from(lineEl.querySelectorAll('.subtitle-fragment'));
            if (fragments.length) {
                measureElements.push(...fragments);
            } else {
                measureElements.push(lineEl);
            }
        });

        measureElements.forEach((measureEl) => {
            const rects = this._getFlatLineClientRects(measureEl);
            elementRectCount.set(measureEl, rects.length);
            rects.forEach((rect) => {
                const key = Math.round(rect.top - containerRect.top);
                let line = linesByTop.get(key);
                if (!line) {
                    line = { left: rect.left, right: rect.right, elements: new Set() };
                    linesByTop.set(key, line);
                } else {
                    line.left = Math.min(line.left, rect.left);
                    line.right = Math.max(line.right, rect.right);
                }
                line.elements.add(measureEl);
            });
        });

        const visualLines = Array.from(linesByTop.entries())
            .sort((left, right) => left[0] - right[0])
            .map((entry) => entry[1]);
        if (!visualLines.length) return;

        visualLines.forEach((line) => {
            const elements = Array.from(line.elements);
            if (!elements.length) return;
            const lastEl = elements[elements.length - 1];
            if ((elementRectCount.get(lastEl) || 0) !== 1) return;
            const hangEndPx = this._getTrailingHangingPunctuationPx(lastEl);
            if (hangEndPx < -0.5) {
                lastEl.style.marginRight = `${hangEndPx.toFixed(3)}px`;
            }
        });

        const canStretchJustify = isFlatLayout && this.container.classList.contains('reader-text-justify');
        if (!canStretchJustify) return;
        if (visualLines.length <= 1) return;

        for (let i = 0; i < visualLines.length - 1; i += 1) {
            const line = visualLines[i];
            const elements = Array.from(line.elements);
            if (!elements.length) continue;
            if (elements.some((el) => (elementRectCount.get(el) || 0) > 1)) continue;

            const lineWidth = Math.max(0, line.right - line.left);
            const boundaryCount = Math.max(0, elements.length - 1);
            const boundaryGapPx = this._getFlatLineBoundaryGapPx(elements);
            const lineVisualWidth = lineWidth + boundaryGapPx;
            const slack = innerWidth - lineVisualWidth;
            if (slack < 2.5 || slack > (innerWidth * 0.18)) continue;

            let letters = 0;
            let spaces = 0;
            let words = 0;
            elements.forEach((el) => {
                const compact = (el.textContent || '').replace(/\s+/g, ' ').trim();
                if (!compact) return;
                words += compact.split(' ').filter(Boolean).length;
                letters += compact.replace(/\s/g, '').length;
                const localSpaces = compact.match(/\s+/g);
                if (localSpaces) spaces += localSpaces.length;
            });

            const totalGapUnits = spaces + boundaryCount;
            if (letters < 8) continue;
            if (totalGapUnits < 2) continue;
            if (words < 4 && slack > 9) continue;
            if (totalGapUnits < 3 && slack > 14) continue;

            const sparseLine = totalGapUnits < 6;
            const wordShare = sparseLine ? 0.82 : 0.76;
            const letterShare = sparseLine ? 0.13 : 0.18;
            const stretchShare = sparseLine ? 0.05 : 0.06;

            const addWord = Math.min(0.68, Math.max(0, (slack * wordShare) / Math.max(1, totalGapUnits)));
            const addLetter = Math.min(0.032, Math.max(0, (slack * letterShare) / Math.max(44, letters)));
            const usedSlack = (addWord * totalGapUnits) + (addLetter * letters);
            const remainingSlack = Math.max(0, slack - usedSlack);
            const stretchScale = 1 + Math.min(0.012, (remainingSlack * stretchShare) / Math.max(240, lineVisualWidth));
            const stretchPercent = stretchScale * 100;
            const hasStretch = stretchScale > 1.002;

            if (addWord < 0.03 && addLetter < 0.004 && !hasStretch) continue;

            const baselineGeometry = this._captureFlatLineGeometry(elements, containerRect);
            if (baselineGeometry.size !== elements.length) continue;

            elements.forEach((el) => {
                el.classList.add('flat-line-smart');
                el.style.setProperty('--flat-smart-word-spacing', `${addWord.toFixed(3)}px`);
                el.style.setProperty('--flat-smart-letter-spacing', `${addLetter.toFixed(3)}px`);
                if (hasStretch) {
                    el.style.setProperty('--flat-smart-stretch', `${stretchPercent.toFixed(2)}%`);
                    el.style.setProperty('--flat-smart-wdth', stretchPercent.toFixed(2));
                } else {
                    el.style.removeProperty('--flat-smart-stretch');
                    el.style.removeProperty('--flat-smart-wdth');
                }
            });

            if (this._didFlatLineGeometryChange(elements, containerRect, baselineGeometry)) {
                elements.forEach((el) => this._clearFlatSmartLineStyle(el));
            }
        }
    }

    _getReadingLayoutSignature() {
        if (!this.container || !this.isReadingMode) return '';
        const versionKey = String(this.container.dataset.version || this.renderVersion || 0);
        const classKey = this.container.className || '';
        const sizeKey = `${this.container.clientWidth || 0}x${this.container.clientHeight || 0}`;
        const childKey = String(this.container.childElementCount || 0);
        const styleKey = this.container.style ? this.container.style.cssText : '';
        return [versionKey, classKey, sizeKey, childKey, styleKey].join('|');
    }

    _scheduleReadingLayoutPass(force = false) {
        if (!this.container || !this.isReadingMode) return;
        const signature = this._getReadingLayoutSignature();
        if (!force && signature && signature === this._lastReadingLayoutSignature) return;
        if (signature) this._lastReadingLayoutSignature = signature;
        const runLayoutPass = () => this._applyFlatSmartJustification();

        if (this._pendingReadingLayoutFrame) {
            cancelAnimationFrame(this._pendingReadingLayoutFrame);
            this._pendingReadingLayoutFrame = 0;
        }
        if (this._pendingReadingLayoutSettleFrame) {
            cancelAnimationFrame(this._pendingReadingLayoutSettleFrame);
            this._pendingReadingLayoutSettleFrame = 0;
        }
        if (this._pendingReadingLayoutTimer) {
            clearTimeout(this._pendingReadingLayoutTimer);
            this._pendingReadingLayoutTimer = null;
        }

        if (typeof requestAnimationFrame === 'function') {
            this._pendingReadingLayoutFrame = requestAnimationFrame(() => {
                this._pendingReadingLayoutFrame = 0;
                runLayoutPass();
                this._pendingReadingLayoutSettleFrame = requestAnimationFrame(() => {
                    this._pendingReadingLayoutSettleFrame = 0;
                    runLayoutPass();
                });
            });
        } else {
            runLayoutPass();
        }

        this._pendingReadingLayoutTimer = setTimeout(() => {
            this._pendingReadingLayoutTimer = null;
            runLayoutPass();
        }, 120);
    }

    renderLines(centerIndex) {
        if (!this.container) return;

        if (this.subtitleTracks.length === 0) {
            this.container.innerHTML = '<div class="subtitle-line subtitle-current">...</div>';
            return;
        }

        if (this.isReadingMode) {
            const currentVersion = String(this.renderVersion);
            const renderedVersion = this.container.dataset.version || '';
            let didRebuildReadingDom = false;

            if (this.container.children.length !== this.subtitleTracks.length || renderedVersion !== currentVersion) {
                didRebuildReadingDom = true;
                this.container.innerHTML = '';
                this.container.dataset.version = currentVersion;

                for (let i = 0; i < this.subtitleTracks.length; i++) {
                    const div = document.createElement('div');
                    div.className = 'subtitle-line';
                    this._renderSubtitleTrackContent(div, this.subtitleTracks[i]);
                    this._wrapFlatTextFragments(div);
                    div.dataset.index = String(i);
                    this._applyFlatTimestampBoundaryGap(div, i);

                    div.style.cursor = 'pointer';
                    div.title = 'Springe zu dieser Stelle';
                    div.addEventListener('click', async (event) => {
                        if (this.canSeek && !this.canSeek()) return;
                        if (this.container.dataset.wasDragging === 'true') return;
                        if (
                            event &&
                            event.target &&
                            typeof event.target.closest === 'function' &&
                            event.target.closest('.subtitle-inline-link')
                        ) return;
                        // Skip seek if bookmark button was clicked
                        if (
                            event &&
                            event.target &&
                            typeof event.target.closest === 'function' &&
                            event.target.closest('.bookmark-btn')
                        ) return;
                        if (this._isDuplicateSeekRequest(i, this.subtitleTracks[i].time)) return;

                        await this.seekToTime(this.subtitleTracks[i].time, { autoplay: true });
                        this.smoothScrollTo(div);
                    });

                    // Custom Hook for Bookmarks etc.
                    if (this.onLineRender) {
                        this.onLineRender(div, this.subtitleTracks[i], i);
                    }

                    this.container.appendChild(div);
                    this._applyFlatLeadingCompensation(div, this.subtitleTracks[i].text);
                    if (this.container.classList.contains('reader-layout-flat') && i < this.subtitleTracks.length - 1) {
                        const separatorText = this._getTimestampBoundarySeparatorText(
                            this.subtitleTracks[i].text,
                            this.subtitleTracks[i + 1].text
                        );
                        if (separatorText) this.container.appendChild(document.createTextNode(separatorText));
                    }
                }
            }

            const oldActive = this.container.querySelector('.subtitle-current');
            if (oldActive) oldActive.classList.remove('subtitle-current');

            const safeIndex = centerIndex < 0 ? 0 : centerIndex;
            if (this.container.children.length > safeIndex) {
                const activeEl = this.container.children[safeIndex];
                activeEl.classList.add('subtitle-current');
                if (this.container.dataset.isDragging !== 'true' && !this.audio.paused) {
                    this.smoothScrollTo(activeEl);
                }
            }

            this._scheduleReadingLayoutPass(didRebuildReadingDom);
            return;
        }

        this.container.innerHTML = '';

        const maxLines = 3;
        const half = Math.floor(maxLines / 2);
        let start = Math.max(0, centerIndex - half);
        let end = Math.min(this.subtitleTracks.length - 1, start + maxLines - 1);
        start = Math.max(0, end - maxLines + 1);

        for (let i = start; i <= end; i++) {
            const div = document.createElement('div');
            div.className = 'subtitle-line';
            if (i === centerIndex) {
                div.classList.add('subtitle-current');
            } else {
                const dist = Math.abs(i - centerIndex);
                if (dist >= 4) div.classList.add('fade-far');
                else if (dist >= 2) div.classList.add('fade-mid');
            }
            this._renderSubtitleTrackContent(div, this.subtitleTracks[i]);
            this.container.appendChild(div);
        }
    }

    smoothScrollTo(targetEl) {
        if (!this.container || !targetEl) return;

        if (this.currentScrollAnimation) {
            cancelAnimationFrame(this.currentScrollAnimation);
            this.currentScrollAnimation = null;
        }

        const container = this.container;
        const startY = container.scrollTop;
        const containerRect = container.getBoundingClientRect();
        const clientRects = targetEl.getClientRects();
        const anchorRect = clientRects.length > 0 ? clientRects[0] : targetEl.getBoundingClientRect();
        const relativeTop = (anchorRect.top - containerRect.top) + container.scrollTop;
        const targetHeight = Math.max(anchorRect.height || 0, targetEl.clientHeight || 0, 1);
        const targetY = relativeTop - (container.clientHeight / 2) + (targetHeight / 2);
        const distance = Math.abs(targetY - startY);

        if (distance < 5) return;
        if (this.isReadingMode && distance < 16) {
            container.scrollTop = targetY;
            return;
        }

        let duration;
        if (this.isReadingMode) {
            duration = Math.min(360, Math.max(140, distance * 0.9));
        } else {
            duration = 1000;
            if (distance > 200) {
                const extraDist = Math.min(800, distance - 200);
                duration = 1000 + (extraDist / 800) * 2000;
            }
            duration = Math.min(3000, duration);
        }

        const startTime = performance.now();
        const easeOutQuad = (t) => t * (2 - t);

        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            if (elapsed >= duration) {
                container.scrollTop = targetY;
                this.currentScrollAnimation = null;
                return;
            }

            const progress = elapsed / duration;
            const eased = easeOutQuad(progress);
            container.scrollTop = startY + (targetY - startY) * eased;
            this.currentScrollAnimation = requestAnimationFrame(animate);
        };

        this.currentScrollAnimation = requestAnimationFrame(animate);
    }

    setReadingMode(active) {
        this.isReadingMode = active;
        this._lastReadingLayoutSignature = '';
        this.renderLines(this.currentSubtitleIndex);
    }

    async _skipBySeconds(sec) {
        if (this.canSeek && !this.canSeek()) return;
        const delta = Number(sec) || 0;
        if (!delta) return;

        const wasPlaying = (typeof this.audio.isProbablyPlaying === 'function')
            ? this.audio.isProbablyPlaying()
            : !this.audio.paused;

        let baseTime = this.audio.currentTime || 0;
        try {
            if (typeof this.audio.getAccurateCurrentTime === 'function') {
                baseTime = await this.audio.getAccurateCurrentTime(900);
            }
        } catch (_) {
            // Keep baseTime fallback
        }

        let target = Math.max(0, baseTime + delta);
        const duration = Number(this.audio.duration);
        if (Number.isFinite(duration) && duration > 0) {
            target = Math.min(duration, target);
        }

        if (typeof this.audio.seekAndConfirm === 'function') {
            await this.audio.seekAndConfirm(target, {
                maxAttempts: 4,
                settleMs: 180,
                tolerance: 0.9
            });
        } else {
            this.audio.currentTime = target;
            await this._wait(160);
        }

        const effectiveTime = (typeof this.audio.getAccurateCurrentTime === 'function')
            ? await this.audio.getAccurateCurrentTime(900)
            : (this.audio.currentTime || target);
        this.currentSubtitleIndex = this.subtitleTracks.length ? this.findSubtitleIndexForTime(effectiveTime) : 0;
        this.renderLines(this.currentSubtitleIndex);

        if (wasPlaying && this.audio.paused) {
            try { await this.audio.play(); } catch (_) { /* ignored */ }
        } else if (!wasPlaying && !this.audio.paused) {
            this.audio.pause();
        }
    }

    // Controls
    play() { return this.audio.play(); }
    pause() { this.audio.pause(); }
    toggle() { if (this.audio.paused) this.play(); else this.pause(); }
    skip(sec) {
        this._skipBySeconds(sec).catch(e => {
            console.warn('SharedAudioPlayer skip failed:', e);
        });
    }

    // Getters/Setters for compatibility
    get paused() { return this.audio.paused; }
    get currentTime() { return this.audio.currentTime; }
    set currentTime(val) { this.audio.currentTime = val; this.onTimeUpdate(); }
    get duration() { return this.audio.duration; }
    get volume() { return this.audio.volume; }
    set volume(val) { this.audio.volume = val; }
    get src() { return this.audio.src; }
    set src(val) { this.audio.src = val; }
}

