/**
 * SCAudioAdapter - Hybrid Audio Wrapper for SoundCloud Widget API & HTML5 Audio
 * 
 * Supports dynamic Iframe creation for SoundCloud and fallback to HTML5 Audio for local files.
 * Provides a unified API: play(), pause(), currentTime, volume, src, and event listeners.
 */



class SCAudioAdapter {
    constructor(iframeIdOrOptions = {}) {
        let iframeId = null;
        if (typeof iframeIdOrOptions === 'string') {
            iframeId = iframeIdOrOptions;
        } else if (iframeIdOrOptions && typeof iframeIdOrOptions === 'object') {
            iframeId = (typeof iframeIdOrOptions.iframeId === 'string') ? iframeIdOrOptions.iframeId : null;
        }

        // --- 1. SoundCloud Widget Setup ---
        this.iframe = iframeId ? document.getElementById(iframeId) : null;
        this.iframeId = iframeId;
        this.widget = null; // Will be initialized if Mode is SC

        // --- 2. HTML5 Audio Setup ---
        this.audioNode = new Audio();
        this.audioNode.autoplay = false;
        this.audioNode.preload = 'auto';

        // --- 3. Internal State ---
        this.mode = 'none'; // 'sc' or 'html5'
        this._src = '';
        this._isReady = false;
        this._pendingPlay = false;
        this._volume = 1.0;
        this._scPaused = true;
        this._scCurrentTime = 0;
        this._playIntent = false;
        this._scLastProgressAt = 0;
        this._pendingSeek = undefined;

        // Event Listeners Storage
        this._listeners = {
            timeupdate: [],
            ended: [],
            play: [],
            pause: [],
            loadedmetadata: [],
            canplay: []
        };

        // --- 4. Init Listeners for HTML5 Audio ---
        this._bindHtml5Events();

        // Register with Visibility Manager if available
        if (typeof window !== 'undefined' && window.AudioVisibilityManager) {
            window.AudioVisibilityManager.register(this);
        }
    }

    _trace() { }

    _bindHtml5Events() {
        const events = ['timeupdate', 'ended', 'play', 'pause', 'loadedmetadata', 'canplay'];
        events.forEach(ev => {
            this.audioNode.addEventListener(ev, () => {
                if (this.mode === 'html5') {
                    if (ev === 'play') this._playIntent = true;
                    if (ev === 'pause' || ev === 'ended') this._playIntent = false;
                    this._dispatch(ev);
                }
            });
        });

        // Handle Error
        this.audioNode.addEventListener('error', (e) => {
            if (this.mode === 'html5') console.error('[SCAudioAdapter] HTML5 Audio Error:', e);
        });
    }

    // --- Iframe Creation (Lazy) ---
    _ensureIframe() {
        if (this.iframe) return;
        if (typeof document === 'undefined') return;

        console.log('[SCAudioAdapter] Creating dynamic iframe for SoundCloud...');
        this.iframe = document.createElement('iframe');
        this.iframe.style.display = 'none';
        this.iframe.setAttribute('allow', 'autoplay');
        this.iframe.setAttribute('frameborder', '0');
        if (this.iframeId) this.iframe.id = this.iframeId;
        document.body.appendChild(this.iframe);
    }

    // --- Core API ---

    get src() { return this._src; }
    set src(url) {
        if (!url) return;
        this._src = url;
        this._isReady = false;
        // Reset cached SC transport state when loading a new source.
        // Prevents stale position carries across chapters/tracks.
        this._scCurrentTime = 0;
        this._pendingSeek = undefined;
        this._scLastProgressAt = 0;

        // Detect Type
        const isSoundCloud = url.includes('soundcloud.com');
        this._trace('src:set', { url, isSoundCloud });

        if (isSoundCloud) {
            this._switchToSC(url);
        } else {
            this._switchToHtml5(url);
        }
    }

    _switchToHtml5(url) {
        console.log('[SCAudioAdapter] Switching to HTML5 Audio for:', url);
        this._trace('switch:html5', { url });
        this.mode = 'html5';
        this._scPaused = true;
        this._playIntent = false;
        this._scCurrentTime = 0;
        this._pendingSeek = undefined;
        this._scLastProgressAt = 0;

        // Pause Widget if active
        if (this.widget) this.widget.pause();

        this.audioNode.src = url;
        this.audioNode.volume = this._volume;
        this.audioNode.load(); // Force load
        this._isReady = true; // HTML5 is effectively "ready" to receive commands immediately

        if (this._pendingPlay) {
            this._pendingPlay = false;
            this.audioNode.play().catch(e => console.warn('[SCAudioAdapter] Auto-play blocked:', e));
        }
    }

