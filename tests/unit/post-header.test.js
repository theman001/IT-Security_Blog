import { test } from 'node:test';
import assert from 'node:assert/strict';
import { postHeaderHtml, postLayoutHtml, sectionOfSlug } from '../../src/lib/post-header.js';

const evil = '"><img src=x onerror=alert(1)>';
const post = (o = {}) => ({ title: 'T', slug: 'tech/a/b', date: '2026-01-02', readingMinutes: 4, tags: ['x'], categoryPath: 'tech/a', description: 'lead', ...o });

test('tech header: crumb links, h1, meta, tags, lead', () => {
  const h = postHeaderHtml(post(), { section: 'tech' });
  assert.match(h, /^<header class="post-head">/);
  assert.ok(h.includes('<a data-link href="/tech">tech</a>') && h.includes('<a data-link href="/categories/tech/a">a</a>'));
  assert.ok(h.includes('<h1 class="post-title">T</h1>') && h.includes('<time datetime="2026-01-02">2026-01-02</time><span>4분</span>'));
  assert.ok(h.includes('<span class="post-tag">#x</span>') && h.includes('<p class="post-lead">lead</p>'));
});
test('essay header has no lead; empty tags/crumb omitted', () => {
  const h = postHeaderHtml(post({ tags: [], categoryPath: null }), { section: 'essays' });
  assert.ok(!h.includes('post-lead') && !h.includes('post-tags') && !h.includes('post-crumb'));
});
test('every field is escaped (title, tags, categoryPath, date, readingMinutes, description)', () => {
  const p = post({ title: evil, tags: [evil], categoryPath: `tech/${evil}`, date: evil, readingMinutes: evil, description: evil });
  for (const html of [postHeaderHtml(p, { section: 'tech' }), postLayoutHtml({ ...p, slug: 'tech/x' }), postLayoutHtml({ ...p, slug: 'essays/x' }, { related: { slug: 'a/b', title: evil, excerpt: evil, date: evil } })]) {
    assert.ok(!html.includes('<img') && !html.includes(evil) && html.includes('&lt;img'), html);
  }
});
test('layout: wrapper classes, empty article, tail; same header as the standalone header', () => {
  const t = postLayoutHtml(post(), { tailHtml: '<nav></nav>' });
  assert.ok(t.startsWith('<div class="post post--tech">') && t.includes('<article class="article"></article>') && t.includes('<nav></nav>'));
  assert.ok(t.includes(postHeaderHtml(post(), { section: 'tech' })) && !t.includes('reading-progress'));
  const e = postLayoutHtml(post({ slug: 'essays/y' }), { bodyHtml: '<p>b</p>' });
  assert.ok(e.includes('post--essay') && e.includes('<article class="article essay"><p>b</p></article>') && e.includes('reading-progress'));
});
test('sectionOfSlug', () => {
  assert.equal(sectionOfSlug('essays/a/b'), 'essays');
  assert.equal(sectionOfSlug(null), '');
});
