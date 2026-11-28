import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handlePosts, handleCategories } from '../../functions/_lib/handlers.js';
import { encodeCursor } from '../../functions/_lib/cursor.js';

const mk = (path, { method = 'GET', params = {} } = {}) => ({
  request: new Request('http://x' + path, { method }), env: {}, params,
});
const fakeDb = (rows = []) => {
  const calls = [];
  return { calls, query: async (text, params) => (calls.push({ text, params }), rows) };
};
const deps = (db) => ({ getDb: () => db });
const body = async (r) => r.json();

test('non-GET -> 405 JSON error', async () => {
  for (const h of [handlePosts, handleCategories]) {
    const r = await h(mk('/api/x', { method: 'POST' }), deps(fakeDb()));
    assert.equal(r.status, 405);
    assert.equal(r.headers.get('allow'), 'GET');
    assert.equal((await body(r)).error.code, 'method_not_allowed');
  }
});
test('bad limit / section / cursor / category -> 400 and never touch the db', async () => {
  const bad = ['limit=0', 'limit=51', 'limit=abc', 'limit=1.5', 'limit=-1', 'section=other', 'section=', 'cursor=###',
    'cursor=' + encodeCursor({ date: 'x', id: 1 }), 'category=a//b', 'category=..'];
  for (const q of bad) {
    const db = fakeDb();
    const r = await handlePosts(mk('/api/posts?' + q), deps(db));
    assert.equal(r.status, 400, q);
    assert.equal(db.calls.length, 0, q);
    assert.equal((await body(r)).error.code, 'bad_request');
  }
});
test('valid list query -> 200 with ok cache header', async () => {
  const db = fakeDb([]);
  const r = await handlePosts(mk('/api/posts?section=essays&limit=50'), deps(db));
  assert.equal(r.status, 200);
  assert.deepEqual(await body(r), { items: [], nextCursor: null });
  assert.match(r.headers.get('cache-control'), /s-maxage=600/);
});
test('post detail: missing -> 404, bad slug -> 400, db error -> 500 without leaking', async (tc) => {
  let r = await handlePosts(mk('/api/posts/x', { params: { slug: ['x'] } }), deps(fakeDb([])));
  assert.equal(r.status, 404);
  assert.equal((await body(r)).error.code, 'not_found');
  r = await handlePosts(mk('/api/posts/..', { params: { slug: ['..'] } }), deps(fakeDb([])));
  assert.equal(r.status, 400);
  const boom = { query: async () => { throw new Error('postgres://u:secret@host/db SELECT 1'); } };
  const log = tc.mock.method(console, 'error', () => {});
  r = await handlePosts(mk('/api/posts', {}), deps(boom));
  assert.equal(r.status, 500);
  assert.equal(r.headers.get('cache-control'), 'no-store');
  assert.equal(log.mock.callCount(), 1, 'handler logs the error');
  const t = JSON.stringify(await body(r));
  assert.doesNotMatch(t, /secret|postgres|SELECT/);
  assert.equal(JSON.parse(t).error.code, 'internal');
});
test('getDb throwing (missing env) -> 500 internal', async (t) => {
  const log = t.mock.method(console, 'error', () => {});
  const r = await handlePosts(mk('/api/posts'), { getDb: () => { throw new Error('DATABASE_URL missing'); } });
  assert.equal(r.status, 500);
  assert.equal(log.mock.callCount(), 1);
});
test('slug params are decoded and passed exactly', async () => {
  const db = fakeDb([]);
  await handlePosts(mk('/', { params: { slug: ['tech', 'a%20b', '%ED%95%9C'] } }), deps(db));
  assert.deepEqual(db.calls[0].params, ['tech/a b/한']);
});
test('categories: no params -> list; suffix required/stripped', async () => {
  let db = fakeDb([]);
  let r = await handleCategories(mk('/api/categories'), deps(db));
  assert.equal(r.status, 200);
  assert.deepEqual(await body(r), { items: [] });
  db = fakeDb([]);
  r = await handleCategories(mk('/', { params: { path: ['tech', 'a%20b', 'posts'] } }), deps(db));
  assert.equal(r.status, 404);
  assert.deepEqual(db.calls[0].params, ['tech/a b']);
  db = fakeDb([]);
  r = await handleCategories(mk('/', { params: { path: ['tech', 'a'] } }), deps(db));
  assert.equal(r.status, 404);
  assert.equal(db.calls.length, 0);
  r = await handleCategories(mk('/', { params: { path: ['posts'] } }), deps(fakeDb([])));
  assert.equal(r.status, 400);
  r = await handleCategories(mk('/', { params: { path: ['..', 'posts'] } }), deps(fakeDb([])));
  assert.equal(r.status, 400);
});

import { handleSectionNav } from '../../functions/_lib/handlers.js';

test('section-nav: only tech|trends|essays; bound patterns; no body; categories + {slug,title} posts', async () => {
  for (const q of ['', '?section=', '?section=other', '?section=tech%25', '?section=tech/security']) {
    const db = fakeDb();
    const r = await handleSectionNav(mk('/api/section-nav' + q), deps(db));
    assert.equal(r.status, 400, q);
    assert.equal(db.calls.length, 0, q);
  }
  assert.equal((await handleSectionNav(mk('/api/section-nav?section=tech', { method: 'POST' }), deps(fakeDb()))).status, 405);
  const calls = [];
  const db = {
    query: async (text, params) => {
      calls.push({ text, params });
      if (/FROM categories c/.test(text)) return [{ id: 1, name: '보안', slug: 'tech/security', parent_id: null, depth: 2, post_count: 1, total_post_count: 1, sub_category_count: 0 }];
      return [{ slug: 'tech/security/a', title: 'A <b>' }];
    },
  };
  const r = await handleSectionNav(mk('/api/section-nav?section=tech'), deps(db));
  assert.equal(r.status, 200);
  assert.match(r.headers.get('cache-control'), /s-maxage=600/);
  const out = await r.json();
  assert.deepEqual(out.posts, [{ slug: 'tech/security/a', title: 'A <b>' }]);
  assert.equal(out.categories[0].path, 'tech/security');
  assert.equal(calls.length, 2);
  for (const c of calls) {
    assert.deepEqual(c.params, ['tech']);
    assert.doesNotMatch(c.text, /content_md|description/); // list only: never the body
  }
});
