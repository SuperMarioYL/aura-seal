// v1.0 — first-paint performance budget gate. Fails CI when the entry JS chunk
// exceeds the gzip budget, so the bundle can't silently regress past the limit the
// roadmap commits to (首屏 JS ≤ 200KB gzip).
import { readdir, readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const assetsDir = resolve(root, 'dist/assets');
const BUDGET_KB = 200;

async function main() {
  const files = await readdir(assetsDir);
  const entry = files.find((f) => /^index-.*\.js$/.test(f));
  if (!entry) {
    console.error('[size] no entry chunk (index-*.js) found in dist/assets — run build first');
    process.exit(1);
  }
  const buf = await readFile(resolve(assetsDir, entry));
  const gzipKb = gzipSync(buf).length / 1024;
  const line = `[size] first-paint ${entry}: ${gzipKb.toFixed(1)} KB gzip (budget ${BUDGET_KB} KB)`;
  if (gzipKb > BUDGET_KB) {
    console.error(`${line} — OVER BUDGET`);
    process.exit(1);
  }
  console.log(`${line} — ok`);
}

main().catch((err) => {
  console.error('[size] failed:', err.message);
  process.exit(1);
});
