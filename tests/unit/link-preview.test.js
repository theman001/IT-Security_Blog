import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTarget, parseMeta, handleLinkPreview } from '../../functions/_lib/link-preview.js';

const ctx = (url, method = 'GET') => ({ request: new Request('http://x/api/link-preview?url=' + encodeURIComponent(url), { method }), env: {} });
const db = (referenced = true) => {
  const calls = [];
  return { calls, getDb: () => ({ query: async (text, params) => (calls.push({ text, params }), referenced ? [{ ok: 1 }] : []) }) };
};
const html = (body, type = 'text/html; charset=utf-8', status = 200, headers = {}) => new Response(body, { status, headers: { 'content-type': type, ...headers } });

test('parseTarget: public http(s) hosts only', () => {
  assert.ok(parseTarget('https://example.org/a?b=1'));
  assert.ok(parseTarget('http://news.example.co.kr/x'));
  for (const bad of ['', 'ftp://example.org', 'javascript:alert(1)', '//example.org', 'https://localhost/', 'https://a.local/', 'https://x.internal/',
    'https://127.0.0.1/', 'https://10.0.0.1/', 'https://0x7f.1/', 'https://[::1]/', 'https://intranet/', 'https://u:p@example.org/', 'https://example.org:8443/',
    'https://' + 'a'.repeat(2100) + '.com', null, undefined]) assert.equal(parseTarget(bad), null, String(bad));
});

test('parseMeta: og first, then twitter, then plain; entities decoded; whitespace and length cleaned', () => {
  assert.deepEqual(parseMeta('<head><title>Plain</title><meta name="description" content="plain d"><meta property="og:title" content="OG &amp; Title"><meta property="og:description" content=\'og  d\n x\'></head>'),
    { title: 'OG & Title', description: 'og d x' });
  assert.deepEqual(parseMeta('<title> T &#39;q&#x41; </title><meta name="twitter:description" content="tw">'), { title: "T 'qA", description: 'tw' });
  assert.deepEqual(parseMeta('<html><body>nothing</body></html>'), { title: '', description: '' });
  const long = parseMeta(`<meta property="og:title" content="${'가'.repeat(300)}"><meta name="description" content="${'x'.repeat(500)}">`);
  assert.equal([...long.title].length, 120);
  assert.equal([...long.description].length, 200);
  assert.ok(long.title.endsWith('…'));
  // content after </head> is ignored; markup in values stays text for the client to escape
  assert.deepEqual(parseMeta('<head></head><meta property="og:title" content="late">'), { title: '', description: '' });
  assert.equal(parseMeta('<meta property="og:title" content="&lt;b&gt;x">').title, '<b>x');
});

test('non-GET -> 405; invalid url -> 400 without touching db or network', async () => {
  const d = db();
  let fetched = 0;
  const fetchImpl = async () => (fetched++, html(''));
  assert.equal((await handleLinkPreview(ctx('https://example.org/', 'POST'), { ...d, fetchImpl })).status, 405);
  for (const bad of ['', 'https://127.0.0.1/', 'file:///etc/passwd']) assert.equal((await handleLinkPreview(ctx(bad), { ...d, fetchImpl })).status, 400, bad);
  assert.equal(d.calls.length, 0);
  assert.equal(fetched, 0);
});

test('url not written in any post -> 404, never fetched (no open proxy); lookup is bound', async () => {
  const d = db(false);
  let fetched = 0;
  const r = await handleLinkPreview(ctx('https://example.org/x'), { ...d, fetchImpl: async () => (fetched++, html('')) });
  assert.equal(r.status, 404);
  assert.equal(fetched, 0);
  assert.deepEqual(d.calls[0].params, ['https://example.org/x']);
  assert.match(d.calls[0].text, /strpos\(content_md, \$1\)/);
});

test('referenced url -> 200 {title, description}; request is a plain GET with manual redirects', async () => {
  const seen = [];
  const fetchImpl = async (url, init) => (seen.push({ url, init }), html('<head><meta property="og:title" content="제목"><meta property="og:description" content="설명"></head>'));
  const r = await handleLinkPreview(ctx('https://example.org/x'), { ...db(), fetchImpl });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { title: '제목', description: '설명' });
  assert.equal(seen[0].init.redirect, 'manual');
  assert.ok(seen[0].init.signal);
  assert.doesNotMatch(JSON.stringify(seen[0].init.headers), /cookie|authorization/i);
});

test('redirects are re-validated: public hop followed, private/oversized chains -> 502', async () => {
  const route = (map) => async (url) => map[url] ?? html('<title>end</title>');
  const redirect = (to) => new Response(null, { status: 302, headers: { location: to } });
  let r = await handleLinkPreview(ctx('https://example.org/a'), { ...db(), fetchImpl: route({ 'https://example.org/a': redirect('/b') }) });
  assert.deepEqual(await r.json(), { title: 'end', description: '' });
  r = await handleLinkPreview(ctx('https://example.org/a'), { ...db(), fetchImpl: route({ 'https://example.org/a': redirect('http://127.0.0.1/admin') }) });
  assert.equal(r.status, 502);
  r = await handleLinkPreview(ctx('https://example.org/a'), { ...db(), fetchImpl: route({ 'https://example.org/a': redirect('https://example.org/b'), 'https://example.org/b': redirect('https://example.org/c'),
    'https://example.org/c': redirect('https://example.org/d'), 'https://example.org/d': redirect('https://example.org/e') }) });
  assert.equal(r.status, 502);
});

test('upstream problems -> 502 (not cached); non-html, error status, timeout; db error -> 500', async () => {
  const same = (fetchImpl) => handleLinkPreview(ctx('https://example.org/x'), { ...db(), fetchImpl });
  assert.equal((await same(async () => html('%PDF', 'application/pdf'))).status, 502);
  assert.equal((await same(async () => html('<title>x</title>', 'text/html', 500))).status, 502);
  assert.equal((await same(async () => { throw new DOMException('t', 'TimeoutError'); })).status, 502);
  const bad = await handleLinkPreview(ctx('https://example.org/x'), { getDb: () => ({ query: async () => { throw new Error('secret conn'); } }), fetchImpl: async () => html('') });
  assert.equal(bad.status, 500);
  assert.equal(bad.headers.get('cache-control'), 'no-store');
  assert.doesNotMatch(await bad.text(), /secret/);
});

test('only the first 256KB is read; charset from the header is honoured', async () => {
  const big = '<head><meta property="og:title" content="앞"></head>' + 'x'.repeat(2_000_000);
  let pulled = 0;
  const stream = new ReadableStream({ pull(c) { pulled += 65536; c.enqueue(new TextEncoder().encode(big.slice(pulled - 65536, pulled))); if (pulled >= big.length) c.close(); } });
  const r = await handleLinkPreview(ctx('https://example.org/x'), { ...db(), fetchImpl: async () => new Response(stream, { headers: { 'content-type': 'text/html' } }) });
  assert.equal((await r.json()).title, '앞');
  assert.ok(pulled < 1_000_000, `pulled ${pulled}`);
  // euc-kr page declared in the header
  const eucKr = new Uint8Array([0x3c, 0x74, 0x69, 0x74, 0x6c, 0x65, 0x3e, 0xb0, 0xa1, 0x3c, 0x2f, 0x74, 0x69, 0x74, 0x6c, 0x65, 0x3e]); // <title>가</title>
  const r2 = await handleLinkPreview(ctx('https://example.org/x'), { ...db(), fetchImpl: async () => new Response(eucKr, { headers: { 'content-type': 'text/html; charset=euc-kr' } }) });
  assert.equal((await r2.json()).title, '가');
});
