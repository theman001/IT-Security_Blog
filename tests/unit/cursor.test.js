import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeCursor, decodeCursor } from '../../functions/_lib/cursor.js';

test('cursor round trip', () => {
  const c = { date: '2026-01-01', id: 5 };
  assert.deepEqual(decodeCursor(encodeCursor(c)), c);
});
test('cursor rejects garbage', () => {
  assert.equal(decodeCursor('###'), null);
  assert.equal(decodeCursor(''), null);
  assert.equal(decodeCursor(Buffer.from('{"date":1,"id":"x"}').toString('base64url')), null);
  assert.equal(decodeCursor(Buffer.from('nope').toString('base64url')), null);
});
