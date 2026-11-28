import { mkdirSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { mockPost, postFixture } from './mock-api.js';

const tech = postFixture('post-tech');
const essay = postFixture('post-essay');
const xss = postFixture('post-xss');

const href = (slug) => `/posts/${slug.split('/').map(encodeURIComponent).join('/')}`;
const TOC = 'nav[aria-label="이 글의 목차"]';
const clone = (fx, post, rest = {}) => ({ ...fx, ...rest, post: { ...fx.post, ...post } });
const nextTech = clone(tech, { slug: 'tech/security/next&two', title: '다음 글 제목' });

// measure token as px, resolved with the article's own font (ch depends on it)
const measureOf = (page, token) =>
  page.evaluate((t) => {
    const a = document.querySelector('.article');
    const probe = document.createElement('div');
    probe.style.maxWidth = `var(${t})`;
    a.append(probe);
    const px = getComputedStyle(probe).maxWidth;
    probe.remove();
    return { probe: px, article: getComputedStyle(a).maxWidth };
  }, token);

test('tech layout: measure, fonts, TOC column, no progress line', async ({ page }) => {
  await mockPost(page, [tech]);
  await page.goto(href(tech.post.slug));
  await expect(page.locator('h1')).toHaveText(tech.post.title);
  const art = page.locator('.article');
  await expect(art).not.toHaveClass(/essay/);
  const m = await measureOf(page, '--measure-tech');
  expect(m.article).toBe(m.probe);
  const f = await art.evaluate((el) => ({ fs: getComputedStyle(el).fontSize, lh: getComputedStyle(el).lineHeight, ff: getComputedStyle(el).fontFamily }));
  expect(f).toMatchObject({ fs: '16px', lh: '28px' });
  expect(f.ff).toContain('Pretendard');
  // 3 h2 + 1 h3 -> TOC; the 1280px viewport shows the sticky column, not the <details>
  const toc = page.locator(`.post-toc ${TOC}`);
  await expect(toc).toBeVisible();
  await expect(toc.locator('li')).toHaveCount(4);
  await expect(toc.locator('li.toc-h3')).toHaveCount(1);
  expect(await toc.evaluate((n) => getComputedStyle(n).position)).toBe('sticky');
  await expect(page.locator('details.post-toc-mobile')).toBeHidden();
  await expect(page.locator('.reading-progress')).toHaveCount(0);
  // description lead is tech/trends only
  await expect(page.locator('.post-lead')).toHaveText(tech.post.description);
});

test('tech narrow: TOC is a <details> above the body', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockPost(page, [tech]);
  await page.goto(href(tech.post.slug));
  const d = page.locator('details.post-toc-mobile');
  await expect(d).toBeVisible();
  await expect(d.locator('summary')).toHaveText('이 글의 목차');
  await expect(page.locator(`.post-toc ${TOC}`)).toBeHidden();
  const order = await page.evaluate(() => document.querySelector('details.post-toc-mobile').compareDocumentPosition(document.querySelector('.article')));
  expect(order & 4).toBeTruthy(); // 4 = DOCUMENT_POSITION_FOLLOWING
  await d.locator('summary').click();
  await expect(d.locator('li')).toHaveCount(4);
});

test('fewer than 3 headings: no TOC, single column', async ({ page }) => {
  const few = clone(tech, { contentMd: '## a\n\n본문\n\n## b\n\n본문\n' });
  await mockPost(page, [few]);
  await page.goto(href(tech.post.slug));
  await expect(page.locator('.article h2')).toHaveCount(2);
  await expect(page.locator(TOC)).toHaveCount(0);
  await expect(page.locator('details.post-toc-mobile')).toHaveCount(0);
});

