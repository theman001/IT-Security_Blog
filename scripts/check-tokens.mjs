import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { checkSource } from './lib/check-tokens.js';

const root = new URL('..', import.meta.url).pathname;
const skip = join(root, 'src/styles/tokens.css');
const walk = (d) =>
  readdirSync(d).flatMap((n) => {
    const p = join(d, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
const files = [...walk(join(root, 'src')), join(root, 'index.html')].filter(
  (f) => /\.(css|js|html)$/.test(f) && f !== skip,
);

let bad = 0;
for (const f of files) {
  for (const v of checkSource(readFileSync(f, 'utf8'), f)) {
    bad++;
    console.error(`${relative(root, f)}:${v.line}  ${v.rule}  ${v.text}`);
  }
}
if (bad) {
  console.error(`\n${bad} token violation(s). Use var(--token) from src/styles/tokens.css.`);
  process.exit(1);
}
console.log(`lint:tokens ok (${files.length} files)`);
