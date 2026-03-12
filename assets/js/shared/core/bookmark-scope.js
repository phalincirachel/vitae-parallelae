export function getBookmarkScope(entry) {
  if (!entry || typeof entry !== 'object') return '';
  const contentKey = typeof entry.contentKey === 'string' ? entry.contentKey.trim() : '';
  if (contentKey) return contentKey;
  const audioRef = typeof entry.audioRef === 'string' ? entry.audioRef.trim() : '';
  if (audioRef) return `audio:${audioRef}`;
  const textRef = typeof entry.textRef === 'string' ? entry.textRef.trim() : '';
  if (textRef) return `text:${textRef}`;
  return typeof entry.page === 'string' ? entry.page : '';
}

export function resolveBookmarkContentKey(entry, fallbackKey = '') {
  if (!entry || typeof entry !== 'object') return fallbackKey;
  if (typeof entry.contentKey === 'string' && entry.contentKey.trim()) return entry.contentKey.trim();
  if (typeof entry.audioRef === 'string' && entry.audioRef.trim()) return `audio:${entry.audioRef.trim()}`;
  if (typeof entry.textRef === 'string' && entry.textRef.trim()) return `text:${entry.textRef.trim()}`;
  return fallbackKey || '';
}

export function normalizeBookmarkPageKey(page) {
  if (typeof page !== 'string') return 'index.html';
  const raw = page.trim();
  if (!raw) return 'index.html';
  return raw;
}

export function bookmarksMatch(left, right, toleranceSeconds = 1) {
  if (!left || !right) return false;
  return normalizeBookmarkPageKey(left.page) === normalizeBookmarkPageKey(right.page)
    && getBookmarkScope(left) === getBookmarkScope(right)
    && Math.abs(Number(left.time || 0) - Number(right.time || 0)) < Math.max(0.001, Number(toleranceSeconds) || 1);
}