test('essay layout: full width, serif 18px/1.9, no TOC, progress line, pull quote', async ({ page }) => {
  await mockPost(page, [essay]);
  await page.goto(href(essay.post.slug));
  const art = page.locator('.article.essay');
  await expect(art).toBeVisible();
  // full page width like Home (no narrow reading column): article, head and nav span #main's content box
  const widths = await page.evaluate(() => {
    const main = document.querySelector('#main');
    const cs = getComputedStyle(main);
    const inner = main.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    return { inner, article: document.querySelector('.article.essay').getBoundingClientRect().width, head: document.querySelector('.post-head').getBoundingClientRect().width };
  });
  expect(widths.article).toBeCloseTo(widths.inner, 0);
  expect(widths.head).toBeCloseTo(widths.inner, 0);
  const f = await art.evaluate((el) => ({ fs: getComputedStyle(el).fontSize, lh: getComputedStyle(el).lineHeight, ff: getComputedStyle(el).fontFamily }));
  expect(f).toMatchObject({ fs: '18px', lh: '34.2px' });
  expect(f.ff).toContain('Noto Serif KR');
  await expect(page.locator(TOC)).toHaveCount(0);
  await expect(page.locator('details.post-toc-mobile')).toHaveCount(0);
  await expect(page.locator('.post-lead')).toHaveCount(0);
  await expect(art.locator('blockquote')).toHaveCSS('border-left-style', 'solid');
  await expect(page.locator('.reading-progress')).toHaveCount(1);
});

test('essay reading progress follows scroll; transition off under reduced motion', async ({ page }) => {
  await mockPost(page, [essay]);
  await page.goto(href(essay.post.slug));
  const bar = page.locator('.reading-progress');
  const width = () => bar.evaluate((el) => el.getBoundingClientRect().width / innerWidth);
  await expect.poll(width).toBeLessThan(0.02);
  expect(await bar.evaluate((el) => getComputedStyle(el).height)).toBe('4px'); // --space-1
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await expect.poll(width).toBeGreaterThan(0.98);
  await page.evaluate(() => scrollTo(0, (document.documentElement.scrollHeight - innerHeight) / 2));
  await expect.poll(async () => Math.abs((await width()) - 0.5)).toBeLessThan(0.05); // settles after the width transition
  expect(await bar.evaluate((el) => getComputedStyle(el).transitionDuration)).not.toBe('0s');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await bar.evaluate((el) => getComputedStyle(el).transitionDuration)).toBe('0s');
});

test('related: null -> no card; present -> card at the very top of an essay', async ({ page }) => {
  await mockPost(page, [clone(essay, {}, { related: null })]);
  await page.goto(href(essay.post.slug));
  await expect(page.locator('h1')).toBeVisible();
  await expect(page.locator('.related-card')).toHaveCount(0);

  await page.unroute('**/api/posts/**');
  await mockPost(page, [essay]);
  await page.goto(href(essay.post.slug));
  const card = page.locator('.related-card');
  await expect(card).toHaveCount(1);
  await expect(card).toContainText('이 생각의 계기가 된 글');
  await expect(card.locator('a')).toHaveAttribute('href', href(essay.related.slug));
  await expect(card).toContainText(essay.related.excerpt);
  await expect(card).toContainText(essay.related.date);
  const before = await page.evaluate(() => document.querySelector('.related-card').compareDocumentPosition(document.querySelector('h1')));
  expect(before & 4).toBeTruthy();
  expect(await card.evaluate((el) => getComputedStyle(el).borderTopStyle)).toBe('solid');
});

test('related card title is a <p>, so an essay has no heading before its h1', async ({ page }) => {
  await mockPost(page, [essay]);
  await page.goto(href(essay.post.slug));
  await expect(page.locator('h1')).toBeVisible();
  await expect(page.locator('.related-card h3')).toHaveCount(0);
  await expect(page.locator('.related-card p.related-card__title a')).toHaveAttribute('href', href(essay.related.slug));
  const first = await page.evaluate(() => document.querySelector('#main h1, #main h2, #main h3')?.tagName);
  expect(first).toBe('H1');
});

