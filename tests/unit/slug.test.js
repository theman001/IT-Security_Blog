import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeSlug, sectionOf } from '../../functions/_lib/slug.js';

test('decodeSlug decodes segments', () => {
  assert.equal(decodeSlug(['tech', 'a%20b', 'x%26y']), 'tech/a b/x&y');
});
test('decodeSlug accepts joined string', () => {
  assert.equal(decodeSlug('tech/a%20b/한글'), 'tech/a b/한글');
});
test('decodeSlug rejects . and ..', () => {
  assert.equal(decodeSlug(['tech', '..']), null);
  assert.equal(decodeSlug(['tech', '.']), null);
  assert.equal(decodeSlug(['tech', '%2e%2e']), null);
});
test('decodeSlug rejects empty segments and empty input', () => {
  assert.equal(decodeSlug(['tech', '']), null);
  assert.equal(decodeSlug('tech//a'), null);
  assert.equal(decodeSlug([]), null);
  assert.equal(decodeSlug(''), null);
});
test('decodeSlug rejects bad percent encoding', () => {
  assert.equal(decodeSlug(['%E0%A4%A']), null);
});
test('decodeSlug rejects encoded slash', () => {
  assert.equal(decodeSlug(['a%2Fb']), null);
});
test('sectionOf returns first segment', () => {
  assert.equal(sectionOf('tech/a/b'), 'tech');
  assert.equal(sectionOf('tech'), 'tech');
});
