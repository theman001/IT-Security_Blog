import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const headers = readFileSync(new URL('../../public/_headers', import.meta.url), 'utf8');

test('_headers: hashed /assets/* are immutable for a year; no rule for HTML', () => {
  assert.match(headers, /^\/assets\/\*\n[ \t]+Cache-Control: public, max-age=31536000, immutable$/m);
  assert.ok(!/^\/(\*|index\.html)?\s*$/m.test(headers), 'no catch-all/HTML rule');
});