test('crumb separator has visible spacing', async ({ page }) => {
  await mockPost(page, [tech]);
  await page.goto(href(tech.post.slug));
  const links = page.locator('.post-crumb a');
  await expect(links).toHaveCount(2);
  const [a, b] = await Promise.all([links.nth(0).boundingBox(), links.nth(1).boundingBox()]);
  expect(b.x - (a.x + a.width)).toBeGreaterThan(16); // glyph + token padding, not a collapsed ~7px
  await expect(page.locator('.post-crumb')).toHaveText(/^tech\s*\/\s*security$/i);
});

test('relatedBy: box after the body for tech, absent when empty', async ({ page }) => {
  await mockPost(page, [tech, clone(tech, { slug: 'tech/security/empty' }, { relatedBy: [] })]);
  await page.goto(href(tech.post.slug));
  const box = page.locator('.related-by');
  await expect(box).toBeVisible();
  await expect(box.getByRole('heading', { name: '이 글에서 이어진 사유' })).toBeVisible();
  await expect(box.locator('.related-card')).toHaveCount(tech.relatedBy.length);
  await expect(box.locator('.related-card a')).toHaveAttribute('href', href(tech.relatedBy[0].slug));
  const after = await page.evaluate(() => document.querySelector('.article').compareDocumentPosition(document.querySelector('.related-by')));
  expect(after & 4).toBeTruthy();
  await page.goto(href('tech/security/empty'));
  await expect(page.locator('h1')).toBeVisible();
  await expect(page.locator('.related-by')).toHaveCount(0);
});

test('prev / 목록 / next hrefs round-trip the encoding', async ({ page }) => {
  const calls = await mockPost(page, [tech, nextTech]);
  await page.goto(href(tech.post.slug));
  expect(calls).toContain('/api/posts/tech/security/a%20b%26c%3A%ED%95%9C%EA%B8%80');
  const nav = page.locator('.post-nav');
  await expect(nav.locator('a[rel="prev"]')).toHaveAttribute('href', '/posts/tech/security/prev%20one');
  await expect(nav.getByRole('link', { name: '목록' })).toHaveAttribute('href', '/categories/tech/security');
  await expect(nav.locator('a[rel="next"]')).toHaveAttribute('href', '/posts/tech/security/next%26two');
  await nav.locator('a[rel="next"]').click();
  await expect(page.locator('h1')).toHaveText('다음 글 제목');
  expect(new URL(page.url()).pathname).toBe('/posts/tech/security/next%26two');
  expect(calls.at(-1)).toBe('/api/posts/tech/security/next%26two');
  expect(await page.title()).toBe('다음 글 제목 - IT Security Blog');
});

test('목록 target: section root, and a single-segment slug goes home', async ({ page }) => {
  await mockPost(page, [essay, clone(tech, { slug: 'solo' })]);
  await page.goto(href(essay.post.slug));
  await expect(page.getByRole('link', { name: '목록' })).toHaveAttribute('href', '/categories/essays/thoughts');
  await page.goto('/posts/solo');
  await expect(page.getByRole('link', { name: '목록' })).toHaveAttribute('href', '/');
  await page.unroute('**/api/posts/**');
  await mockPost(page, [clone(essay, { slug: 'essays/x' })]);
  await page.goto('/posts/essays/x');
  await expect(page.getByRole('link', { name: '목록' })).toHaveAttribute('href', '/essays');
});

test('essay shows 다음 사유 navigation when next exists', async ({ page }) => {
  await mockPost(page, [essay]);
  await page.goto(href(essay.post.slug));
  await expect(page.locator('.post-nav a[rel="next"]')).toContainText('다음 사유');
  await expect(page.locator('.post-nav a[rel="prev"]')).toHaveCount(0);
});

test('404 from the API renders the not-found message and title', async ({ page }) => {
  await mockPost(page, []);
  await page.goto('/posts/tech/none');
  await expect(page.locator('h1')).toHaveText('페이지를 찾을 수 없습니다');
  await expect(page.locator('#main a[data-link][href="/"]')).toBeVisible();
  expect(await page.title()).toBe('페이지를 찾을 수 없습니다 - IT Security Blog');
});