    _switchToSC(url) {
        console.log('[SCAudioAdapter] Switching to SoundCloud for:', url);
        this._trace('switch:sc', { url });
        this.mode = 'sc';
        this._scPaused = true;
        this._playIntent = false;
        this._scCurrentTime = 0;
        this._pendingSeek = undefined;
        this._scLastProgressAt = 0;

        // Pause HTML5 if active
        this.audioNode.pause();

        this._ensureIframe();

        // Check if Widget already exists
        if (!this.widget) {
            // First Init
            const widgetOptions = '&auto_play=false&hide_related=true&show_comments=false&buying=false&sharing=false&download=false&show_artwork=false&visual=false&single_active=false';
            this.iframe.src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}${widgetOptions}`;

            this.iframe.onload = () => {
                if (typeof SC === 'undefined') {
                    console.error('[SCAudioAdapter] SC API not found!');
                    return;
                }
                this.widget = SC.Widget(this.iframe);
                this._bindWidgetEvents();
            };
        } else {
            // Reload Widget
            this.widget.load(url, {
                auto_play: false,
                callback: () => {
                    this._isReady = true;
                    this.widget.setVolume(this._volume * 100);
                    if (this._pendingPlay) {
                        this._pendingPlay = false;
                        this.widget.play();
                    }
                    this._dispatch('loadedmetadata');
                }
            });
        }
    }

    _bindWidgetEvents() {
        this.widget.bind(SC.Widget.Events.READY, () => {
            this._isReady = true;
            console.log('[SCAudioAdapter] SC Widget READY');
            this._trace('sc:event:ready');
            this.widget.setVolume(this._volume * 100);
            if (this._pendingPlay) {
                this._pendingPlay = false;
                this._playIntent = true;
                this.widget.play();
            }
        });

        this.widget.bind(SC.Widget.Events.PLAY, () => {
            if (this.mode !== 'sc' || !this._isReady) return;
            this._scPaused = false;
            this._playIntent = true;
            this._scLastProgressAt = Date.now();
            this._trace('sc:event:play');
            this._dispatch('play');
            // Apply pending seek after playback starts
            this._applyPendingSeek();
        });

        this.widget.bind(SC.Widget.Events.PAUSE, () => {
            if (this.mode !== 'sc' || !this._isReady) return;
            this._scPaused = true;
            this._playIntent = false;
            this._trace('sc:event:pause');
            this._dispatch('pause');
        });

        this.widget.bind(SC.Widget.Events.FINISH, () => {
            if (this.mode !== 'sc' || !this._isReady) return;
            this._scPaused = true;
            this._playIntent = false;
            this._trace('sc:event:finish');
            this._dispatch('ended');
        });

        this.widget.bind(SC.Widget.Events.PLAY_PROGRESS, (data) => {
            if (this.mode !== 'sc' || !this._isReady) return;
            if (data && Number.isFinite(data.currentPosition)) {
                this._scCurrentTime = data.currentPosition / 1000;
            }
            // Do NOT set _scPaused here — late PLAY_PROGRESS events after PAUSE
            // would overwrite the pause state. Only PLAY event controls _scPaused.
            this._scLastProgressAt = Date.now();
            this._dispatch('timeupdate');
        });

        // Error Handling
        this.widget.bind(SC.Widget.Events.ERROR, (e) => {
            console.error('[SCAudioAdapter] Widget Error:', e);
        });
    }

    // --- Controls ---

    play() {
        this._trace('control:play:requested');
        this._playIntent = true;
        if (this.mode === 'html5') {
            this._trace('control:play:html5');
            return this.audioNode.play();
        } else if (this.mode === 'sc' && this.widget && this._isReady) {
            // Skip if already playing to prevent double-play stutter
            const progressAge = Date.now() - this._scLastProgressAt;
            if (!this._scPaused && progressAge < 1500) {
                this._trace('control:play:skip-already-playing', { progressAge });
                return Promise.resolve();
            }
            this._trace('control:play:sc-dispatch');
            this.widget.play();
            return Promise.resolve();
        } else {
            this._pendingPlay = true;
            this._trace('control:play:queued');
            return Promise.resolve();
        }
    }

    pause() {
        this._trace('control:pause:requested');
        this._playIntent = false;
        this._pendingPlay = false;
        if (this.mode === 'html5') {
            this._trace('control:pause:html5');
            this.audioNode.pause();
        } else if (this.mode === 'sc' && this.widget) {
            this._scPaused = true;
            this._trace('control:pause:sc-dispatch');
            this.widget.pause();
        }
    }

    /**
     * Returns transport pause state without intent-based heuristics.
     * Useful for UI state decisions to avoid icon drift.
     */
    isTransportPaused() {
        if (this.mode === 'html5') return this.audioNode.paused;
        if (this.mode === 'sc') return this._scPaused !== false;
        return true;
    }

    /**
     * Returns true when genuine playback progress arrived recently.
     * For SC this is based on PLAY/PLAY_PROGRESS timestamps.
     */
    hasRecentProgress(maxAgeMs = 1400) {
        if (this.mode === 'html5') return !this.audioNode.paused;
        if (this.mode !== 'sc') return false;
        const age = Date.now() - this._scLastProgressAt;
        return (this._scPaused === false) && age >= 0 && age <= Math.max(100, Number(maxAgeMs) || 0);
    }

    toggle() {
        if (this.paused) this.play();
        else this.pause();
    }

    // --- Properties ---

    get paused() {
        if (this.mode === 'html5') return this.audioNode.paused;
        // SoundCloud pause state can lag behind; combine intent + recent progress.
        if (this._pendingPlay || this._playIntent) {
            if (Date.now() - this._scLastProgressAt < 1500) {
                return false;
            }
        }
        return this._scPaused !== false; // Default to true (paused)
    }

    get currentTime() {
        if (this.mode === 'html5') return this.audioNode.currentTime;
        return this._scCurrentTime || 0;
    }

    set currentTime(val) {
        const safeVal = Math.max(0, Number(val) || 0);
        this._scCurrentTime = safeVal;
        if (this.mode === 'html5') {
            this.audioNode.currentTime = safeVal;
        } else if (this.mode === 'sc' && this.widget) {
            // Only store as pending seek if widget isn't ready yet.
            // When ready, the direct seekTo() call is sufficient.
            if (!this._isReady) {
                this._pendingSeek = safeVal;
            }
            // Try to seek immediately
            this.widget.seekTo(safeVal * 1000);
        }
    }

    // Called when SC starts playing - apply pending seek if exists
    _applyPendingSeek() {
        if (this.mode === 'sc' && this.widget && this._pendingSeek !== undefined) {
            const seekVal = this._pendingSeek;
            this._pendingSeek = undefined;
            this._scCurrentTime = seekVal;
            setTimeout(() => {
                this.widget.seekTo(seekVal * 1000);
            }, 500); // Small delay to ensure widget is ready
        }
    }

    get volume() { return this._volume; }
    set volume(v) {
        this._volume = Math.max(0, Math.min(1, v));
        if (this.mode === 'html5') {
            this.audioNode.volume = this._volume;
        } else if (this.mode === 'sc' && this.widget) {
            this.widget.setVolume(this._volume * 100);
        }
    }

    skip(amount) {
        this.currentTime = this.currentTime + amount;
    }

    _wait(ms) {
        return new Promise(resolve => setTimeout(resolve, Math.max(0, ms || 0)));
    }

    async _waitForScReady(timeoutMs = 2200) {
        if (this.mode !== 'sc') return true;
        const end = Date.now() + Math.max(200, timeoutMs || 0);
        while (Date.now() < end) {
            if (this._isReady && this.widget) return true;
            await this._wait(80);
        }
        return !!(this._isReady && this.widget);
    }

    /**
     * Force-seek and verify the resulting position, useful for streamed SC tracks.
     *
     * @param {number} targetSeconds
     * @param {{maxAttempts?:number, settleMs?:number, tolerance?:number}} options
     * @returns {Promise<{ok:boolean,target:number,position:number,attempts:number}>}
     */
    async seekAndConfirm(targetSeconds, options = {}) {
        const target = Math.max(0, Number(targetSeconds) || 0);
        let isPlaying = this.isProbablyPlaying();
        let maxAttempts = Math.max(1, isPlaying ? Math.min(options.maxAttempts || 4, 2) : (options.maxAttempts || 4));
        let settleMs = Math.max(80, isPlaying ? Math.min(options.settleMs || 220, 150) : (options.settleMs || 220));
        const tolerance = Math.max(0.1, options.tolerance || 0.9);
        this._trace('seek:start', { target, isPlaying, maxAttempts, settleMs, tolerance });

        let scReady = true;
        if (this.mode === 'sc') {
            scReady = await this._waitForScReady(options.readyTimeoutMs || 2500);
            if (!scReady || !this.widget) {
                // Stream not ready yet: queue seek for PLAY event and report non-confirmed status.
                this._pendingSeek = target;
                this._scCurrentTime = target;
                this._trace('seek:not-ready-queued', { target, scReady });
                return { ok: false, target, position: target, attempts: 0 };
            }
        }

        // Re-evaluate after ready wait because SC events can arrive during load.
        isPlaying = this.isProbablyPlaying();
        maxAttempts = Math.max(1, isPlaying ? Math.min(options.maxAttempts || 4, 2) : (options.maxAttempts || 4));
        settleMs = Math.max(80, isPlaying ? Math.min(options.settleMs || 220, 150) : (options.settleMs || 220));
        this._trace('seek:post-ready-state', { target, isPlaying, maxAttempts, settleMs });

        // When SoundCloud is paused, seekTo() on freshly switched streams is not
        // always honored immediately. Keep the target as pending so PLAY can
        // re-apply it once transport is actually running.
        if (this.mode === 'sc' && !isPlaying) {
            this._scCurrentTime = target;
            this._pendingSeek = target;
            if (this.widget) {
                try { this.widget.seekTo(target * 1000); } catch (_) { }
            }
            this._trace('seek:paused-fast-path', { target });
            return { ok: true, target, position: target, attempts: 0 };
        }

        this.currentTime = target;

        let lastPos = this.currentTime || 0;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            if (this.mode === 'sc' && this.widget) {
                try {
                    this.widget.seekTo(target * 1000);
                } catch (_) {
                    // ignore and continue with verification
                }
            } else if (this.mode === 'html5') {
                this.audioNode.currentTime = target;
            }

            await this._wait(settleMs * attempt);
            lastPos = await this.getAccurateCurrentTime(900);

            const ok = Math.abs(lastPos - target) <= tolerance || lastPos >= (target - tolerance);
            if (ok) {
                this._trace('seek:ok', { target, lastPos, attempts: attempt });
                return { ok: true, target, position: lastPos, attempts: attempt };
            }
        }

        this._trace('seek:failed', { target, lastPos, attempts: maxAttempts });
        return { ok: false, target, position: lastPos, attempts: maxAttempts };
    }

    /**
     * Returns best-effort "is playing" signal across HTML5 and SC modes.
     */
    isProbablyPlaying() {
        if (this.mode === 'html5') return !this.audioNode.paused;
        if (this.mode === 'sc') return !this.paused || this._pendingPlay || this._playIntent;
        return false;
    }

    /**
     * Resolve the latest playback position.
     * For SC this actively queries widget position instead of only using cached value.
     *
     * @param {number} timeoutMs
     * @returns {Promise<number>}
     */
    getAccurateCurrentTime(timeoutMs = 700) {
        if (this.mode === 'html5') {
            return Promise.resolve(this.audioNode.currentTime || 0);
        }

        if (this.mode !== 'sc' || !this.widget) {
            return Promise.resolve(this._scCurrentTime || 0);
        }

        return new Promise(resolve => {
            let settled = false;
            const timer = setTimeout(() => {
                if (settled) return;
                settled = true;
                resolve(this._scCurrentTime || 0);
            }, Math.max(100, timeoutMs));

            try {
                this.widget.getPosition(ms => {
                    if (settled) return;
                    settled = true;
                    clearTimeout(timer);
                    this._scCurrentTime = (ms || 0) / 1000;
                    resolve(this._scCurrentTime);
                });
            } catch (e) {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                resolve(this._scCurrentTime || 0);
            }
        });
    }

    // --- Event System ---
    addEventListener(ev, cb) {
        if (this._listeners[ev]) this._listeners[ev].push(cb);
    }

    removeEventListener(ev, cb) {
        if (this._listeners[ev]) {
            this._listeners[ev] = this._listeners[ev].filter(l => l !== cb);
        }
    }

    _dispatch(ev) {
        // Special: Update SC time cache
        if (ev === 'timeupdate' && this.mode === 'sc' && this.widget) {
            this.widget.getPosition(ms => this._scCurrentTime = ms / 1000);
        }

        if (this._listeners[ev]) {
            this._listeners[ev].forEach(cb => cb());
        }
    }
}

if (typeof window !== 'undefined') {
    window.SCAudioAdapter = SCAudioAdapter;
}
