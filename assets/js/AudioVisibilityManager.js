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

    init() {
        document.addEventListener('visibilitychange', () => {
            this._handleVisibilityChange();
        });
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
    },

    /**
     * Unregister an adapter
     * @param {Object} adapter 
     */
    unregister(adapter) {
        this._sources.delete(adapter);
    },

    _handleVisibilityChange() {
        if (document.hidden) {
            console.log('[AudioVisibilityManager] Tab hidden - Pausing all audio');
            this._pauseAll();
        } else {
            console.log('[AudioVisibilityManager] Tab visible - Resuming audio');
            this._resumeAll();
        }
    },

    _pauseAll() {
        this._sources.forEach(adapter => {
            // Save state: was it playing?
            // Note: adapter.paused might be true if it ended, or false if playing.
            // We attach a temporary property to the adapter instance to remember state across visibility toggle
            if (adapter && !adapter.paused) {
                adapter._wasPlayingBeforeHide = true;
                adapter.pause();
            } else {
                if (adapter) adapter._wasPlayingBeforeHide = false;
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
