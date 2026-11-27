import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handlePost, handleCatchAll, handleSitemap, handleRss, handleRobots } from '../../functions/_lib/edge-handlers.js';
import { renderShell } from '../../functions/_lib/shell.js';

// Fake HTMLRewriter: records handlers and applies them to a tiny fake <head>/<main>.
class FakeHR {
  constructor() { this.on_ = []; }
  on(sel, h) { this.on_.push([sel, h]); return this; }
  transform(res) {
    const out = { removed: [], head: '', main: null };
    for (const [sel, h] of this.on_) {
      h.element({ remove: () => out.removed.push(sel), onEndTag: (cb) => cb({ before: (s) => (out.head += s) }), setInnerContent: (s) => (out.main = s) });
    }
    res.rewrite = out;
    return res;
  }
}
const HTMLRewriter = FakeHR;
const shellRes = () => new Response('<html></html>', { status: 200, headers: { 'content-type': 'text/html' } });
const mkEnv = (extra = {}) => {
  const fetched = [];
  return { fetched, ASSETS: { fetch: async (r) => (fetched.push(r), shellRes()) }, ...extra };
};
const mk = (path, { method = 'GET', params = {}, env = mkEnv() } = {}) => ({ request: new Request('http://x' + path, { method }), env, params });
const fakeDb = (...sets) => ({ query: async () => (sets.length > 1 ? sets.shift() : sets[0] ?? []) });
const deps = (db) => ({ getDb: () => db, HTMLRewriter });
const throwing = { getDb: () => { throw new Error('postgresql://secret@host/db'); }, HTMLRewriter };
const noindex = (r) => r.rewrite.head.includes('<meta name="robots" content="noindex">');

