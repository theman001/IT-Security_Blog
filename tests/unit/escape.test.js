import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml } from '../../src/lib/escape.js';

test('escapeHtml escapes & < > " \'', () => {
  assert.equal(escapeHtml('<a href="x">&\''), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;');
});
test('escapeHtml: null/undefined -> empty, non-strings stringified', () => {
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(undefined), '');
  assert.equal(escapeHtml(0), '0');
  assert.equal(escapeHtml('<'.repeat(2)), '&lt;&lt;');
});
