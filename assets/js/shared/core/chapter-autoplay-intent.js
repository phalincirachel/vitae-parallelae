const STORAGE_KEY = 'gb_autoplay_intent';
const MAX_AGE_MS = 10 * 60 * 1000;

function createStorageAdapter(storage) {
  if (storage && typeof storage.getItem === 'function' && typeof storage.setItem === 'function') {
    return storage;
  }
  return {
    getItem() { return null; },
    setItem() {},
    removeItem() {}
  };
}

export function createChapterAutoplayIntent(options = {}) {
  const storage = createStorageAdapter(options.storage || globalThis.sessionStorage);
  const now = typeof options.now === 'function' ? options.now : () => Date.now();

  function readIntent() {
    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }

  function clearIntent() {
    try {
      storage.removeItem(STORAGE_KEY);
    } catch {
      // ignore storage failures
    }
  }

  function writeIntent(policy, target, source, reason) {
    if (!target) return;
    const payload = {
      policy: policy === 'manual' ? 'manual' : 'auto',
      target: String(target),
      source: source ? String(source) : '',
      reason: reason ? String(reason) : '',
      at: now()
    };

    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // ignore storage failures
    }
  }

  return {
    markManual(target, source, reason) {
      writeIntent('manual', target, source, reason || 'chapter-menu');
    },
    markAuto(target, source, reason) {
      writeIntent('auto', target, source, reason || 'auto-transition');
    },
    consume(target, consumeOptions = {}) {
      const expectedTarget = String(target || '');
      const defaultPolicy = consumeOptions.defaultPolicy === 'manual' ? 'manual' : 'auto';
      const intent = readIntent();

      if (!intent) {
        return {
          policy: defaultPolicy,
          shouldAutoplay: defaultPolicy !== 'manual',
          source: 'default',
          reason: 'no-intent'
        };
      }

      const age = Math.max(0, now() - Number(intent.at || 0));
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
  };
}

export const defaultChapterAutoplayIntent = createChapterAutoplayIntent();
export default defaultChapterAutoplayIntent;