test('other API errors reach the router error state', async ({ page }) => {
  await mockPost(page, []);
  await page.goto('/posts/boom');
  await expect(page.locator('[role="alert"]')).toBeVisible();
});

test('XSS: DB strings are text, body goes through the sanitizer', async ({ page }) => {
  let dialog = false;
  page.on('dialog', (d) => { dialog = true; d.dismiss(); });
  await mockPost(page, [xss, clone(essay, { slug: 'essays/xss', title: '<script>alert(1)</script>' }, { related: xss.related })]);
  await page.goto(href(xss.post.slug));
  await expect(page.locator('h1')).toHaveText('<script>alert(1)</script>');
  await expect(page.locator('.post-lead')).toHaveText('<img src=x onerror=alert(1)>');
  await expect(page.locator('.post-tags')).toContainText('#"><img src=x onerror=alert(1)>');
  await expect(page.locator('.post-crumb')).toContainText('<i>x"><img src=x onerror=alert(1)>');
  await expect(page.locator('.post-nav')).toContainText('<img src=x onerror=alert(1)>');
  await expect(page.locator('.related-by')).toContainText('<svg onload=alert(1)>');
  await page.goto(href('essays/xss'));
  await expect(page.locator('.related-card')).toContainText('<script>alert(1)</script>');
  await page.goto(href(xss.post.slug));
  await expect(page.locator('h1')).toBeVisible();
  // nothing was injected: no scripts, no handler attributes, no images outside the sanitized body
  await expect(page.locator('#main script, #main svg')).toHaveCount(0);
  await expect(page.locator('#main [onerror], #main [onload]')).toHaveCount(0);
  await expect(page.locator('#main img:not(.article img)')).toHaveCount(0);
  await page.waitForTimeout(300);
  expect(dialog).toBe(false);
});

