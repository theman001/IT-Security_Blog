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

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
test('cursor rejects non-date strings and impossible dates', () => {
  assert.equal(decodeCursor(b64({ date: 'x', id: 1 })), null);
  assert.equal(decodeCursor(b64({ date: "2026-01-01'; DROP", id: 1 })), null);
  assert.equal(decodeCursor(b64({ date: '2026-13-45', id: 1 })), null);
  assert.equal(decodeCursor(b64({ date: '2026-02-30', id: 1 })), null);
});
test('cursor rejects ids outside int4', () => {
  assert.equal(decodeCursor(b64({ date: '2026-01-01', id: 2 ** 31 })), null);
  assert.equal(decodeCursor(b64({ date: '2026-01-01', id: -1 })), null);
});
test('cursor rejects year 0000 (Postgres ::timestamp has no year 0)', () => {
  assert.equal(decodeCursor(b64({ date: '0000-01-01', id: 1 })), null);
  assert.deepEqual(decodeCursor(b64({ date: '0001-01-01', id: 1 })), { date: '0001-01-01', id: 1 });
});
