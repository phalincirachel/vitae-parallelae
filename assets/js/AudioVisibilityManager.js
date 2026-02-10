/**
 * AudioVisibilityManager.js
 * 
 * Manages audio playback based on page visibility.
 * Pauses all registered audio sources when the tab is hidden (e.g., closed on mobile, switched on desktop).
 * Auto-resumes audio that was playing when the tab becomes visible again.
 */

const AudioVisibilityManager = {
    // Registered audio sources (WeakRefs or direct references if unavoidable, but we'll use a Set)
    // We use a Set of objects: { adapter: SCAudioAdapter, wasPlaying: boolean }
    _sources: new Set(),
    _isBackgrounded: false,
    _blurTimer: null,

    init() {
        document.addEventListener('visibilitychange', () => this._handleVisibilityChange('visibilitychange'));
        document.addEventListener('webkitvisibilitychange', () => this._handleVisibilityChange('webkitvisibilitychange'));
        window.addEventListener('pagehide', () => this._enterBackground('pagehide'));
        window.addEventListener('freeze', () => this._enterBackground('freeze'));
        window.addEventListener('blur', () => this._handleBlurFallback());
        window.addEventListener('focus', () => this._handlePotentialForeground('focus'));
        window.addEventListener('pageshow', () => this._handlePotentialForeground('pageshow'));
        document.addEventListener('resume', () => this._handlePotentialForeground('resume'));
        console.log('[AudioVisibilityManager] Initialized');
    },

    /**
     * Register an audio adapter to be managed
     * @param {Object} adapter - The SCAudioAdapter instance
     */
    register(adapter) {
        // We wrap it in an object to store extra state without polluting the adapter
        // But we need to be able to find it again to remove it.
        // Actually, let's just add a property to the adapter itself or keep a simple list.
        // For simplicity and since we don't have many adapters:
        this._sources.add(adapter);
        // If an adapter is created while the app is already backgrounded,
        // force it paused immediately so iOS/Safari lifecycle races cannot leak audio.
        if (this._isBackgrounded && adapter) {
            adapter._wasPlayingBeforeHide = false;
            try {
                adapter.pause();
            } catch (e) {
                console.warn('[AudioVisibilityManager] Pause-on-register failed:', e);
            }
        }
    },

    /**
     * Unregister an adapter
     * @param {Object} adapter 
     */
    unregister(adapter) {
        this._sources.delete(adapter);
    },

    _isDocumentHidden() {
        if (typeof document.hidden === 'boolean') return document.hidden;
        if (typeof document.webkitHidden === 'boolean') return document.webkitHidden;
        return false;
    },

    _handleVisibilityChange(reason = 'visibilitychange') {
        if (this._isDocumentHidden()) {
            this._enterBackground(reason);
        } else {
            this._handlePotentialForeground(reason);
        }
    },

    _handleBlurFallback() {
        if (this._blurTimer) clearTimeout(this._blurTimer);
        this._blurTimer = setTimeout(() => {
            this._blurTimer = null;
            const hidden = this._isDocumentHidden();
            const hasFocus = typeof document.hasFocus === 'function' ? document.hasFocus() : true;
            if (hidden || !hasFocus) {
                this._enterBackground(hidden ? 'blur-hidden' : 'blur-no-focus');
            }
        }, 120);
    },

    _handlePotentialForeground(reason = 'foreground') {
        if (this._isDocumentHidden()) return;
        if (this._blurTimer) {
            clearTimeout(this._blurTimer);
            this._blurTimer = null;
        }
        if (!this._isBackgrounded) return;
        this._isBackgrounded = false;
        console.log(`[AudioVisibilityManager] Foreground (${reason}) - Resuming audio`);
        this._resumeAll();
    },

    _enterBackground(reason = 'background') {
        if (this._blurTimer) {
            clearTimeout(this._blurTimer);
            this._blurTimer = null;
        }
        if (this._isBackgrounded) return;
        this._isBackgrounded = true;
        console.log(`[AudioVisibilityManager] Background (${reason}) - Pausing all audio`);
        this._pauseAll();
    },

    _handleVisibilityLegacy() {
        if (this._isDocumentHidden()) {
            this._enterBackground('legacy-hidden');
        } else {
            this._handlePotentialForeground('legacy-visible');
        }
    },

    _wasAdapterPlaying(adapter) {
        if (!adapter) return false;
        try {
            if (typeof adapter.isProbablyPlaying === 'function') {
                return !!adapter.isProbablyPlaying();
            }
            return !adapter.paused;
        } catch (_) {
            return false;
        }
    },

    _pauseAll() {
        this._sources.forEach(adapter => {
            if (!adapter) return;
            // Save state first, then always send a pause signal.
            // This avoids stale paused-state races on iOS/Safari SoundCloud playback.
            adapter._wasPlayingBeforeHide = this._wasAdapterPlaying(adapter);
            try {
                adapter.pause();
            } catch (e) {
                console.warn('[AudioVisibilityManager] Pause failed:', e);
            }
        });
    },

    _resumeAll() {
        this._sources.forEach(adapter => {
            if (adapter && adapter._wasPlayingBeforeHide) {
                // Determine if we should really resume?
                // Yes, user requested auto-resume.
                // Reset flag
                adapter._wasPlayingBeforeHide = false;

                // Small delay to ensure browser is ready
                setTimeout(() => {
                    if (this._isBackgrounded || this._isDocumentHidden()) return;
                    adapter.play().catch(e => console.warn('[AudioVisibilityManager] Resume failed:', e));
                }, 100);
            }
        });
    }
};

// Auto-init
AudioVisibilityManager.init();

// Export
if (typeof window !== 'undefined') {
    window.AudioVisibilityManager = AudioVisibilityManager;
}
