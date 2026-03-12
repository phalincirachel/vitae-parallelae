const DEFAULT_REMOTE_URL = 'https://unpkg.com/three@0.160.0/build/three.module.js';
const DEFAULT_LOCAL_URL = '../../../vendor/three/three.module.js';

export async function loadThree(options = {}) {
  const importer = typeof options.importer === 'function' ? options.importer : (specifier) => import(specifier);
  const candidates = Array.isArray(options.candidates) && options.candidates.length
    ? options.candidates
    : [DEFAULT_LOCAL_URL, DEFAULT_REMOTE_URL];

  let lastError = null;
  for (const candidate of candidates) {
    try {
      const module = await importer(candidate);
      return {
        THREE: module,
        mode: '3d',
        source: candidate
      };
    } catch (error) {
      lastError = error;
    }
  }

  if (options.allowFallback !== false) {
    return {
      THREE: null,
      mode: '2d-fallback',
      source: null,
      error: lastError
    };
  }

  throw lastError;
}

export default loadThree;
