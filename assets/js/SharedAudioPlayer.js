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
            const text = await response.text();
            this.parseSubtitles(text);
        } catch (e) {
            console.error("SharedAudioPlayer: Failed to load text", e);
            this.container.innerHTML = `<div class="subtitle-line subtitle-current">Fehler beim Laden des Textes: ${url}</div>`;
        }
    }

    parseSubtitles(rawText) {
        this.subtitleTracks = [];
        // Robust regex from Liminal Library (supports hh:mm:ss and decimals)
        const lines = rawText.split(/\r?\n/);
        const timeReg = /^\[(\d{1,2}):(\d{1,2})(?::(\d{1,2}(?:\.\d+)?)?)?\][ ]*(.*)/;

        lines.forEach(line => {
            const match = line.match(timeReg);
            if (match) {
                const part1 = parseFloat(match[1]);
                const part2 = parseFloat(match[2]);
                const part3 = match[3] ? parseFloat(match[3]) : null;

                let totalSeconds = 0;
                if (part3 !== null) {
                    // hh:mm:ss
                    totalSeconds = part1 * 3600 + part2 * 60 + part3;
                } else {
                    // mm:ss
                    totalSeconds = part1 * 60 + part2;
                }

                const text = match[4] ? match[4].trim() : '';
                if (text) {
                    this.subtitleTracks.push({ time: totalSeconds, text });
                }
            }
        });
        this.subtitleTracks.sort((a, b) => a.time - b.time);
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
        this.container.innerHTML = '';

        if (this.subtitleTracks.length === 0) {
            this.container.innerHTML = '<div class="subtitle-line subtitle-current">...</div>';
            return;
        }

        const maxLines = this.isReadingMode ? this.subtitleTracks.length : 3;

        let start, end;
        if (this.isReadingMode) {
            start = 0;
            end = this.subtitleTracks.length - 1;
        } else {
            const half = Math.floor(maxLines / 2);
            start = Math.max(0, centerIndex - half);
            end = Math.min(this.subtitleTracks.length - 1, start + maxLines - 1);
            // Adjust start if near end
            start = Math.max(0, end - maxLines + 1);
        }

        for (let i = start; i <= end; i++) {
            const div = document.createElement('div');
            div.className = 'subtitle-line';
            if (i === centerIndex) div.classList.add('subtitle-current');

            // Fading logic
            const dist = Math.abs(i - centerIndex);
            if (dist >= 4) div.classList.add('fade-far');
            else if (dist >= 2 && !this.isReadingMode) div.classList.add('fade-mid');

            div.innerHTML = this.subtitleTracks[i].text;

            // Allow seeking in Reading Mode
            if (this.isReadingMode) {
                div.style.cursor = 'pointer';
                div.title = 'Springe zu dieser Stelle';
                div.addEventListener('click', () => {
                    // Check drag state from container
                    if (this.container.dataset.wasDragging === 'true') return;

                    console.log(`Seek to ${this.subtitleTracks[i].time}`);
                    this.audio.currentTime = this.subtitleTracks[i].time;
                    this.onTimeUpdate(); // Update now

                    // SMOOTH SCROLL (Task 5c)
                    this.smoothScrollTo(div);
                });
            }

            this.container.appendChild(div);

            if (i === centerIndex && this.isReadingMode && !this.audio.paused) {
                // ONLY Auto-Scroll if Playing AND user is not actively dragging (Task 5b)
                // Removed 'is-scrolling' check per user request - was blocking updates too long
                if (this.container.dataset.isDragging !== 'true') {
                    div.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
        }
    }

    // Custom Smooth Scroll (Task 5c)
    smoothScrollTo(targetEl) {
        if (!this.container || !targetEl) return;

        const container = this.container;
        const startY = container.scrollTop;

        // Calculate Target Y to center the element
        const targetRect = targetEl.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        // Offset relative to container top
        const relativeTop = targetEl.offsetTop;
        // We want: relativeTop - (containerHeight/2) + (elementHeight/2)
        const targetY = relativeTop - (container.clientHeight / 2) + (targetEl.clientHeight / 2);

        const distance = Math.abs(targetY - startY);

        // Dynamic Duration: 1s (near) to 3s (far)
        // Let's say "Far" is > 1000px
        let duration = 1000 + (distance / 500) * 1000;
        duration = Math.min(3000, duration); // Cap at 3s

        console.log(`[DEBUG_SYS] SmoothScroll: Dist=${distance.toFixed(0)}px -> Duration=${duration.toFixed(0)}ms`);

        const startTime = performance.now();

        const easeInOutQuad = (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            if (elapsed > duration) {
                container.scrollTop = targetY; // Snap to final
                return;
            }

            const progress = elapsed / duration;
            const eased = easeInOutQuad(progress);

            container.scrollTop = startY + (targetY - startY) * eased;

            requestAnimationFrame(animate);
        };

        requestAnimationFrame(animate);
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
