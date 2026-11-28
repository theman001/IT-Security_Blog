import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { metaTags, pageMeta, headTagsHtml, xmlEscape, buildSitemap, buildRss, siteOrigin, DEFAULT_DESCRIPTION } from '../../functions/_lib/seo.js';
import { SECTIONS } from '../../functions/_lib/sections.js';
import { SECTIONS as SRC } from '../../src/content/sections.js';

const evil = {
  title: '<script>alert(1)</script> "q" & \'s\'', slug: 'tech/a b&c:한글', date: '2026-01-02',
  description: 'say "hi" </script><b>', excerpt: 'x', tags: ['a"b', '</script>', "c'd"], categoryName: 'Cat <x>', section: 'tech',
};

test('metaTags + headTagsHtml: fully escaped, no raw script, no </script> in JSON-LD', () => {
  const m = metaTags(evil, 'https://e.com');
  assert.equal(m.title, `${evil.title} - TheMan의 Patch Notes`);
  assert.equal(m.canonical, 'https://e.com/posts/tech/a%20b%26c%3A%ED%95%9C%EA%B8%80');
  assert.equal(m.og['og:type'], 'article');
  assert.equal(m.og['article:published_time'], '2026-01-02');
  assert.equal(m.twitter['twitter:card'], 'summary');
  assert.ok(!m.jsonLd.includes('<'));
  const ld = JSON.parse(m.jsonLd);
  assert.equal(ld['@type'], 'BlogPosting');
  assert.equal(ld.headline, evil.title);
  assert.equal(ld.dateModified, '2026-01-02');
  assert.equal(ld.keywords, 'a"b, </script>, c\'d');
  const html = headTagsHtml(m);
  assert.ok(!html.includes('<script>alert'));
  assert.equal(html.match(/<script/g).length, 1); // only the JSON-LD
  assert.equal(html.match(/<\/script>/g).length, 1);
  for (const [, v] of html.matchAll(/ content="([^"]*)"/g)) assert.ok(!/["<>]/.test(v), v);
  assert.match(html, /<title>&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});
test('metaTags uses excerpt when description empty, accepts getPost() shape', () => {
  const m = metaTags({ post: { ...evil, description: '', excerpt: 'from body' } }, 'https://e.com');
  assert.equal(m.description, 'from body');
});
test('pageMeta: home title and canonical', () => {
  const h = pageMeta({ title: '', description: 'd', path: '/' }, 'https://e.com');
  assert.equal(h.title, 'TheMan의 Patch Notes - IT Security Blog');
  assert.equal(h.canonical, 'https://e.com/');
  const s = pageMeta({ title: '기술', description: 'd', path: '/categories/tech/a b' }, 'https://e.com');
  assert.equal(s.title, '기술 - TheMan의 Patch Notes');
  assert.equal(s.canonical, 'https://e.com/categories/tech/a%20b');
  assert.ok(!headTagsHtml(s).includes('ld+json'));
});
test('xmlEscape', () => assert.equal(xmlEscape('a&b<c>"\''), 'a&amp;b&lt;c&gt;&quot;&apos;'));
test('buildSitemap: exact encoded + escaped <loc>, lastmod', () => {
  const x = buildSitemap([{ path: '/' }, { path: '/posts/tech/a b&c:한글', date: '2026-01-02' }], 'https://e.com');
  assert.ok(x.includes('<loc>https://e.com/</loc>'));
  assert.ok(x.includes('<loc>https://e.com/posts/tech/a%20b%26c%3A%ED%95%9C%EA%B8%80</loc><lastmod>2026-01-02</lastmod>'));
  assert.ok(x.startsWith('<?xml'));
  assert.equal(buildSitemap(Array.from({ length: 50005 }, () => ({ path: '/' })), 'https://e.com').match(/<url>/g).length, 50000);
});
test('buildRss: escaped, RFC-822 pubDate at 00:00 KST, permalink guid', () => {
  const x = buildRss([{ title: 'A & <B>', slug: 'tech/a b&c', date: '2026-01-02', excerpt: '"q" <x>' }], 'https://e.com');
  assert.ok(x.includes('<title>A &amp; &lt;B&gt;</title>'));
  assert.ok(x.includes('<link>https://e.com/posts/tech/a%20b%26c</link>'));
  assert.ok(x.includes('<guid isPermaLink="true">https://e.com/posts/tech/a%20b%26c</guid>'));
  assert.ok(x.includes('<pubDate>Thu, 01 Jan 2026 15:00:00 GMT</pubDate>'));
  assert.ok(x.includes('<description>&quot;q&quot; &lt;x&gt;</description>'));
  assert.ok(x.includes('<language>ko</language>'));
});
test('siteOrigin: SITE_URL trimmed else request origin', () => {
  const r = new Request('http://h:1/x');
  assert.equal(siteOrigin({ SITE_URL: ' https://s.com/// ' }, r), 'https://s.com');
  assert.equal(siteOrigin({ SITE_URL: '' }, r), 'http://h:1');
  assert.equal(siteOrigin({}, r), 'http://h:1');
  assert.equal(siteOrigin({ SITE_URL: 'http://localhost:8788/' }, r), 'http://localhost:8788');
});
test('siteOrigin: invalid SITE_URL (no scheme, junk, other scheme) falls back to the request origin, never throws', () => {
  const r = new Request('http://h:1/x');
  for (const v of ['example.com', 'example.com:8080', 'not a url', 'javascript:alert(1)', 'ftp://s.com', 'https://', '//s.com', 42]) {
    assert.equal(siteOrigin({ SITE_URL: v }, r), 'http://h:1', String(v));
  }
});
test('functions sections copy equals src; index.html default description matches', () => {
  for (const k of Object.keys(SRC)) assert.deepEqual(SECTIONS[k], { title: SRC[k].title, description: SRC[k].description });
  assert.deepEqual(Object.keys(SECTIONS), Object.keys(SRC));
  const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
  assert.ok(html.includes(`content="${DEFAULT_DESCRIPTION}"`));
  assert.ok(html.includes('href="/rss.xml"'));
});
