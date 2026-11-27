import { test } from 'node:test';
import assert from 'node:assert/strict';
import { json, fail } from '../../functions/_lib/http.js';

test('json defaults to ok cache header', () => {
  const r = json({ a: 1 });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('Cache-Control'), 'public, max-age=60, s-maxage=600, stale-while-revalidate=86400');
  assert.match(r.headers.get('Content-Type'), /application\/json/);
});

test('fail returns error body and err cache', async () => {
  const r = fail(404, 'not_found', 'x');
  assert.equal(r.status, 404);
  assert.deepEqual(await r.json(), { error: { code: 'not_found', message: 'x' } });
  assert.match(r.headers.get('Cache-Control'), /s-maxage=60/);
  assert.match(r.headers.get('Cache-Control'), /max-age=0/);
});
