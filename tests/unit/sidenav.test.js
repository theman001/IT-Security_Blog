import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sidenavHtml } from '../../src/components/sidenav.js';

const cats = [
  { path: 'tech', name: 'tech' },
  { path: 'tech/security', name: '보안' },
  { path: 'tech/security/web', name: '웹 <b>' },
  { path: 'tech/infra', name: '인프라' },
  { path: 'trends', name: 'trends' },
  { path: 'trends/ai', name: 'AI' },
  { path: 'essays', name: 'essays' },
];
const posts = [
  { slug: 'tech/security/a b&c', title: '글 "A"' },
  { slug: 'tech/security/web/w1', title: '웹 1' },
  { slug: 'tech/root-post', title: '루트 글' },
  { slug: 'trends/ai/x', title: 'AI 글' },
  { slug: 'essays/e1', title: '사유 1' },
];
const html = (cur) => sidenavHtml({ categories: cats, posts }, cur);
const techHtml = html('tech/security/web/w1');

test('three sections in a fixed order with the static section titles, each a <details> with its tree', () => {
  assert.match(techHtml, /aria-label="카테고리와 글"/);
  assert.equal((techHtml.match(/<ul class="sidenav__sections">/g) ?? []).length, 1);
  const at = ['기술', '동향', '사유'].map((n) => techHtml.indexOf(`<span class="sidenav__name">${n}</span>`));
  assert.ok(at[0] > 0 && at[0] < at[1] && at[1] < at[2], `section order ${at}`);
  assert.match(techHtml, /<ul class="sidenav__sections"><li><details open><summary><span class="sidenav__name">기술/);
  assert.doesNotMatch(techHtml, /전체 보기|sidenav__all/); // folders only toggle; no extra "view all" rows
  assert.doesNotMatch(techHtml, /href="\/(tech|trends|essays)"|href="\/categories\//);
  assert.match(techHtml, /<span class="sidenav__name">기술<\/span><span class="sidenav__count">3<\/span>/); // subtree total: 3 tech posts
});
test('only the folders on the way to the current post are open', () => {
  assert.equal((techHtml.match(/<details open>/g) ?? []).length, 3); // 기술, 보안, 웹
  assert.match(techHtml, /<details open><summary><span class="sidenav__name">기술/);
  assert.match(techHtml, /<details><summary><span class="sidenav__name">동향/);
  assert.match(techHtml, /<details><summary><span class="sidenav__name">사유/);
  assert.match(techHtml, /<details><summary><span class="sidenav__name">인프라/);
  assert.match(techHtml, /href="\/posts\/tech\/security\/web\/w1" aria-current="page">웹 1</);
  assert.equal((techHtml.match(/aria-current="page"/g) ?? []).length, 1);
  // trends / essays pages open their own section
  assert.match(html('trends/ai/x'), /<details open><summary><span class="sidenav__name">동향/);
  assert.match(html('trends/ai/x'), /<details><summary><span class="sidenav__name">기술/);
  assert.match(html('essays/e1'), /<details open><summary><span class="sidenav__name">사유/);
  assert.match(html('essays/e1'), /href="\/posts\/essays\/e1" aria-current="page">사유 1</);
});
test('everything is escaped and urls are encoded per segment; posts stay in their own section', () => {
  assert.doesNotMatch(techHtml, /<b>/);
  assert.match(techHtml, /웹 &lt;b&gt;/);
  assert.match(techHtml, /글 &quot;A&quot;/);
  assert.match(techHtml, /href="\/posts\/tech\/security\/a%20b%26c"/);
  const trendsPart = techHtml.slice(techHtml.indexOf('동향'), techHtml.indexOf('사유</span>'));
  assert.doesNotMatch(trendsPart, /글 &quot;A&quot;|웹 1|루트 글/);
});
test('missing category rows, empty input and foreign paths do not break it', () => {
  const h = sidenavHtml({ categories: [], posts: [{ slug: 'tech/x/y/z', title: 'Z' }] }, 'tech/x/y/z');
  assert.match(h, /<span class="sidenav__name">x<\/span>/);
  assert.match(h, /<span class="sidenav__name">y<\/span>/);
  assert.match(h, /aria-current="page">Z</);
  assert.match(sidenavHtml({}, 'tech/a'), /<nav class="sidenav"/);
  assert.doesNotMatch(sidenavHtml({ categories: [{ path: 'other/x', name: 'no' }], posts: [{ slug: 'other/p', title: 'no' }] }, 'tech/a'), />no</);
});
