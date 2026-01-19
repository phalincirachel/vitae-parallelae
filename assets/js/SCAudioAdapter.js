/**
 * SCAudioAdapter - HTML5 Audio-kompatible Wrapper-Klasse für SoundCloud Widget API
 * 
 * Unterstützt dynamische Iframe-Erstellung für Multi-Instanz-Nutzung.
 */
class SCAudioAdapter {
    constructor(iframeIdOrOptions = {}) {
        let iframeId = (typeof iframeIdOrOptions === 'string') ? iframeIdOrOptions : null;
        let options = (typeof iframeIdOrOptions === 'object') ? iframeIdOrOptions : {};

        // 1. Iframe finden oder erstellen
        this.iframe = iframeId ? document.getElementById(iframeId) : null;

        if (!this.iframe) {
            console.log('[SCAudioAdapter] No iframe found/provided. Creating dynamic iframe...');
            this.iframe = document.createElement('iframe');
            this.iframe.style.display = 'none';
            this.iframe.width = '0';
            this.iframe.height = '0';
            this.iframe.allow = 'autoplay';
            this.iframe.src = 'https://w.soundcloud.com/player/?url=';
            document.body.appendChild(this.iframe);
        }

        // 2. Widget initialisieren
        this.widget = SC.Widget(this.iframe);

        // Internal State
        this._currentTimeMs = 0;
        this._durationMs = 0;
        this._paused = true;
        this._volume = 1.0;
        this._isReady = false;
        this._pendingPlay = false;
        this._src = '';

        // Event Listeners
        this._listeners = {
            timeupdate: [],
            ended: [],
            play: [],
            pause: [],
            loadedmetadata: [],
            canplay: []
        };

        this._bindWidgetEvents();
    }

    _bindWidgetEvents() {
        this.widget.bind(SC.Widget.Events.READY, () => {
            this._isReady = true;
            console.log('[SCAudioAdapter] READY');

            if (this._pendingPlay) {
                this._pendingPlay = false;
                this.widget.play();
            }

            this.widget.getDuration(ms => {
                this._durationMs = ms;
                this._dispatch('loadedmetadata');
                this._dispatch('canplay');
            });

            // Initiales Volume setzen
            this.widget.setVolume(this._volume * 100);
        });

        this.widget.bind(SC.Widget.Events.PLAY_PROGRESS, (data) => {
            this._currentTimeMs = data.currentPosition;
            this._dispatch('timeupdate');
        });

        this.widget.bind(SC.Widget.Events.PLAY, () => {
            this._paused = false;
            this._dispatch('play');
        });

        this.widget.bind(SC.Widget.Events.PAUSE, () => {
            this._paused = true;
            this._dispatch('pause');
        });

        this.widget.bind(SC.Widget.Events.FINISH, () => {
            this._paused = true;
            this._dispatch('ended');
        });
    }

    // HTML5 compatible properties
    get currentTime() { return this._currentTimeMs / 1000; }
    set currentTime(s) {
        this._currentTimeMs = s * 1000;
        if (this._isReady) this.widget.seekTo(this._currentTimeMs);
    }

    get duration() { return this._durationMs / 1000; }
    get paused() { return this._paused; }
    get volume() { return this._volume; }
    set volume(v) {
        this._volume = Math.max(0, Math.min(1, v));
        if (this._isReady) this.widget.setVolume(this._volume * 100);
    }

    get src() { return this._src; }
    set src(url) {
        if (!url) return;
        this._src = url;
        this._isReady = false;
        this._currentTimeMs = 0;

        this.widget.load(url, {
            auto_play: false,
            buying: false,
            liking: false,
            download: false,
            sharing: false,
            show_artwork: false,
            show_comments: false,
            show_playcount: false,
            show_user: false,
            hide_related: true,
            visual: false,
            callback: () => {
                console.log('[SCAudioAdapter] Track loaded:', url);
            }
        });
    }

    play() {
        if (this._isReady) {
            this.widget.play();
        } else {
            this._pendingPlay = true;
        }
        return Promise.resolve();
    }

    pause() {
        this._pendingPlay = false;
        if (this._isReady) this.widget.pause();
    }

    addEventListener(ev, cb) {
        if (this._listeners[ev]) this._listeners[ev].push(cb);
    }

    removeEventListener(ev, cb) {
        if (this._listeners[ev]) {
            this._listeners[ev] = this._listeners[ev].filter(l => l !== cb);
        }
    }

    _dispatch(ev) {
        if (this._listeners[ev]) {
            this._listeners[ev].forEach(cb => {
                try { cb(); } catch (e) { console.error(e); }
            });
        }
    }
}

if (typeof window !== 'undefined') {
    window.SCAudioAdapter = SCAudioAdapter;
}
