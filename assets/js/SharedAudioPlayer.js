export class SharedAudioPlayer {
    constructor(audioUrl, textUrl, options = {}) {
        // SC Integration: Nutze Adapter und konvertiere URL
        const scUrl = typeof getSCUrl === 'function' ? getSCUrl(audioUrl) : audioUrl;

        if (typeof SCAudioAdapter !== 'undefined') {
            this.audio = new SCAudioAdapter({ iframeId: options.iframeId || 'sc-widget-shared' });
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

        // Default volumes
        this.audio.volume = options.volume || 1.0;

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
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const text = await response.text();
            this.parseSubtitles(text);
            return true;
        } catch (e) {
            console.error("SharedAudioPlayer: Failed to load text", e);
            this.container.innerHTML = `<div class="subtitle-line subtitle-current">Fehler beim Laden des Textes: ${url}</div>`;
            return false;
        }
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
                    div.addEventListener('click', () => {
                        if (this.container.dataset.wasDragging === 'true') return;
                        this.audio.currentTime = this.subtitleTracks[i].time;
                        this.onTimeUpdate();
                        this.smoothScrollTo(div);
                    });

                    this.container.appendChild(div);
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
            div.innerHTML = this.subtitleTracks[i].text;
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
        const relativeTop = targetEl.offsetTop;
        const targetY = relativeTop - (container.clientHeight / 2) + (targetEl.clientHeight / 2);
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

    // Controls
    play() { return this.audio.play(); }
    pause() { this.audio.pause(); }
    toggle() { if (this.audio.paused) this.play(); else this.pause(); }
    skip(sec) { this.audio.currentTime = Math.max(0, Math.min(this.audio.duration || 0, this.audio.currentTime + sec)); }

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
