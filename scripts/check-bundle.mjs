import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanText } from './lib/check-bundle.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'dist');
// Always scan a fresh build; SKIP_BUILD=1 scans the existing dist/ (e.g. right after `npm run build`).
if (process.env.SKIP_BUILD !== '1' || !existsSync(dist)) execSync('npx vite build', { cwd: root, stdio: 'inherit' });

const walk = (d) =>
  readdirSync(d).flatMap((n) => {
    const p = join(d, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
const files = walk(dist).filter((f) => /\.(js|mjs|css|html|json|map|txt|xml|svg)$/.test(f));

let bad = 0;
for (const f of files) {
  const hits = scanText(readFileSync(f, 'utf8'));
  if (hits.length) {
    bad++;
    console.error(`${relative(root, f)}: ${hits.join(', ')}`);
  }
}
if (bad) {
  console.error(`\n${bad} file(s) in dist/ contain forbidden strings.`);
  process.exit(1);
}
console.log(`check:bundle ok (${files.length} files)`);
