import { listRuntimeAssetPaths } from '../assets/js/shared/data/content-manifest.js';
import { listIntroAssetPaths } from '../assets/js/shared/data/intro-config.js';
import { listSceneAssetPaths } from '../assets/js/shared/data/scene-config.js';
import { getSCUrl } from '../assets/js/shared/audio/soundcloud-urls.js';
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const missing = [];
const seen = new Set();

async function verifyAsset(assetPath) {
  if (!assetPath || seen.has(assetPath)) return;
  seen.add(assetPath);
  const normalized = assetPath.replaceAll('/', path.sep);
  const fullPath = path.join(ROOT, normalized);
  try {
    await fs.access(fullPath);
  } catch {
    if (getSCUrl(assetPath) !== assetPath) return;
    missing.push(assetPath);
  }
}

for (const assetPath of [...listRuntimeAssetPaths(), ...listSceneAssetPaths(), ...listIntroAssetPaths()]) {
  await verifyAsset(assetPath);
}

if (missing.length) {
  console.error('[verify-assets] Missing runtime assets:');
  for (const assetPath of missing) {
    console.error(`  - ${assetPath}`);
  }
  process.exit(1);
}

console.log(`[verify-assets] Verified ${seen.size} runtime asset references.`);
