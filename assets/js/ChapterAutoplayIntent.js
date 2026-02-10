/**
 * Cross-chapter autoplay intent handoff.
 * Default behavior is autoplay unless navigation explicitly marks manual.
 */
(function initChapterAutoplayIntent() {
    const STORAGE_KEY = 'gb_autoplay_intent';
    const MAX_AGE_MS = 10 * 60 * 1000;

    function readIntent() {
        try {
            const raw = sessionStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object') return null;
            return parsed;
        } catch (_) {
            return null;
        }
    }

    function clearIntent() {
        try {
            sessionStorage.removeItem(STORAGE_KEY);
        } catch (_) {
            // Ignore storage failures.
        }
    }

    function writeIntent(policy, target, source, reason) {
        if (!target) return;
        const normalizedPolicy = policy === 'manual' ? 'manual' : 'auto';
        const payload = {
            policy: normalizedPolicy,
            target: String(target),
            source: source ? String(source) : '',
            reason: reason ? String(reason) : '',
            at: Date.now()
        };

        try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        } catch (_) {
            // Ignore storage failures.
        }
    }

    function consume(target, options = {}) {
        const expectedTarget = String(target || '');
        const defaultPolicy = options.defaultPolicy === 'manual' ? 'manual' : 'auto';
        const now = Date.now();
        const intent = readIntent();

        if (!intent) {
            return {
                policy: defaultPolicy,
                shouldAutoplay: defaultPolicy !== 'manual',
                source: 'default',
                reason: 'no-intent'
            };
        }

        const age = Math.max(0, now - Number(intent.at || 0));
        const matchesTarget = intent.target === expectedTarget;
        const freshEnough = Number.isFinite(age) && age <= MAX_AGE_MS;

        if (!matchesTarget || !freshEnough) {
            if (matchesTarget) clearIntent();
            return {
                policy: defaultPolicy,
                shouldAutoplay: defaultPolicy !== 'manual',
                source: 'default',
                reason: matchesTarget ? 'stale-intent' : 'target-mismatch'
            };
        }

        clearIntent();
        const policy = intent.policy === 'manual' ? 'manual' : 'auto';
        return {
            policy,
            shouldAutoplay: policy !== 'manual',
            source: intent.source || 'intent',
            reason: intent.reason || 'intent'
        };
    }

    window.ChapterAutoplayIntent = {
        markManual(target, source, reason) {
            writeIntent('manual', target, source, reason || 'chapter-menu');
        },
        markAuto(target, source, reason) {
            writeIntent('auto', target, source, reason || 'auto-transition');
        },
        consume
    };
})();
