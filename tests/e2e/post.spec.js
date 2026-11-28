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
  await d.locator('summary').first().click();
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

test('essay layout: measure, serif 18px/1.9, no TOC, progress line, pull quote', async ({ page }) => {
  await mockPost(page, [essay]);
  await page.goto(href(essay.post.slug));
  const art = page.locator('.article.essay');
  await expect(art).toBeVisible();
  const m = await measureOf(page, '--measure-essay');
  expect(m.article).toBe(m.probe);
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

test('external link card in a post is filled from /api/link-preview (text only); failures keep the domain card', async ({ page }) => {
  const url = 'https://example.org/a?x=1&y=2';
  const md = `\`\`\`link\nurl: ${url}\n\`\`\`\n\n\`\`\`link\nurl: https://down.example.org/z\n\`\`\`\n\n\`\`\`link\nurl: https://hand.example.org/h\ntitle: 손으로 쓴 제목\n\`\`\``;
  await mockPost(page, [clone(essay, { contentMd: md })]);
  const asked = [];
  await page.route('**/api/link-preview?*', (route) => {
    const u = new URL(route.request().url()).searchParams.get('url');
    asked.push(u);
    if (u === url) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ title: '<img src=x onerror=alert(1)>메타 제목', description: '메타 설명 & 요약' }) });
    return route.fulfill({ status: 502, contentType: 'application/json', body: '{"error":{"code":"upstream_failed","message":"x"}}' });
  });
  await page.goto(href(essay.post.slug));
  const cards = page.locator('.article a.link-card');
  await expect(cards).toHaveCount(3);
  await expect(cards.nth(0).locator('.link-card__title')).toHaveText('<img src=x onerror=alert(1)>메타 제목'); // text, not markup
  await expect(cards.nth(0).locator('.link-card__desc')).toHaveText('메타 설명 & 요약');
  await expect(cards.nth(0).locator('img')).toHaveCount(0);
  await expect(cards.nth(1).locator('.link-card__title')).toHaveText('down.example.org'); // failed -> domain fallback
  await expect(cards.nth(1).locator('.link-card__desc')).toHaveCount(0);
  await expect(cards.nth(2).locator('.link-card__title')).toHaveText('손으로 쓴 제목');
  expect(asked.sort()).toEqual([url, 'https://down.example.org/z'].sort()); // hand-written card is never looked up
});

test('youtube fence: only the thumbnail loads before click, no iframe; click swaps in a youtube-nocookie iframe; modified click and bad ids do not', async ({ page }) => {
  const id = 'dQw4w9WgXcQ';
  const md = `\`\`\`youtube\nurl: https://youtu.be/${id}?t=1m5s\ntitle: 테스트 영상\n\`\`\`\n\n\`\`\`youtube\nhttps://www.youtube.com/watch?v=${id}\n\`\`\`\n\n\`\`\`youtube\nurl: https://evil.example/watch?v=${id}\n\`\`\`\n\n<iframe src="https://www.youtube.com/embed/${id}"></iframe>`;
  await mockPost(page, [clone(essay, { contentMd: md })]);
  const yt = [];
  page.on('request', (r) => /youtube|ytimg|google/.test(new URL(r.url()).hostname) && yt.push(r.url()));
  await page.route('https://i.ytimg.com/**', (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360"/>' }));
  await page.route('https://www.youtube-nocookie.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>stub</title>' }));
  await page.goto(href(essay.post.slug));
  const boxes = page.locator('.article .video-embed');
  await expect(boxes).toHaveCount(2);
  await expect(page.locator('.article iframe')).toHaveCount(0); // raw <iframe> in markdown is stripped, embeds are not iframes yet
  await expect(page.locator('.article pre')).toHaveCount(1); // the evil.example block stayed a code block
  await expect(boxes.nth(0).locator('img.video-embed__thumb')).toHaveAttribute('src', `https://i.ytimg.com/vi/${id}/hqdefault.jpg`);
  await expect(boxes.nth(0).locator('img.video-embed__thumb')).toHaveAttribute('referrerpolicy', 'no-referrer');
  await expect.poll(() => yt.length).toBeGreaterThan(0); // the thumbnail (same id twice = one request); never an iframe / nocookie request before a click
  expect(yt.every((u) => u.startsWith('https://i.ytimg.com/vi/'))).toBe(true);
  const first = boxes.nth(0).locator('a.video-embed__play');
  await expect(first).toHaveAttribute('href', `https://www.youtube.com/watch?v=${id}&t=65`); // no-JS / new-tab fallback
  await expect(first.locator('.video-embed__label')).toHaveText('테스트 영상');
  // ctrl-click is left to the browser (new tab), page unchanged
  await first.click({ modifiers: ['Control'], noWaitAfter: true }).catch(() => {});
  await expect(page.locator('.article iframe')).toHaveCount(0);
  await first.click();
  const f = page.locator('.article .video-embed iframe');
  await expect(f).toHaveCount(1);
  await expect(f).toHaveAttribute('src', `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&start=65`);
  await expect(f).toHaveAttribute('title', '테스트 영상');
  await expect(f).toHaveAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
  await expect(boxes.nth(1).locator('iframe')).toHaveCount(0); // other embeds stay untouched
});

