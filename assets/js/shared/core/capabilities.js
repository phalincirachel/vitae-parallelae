export function getTouchPoints(env = globalThis) {
  const navigatorRef = env?.navigator;
  return Number(navigatorRef?.maxTouchPoints || navigatorRef?.msMaxTouchPoints || 0);
}

export function isProbablyIOS(env = globalThis) {
  const navigatorRef = env?.navigator;
  const platform = String(navigatorRef?.platform || '');
  const userAgent = String(navigatorRef?.userAgent || '');
  const doc = env?.document;
  return ['iPad Simulator', 'iPhone Simulator', 'iPod Simulator', 'iPad', 'iPhone', 'iPod'].includes(platform)
    || (userAgent.includes('Mac') && !!doc && 'ontouchend' in doc);
}

export function isDesktopPointerLayout(env = globalThis) {
  if (typeof env?.matchMedia !== 'function') return true;
  return env.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

export function detectDeviceProfile(env = globalThis, mobileBreakpoint = 900) {
  const coarsePointer = typeof env?.matchMedia === 'function' && env.matchMedia('(pointer: coarse)').matches;
  const width = Number(env?.innerWidth || 0);
  if (coarsePointer || getTouchPoints(env) > 0 || width <= mobileBreakpoint) {
    return 'mobile';
  }
  return 'desktop';
}