test('shell fetched from "/" (not /index.html); status/headers set', async () => {
  const env = mkEnv();
  const r = await renderShell(env, new Request('http://x/deep/path'), { status: 404, noindex: true }, FakeHR);
  assert.equal(new URL(env.fetched[0].url).pathname, '/');
  assert.equal(r.status, 404);
  assert.equal(r.headers.get('content-type'), 'text/html; charset=utf-8');
  assert.equal(r.headers.get('cache-control'), 'public, max-age=0, s-maxage=60');
  assert.deepEqual(r.rewrite.removed, []); // nothing replaced on a 404 shell
});
test('200 shell cache header and default tags replaced', async () => {
  const r = await renderShell(mkEnv(), new Request('http://x/'), { headTags: '<title>t</title>' }, FakeHR);
  assert.equal(r.headers.get('cache-control'), 'public, max-age=0, s-maxage=600, stale-while-revalidate=86400');
  assert.ok(r.rewrite.removed.includes('title') && r.rewrite.removed.includes('link[rel="canonical"]'));
  assert.ok(r.rewrite.head.includes('<title>t</title>'));
});
test('NAVER_SITE_VERIFICATION: escaped when set, absent when unset/empty', async () => {
  const on = await handleCatchAll(mk('/about', { env: mkEnv({ NAVER_SITE_VERIFICATION: 'a"><script>x' }) }), deps(fakeDb()));
  assert.ok(on.rewrite.head.includes('<meta name="naver-site-verification" content="a&quot;&gt;&lt;script&gt;x">'));
  for (const v of [undefined, '', '  ']) {
    const off = await handleCatchAll(mk('/about', { env: mkEnv({ NAVER_SITE_VERIFICATION: v }) }), deps(fakeDb()));
    assert.ok(!off.rewrite.head.includes('naver'));
  }
  const nf = await handleCatchAll(mk('/nope', { env: mkEnv({ NAVER_SITE_VERIFICATION: 'z' }) }), deps(fakeDb()));
  assert.ok(nf.rewrite.head.includes('naver-site-verification')); // every shell response
});
test('catch-all: known pages 200, unknown 404 + noindex', async () => {
  for (const p of ['/', '/about', '/about/', '/tech', '/trends', '/essays']) {
    const r = await handleCatchAll(mk(p), deps(fakeDb()));
    assert.equal(r.status, 200, p);
    assert.ok(!noindex(r), p);
    assert.ok(r.rewrite.head.includes('<link rel="canonical"'), p);
  }
  const t = await handleCatchAll(mk('/tech/'), deps(fakeDb()));
  assert.ok(t.rewrite.head.includes('href="http://x/tech"'));
  assert.ok(t.rewrite.head.includes('<title>기술 - IT Security Blog</title>'));
  for (const p of ['/nope', '/a/b/c', '/Tech', '/posts-x', '/categories', '/categories/', '/about/x', '/toString', '/__proto__']) {
    const r = await handleCatchAll(mk(p), deps(fakeDb()));
    assert.equal(r.status, 404, p);
    assert.ok(noindex(r), p);
  }
});
test('catch-all: /assets and file extensions pass through; html fallback is a 404', async () => {
  const asset = new Response('js', { headers: { 'content-type': 'text/javascript' } });
  const env = { ASSETS: { fetch: async () => asset } };
  assert.equal(await handleCatchAll(mk('/assets/x.js', { env }), deps(fakeDb())), asset);
  assert.equal(await handleCatchAll(mk('/favicon.ico', { env }), deps(fakeDb())), asset);
  const r = await handleCatchAll(mk('/assets/missing.js'), deps(fakeDb())); // fake ASSETS returns html
  assert.equal(r.status, 404);
  assert.ok(noindex(r));
});
test('catch-all: /api/* unknown -> JSON 404', async () => {
  const r = await handleCatchAll(mk('/api/nope'), deps(fakeDb()));
  assert.equal(r.status, 404);
  assert.equal((await r.json()).error.code, 'not_found');
});
test('categories: existing section-rooted 200 (name as title), missing/non-section 404', async () => {
  const db = fakeDb([{ slug: 'tech/web', name: 'Web <x>' }, { slug: 'Security/Hack', name: 'Old' }]);
  const ok = await handleCatchAll(mk('/categories/tech/web'), deps(db));
  assert.equal(ok.status, 200);
  assert.ok(ok.rewrite.head.includes('<title>Web &lt;x&gt; - IT Security Blog</title>'));
  for (const p of ['/categories/tech/nope', '/categories/Security/Hack', '/categories/tech/%E0%A4', '/categories/tech/../x']) {
    const r = await handleCatchAll(mk(p), deps(db));
    assert.equal(r.status, 404, p);
    assert.ok(noindex(r), p);
  }
});
test('posts: found -> 200 with meta + escaped prerendered post header; missing/bad slug -> 404', async () => {
  const row = { id: 1, title: '<b>T</b>', slug: 'tech/a b', date: '2026-01-02', description: 'd', body_head: null, reading_minutes: 1, category_id: null, tags: [], content_md: 'x', category_name: null, category_path: null };
  const db = fakeDb([row], []);
  const r = await handlePost(mk('/posts/tech/a%20b', { params: { slug: ['tech', 'a%20b'] } }), deps(db));
  assert.equal(r.status, 200);
  assert.ok(r.rewrite.head.includes('og:title') && r.rewrite.head.includes('application/ld+json'));
  assert.ok(r.rewrite.head.includes('href="http://x/posts/tech/a%20b"'));
  assert.ok(!r.rewrite.head.includes('<b>T'));
  assert.ok(r.rewrite.main.includes('<h1 class="post-title">&lt;b&gt;T&lt;/b&gt;</h1>'));
  assert.ok(r.rewrite.main.includes('<p class="post-lead">d</p>') && r.rewrite.main.includes('<article class="article"></article>'));
  assert.ok(!r.rewrite.main.includes('<b>T'));
  const nf = await handlePost(mk('/posts/x', { params: { slug: ['x'] } }), deps(fakeDb([])));
  assert.equal(nf.status, 404);
  assert.ok(noindex(nf));
  for (const params of [{}, { slug: ['..'] }, { slug: ['%E0%A4'] }]) {
    const b = await handlePost(mk('/posts', { params }), deps(fakeDb([row])));
    assert.equal(b.status, 404);
  }
});
test('DB failure -> 500 shell, noindex, no-store, no leaked message', async () => {
  const log = console.error; console.error = () => {};
  try {
    const r = await handlePost(mk('/posts/x', { params: { slug: ['x'] } }), throwing);
    assert.equal(r.status, 500);
    assert.equal(r.headers.get('cache-control'), 'no-store');
    assert.ok(noindex(r));
    assert.ok(!JSON.stringify(r.rewrite).includes('secret'));
    const c = await handleCatchAll(mk('/categories/tech/x'), throwing);
    assert.equal(c.status, 500);
    for (const h of [handleSitemap, handleRss]) {
      const f = await h(mk('/x'), throwing);
      assert.equal(f.status, 500);
      assert.ok(!JSON.stringify(await f.json()).includes('secret'));
    }
    // shell itself unavailable -> JSON 500
    const broken = { ASSETS: { fetch: async () => new Response('', { status: 500 }) } };
    assert.equal((await handlePost(mk('/posts/x', { params: { slug: ['x'] }, env: broken }), throwing)).status, 500);
  } finally { console.error = log; }
});
test('non-GET -> 405 everywhere', async () => {
  for (const h of [handlePost, handleCatchAll, handleSitemap, handleRss, handleRobots]) {
    assert.equal((await h(mk('/x', { method: 'POST' }), deps(fakeDb()))).status, 405);
  }
});
test('sitemap: static + deep categories + posts, application/xml', async () => {
  const db = fakeDb([{ slug: 'tech', name: 'T' }, { slug: 'tech/a b', name: 'A' }, { slug: 'Security/Hack', name: 'Old' }],
    [{ slug: 'tech/a b&c', date: '2026-01-02' }]);
  const r = await handleSitemap(mk('/sitemap.xml', { env: { SITE_URL: 'https://e.com/' } }), deps(db));
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'application/xml; charset=utf-8');
  assert.match(r.headers.get('cache-control'), /s-maxage=600/);
  const x = await r.text();
  for (const loc of ['https://e.com/', 'https://e.com/about', 'https://e.com/tech', 'https://e.com/trends', 'https://e.com/essays',
    'https://e.com/categories/tech/a%20b', 'https://e.com/posts/tech/a%20b%26c']) assert.ok(x.includes(`<loc>${loc}</loc>`), loc);
  assert.ok(!x.includes('Security') && !x.includes('/categories/tech<'));
  assert.ok(x.includes('<lastmod>2026-01-02</lastmod>'));
});
test('rss + robots', async () => {
  const db = fakeDb([{ id: 1, title: 'T', slug: 'a/b', date: '2026-01-02', description: 'd', body_head: null, reading_minutes: 1, category_id: null, tags: [] }]);
  const r = await handleRss(mk('/rss.xml'), deps(db));
  assert.equal(r.headers.get('content-type'), 'application/rss+xml; charset=utf-8');
  assert.ok((await r.text()).includes('<link>http://x/posts/a/b</link>'));
  const rb = await handleRobots(mk('/robots.txt'));
  assert.equal(rb.headers.get('content-type'), 'text/plain; charset=utf-8');
  assert.equal(await rb.text(), 'User-agent: *\nAllow: /\n\nSitemap: http://x/sitemap.xml\n');
});

test('posts: essay prerender has the related card, progress bar and no lead; escapes every field', async () => {
  const row = { id: 1, title: 'E', slug: 'essays/x', date: '2026-01-02', description: 'd', body_head: null, reading_minutes: 3, category_id: null, tags: ['<i>'], content_md: 'x', category_name: null, category_path: 'essays/"><s>',
    rel_slug: 'tech/r', rel_title: '<u>R</u>', rel_description: 'rd', rel_date: '2025-01-01' };
  const r = await handlePost(mk('/posts/essays/x', { params: { slug: ['essays', 'x'] } }), deps(fakeDb([row], [])));
  const m = r.rewrite.main;
  assert.ok(m.startsWith('<div class="post post--essay">') && m.includes('class="reading-progress"') && m.includes('class="related-card"'));
  assert.ok(m.includes('<article class="article essay"></article>') && !m.includes('post-lead'));
  assert.ok(!/<(i|s|u)>/.test(m), m);
});
