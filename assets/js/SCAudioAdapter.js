/**
 * SCAudioAdapter - HTML5 Audio-kompatible Wrapper-Klasse für SoundCloud Widget API
 * 
 * Unterstützt dynamische Iframe-Erstellung für Multi-Instanz-Nutzung.
 */
class SCAudioAdapter {
    constructor(iframeIdOrOptions = {}) {
        let iframeId = (typeof iframeIdOrOptions === 'string') ? iframeIdOrOptions : null;
        let options = (typeof iframeIdOrOptions === 'object') ? iframeIdOrOptions : {};

        // 1. Iframe finden oder erstellen (aber noch nicht laden!)
        this.iframe = iframeId ? document.getElementById(iframeId) : null;
        this.iframeId = iframeId; // Store ID for potential reuse checks

        if (!this.iframe) {
            // Check if body exists
            if (document.body) {
                this._createIframe(iframeId);
                this._checkInitWidget();
            } else {
                console.log('[SCAudioAdapter] document.body not ready. Deferring iframe creation...');
                window.addEventListener('DOMContentLoaded', () => {
                    if (!this.iframe) {
                        this._createIframe(iframeId);
                        // If we have a pending src, init widget now
                        if (this._src) this._initWidget(this._src);
                        else this._checkInitWidget();
                    }
                });
            }
        } else {
            // Iframe provided externally
            this._checkInitWidget();
        }

        // Widget wird erst initialisiert, wenn wir einen validen SRC haben
        this.widget = null;

        // Internal State
        this._currentTimeMs = 0;
        this._durationMs = 0;
        this._paused = true;
        this._volume = 1.0;
        this._isReady = false;
        this._pendingPlay = false;
        this._pendingInit = false; // Lock to prevent double init
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
    }

    _createIframe(id) {
        console.log('[SCAudioAdapter] Creating dynamic iframe...');
        this.iframe = document.createElement('iframe');
        this.iframe.style.display = 'none';
        this.iframe.setAttribute('allow', 'autoplay');
        this.iframe.setAttribute('frameborder', '0');
        if (id) this.iframe.id = id;
        document.body.appendChild(this.iframe);
    }

    _checkInitWidget() {
        // Placeholder for future use. Widget init is deferred to src setter.
    }

    _initWidget(initialUrl) {
        if (this._pendingInit) return;
        this._pendingInit = true;

        console.log('[SCAudioAdapter] Initializing Widget with URL:', initialUrl);

        // 1. Setze Iframe Src
        // Standard Params für Widget API compliance
        const widgetOptions = '&auto_play=false&hide_related=true&show_comments=false&buying=false&sharing=false&download=false&show_artwork=false&visual=false&single_active=false';
        this.iframe.src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(initialUrl)}${widgetOptions}`;

        // 2. Warte auf Load, dann binde API
        this.iframe.onload = () => {
            console.log('[SCAudioAdapter] Iframe loaded. Binding SC.Widget...');

            // Safety Check: Falls SC nicht da ist
            if (typeof SC === 'undefined') {
                console.error('[SCAudioAdapter] SC Global Object not found! Is api.js loaded?');
                return;
            }

            this.widget = SC.Widget(this.iframe);
            this._bindWidgetEvents();
        };
    }

    _bindWidgetEvents() {
        this.widget.bind(SC.Widget.Events.READY, () => {
            this._isReady = true;
            this._pendingInit = false; // Init complete
            console.log('[SCAudioAdapter] READY');

            // Wenn wir in der Zwischenzeit Volume gesetzt haben
            this.widget.setVolume(this._volume * 100);

            if (this._pendingPlay) {
                this._pendingPlay = false;
                this.widget.play();
            }

            this.widget.getDuration(ms => {
                this._durationMs = ms;
                this._dispatch('loadedmetadata');
                this._dispatch('canplay');
            });
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

        // Error Handling
        this.widget.bind(SC.Widget.Events.ERROR, (e) => {
            console.error('[SCAudioAdapter] Widget Error:', e);
        });
    }

    // HTML5 compatible properties
    get currentTime() { return this._currentTimeMs / 1000; }
    set currentTime(s) {
        this._currentTimeMs = s * 1000;
        if (this._isReady && this.widget) this.widget.seekTo(this._currentTimeMs);
    }

    get duration() { return this._durationMs / 1000; }
    get paused() { return this._paused; }
    get volume() { return this._volume; }
    set volume(v) {
        this._volume = Math.max(0, Math.min(1, v));
        if (this._isReady && this.widget) this.widget.setVolume(this._volume * 100);
    }

    get src() { return this._src; }
    set src(url) {
        if (!url) return;
        this._src = url;

        // Fall 1: Noch kein Widget -> Init
        // Aber nur, wenn das Iframe schon existiert. Sonst wird es im DOMContentLoaded-Handler initialisiert.
        if (!this.widget && !this._pendingInit) {
            if (this.iframe) { // Check if iframe element is available
                this._initWidget(url);
            }
            return;
        }

        // Fall 2: Widget existiert (oder init läuft) -> Load
        // Achtung: Wenn init läuft (_pendingInit), müssen wir warten? 
        // Nein, .load() kann erst gerufen werden wenn ready.
        // Wir setzen _isReady = false, damit play() queued.

        this._isReady = false;
        this._currentTimeMs = 0;

        // Wait until existing widget is actually usable? 
        // Helper to retry load if widget not ready/bound yet
        const safeLoad = () => {
            if (this.widget && typeof this.widget.load === 'function') {
                this.widget.load(url, {
                    auto_play: false, // Wir steuern Play manuell
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
                        console.log('[SCAudioAdapter] Track loaded via .load():', url);
                    }
                });
            } else {
                // If initializing, verify again shortly
                setTimeout(safeLoad, 500);
            }
        };

        if (this.widget) {
            safeLoad();
        } else {
            // Should be covered by Init logic, but if double-set happens during init:
            // Just let the initial init finish, the iframe src will load THIS url if it was the first.
            // If this is a SECOND set during init... tricky. 
            // Simplified: The FIRST set wins the init. Subsequent sets must wait.
            // For now, assume sequential flow.
        }
    }

    play() {
        if (this._isReady && this.widget) {
            this.widget.play();
        } else {
            this._pendingPlay = true;
        }
        return Promise.resolve();
    }

    pause() {
        this._pendingPlay = false;
        if (this._isReady && this.widget) this.widget.pause();
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
    // DOM Compatibility Stubs
    blur() { /* No-op: SCAudioAdapter is not a DOM element */ }
    focus() { /* No-op: SCAudioAdapter is not a DOM element */ }
}

if (typeof window !== 'undefined') {
    window.SCAudioAdapter = SCAudioAdapter;
}
