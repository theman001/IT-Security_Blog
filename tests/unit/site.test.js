import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SITE, SITE_EN, SITE_SUBTITLE, SITE_TAGLINE, AUTHOR, HOME_TITLE, DEFAULT_DESCRIPTION } from '../../src/lib/site.js';
import { pageMeta, metaTags, headTagsHtml, buildRss } from '../../functions/_lib/seo.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

test('brand constants', () => {
  assert.equal(SITE, 'TheMan의 Patch Notes');
  assert.equal(SITE_EN, "TheMan's Patch Notes");
  assert.equal(SITE_SUBTITLE, 'IT Security Blog');
  assert.equal(SITE_TAGLINE, '기술을 읽고, 생각을 적는다');
  assert.equal(HOME_TITLE, 'TheMan의 Patch Notes - IT Security Blog');
  assert.ok(DEFAULT_DESCRIPTION.startsWith(`${SITE_TAGLINE}.`));
});

test('static copies (index.html, 404.html) match the constants', () => {
  const html = read('index.html');
  assert.ok(html.includes(`<title>${HOME_TITLE}</title>`));
  assert.ok(html.includes(`<meta name="description" content="${DEFAULT_DESCRIPTION}" />`));
  assert.ok(html.includes(`<meta property="og:site_name" content="${SITE}" />`));
  assert.ok(html.includes(`title="${SITE}" href="/rss.xml"`));
  assert.ok(read('public/404.html').includes(`페이지를 찾을 수 없습니다 - ${SITE}</title>`));
  assert.doesNotMatch(html + read('public/404.html'), /<title>IT Security Blog<\/title>/);
});

test('home page: title, WebSite JSON-LD with name + alternateName; other pages carry no JSON-LD', () => {
  const home = pageMeta({ title: '', description: DEFAULT_DESCRIPTION, path: '/' }, 'https://blog.example');
  assert.equal(home.title, HOME_TITLE);
  assert.equal(home.og['og:site_name'], SITE);
  const ld = JSON.parse(home.jsonLd);
  assert.deepEqual(ld, { '@context': 'https://schema.org', '@type': 'WebSite', name: SITE, alternateName: [SITE_EN], url: 'https://blog.example/', inLanguage: 'ko' });
  assert.ok(!home.jsonLd.includes('<'));
  assert.equal(headTagsHtml(home).match(/application\/ld\+json/g).length, 1);
  assert.equal(pageMeta({ title: 'About', description: 'x', path: '/about' }, 'https://blog.example').jsonLd, '');
  assert.equal(pageMeta({ title: '기술', description: 'x', path: '/tech' }, 'https://blog.example').title, `기술 - ${SITE}`);
});

test('posts: author is the person, title suffix is the site name; RSS channel uses the brand', () => {
  const m = metaTags({ title: 'T', slug: 'tech/t', date: '2026-01-02', description: 'd', tags: [], section: 'tech' }, 'https://blog.example');
  assert.equal(m.title, `T - ${SITE}`);
  assert.equal(JSON.parse(m.jsonLd).author.name, AUTHOR);
  const rss = buildRss([], 'https://blog.example');
  assert.ok(rss.includes(`<title>${SITE}</title>`));
  assert.ok(rss.includes(DEFAULT_DESCRIPTION.replace(/&/g, '&amp;')));
});