test('youtube embed ignores a spoofed data-video (raw html in markdown) and cleans up on navigation', async ({ page }) => {
  await mockPost(page, [clone(essay, { contentMd: '<div class="video-embed" data-video="x&quot;><script>1</script>"><a class="video-embed__play" href="https://youtu.be/dQw4w9WgXcQ">x</a></div>' })]);
  await page.context().route(/youtu(\.be|be\.com|be-nocookie\.com)/, (r) => r.abort()); // also the popup a plain click opens
  await page.goto(href(essay.post.slug));
  const a = page.locator('.article a.video-embed__play');
  await a.click({ noWaitAfter: true }).catch(() => {});
  await expect(page.locator('.article iframe')).toHaveCount(0);
});

test('image zoom: click / Enter opens a modal dialog with the large image; Esc, click and the button close it; links and thumbnails are skipped', async ({ page }) => {
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  await page.route('https://asset.taeuk.site/**', (r) => r.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from(png.split(',')[1], 'base64') }));
  await page.route('https://i.ytimg.com/**', (r) => r.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from(png.split(',')[1], 'base64') }));
  const md = '![첫 사진](https://asset.taeuk.site/posts/a.png)\n\n[![링크 사진](https://asset.taeuk.site/posts/b.png)](https://example.org)\n\n![둘째](https://asset.taeuk.site/posts/c.png)\n\n```youtube\nhttps://youtu.be/dQw4w9WgXcQ\n```';
  await mockPost(page, [clone(essay, { contentMd: md })]);
  await page.goto(href(essay.post.slug));
  const zoomables = page.locator('.article img.zoomable');
  await expect(zoomables).toHaveCount(2); // the linked image and the youtube thumbnail are not zoomable
  await expect(zoomables.nth(0)).toHaveAttribute('role', 'button');
  await expect(zoomables.nth(0)).toHaveAttribute('aria-label', '이미지 크게 보기: 첫 사진');
  const dlg = page.locator('dialog.image-zoom');
  await expect(dlg).toHaveCount(0);
  await zoomables.nth(0).click();
  await expect(dlg).toBeVisible();
  await expect(dlg.locator('img')).toHaveAttribute('src', 'https://asset.taeuk.site/posts/a.png');
  await expect(dlg.locator('img')).toHaveAttribute('alt', '첫 사진');
  await page.keyboard.press('Escape');
  await expect(dlg).toHaveCount(0);
  await expect(zoomables.nth(0)).toBeFocused(); // focus returns to the image
  await page.keyboard.press('Enter'); // keyboard opens it too
  await expect(dlg).toBeVisible();
  await dlg.locator('.image-zoom__close').click();
  await expect(dlg).toHaveCount(0);
  await zoomables.nth(1).click();
  await expect(dlg.locator('img')).toHaveAttribute('src', 'https://asset.taeuk.site/posts/c.png');
  await dlg.locator('img').click(); // clicking the image closes
  await expect(dlg).toHaveCount(0);
  await page.locator('.article .video-embed__thumb').click({ noWaitAfter: true }); // thumbnail click = play, not zoom
  await expect(dlg).toHaveCount(0);
  // Ctrl-click leaves the image alone
  await zoomables.nth(0).click({ modifiers: ['Control'] });
  await expect(dlg).toHaveCount(0);
  await zoomables.nth(0).click();
  await expect(dlg).toBeVisible();
});

