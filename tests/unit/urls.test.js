import { test } from 'node:test';
import assert from 'node:assert/strict';
import { postHref, categoryHref } from '../../src/lib/urls.js';

test('postHref encodes each segment, keeps the slashes', () => {
  assert.equal(postHref('tech/security/01-a'), '/posts/tech/security/01-a');
  assert.equal(postHref('tech/a b&c:한글/x'), '/posts/tech/a%20b%26c%3A%ED%95%9C%EA%B8%80/x');
});
test('postHref round trips through decodeURIComponent per segment', () => {
  const slug = 'essays/a b&c:한글/"q"?#';
  const back = postHref(slug).slice('/posts/'.length).split('/').map(decodeURIComponent).join('/');
  assert.equal(back, slug);
});
test('categoryHref: one segment is a section root, more is /categories/…', () => {
  assert.equal(categoryHref('tech'), '/tech');
  assert.equal(categoryHref('essays'), '/essays');
  assert.equal(categoryHref('tech/a b&c:한글'), '/categories/tech/a%20b%26c%3A%ED%95%9C%EA%B8%80');
});
