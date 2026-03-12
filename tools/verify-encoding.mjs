import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const TEXT_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.json', '.html', '.css', '.md', '.txt']);
const IGNORE_DIRS = new Set(['.git', 'node_modules', 'dist', 'out', 'release', 'tools']);
const IGNORE_FILE_PATTERNS = [/^index_dump/, /^__tmp_/, /^temp_script_/, /^book_/, /^temp_b64\.txt$/, /^verify-encoding\.mjs$/];
const replacementChar = String.fromCharCode(65533);
const suspiciousPattern = /(Ã|Â|â€|â€”|â€“|â€œ|â€|â€™|â€˜|â€¦)/;
const suspicious = [];
const hardErrors = [];

function shouldIgnoreFile(name) {
  return IGNORE_FILE_PATTERNS.some((pattern) => pattern.test(name));
}

function isCommentLikeLine(line, ext, matchIndex = 0) {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.startsWith('*/')) return true;
  if (trimmed.startsWith('<!--') || trimmed.startsWith('-->')) return true;
  if (ext === '.html' && trimmed.startsWith('<!')) return true;

  const jsCommentIndex = line.indexOf('//');
  if (jsCommentIndex !== -1 && jsCommentIndex <= matchIndex) return true;

  const htmlCommentIndex = line.indexOf('<!--');
  if (htmlCommentIndex !== -1 && htmlCommentIndex <= matchIndex) return true;

  return false;
}

async function walk(dirPath) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      await walk(fullPath);
      continue;
    }
    if (shouldIgnoreFile(entry.name)) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (!TEXT_EXTENSIONS.has(ext)) continue;

    const content = await fs.readFile(fullPath, 'utf8');
    const relativePath = path.relative(ROOT, fullPath);
    if (content.includes(replacementChar)) {
      hardErrors.push(relativePath);
    }

    const lines = content.split(/\r?\n/);
    const matches = [];
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const match = line.match(suspiciousPattern);
      if (!match) continue;
      matches.push({
        line: index + 1,
        snippet: line.trim().slice(0, 160),
        commentLike: isCommentLikeLine(line, ext, match.index || 0)
      });
    }

    if (matches.length) {
      suspicious.push({
        file: relativePath,
        matches
      });
    }
  }
}

await walk(ROOT);

if (suspicious.length) {
  console.warn('[verify-encoding] Suspicious mojibake markers detected:');
  for (const entry of suspicious) {
    const runtimeMatches = entry.matches.filter((match) => !match.commentLike);
    const commentMatches = entry.matches.filter((match) => match.commentLike);
    console.warn(`  - ${entry.file}`);
    if (runtimeMatches.length) {
      for (const match of runtimeMatches.slice(0, 5)) {
        console.warn(`      runtime L${match.line}: ${match.snippet}`);
      }
      if (runtimeMatches.length > 5) {
        console.warn(`      ... ${runtimeMatches.length - 5} more runtime matches`);
      }
    }
    if (commentMatches.length) {
      for (const match of commentMatches.slice(0, 3)) {
        console.warn(`      comment L${match.line}: ${match.snippet}`);
      }
      if (commentMatches.length > 3) {
        console.warn(`      ... ${commentMatches.length - 3} more comment matches`);
      }
    }
  }
}

if (hardErrors.length) {
  console.error('[verify-encoding] Replacement characters detected in:');
  for (const filePath of hardErrors) {
    console.error(`  - ${filePath}`);
  }
  process.exit(1);
}

console.log('[verify-encoding] Completed without hard encoding failures.');