test('sidebar (>= 1280px): all three sections in the left column; the current section is open, the others collapsed; folders collapse', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockPost(page, [tech]);
  await page.goto(href(tech.post.slug));
  const side = page.locator('.post-sidenav .sidenav');
  await expect(side).toBeVisible();
  await expect(side).toHaveAttribute('aria-label', '카테고리와 글');
  const top = side.locator('.sidenav__sections > li > details');
  await expect(top).toHaveCount(3);
  await expect(top.locator('> summary .sidenav__name')).toHaveText(['기술', '동향', '사유']);
  // tech open, trends/essays collapsed
  await expect(top.nth(0)).toHaveJSProperty('open', true);
  await expect(top.nth(1)).toHaveJSProperty('open', false);
  await expect(top.nth(2)).toHaveJSProperty('open', false);
  await expect(side.getByRole('link', { name: '동향 글 1' })).toBeHidden();
  await expect(side.getByRole('link', { name: '사유 글 1' })).toBeHidden();
  // geometry: left of the body, same width as the TOC column, starting on the breadcrumb row
  const g = await page.evaluate(() => {
    const b = (s) => document.querySelector(s).getBoundingClientRect();
    return { side: b('.post-sidenav'), art: b('.article'), head: b('.post-head'), toc: b('.post-toc'), rem: parseFloat(getComputedStyle(document.documentElement).fontSize) };
  });
  expect(g.side.right).toBeLessThanOrEqual(g.art.left);
  expect(Math.round(g.side.width)).toBe(Math.round(g.rem * 14));
  expect(g.side.left).toBeGreaterThanOrEqual(0);
  expect(Math.abs(g.side.top - g.head.top)).toBeLessThanOrEqual(1); // sidebar starts at the title row
  expect(Math.abs(g.toc.top - g.head.top)).toBeLessThanOrEqual(1); // so does the TOC (it used to start below the header)
  expect(g.toc.left).toBeGreaterThanOrEqual(g.art.right);
  // current post: marked, escaped title, its folders open, sibling folders collapsed
  const cur = side.locator('a[aria-current="page"]');
  await expect(cur).toHaveText(tech.post.title);
  await expect(cur).toHaveAttribute('href', href(tech.post.slug));
  await expect(side.locator('details', { has: page.locator('a[href$="/w1"]') }).last()).toHaveJSProperty('open', false);
  await expect(side.getByRole('link', { name: '웹 글 <1>' })).toBeHidden(); // collapsed, and the title is text
  await side.locator('summary', { hasText: '웹' }).click();
  await expect(side.getByRole('link', { name: '웹 글 <1>' })).toBeVisible();
  await expect(page.locator('.article')).toBeVisible(); // toggling does not navigate
  // sections collapse/expand too
  await top.nth(1).locator('> summary').click();
  await expect(side.getByRole('link', { name: '동향 글 1' })).toBeVisible();
  await top.nth(0).locator('> summary').click();
  await expect(top.nth(0)).toHaveJSProperty('open', false);
  await expect(side.locator('a[aria-current="page"]')).toBeHidden();
  // no "전체 보기" rows: only folders and posts
  await expect(side.getByText('전체 보기')).toHaveCount(0);
  await expect(side.locator('a:not(.sidenav__post)')).toHaveCount(0);
  await expect(side.locator('summary', { hasText: '보안' }).first().locator('.sidenav__count')).toHaveText(/^\d+$/);
});

test('sidebar on a trends post opens trends; on an essay opens essays and sits in the same left column', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const trend = clone(tech, { slug: 'trends/t1', title: '동향 글 1', categoryPath: 'trends' });
  await mockPost(page, [tech, trend, essay]);
  await page.goto(href('trends/t1'));
  const top = page.locator('.post-sidenav .sidenav__sections > li > details');
  await expect(top).toHaveCount(3);
  await expect(top.nth(0)).toHaveJSProperty('open', false);
  await expect(top.nth(1)).toHaveJSProperty('open', true);
  await expect(page.locator('.post-sidenav a[aria-current="page"]')).toHaveText('동향 글 1');
  const techArt = await page.locator('.article').evaluate((el) => el.getBoundingClientRect().left);
  await page.goto(href(essay.post.slug));
  await expect(page.locator('.article.essay')).toBeVisible();
  await expect(top).toHaveCount(3);
  await expect(top.nth(2)).toHaveJSProperty('open', true);
  await expect(top.nth(0)).toHaveJSProperty('open', false);
  await expect(page.locator('.post-sidenav a[aria-current="page"]')).toHaveText(essay.post.title);
  const g = await page.evaluate(() => ({ side: document.querySelector('.post-sidenav').getBoundingClientRect(), art: document.querySelector('.article').getBoundingClientRect() }));
  expect(g.side.right).toBeLessThanOrEqual(g.art.left);
  expect(g.art.left).toBe(techArt); // same body x on tech and essay pages
  await expect(page.locator('.post-sidenav .sidenav a[href^="/posts/essays"]').first()).toBeAttached();
});

