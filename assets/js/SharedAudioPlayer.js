export class SharedAudioPlayer {
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
        this.isReadingMode = options.isReadingMode || false;
        this.onLineRender = options.onLineRender || null;
        this.canSeek = (typeof options.canSeek === 'function') ? options.canSeek : null;
        this._textLoadRequestId = 0;
        this._activeTextAbortController = null;
        this._flatCompMeasureCanvas = null;
        this._flatCompMeasureCtx = null;
        this._flatCompMeasureCache = new Map();

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

        if (autoplay) {
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
                    this.subtitleTracks.push({ time: totalSeconds, text });
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

    _getFlatCompensationGapPx(text, sampleEl) {
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

    _applyFlatCompensationGap(lineEl, text) {
        if (!lineEl) return;
        if (!this.container || !this.container.classList.contains('reader-layout-flat')) {
            lineEl.style.removeProperty('--flat-comp-gap');
            return;
        }
        const compensationPx = this._getFlatCompensationGapPx(text, lineEl);
        lineEl.style.setProperty('--flat-comp-gap', `${compensationPx}px`);
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

            if (this.container.children.length !== this.subtitleTracks.length || renderedVersion !== currentVersion) {
                this.container.innerHTML = '';
                this.container.dataset.version = currentVersion;

                for (let i = 0; i < this.subtitleTracks.length; i++) {
                    const div = document.createElement('div');
                    div.className = 'subtitle-line';
                    div.innerText = this.subtitleTracks[i].text;
                    div.dataset.index = String(i);

                    div.style.cursor = 'pointer';
                    div.title = 'Springe zu dieser Stelle';
                    div.addEventListener('click', async (event) => {
                        if (this.canSeek && !this.canSeek()) return;
                        if (this.container.dataset.wasDragging === 'true') return;
                        // Skip seek if bookmark button was clicked
                        if (
                            event &&
                            event.target &&
                            typeof event.target.closest === 'function' &&
                            event.target.closest('.bookmark-btn')
                        ) return;

                        await this.seekToTime(this.subtitleTracks[i].time, { autoplay: true });
                        this.smoothScrollTo(div);
                    });

                    // Custom Hook for Bookmarks etc.
                    if (this.onLineRender) {
                        this.onLineRender(div, this.subtitleTracks[i], i);
                    }

                    this.container.appendChild(div);
                    this._applyFlatCompensationGap(div, this.subtitleTracks[i].text);
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
            div.textContent = this.subtitleTracks[i].text;
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

        let duration = 1000;
        if (distance > 200) {
            const extraDist = Math.min(800, distance - 200);
            duration = 1000 + (extraDist / 800) * 2000;
        }
        duration = Math.min(3000, duration);

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
