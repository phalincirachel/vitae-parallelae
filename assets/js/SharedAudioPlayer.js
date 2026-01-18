export class SharedAudioPlayer {
    constructor(audioUrl, textUrl, options = {}) {
        this.audio = new Audio(audioUrl);
        this.subtitleTracks = [];
        this.currentSubtitleIndex = -1;
        this.container = options.container || document.getElementById('subtitleContainer');
        this.isReadingMode = false;

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
        const lines = rawText.split('\n');
        // Match [mm:ss] or [mm:ss.xx]
        const timeReg = /\[(\d{2}):(\d{2}(?:\.\d+)?)\](.*)/;

        lines.forEach(line => {
            const match = line.match(timeReg);
            if (match) {
                const minutes = parseFloat(match[1]);
                const seconds = parseFloat(match[2]);
                const text = match[3].trim();
                const totalSeconds = minutes * 60 + seconds;
                this.subtitleTracks.push({ time: totalSeconds, text });
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

        const maxLines = this.isReadingMode ? 15 : 3;
        const half = Math.floor(maxLines / 2);

        let start = Math.max(0, centerIndex - half);
        let end = Math.min(this.subtitleTracks.length - 1, start + maxLines - 1);

        // Adjust start if near end
        start = Math.max(0, end - maxLines + 1);

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
                    console.log(`Seek to ${this.subtitleTracks[i].time}`);
                    this.audio.currentTime = this.subtitleTracks[i].time;
                    this.onTimeUpdate(); // Update now
                });
            }

            this.container.appendChild(div);

            if (i === centerIndex && this.isReadingMode) {
                div.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
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
}