test('sidebar: the article column keeps its x position whether or not the sidebar / TOC has loaded (no layout shift)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockPost(page, [tech]);
  let release;
  const gate = new Promise((r) => (release = r));
  await page.route('**/api/nav', async (route) => { await gate; await route.fallback(); });
  await page.goto(href(tech.post.slug));
  const left = () => page.locator('.article').evaluate((el) => el.getBoundingClientRect().left);
  const before = await left();
  expect(await page.locator('.post-sidenav .sidenav').count()).toBe(0);
  release();
  await expect(page.locator('.post-sidenav .sidenav')).toBeVisible();
  expect(await left()).toBe(before);
});

test('sidebar: below 1280px it is a collapsed <details> above the body; API failure leaves the page working', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 900 });
  await mockPost(page, [tech]);
  await page.goto(href(tech.post.slug));
  const d = page.locator('details.post-sidenav-mobile');
  await expect(d).toBeVisible();
  await expect(d.locator('.sidenav')).toBeHidden();
  await d.locator('summary').first().click();
  await expect(d.locator('a[aria-current="page"]')).toBeVisible();
  await expect(page.locator('.post-sidenav')).toBeHidden();
  // failure: article still renders, nothing broken
  await page.route('**/api/nav', (r) => r.fulfill({ status: 500, contentType: 'application/json', body: '{"error":{"code":"internal","message":"x"}}' }));
  await page.goto(href(tech.post.slug));
  await expect(page.locator('.article')).toBeVisible();
  await expect(page.locator('details.post-sidenav-mobile')).toHaveCount(0);
});

test('TOC (1200-1279px, no sidebar): the sticky column starts on the title row at the right of the body', async ({ page }) => {
  await page.setViewportSize({ width: 1240, height: 900 });
  await mockPost(page, [tech]);
  await page.goto(href(tech.post.slug));
  await expect(page.locator('.post-toc nav')).toBeVisible();
  await expect(page.locator('.post-sidenav')).toBeHidden();
  const g = await page.evaluate(() => ({ head: document.querySelector('.post-head').getBoundingClientRect(), art: document.querySelector('.article').getBoundingClientRect(), toc: document.querySelector('.post-toc').getBoundingClientRect() }));
  expect(Math.abs(g.toc.top - g.head.top)).toBeLessThanOrEqual(1);
  expect(g.toc.left).toBeGreaterThanOrEqual(g.art.right);
});

test('sidebar: the guide line under an open folder sits exactly under the tip of its pointing-down triangle', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockPost(page, [tech]);
  await page.goto(href(tech.post.slug));
  const side = page.locator('.post-sidenav .sidenav');
  await expect(side).toBeVisible();
  const open = side.locator('details[open]');
  expect(await open.count()).toBeGreaterThanOrEqual(2); // section + nested folder
  for (let i = 0; i < await open.count(); i++) {
    const m = await open.nth(i).evaluate((d) => {
      const sum = d.querySelector(':scope > summary');
      const ul = d.querySelector(':scope > ul');
      const w = parseFloat(getComputedStyle(sum, '::before').width);
      const bw = parseFloat(getComputedStyle(ul).borderLeftWidth);
      const tip = sum.getBoundingClientRect().left + w / 2; // the rotated triangle's tip is at the centre of its box
      const line = ul.getBoundingClientRect().left + bw / 2;
      return { tip, line, rot: getComputedStyle(sum, '::before').transform };
    });
    expect(m.rot).not.toBe('none'); // rotated = pointing down
    expect(Math.abs(m.tip - m.line)).toBeLessThanOrEqual(0.5);
  }
});
