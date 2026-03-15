/**
 * Global scene dimmer with staged reading/freeze cycle.
 * Active click cycle: white freeze -> black freeze -> reading half -> reading light -> repeat
 * Neutral reset state: off (game mode normal), entered via explicit reset (setLevel(0)).
 */
(function initGlobalVisualDimmer() {
    const STORAGE_LEVEL_KEY = 'gb_background_dim_level';
    const STORAGE_PHASE_KEY = 'gb_background_dim_phase';
    const STORAGE_MODE_KEY = 'gb_background_dim_mode';
    const LIGHT_MODE_CLASS = 'scene-dimmer-light-mode';

    const MODE_OFF = 'off';
    const MODE_WHITE_FREEZE = 'white-freeze';
    const MODE_BLACK_FREEZE = 'black-freeze';
    const MODE_READING_HALF = 'reading-half';
    const MODE_READING_CLEAR = 'reading-clear';

    const STEPS = [
        {
            key: MODE_OFF,
            level: 0,
            freeze: false,
            readingMode: false,
            overlayColor: '#000000',
            icon: 'full',
            aria: 'Hintergrunddimmer aus'
        },
        {
            key: MODE_WHITE_FREEZE,
            level: 100,
            freeze: true,
            readingMode: true,
            overlayColor: '#ffffff',
            icon: 'sun',
            aria: 'Hintergrund weiss, Lesemodus aktiv'
        },
        {
            key: MODE_BLACK_FREEZE,
            level: 100,
            freeze: true,
            readingMode: true,
            overlayColor: '#000000',
            icon: 'crescent',
            aria: 'Hintergrund schwarz, Lesemodus aktiv'
        },
        {
            key: MODE_READING_HALF,
            level: 50,
            freeze: false,
            readingMode: true,
            overlayColor: '#000000',
            icon: 'half',
            aria: 'Lesemodus mit halb verdunkeltem Hintergrund'
        },
        {
            key: MODE_READING_CLEAR,
            level: 0,
            freeze: false,
            readingMode: true,
            overlayColor: '#000000',
            icon: 'full',
            aria: 'Lesemodus mit hellem Hintergrund'
        }
    ];

    const ACTIVE_CYCLE_KEYS = [
        MODE_WHITE_FREEZE,
        MODE_BLACK_FREEZE,
        MODE_READING_HALF,
        MODE_READING_CLEAR
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

    function phaseForKey(key) {
        if (typeof key !== 'string') return -1;
        const normalized = key.trim();
        if (!normalized) return -1;
        return STEPS.findIndex((step) => step.key === normalized);
    }

    function phaseForLevel(level) {
        const normalized = clampLevel(level);
        if (normalized >= 100) return phaseForKey(MODE_WHITE_FREEZE);
        if (normalized >= 50) return phaseForKey(MODE_READING_HALF);
        return phaseForKey(MODE_OFF);
    }

    function migrateLegacyPhase(phase, level) {
        const normalized = clampLevel(level);
        if (normalized >= 100) {
            // Previous shape used phase 2=white, 3=black.
            if (phase === 2) return phaseForKey(MODE_WHITE_FREEZE);
            if (phase === 3) return phaseForKey(MODE_BLACK_FREEZE);
            return phaseForKey(MODE_WHITE_FREEZE);
        }
        if (normalized >= 50) {
            // Previous phase 1 was generic half-dim.
            return phaseForKey(MODE_READING_HALF);
        }
        return phaseForKey(MODE_OFF);
    }

    function nextPhaseForCycle(phase) {
        const currentStep = STEPS[clampPhase(phase)] || STEPS[0];
        const currentIndex = ACTIVE_CYCLE_KEYS.indexOf(currentStep.key);
        if (currentIndex < 0) {
            return phaseForKey(ACTIVE_CYCLE_KEYS[0]);
        }
        const nextIndex = (currentIndex + 1) % ACTIVE_CYCLE_KEYS.length;
        return phaseForKey(ACTIVE_CYCLE_KEYS[nextIndex]);
    }

    function loadStoredState() {
        let phase = phaseForKey(MODE_OFF);
        let level = 0;
        let needsPersist = false;

        try {
            const storedModePhase = phaseForKey(localStorage.getItem(STORAGE_MODE_KEY));
            if (storedModePhase >= 0) {
                phase = storedModePhase;
                level = STEPS[phase].level;
            } else {
                const legacyPhase = clampPhase(localStorage.getItem(STORAGE_PHASE_KEY));
                const legacyLevel = clampLevel(localStorage.getItem(STORAGE_LEVEL_KEY));
                phase = migrateLegacyPhase(legacyPhase, legacyLevel);
                level = STEPS[phase].level;
                needsPersist = true;
            }
        } catch (_) {
            phase = phaseForKey(MODE_OFF);
            level = 0;
        }

        if (STEPS[phase].level !== level) {
            phase = phaseForLevel(level);
            level = STEPS[phase].level;
            needsPersist = true;
        }

        return { phase, level, needsPersist };
    }

    function persistState() {
        try {
            const step = getCurrentStep();
            localStorage.setItem(STORAGE_LEVEL_KEY, String(state.level));
            localStorage.setItem(STORAGE_PHASE_KEY, String(state.phase));
            localStorage.setItem(STORAGE_MODE_KEY, step.key);
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
            readingMode: !!step.readingMode,
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
            ui.toggleButton.classList.toggle('is-active', step.key !== MODE_OFF);
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
        const modePhase = phaseForKey(options.modeKey);
        let phase = modePhase >= 0 ? modePhase : phaseForLevel(normalized);

        if (modePhase < 0 && normalized >= 100 && isFrozenPhase(state.phase)) {
            phase = state.phase;
        }

        setFromPhase(phase, options);
    }

    function cycleLevel() {
        const next = nextPhaseForCycle(state.phase);
        setFromPhase(next, { forceEmit: true });
    }

    function bindUi() {
        if (!ui.toggleButton) return;
        ui.toggleButton.addEventListener('click', (event) => {
            event.preventDefault();
            cycleLevel();
        });

        window.addEventListener('storage', (event) => {
            if (event.key !== STORAGE_PHASE_KEY && event.key !== STORAGE_LEVEL_KEY && event.key !== STORAGE_MODE_KEY) return;
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

        const loaded = loadStoredState();
        state.phase = loaded.phase;
        state.level = loaded.level;
        if (loaded.needsPersist) {
            persistState();
        }

        if (!state.initialized) {
            state.initialized = true;
            bindUi();
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
        getMode: () => getCurrentStep().key,
        isFrozen: () => isFrozenLevel(state.level),
        cycleLevel
    };

    window.GlobalVisualDimmer = api;
})();
