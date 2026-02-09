/**
 * Global scene dimmer with hard freeze at full black.
 * Click cycle: 0 -> 50 -> 100 -> 50 -> 0
 */
(function initGlobalVisualDimmer() {
    const STORAGE_LEVEL_KEY = 'gb_background_dim_level';
    const STORAGE_PHASE_KEY = 'gb_background_dim_phase';
    const LEVELS = [0, 50, 100, 50];

    const state = {
        level: 0,
        phase: 0,
        initialized: false
    };

    const ui = {
        overlay: null,
        toggleButton: null,
        iconFull: null,
        iconHalf: null,
        iconCrescent: null
    };

    const listeners = new Set();

    function isFrozenLevel(level) {
        return Number(level) >= 100;
    }

    function clampPhase(value) {
        const num = Number(value);
        if (!Number.isFinite(num)) return 0;
        const int = Math.round(num);
        if (int < 0 || int >= LEVELS.length) return 0;
        return int;
    }

    function clampLevel(value) {
        const num = Number(value);
        if (!Number.isFinite(num)) return 0;
        if (num >= 75) return 100;
        if (num >= 25) return 50;
        return 0;
    }

    function phaseForLevel(level) {
        if (level >= 100) return 2;
        if (level >= 50) return 1;
        return 0;
    }

    function loadStoredState() {
        let phase = 0;
        let level = 0;

        try {
            phase = clampPhase(localStorage.getItem(STORAGE_PHASE_KEY));
            level = clampLevel(localStorage.getItem(STORAGE_LEVEL_KEY));
        } catch (_) {
            phase = 0;
            level = 0;
        }

        if (LEVELS[phase] !== level) {
            phase = phaseForLevel(level);
        }

        return { phase, level };
    }

    function persistState() {
        try {
            localStorage.setItem(STORAGE_LEVEL_KEY, String(state.level));
            localStorage.setItem(STORAGE_PHASE_KEY, String(state.phase));
        } catch (_) {
            // Ignore storage failures.
        }
    }

    function emitChange() {
        const payload = {
            level: state.level,
            frozen: isFrozenLevel(state.level)
        };
        listeners.forEach((cb) => {
            try {
                cb(payload);
            } catch (_) {
                // Listener isolation.
            }
        });
    }

    function setIconState() {
        if (ui.iconFull) ui.iconFull.style.display = state.level === 0 ? 'block' : 'none';
        if (ui.iconHalf) ui.iconHalf.style.display = state.level === 50 ? 'block' : 'none';
        if (ui.iconCrescent) ui.iconCrescent.style.display = state.level === 100 ? 'block' : 'none';
    }

    function updateAriaLabel() {
        if (!ui.toggleButton) return;
        const label = state.level === 0
            ? 'Hintergrunddimmer aus'
            : state.level === 50
                ? 'Hintergrunddimmer 50 Prozent'
                : 'Hintergrunddimmer 100 Prozent, Grafik eingefroren';
        ui.toggleButton.setAttribute('aria-label', label);
    }

    function syncUi() {
        if (ui.overlay) {
            ui.overlay.style.opacity = (state.level / 100).toFixed(3);
        }
        if (ui.toggleButton) {
            ui.toggleButton.classList.toggle('is-active', state.level > 0);
            ui.toggleButton.dataset.dimState = String(state.level);
        }
        setIconState();
        updateAriaLabel();
        window.visualFreezeActive = isFrozenLevel(state.level);
    }

    function setFromPhase(phase, options = {}) {
        state.phase = clampPhase(phase);
        state.level = LEVELS[state.phase];
        syncUi();
        if (!options.skipPersist) {
            persistState();
        }
        if (options.forceEmit) {
            emitChange();
        }
    }

    function setLevel(level, options = {}) {
        const normalized = clampLevel(level);
        const phase = phaseForLevel(normalized);
        setFromPhase(phase, options);
    }

    function cycleLevel() {
        const next = (state.phase + 1) % LEVELS.length;
        setFromPhase(next, { forceEmit: true });
    }

    function bindUi() {
        if (!ui.toggleButton) return;
        ui.toggleButton.addEventListener('click', (event) => {
            event.preventDefault();
            cycleLevel();
        });

        window.addEventListener('storage', (event) => {
            if (event.key !== STORAGE_PHASE_KEY && event.key !== STORAGE_LEVEL_KEY) return;
            const loaded = loadStoredState();
            state.phase = loaded.phase;
            state.level = loaded.level;
            syncUi();
            emitChange();
        });
    }

    function resolveElements(config = {}) {
        ui.overlay = document.getElementById(config.overlayId || 'sceneDimmerOverlay');
        ui.toggleButton = document.getElementById(config.toggleButtonId || 'sceneDimmerToggleBtn');
        ui.iconFull = document.getElementById(config.iconFullId || 'sceneDimmerIconFull');
        ui.iconHalf = document.getElementById(config.iconHalfId || 'sceneDimmerIconHalf');
        ui.iconCrescent = document.getElementById(config.iconCrescentId || 'sceneDimmerIconCrescent');
    }

    function init(config = {}) {
        resolveElements(config);

        if (!state.initialized) {
            const loaded = loadStoredState();
            state.phase = loaded.phase;
            state.level = loaded.level;
            state.initialized = true;
            bindUi();
        } else {
            const loaded = loadStoredState();
            state.phase = loaded.phase;
            state.level = loaded.level;
        }

        syncUi();
        emitChange();
        return api;
    }

    function onChange(callback) {
        if (typeof callback !== 'function') {
            return function noopUnsubscribe() { };
        }
        listeners.add(callback);
        return () => listeners.delete(callback);
    }

    const api = {
        init,
        onChange,
        setLevel,
        getLevel: () => state.level,
        isFrozen: () => isFrozenLevel(state.level),
        cycleLevel
    };

    window.GlobalVisualDimmer = api;
})();
