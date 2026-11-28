import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sectionNavHtml } from '../../src/components/section-nav.js';

const cats = [
  { path: 'tech', name: 'tech' },
  { path: 'tech/security', name: '보안' },
  { path: 'tech/security/web', name: '웹 <b>' },
  { path: 'tech/infra', name: '인프라' },
];
const posts = [
  { slug: 'tech/security/a b&c', title: '글 "A"' },
  { slug: 'tech/security/web/w1', title: '웹 1' },
  { slug: 'tech/root-post', title: '루트 글' },
];
const html = sectionNavHtml({ categories: cats, posts }, 'tech', 'tech/security/web/w1');

test('tree: section title link, folders as <details>, posts as links, counts are subtree sizes', () => {
  assert.match(html, /aria-label="기술 카테고리와 글"/);
  assert.match(html, /<p class="sidenav__title"><a data-link href="\/tech">기술<\/a><\/p>/);
  assert.equal((html.match(/<details/g) ?? []).length, 3); // security, web, infra
  assert.match(html, /<span class="sidenav__name">보안<\/span><span class="sidenav__count">2<\/span>/);
  assert.match(html, /<span class="sidenav__name">인프라<\/span><span class="sidenav__count">0<\/span>/);
  assert.match(html, /href="\/categories\/tech\/security"/); // 전체 보기
  assert.match(html, /href="\/posts\/tech\/root-post"/); // post directly in the section root
});
test('current post is marked; only its folders are open', () => {
  assert.equal((html.match(/aria-current="page"/g) ?? []).length, 1);
  assert.match(html, /href="\/posts\/tech\/security\/web\/w1" aria-current="page">웹 1</);
  assert.match(html, /<details open><summary><span class="sidenav__name">보안/);
  assert.match(html, /<details open><summary><span class="sidenav__name">웹 &lt;b&gt;/);
  assert.match(html, /<details><summary><span class="sidenav__name">인프라/); // collapsed
});
test('everything is escaped and urls are encoded per segment', () => {
  assert.doesNotMatch(html, /<b>/);
  assert.match(html, /글 &quot;A&quot;/);
  assert.match(html, /href="\/posts\/tech\/security\/a%20b%26c"/);
});
test('missing category rows and odd input do not break it (virtual folders, empty lists)', () => {
  const h = sectionNavHtml({ categories: [], posts: [{ slug: 'tech/x/y/z', title: 'Z' }] }, 'tech', 'tech/x/y/z');
  assert.match(h, /<span class="sidenav__name">x<\/span>/);
  assert.match(h, /<span class="sidenav__name">y<\/span>/);
  assert.match(h, /aria-current="page">Z</);
  assert.match(sectionNavHtml({}, 'tech', 'tech/a'), /<nav class="sidenav"/);
  assert.doesNotMatch(sectionNavHtml({ categories: [{ path: 'trends/x', name: 'no' }], posts: [{ slug: 'other/p', title: 'no' }] }, 'tech', 'tech/a'), />no</);
});
