import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withEdgeCache } from '../../functions/_lib/cache.js';

// Fake Cache API: stores clones keyed by URL; put() records what was stored.
const fakeCache = () => {
  const m = new Map();
  return { m, match: async (k) => m.get(k.url)?.clone(), put: async (k, r) => void m.set(k.url, r) };
};
const mkCtx = () => { const p = []; return { p, waitUntil: (x) => p.push(x) }; };
const req = (path = '/tech', init) => new Request('http://x' + path, init);
const run = async (cache, handler, path, init, opts) => {
  const ctx = mkCtx();
  const r = await withEdgeCache(req(path, init), ctx, handler, { cache, ...opts });
  await Promise.all(ctx.p);
  return r;
};
const handlerOf = (status = 200, headers = { 'Cache-Control': 'public, max-age=0, s-maxage=600' }) => {
  const h = async () => (h.calls++, new Response(status === 301 ? null : 'body', { status, headers }));
  h.calls = 0;
  return h;
};

test('MISS then HIT: second call skips the handler; client keeps the original Cache-Control', async () => {
  const cache = fakeCache(), h = handlerOf();
  const a = await run(cache, h);
  assert.equal(a.headers.get('x-edge-cache'), 'MISS');
  const b = await run(cache, h);
  assert.equal(b.headers.get('x-edge-cache'), 'HIT');
  assert.equal(h.calls, 1);
  assert.equal(await b.text(), 'body');
  assert.equal(b.headers.get('cache-control'), 'public, max-age=0, s-maxage=600');
  assert.equal(a.headers.get('cache-control'), 'public, max-age=0, s-maxage=600');
  assert.equal(b.headers.get('x-orig-cache-control'), null);
});

test('stored copy carries the layer TTL: 600 for 200 and 301, 60 for 404', async () => {
  for (const [status, ttl] of [[200, 600], [301, 600], [404, 60]]) {
    const cache = fakeCache();
    await run(cache, handlerOf(status), `/s${status}`);
    assert.equal(cache.m.get(`http://x/s${status}`).headers.get('cache-control'), `public, max-age=${ttl}`, String(status));
  }
  const cache = fakeCache();
  await run(cache, handlerOf(200), '/t', undefined, { ttl: 300 });
  assert.equal(cache.m.get('http://x/t').headers.get('cache-control'), 'public, max-age=300');
});

test('404 and 301 are cached and replayed with their status', async () => {
  for (const s of [404, 301]) {
    const cache = fakeCache(), h = handlerOf(s);
    await run(cache, h, '/p');
    assert.equal((await run(cache, h, '/p')).status, s);
    assert.equal(h.calls, 1);
  }
});

test('400, 405, 5xx and no-store responses are never stored', async () => {
  for (const [s, hd] of [[400, undefined], [405, undefined], [500, undefined], [503, undefined], [200, { 'Cache-Control': 'no-store' }], [404, { 'Cache-Control': 'private, No-Store' }]]) {
    const cache = fakeCache(), h = handlerOf(s, hd);
    const a = await run(cache, h, '/e');
    assert.equal(a.status, s);
    assert.equal(cache.m.size, 0, `${s} ${JSON.stringify(hd)}`);
    await run(cache, h, '/e');
    assert.equal(h.calls, 2);
  }
});

test('the query string is part of the key', async () => {
  const cache = fakeCache(), h = handlerOf();
  await run(cache, h, '/api/posts?limit=1');
  await run(cache, h, '/api/posts?limit=2');
  assert.equal(h.calls, 2);
  assert.deepEqual([...cache.m.keys()].sort(), ['http://x/api/posts?limit=1', 'http://x/api/posts?limit=2']);
});

test('HEAD and POST pass through untouched (BYPASS, no lookup, no store)', async () => {
  for (const method of ['HEAD', 'POST']) {
    const cache = fakeCache(), h = handlerOf();
    const r = await run(cache, h, '/tech', { method });
    assert.equal(r.headers.get('x-edge-cache'), 'BYPASS', method);
    assert.equal(cache.m.size, 0);
    assert.equal(h.calls, 1);
  }
});

test('Cache API missing: handler runs, no throw, no header', async () => {
  const h = handlerOf();
  const r = await run(null, h);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('x-edge-cache'), null);
  assert.equal(h.calls, 1);
});

test('client Cache-Control/Pragma: no-cache skips the lookup but refreshes the stored entry', async () => {
  for (const hd of [{ 'Cache-Control': 'no-cache' }, { Pragma: 'no-cache' }]) {
    const cache = fakeCache(), h = handlerOf();
    await run(cache, h);
    const r = await run(cache, h, '/tech', { headers: hd });
    assert.equal(r.headers.get('x-edge-cache'), 'BYPASS');
    assert.equal(h.calls, 2);
    assert.equal(cache.m.size, 1);
    assert.equal((await run(cache, h)).headers.get('x-edge-cache'), 'HIT');
  }
});

test('cache lookup or store failures never break the response', async () => {
  const cache = { match: async () => { throw new Error('boom'); }, put: async () => { throw new Error('boom'); } };
  const h = handlerOf();
  const r = await run(cache, h);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('x-edge-cache'), 'MISS');
});

test('handler errors propagate (handlers turn their own errors into 500s)', async () => {
  await assert.rejects(run(fakeCache(), async () => { throw new Error('x'); }), /x/);
});
