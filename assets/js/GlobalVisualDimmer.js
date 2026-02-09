/**
 * Global scene dimmer with optional hard freeze at full black.
 * Shared across chapters via localStorage.
 */
(function initGlobalVisualDimmer() {
    const STORAGE_KEY = 'gb_background_dim_level';
    const FREEZE_THRESHOLD = 100;
    const OPEN_CLASS = 'is-open';
    const ACTIVE_CLASS = 'is-active';

    const state = {
        level: 0,
        initialized: false
    };

    const ui = {
        overlay: null,
        panel: null,
        toggleButton: null,
        slider: null,
        value: null
    };

    const listeners = new Set();

    function clampLevel(value) {
        const num = Number(value);
        if (!Number.isFinite(num)) return 0;
        return Math.max(0, Math.min(100, num));
    }

    function isFrozenLevel(level) {
        return level >= FREEZE_THRESHOLD;
    }

    function getStoredLevel() {
        try {
            return clampLevel(localStorage.getItem(STORAGE_KEY));
        } catch (_) {
            return 0;
        }
    }

    function persistLevel(level) {
        try {
            localStorage.setItem(STORAGE_KEY, String(Math.round(level)));
        } catch (_) {
            // Ignore storage failures (private mode/quota etc.)
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

    function syncUi() {
        const frozen = isFrozenLevel(state.level);
        const opacity = (state.level / 100).toFixed(3);

        if (ui.overlay) {
            ui.overlay.style.opacity = opacity;
        }

        if (ui.slider) {
            const value = String(Math.round(state.level));
            if (ui.slider.value !== value) ui.slider.value = value;
        }

        if (ui.value) {
            ui.value.textContent = frozen ? '100% (Freeze)' : `${Math.round(state.level)}%`;
        }

        if (ui.toggleButton) {
            ui.toggleButton.classList.toggle(ACTIVE_CLASS, state.level > 0);
            ui.toggleButton.setAttribute(
                'aria-label',
                frozen
                    ? 'Hintergrunddimmer aktiv, Grafik eingefroren'
                    : `Hintergrunddimmer ${Math.round(state.level)} Prozent`
            );
        }

        window.visualFreezeActive = frozen;
    }

    function setLevel(level, options = {}) {
        const clamped = clampLevel(level);
        const changed = Math.abs(clamped - state.level) > 0.0001;

        state.level = clamped;
        syncUi();

        if (!options.skipPersist) {
            persistLevel(state.level);
        }

        if (changed || options.forceEmit) {
            emitChange();
        }
    }

    function closePanel() {
        if (ui.panel) ui.panel.classList.remove(OPEN_CLASS);
        if (ui.toggleButton) ui.toggleButton.setAttribute('aria-expanded', 'false');
    }

    function togglePanel() {
        if (!ui.panel) return;
        const willOpen = !ui.panel.classList.contains(OPEN_CLASS);
        ui.panel.classList.toggle(OPEN_CLASS, willOpen);
        if (ui.toggleButton) ui.toggleButton.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    }

    function bindUi() {
        if (!ui.toggleButton || !ui.slider) return;

        ui.toggleButton.addEventListener('click', (event) => {
            event.preventDefault();
            togglePanel();
        });

        ui.slider.addEventListener('input', (event) => {
            setLevel(event.target.value, { forceEmit: true });
        });

        document.addEventListener('click', (event) => {
            if (!ui.panel || !ui.panel.classList.contains(OPEN_CLASS)) return;
            const target = event.target;
            if (!(target instanceof Element)) return;
            const insidePanel = ui.panel.contains(target);
            const onToggle = !!ui.toggleButton && ui.toggleButton.contains(target);
            if (!insidePanel && !onToggle) {
                closePanel();
            }
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                closePanel();
            }
        });

        window.addEventListener('storage', (event) => {
            if (event.key !== STORAGE_KEY) return;
            setLevel(getStoredLevel(), { skipPersist: true, forceEmit: true });
        });
    }

    function resolveElements(config = {}) {
        ui.overlay = document.getElementById(config.overlayId || 'sceneDimmerOverlay');
        ui.panel = document.getElementById(config.panelId || 'sceneDimmerPanel');
        ui.toggleButton = document.getElementById(config.toggleButtonId || 'sceneDimmerToggleBtn');
        ui.slider = document.getElementById(config.sliderId || 'sceneDimmerRange');
        ui.value = document.getElementById(config.valueId || 'sceneDimmerValue');
    }

    function init(config = {}) {
        resolveElements(config);

        if (!state.initialized) {
            state.level = getStoredLevel();
            state.initialized = true;
        } else {
            state.level = getStoredLevel();
        }

        bindUi();
        syncUi();
        emitChange();
        return api;
    }

    function onChange(callback) {
        if (typeof callback !== 'function') {
            return () => { };
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
        FREEZE_THRESHOLD
    };

    window.GlobalVisualDimmer = api;
})();
