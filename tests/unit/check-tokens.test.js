import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkSource } from '../../scripts/lib/check-tokens.js';

const bad = [
  'a{color:#fff}',
  'a { color: #aabbcc; }',
  'a { color: #aabbccdd }',
  'a{margin:12px}',
  'a { margin: -4.5px 0 }',
  'a{background:oklch(0.5 0.1 20)}',
  'a{color:rgb(0 0 0)}',
  'a{color:rgba(0,0,0,.5)}',
  'a{color:hsl(10 10% 10%)}',
  'a{color:oklab(0.5 0 0)}',
  "el.style.color = '#abc';",
  "const c = \"#112233\";",
];
const clean = [
  'a { color: var(--color-fg); }',
  '@media (min-width: 1200px) { a { margin: 0 } }',
  'a { margin: 0; width: 100%; margin: 0px }',
  '@font-face { src: url(/x.woff2) format("woff2"); }',
  '#main { color: var(--color-fg) }',
  'a:hover #add { color: var(--color-fg) }',
  '<a href="#main">skip</a>',
  '<a href="#add">x</a>',
  '/* color: #fff; margin: 12px */ a { margin: 0 }',
  'a { fill: url(#grad); }',
];

for (const s of bad) {
  test(`flags: ${s}`, () => assert.ok(checkSource(s, 'x.css').length > 0));
}
for (const s of clean) {
  test(`passes: ${s}`, () => assert.deepEqual(checkSource(s, 'x.css'), []));
}
test('reports line numbers', () => {
  const v = checkSource('a{}\nb{margin:12px}', 'x.css');
  assert.equal(v[0].line, 2);
});

test('tokens.css: light and dark define the same color keys', () => {
  const css = readFileSync(new URL('../../src/styles/tokens.css', import.meta.url), 'utf8');
  const keys = (block) => new Set([...block.matchAll(/(--(?:color|code)-[\w-]+)\s*:/g)].map((m) => m[1]));
  const grab = (re) => css.match(re)[1];
  const light = keys(grab(/:root\s*\{([^}]*)\}/));
  const dark = keys(grab(/:root\[data-theme="dark"\]\s*\{([^}]*)\}/));
  const media = keys(grab(/prefers-color-scheme: dark\)\s*\{\s*:root:not\(\[data-theme="light"\]\)\s*\{([^}]*)\}/));
  assert.ok(light.size >= 18);
  assert.deepEqual([...dark].sort(), [...light].sort());
  assert.deepEqual([...media].sort(), [...light].sort());
});