test('TOC click: hash only, no re-render, active heading follows', async ({ page }) => {
  await mockPost(page, [tech]);
  await page.goto(href(tech.post.slug));
  await expect(page.locator('h1')).toBeVisible();
  await page.evaluate(() => { window.__same = document.querySelector('.article'); });
  const links = page.locator(`.post-toc ${TOC} a`);
  await links.nth(1).click(); // 토큰 교환
  await expect(page).toHaveURL(/#toc-heading-1$/);
  await expect(links.nth(1)).toHaveAttribute('aria-current', 'true');
  await expect(links.first()).not.toHaveAttribute('aria-current', 'true');
  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(200);
  expect(await page.evaluate(() => window.__same === document.querySelector('.article'))).toBe(true);
  const top = await page.locator('#toc-heading-1').evaluate((h) => h.getBoundingClientRect().top);
  expect(top).toBeLessThan(200);
});

test('deep link /posts/x#toc-heading-1 scrolls to that heading (initial load and client navigation)', async ({ page }) => {
  await mockPost(page, [tech]);
  const top = () => page.evaluate(() => Math.round(document.getElementById('toc-heading-1').getBoundingClientRect().top));
  await page.goto(`${href(tech.post.slug)}#toc-heading-1`);
  await expect(page.locator('#toc-heading-1')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(200);
  expect(await top()).toBeLessThan(200);
  // client-side navigation from another post URL keeps working too, and an unknown hash falls back to the top
  await page.evaluate(async (u) => (await import('/src/router.js')).navigate(u), `${href(tech.post.slug)}?x=1#toc-heading-2`);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(200);
  expect(await page.evaluate(() => Math.round(document.getElementById('toc-heading-2').getBoundingClientRect().top))).toBeLessThan(200);
  await page.evaluate(async (u) => (await import('/src/router.js')).navigate(u), `${href(tech.post.slug)}?x=2#nope`);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
});

test('code blocks get the copy button', async ({ page }) => {
  await mockPost(page, [tech]);
  await page.goto(href(tech.post.slug));
  await expect(page.locator('.article .code-block .code-block__copy')).toHaveCount(1);
  await expect(page.locator('.article .code-block .token').first()).toBeVisible();
});

test('post -> post navigation leaves no stale progress line, listeners or observers', async ({ page }) => {
  await page.addInitScript(() => {
    window.__io = 0;
    const IO = window.IntersectionObserver;
    window.IntersectionObserver = class extends IO {
      constructor(...a) { super(...a); window.__io++; this._off = false; }
      disconnect() { if (!this._off) { this._off = true; window.__io--; } super.disconnect(); }
    };
    window.__scroll = 0;
    const add = window.addEventListener.bind(window);
    const rm = window.removeEventListener.bind(window);
    window.addEventListener = (t, ...r) => { if (t === 'scroll') window.__scroll++; return add(t, ...r); };
    window.removeEventListener = (t, ...r) => { if (t === 'scroll') window.__scroll--; return rm(t, ...r); };
  });
  await mockPost(page, [essay, tech]);
  const live = () => page.evaluate(() => ({ io: window.__io, scroll: window.__scroll, bars: document.querySelectorAll('.reading-progress').length }));
  await page.goto(href(essay.post.slug));
  await expect(page.locator('.reading-progress')).toHaveCount(1);
  expect(await live()).toEqual({ io: 0, scroll: 1, bars: 1 });
  await page.locator('.post-nav a[rel="next"]').click(); // essay -> tech
  await expect(page.locator('h1')).toHaveText(tech.post.title);
  const t = await live();
  expect(t).toMatchObject({ scroll: 0, bars: 0 });
  expect(t.io).toBeGreaterThan(0);
  await page.locator('.related-by .related-card a').click(); // tech -> essay
  await expect(page.locator('h1')).toHaveText(essay.post.title);
  expect(await live()).toEqual({ io: 0, scroll: 1, bars: 1 });
});

test('screenshots for review', async ({ page }) => {
  test.skip(!process.env.SCREENSHOTS, 'set SCREENSHOTS=1 to write .superpowers/screens/*.png');
  mkdirSync('.superpowers/screens', { recursive: true });
  await mockPost(page, [tech, essay]);
  for (const [w, h] of [[1440, 900], [390, 844]]) {
    await page.setViewportSize({ width: w, height: h });
    for (const [name, fx] of [['tech', tech], ['essay', essay]]) {
      await page.goto(href(fx.post.slug));
      await expect(page.locator('h1')).toBeVisible();
      await page.screenshot({ path: `.superpowers/screens/post-${name}-${w}.png`, fullPage: true });
    }
  }
});

test('SPA navigation never reads a #post-data element that appears after boot as the inline payload', async ({ page }) => {
  const c = clone(tech, { slug: 'tech/c', title: 'C 제목' }, { prev: null, next: null });
  const b = clone(tech, { slug: 'tech/b', title: 'B 제목' }, { prev: null, next: { slug: 'tech/c', title: 'C 제목' } });
  const a = clone(tech, { slug: 'tech/a', title: 'A 제목' }, { prev: null, next: { slug: 'tech/b', title: 'B 제목' } });
  const calls = await mockPost(page, [a, b, c]);
  await page.goto(href('tech/a'));
  await page.locator('a.post-nav__next').click();
  await expect(page.locator('h1')).toHaveText('B 제목');
  // The sanitizer drops ids from post bodies, so simulate whatever could put one in the DOM later (script and div alike).
  await page.evaluate(() => {
    const payload = JSON.stringify({ post: { slug: 'tech/c', title: 'FROM BODY', contentMd: 'x' } });
    for (const [tag, type] of [['script', 'application/json'], ['div', null]]) {
      const el = document.createElement(tag);
      el.id = 'post-data';
      if (type) el.type = type;
      el.textContent = payload;
      document.getElementById('main').append(el);
    }
  });
  await page.locator('a.post-nav__next').click();
  await expect(page.locator('h1')).toHaveText('C 제목');
  expect(calls).toEqual(['/api/posts/tech/a', '/api/posts/tech/b', '/api/posts/tech/c']);
});
