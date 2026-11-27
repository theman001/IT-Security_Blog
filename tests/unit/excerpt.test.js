import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeExcerpt } from '../../functions/_lib/excerpt.js';

test('description wins', () => {
  assert.equal(makeExcerpt('요약', '본문'), '요약');
});
test('body fallback strips markdown and truncates', () => {
  const e = makeExcerpt('', '# 제목\n```js\nx\n```\n본문'.repeat(40));
  assert.ok(e.endsWith('...'));
  assert.ok(e.length <= 183);
  assert.ok(!/`/.test(e));
});
test('short body has no ellipsis; links/images cleaned', () => {
  assert.equal(makeExcerpt(null, '![img](a.png) [링크](http://x) *굵게* > 인용'), '링크 굵게 인용');
});
