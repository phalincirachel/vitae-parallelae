/**
 * Global scene dimmer with hard freeze at full coverage.
 * Click cycle: 0 -> 50 -> 100 black -> 100 white -> 0
 */
(function initGlobalVisualDimmer() {
    const STORAGE_LEVEL_KEY = 'gb_background_dim_level';
    const STORAGE_PHASE_KEY = 'gb_background_dim_phase';
    const LIGHT_MODE_CLASS = 'scene-dimmer-light-mode';
    const STEPS = [
        {
            key: 'off',
            level: 0,
            freeze: false,
            overlayColor: '#000000',
            icon: 'full',
            aria: 'Hintergrunddimmer aus'
        },
        {
            key: 'half',
            level: 50,
            freeze: false,
            overlayColor: '#000000',
            icon: 'half',
            aria: 'Hintergrunddimmer 50 Prozent'
        },
        {
            key: 'black-freeze',
            level: 100,
            freeze: true,
            overlayColor: '#000000',
            icon: 'crescent',
            aria: 'Hintergrunddimmer 100 Prozent schwarz, Grafik eingefroren'
        },
        {
            key: 'white-freeze',
            level: 100,
            freeze: true,
            overlayColor: '#ffffff',
            icon: 'sun',
            aria: 'Hintergrunddimmer 100 Prozent weiss, Grafik eingefroren'
        }
    ];

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
        iconCrescent: null,
        iconSun: null
    };

    const listeners = new Set();

    function getCurrentStep() {
        return STEPS[state.phase] || STEPS[0];
    }

    function isFrozenPhase(phase) {
        const step = STEPS[clampPhase(phase)];
        return !!(step && step.freeze);
    }

    function isFrozenLevel(level) {
        return Number(level) >= 100;
    }

    function clampPhase(value) {
        const num = Number(value);
        if (!Number.isFinite(num)) return 0;
        const int = Math.round(num);
        if (int < 0 || int >= STEPS.length) return 0;
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

        if (STEPS[phase].level !== level) {
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
        const step = getCurrentStep();
        const payload = {
            level: state.level,
            frozen: !!step.freeze,
            mode: step.key,
            isWhiteMode: step.overlayColor === '#ffffff'
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
        const step = getCurrentStep();
        if (ui.iconFull) ui.iconFull.style.display = step.icon === 'full' ? 'block' : 'none';
        if (ui.iconHalf) ui.iconHalf.style.display = step.icon === 'half' ? 'block' : 'none';
        if (ui.iconCrescent) ui.iconCrescent.style.display = step.icon === 'crescent' ? 'block' : 'none';
        if (ui.iconSun) ui.iconSun.style.display = step.icon === 'sun' ? 'block' : 'none';
    }

    function updateAriaLabel() {
        if (!ui.toggleButton) return;
        const step = getCurrentStep();
        const label = step.aria;
        ui.toggleButton.setAttribute('aria-label', label);
        ui.toggleButton.setAttribute('title', label);
    }

    function syncLightModeClass() {
        const step = getCurrentStep();
        const isWhiteMode = step.overlayColor === '#ffffff';
        if (document.body) {
            document.body.classList.toggle(LIGHT_MODE_CLASS, isWhiteMode);
        }
        if (document.documentElement) {
            document.documentElement.classList.toggle(LIGHT_MODE_CLASS, isWhiteMode);
        }
    }

    function syncUi() {
        const step = getCurrentStep();
        if (ui.overlay) {
            ui.overlay.style.opacity = (step.level / 100).toFixed(3);
            ui.overlay.style.backgroundColor = step.overlayColor;
        }
        if (ui.toggleButton) {
            ui.toggleButton.classList.toggle('is-active', state.level > 0);
            ui.toggleButton.dataset.dimState = step.key;
        }
        setIconState();
        updateAriaLabel();
        syncLightModeClass();
        window.visualFreezeActive = !!step.freeze;
    }

    function setFromPhase(phase, options = {}) {
        state.phase = clampPhase(phase);
        state.level = STEPS[state.phase].level;
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
        const fallbackPhase = phaseForLevel(normalized);
        const phase = normalized >= 100 && isFrozenPhase(state.phase) ? state.phase : fallbackPhase;
        setFromPhase(phase, options);
    }

    function cycleLevel() {
        const next = (state.phase + 1) % STEPS.length;
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
        ui.iconSun = document.getElementById(config.iconSunId || 'sceneDimmerIconSun');
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
