import { mkdirSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { fixture, mockPosts, mockPost } from './mock-api.js';

const normal = fixture('posts-normal');
const xss = fixture('posts-xss');
const NF = '페이지를 찾을 수 없습니다';
const SITE = 'TheMan의 Patch Notes';

test('/about renders the markdown inside .article with title About', async ({ page }) => {
  let dialog = false;
  page.on('dialog', (d) => { dialog = true; d.dismiss(); });
  await page.goto('/about');
  await expect(page.locator('#main .article h1')).toHaveCount(1);
  await expect(page.locator('#main .article h2')).toHaveCount(3);
  await expect(page.locator('#main .article h2').nth(1)).toHaveText('이렇게 읽어 주세요');
  expect(await page.title()).toBe(`About - ${SITE}`);
  const rss = page.locator('#main .article a[href="/rss.xml"]');
  await expect(rss).toBeVisible();
  await expect(rss).not.toHaveAttribute('data-link', /.*/);
  await expect(page.locator('#main .article')).toContainText('연락처는 곧 추가됩니다.');
  await expect(page.locator('#main .article')).not.toContainText('TODO');
  expect(dialog).toBe(false);
});

test('/about/x is not the About page', async ({ page }) => {
  await mockPosts(page, []);
  await page.goto('/about/x');
  await expect(page.locator('h1')).toHaveText(NF);
});

test('unknown path -> not-found page with title, sentence, home link, 3 recent posts', async ({ page }) => {
  const calls = await mockPosts(page, normal);
  await page.goto('/nope/deeper');
  await expect(page.locator('#main h1')).toHaveText(NF);
  expect(await page.title()).toBe(`${NF} - ${SITE}`);
  await expect(page.locator('#main')).toContainText('주소가 바뀌었거나 삭제된 글일 수 있습니다.');
  await expect(page.locator('#main .nf-recent .post-row')).toHaveCount(3);
  await expect(page.locator('#main .nf-recent h2')).toHaveText('최근 글');
  expect(calls).toEqual([{ limit: '3' }]);
  // home link navigates via pushState (no reload)
  await page.evaluate(() => { window.__marker = 1; });
  await page.locator('#main a[data-link][href="/"]').click();
  await expect(page).toHaveURL('/');
  expect(await page.evaluate(() => window.__marker)).toBe(1);
});

test('failing /api/posts: still renders, no recent list', async ({ page }) => {
  await mockPosts(page, normal, { fail: ['all'] });
  await page.goto('/nope');
  await expect(page.locator('#main h1')).toHaveText(NF);
  await expect(page.locator('#main a[data-link][href="/"]')).toBeVisible();
  await page.waitForTimeout(300);
  await expect(page.locator('.nf-recent')).toHaveCount(0);
  await expect(page.locator('[role="alert"]')).toHaveCount(0);
});

test('XSS: recent post titles are escaped', async ({ page }) => {
  let dialog = false;
  page.on('dialog', (d) => { dialog = true; d.dismiss(); });
  await mockPosts(page, xss);
  await page.goto('/nope');
  await expect(page.locator('.nf-recent .post-row')).not.toHaveCount(0);
  await expect(page.locator('.nf-recent')).toContainText('<script>alert(1)</script>');
  expect(await page.locator('.nf-recent script').count()).toBe(0);
  expect(dialog).toBe(false);
});

test('stale mount: leaving before the request resolves adds nothing', async ({ page }) => {
  let release;
  const gate = new Promise((r) => { release = r; });
  await page.route('**/api/posts?*', async (route) => {
    await gate;
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: normal.slice(0, 3), nextCursor: null }) });
  });
  await page.goto('/nope');
  await page.evaluate(() => { history.pushState(null, '', '/about'); dispatchEvent(new PopStateEvent('popstate')); });
  await expect(page.locator('#main .article h1')).toBeVisible();
  release();
  await page.waitForTimeout(300);
  await expect(page.locator('.nf-recent')).toHaveCount(0);
});

test('post 404 and section-not-found use the shared view', async ({ page }) => {
  await mockPosts(page, normal);
  await mockPost(page, []);
  await page.goto('/posts/tech/none');
  await expect(page.locator('#main h1')).toHaveText(NF);
  await expect(page.locator('#main a[data-link][href="/"]')).toBeVisible();
  await expect(page.locator('.nf-recent .post-row')).toHaveCount(3);
  await page.route('**/api/categories', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: [] }) }));
  await page.goto('/categories/other/x');
  await expect(page.locator('#main h1')).toHaveText(NF);
  await expect(page.locator('#main a[data-link][href="/"]')).toBeVisible();
  expect(await page.title()).toBe(`${NF} - ${SITE}`);
  await expect(page.locator('.nf-recent .post-row')).toHaveCount(3);
});

test('route order: other routes still win over the wildcard', async ({ page }) => {
  await mockPosts(page, normal);
  await mockPost(page, []);
  await page.route('**/api/categories', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: [] }) }));
  for (const [url, h1] of [['/about', 'About'], ['/tech', '기술'], ['/trends', '동향'], ['/essays', '사유']]) {
    await page.goto(url);
    await expect(page.locator('#main h1')).toHaveText(h1);
  }
  await page.goto('/');
  await expect(page.locator('.home-lead, [data-section="tech"]').first()).toBeVisible();
  await expect(page.locator('#main h1')).not.toHaveText(NF);
  await page.goto('/posts/tech/none');
  await expect(page.locator('#main h1')).toHaveText(NF); // post's own 404, not a route miss
  await page.goto('/categories/tech');
  await expect(page.locator('#main h1')).toHaveText('기술');
});

test('screenshots for review', async ({ page }) => {
  test.skip(!process.env.SCREENSHOTS, 'set SCREENSHOTS=1 to write .superpowers/screens/*.png');
  mkdirSync('.superpowers/screens', { recursive: true });
  await mockPosts(page, normal);
  for (const [name, path, sel] of [['about', '/about', '.article h1'], ['not-found', '/nope', '.nf-recent .post-row']]) {
    for (const [w, h] of [[1440, 1000], [390, 900]]) {
      await page.setViewportSize({ width: w, height: h });
      await page.goto(path);
      await expect(page.locator(sel).first()).toBeVisible();
      await page.screenshot({ path: `.superpowers/screens/${name}-${w}.png`, fullPage: true });
    }
  }
});

test('/privacy renders the policy inside .article with title 개인정보처리방침', async ({ page }) => {
  await page.goto('/privacy');
  await expect(page.locator('#main .article h1')).toHaveText('개인정보처리방침');
  await expect(page.locator('#main .article h2').first()).toBeVisible();
  expect(await page.title()).toBe(`개인정보처리방침 - ${SITE}`);
});

test('footer: About | 문의하기 | 개인정보처리방침 (small) over a bold larger ⓒtheman; no RSS link', async ({ page }) => {
  await mockPosts(page, normal);
  await page.goto('/about');
  const links = page.locator('footer .site-footer__links a');
  await expect(links).toHaveText(['About', '문의하기', '개인정보처리방침']);
  await expect(links).toHaveCount(3);
  await expect(page.locator('footer a[href="/rss.xml"]')).toHaveCount(0);
  for (const a of await links.all()) await expect(a).toHaveCSS('text-decoration-line', 'none'); // not link-styled
  const copy = page.locator('footer .site-footer__copy');
  await expect(copy).toHaveText('ⓒtheman');
  const sz = (l) => l.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(await sz(copy)).toBeGreaterThan(await sz(links.first()));
  await expect(copy).toHaveCSS('font-weight', '700');
  // two centered rows: links above the copyright line
  const [fb, nb, cb] = await Promise.all([page.locator('footer .site-footer__inner').boundingBox(), page.locator('footer .site-footer__links').boundingBox(), copy.boundingBox()]);
  expect(cb.y).toBeGreaterThan(nb.y + nb.height - 1);
  for (const b of [nb, cb]) expect(Math.abs(fb.x + fb.width / 2 - (b.x + b.width / 2))).toBeLessThan(4);
  // "|" separators between the links (CSS pseudo-elements), none before the first
  const seps = await links.evaluateAll((els) => els.map((el) => getComputedStyle(el, '::before').content));
  expect(seps).toEqual(['none', '""', '""']);
  await links.nth(2).click();
  await expect(page).toHaveURL('/privacy');
  await expect(page.locator('#main .article h1')).toHaveText('개인정보처리방침');
  await page.locator('footer a[href="/contact"]').click();
  await expect(page).toHaveURL('/contact');
  await expect(page.locator('#main .article h1')).toHaveText('문의하기');
  expect(await page.title()).toBe(`문의하기 - ${SITE}`);
  await page.locator('footer a[href="/about"]').click();
  await expect(page).toHaveURL('/about');
});

test('header: Home link is first, left of Tech, and current on the home page only', async ({ page }) => {
  await mockPosts(page, normal);
  await page.goto('/');
  const links = page.locator('.site-header__nav a');
  await expect(links).toHaveText(['Home', 'Tech', 'Trends', 'Essays', 'About']);
  await expect(links.first()).toHaveAttribute('href', '/');
  await expect(links.first()).toHaveAttribute('aria-current', 'page');
  await page.goto('/about');
  await expect(links.first()).not.toHaveAttribute('aria-current', 'page');
  await expect(page.locator('.site-header__nav a[href="/about"]')).toHaveAttribute('aria-current', 'page');
});

test('theme toggle: icon (not text), follows the theme colors, swaps moon/sun', async ({ page }) => {
  await mockPosts(page, normal);
  await page.goto('/about');
  const btn = page.getByRole('button', { name: '다크 모드' });
  await expect(btn).toHaveText('');
  const look = () => btn.evaluate((el) => {
    const cs = getComputedStyle(el);
    const vis = (sel) => getComputedStyle(el.querySelector(sel)).display !== 'none';
    return { color: cs.color, bg: cs.backgroundColor, border: cs.borderTopColor, moon: vis('.theme-toggle__moon'), sun: vis('.theme-toggle__sun'), icon: getComputedStyle(el.querySelector('svg:not([style*="none"])')).stroke };
  });
  await page.evaluate(() => { document.documentElement.dataset.theme = 'light'; });
  const light = await look();
  await btn.click(); // -> dark
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.mouse.move(0, 0); // un-hover so the resting (transparent) background is measured
  await expect.poll(async () => (await look()).bg).toMatch(/\/ 0\)$|rgba\(0, 0, 0, 0\)/);
  const dark = await look();
  expect(light).toMatchObject({ moon: true, sun: false });
  expect(light.bg).toMatch(/\/ 0\)$|rgba\(0, 0, 0, 0\)/);
  expect(dark).toMatchObject({ moon: false, sun: true });
  // the button recolors with the theme: text/icon/border differ between light and dark
  expect(dark.color).not.toBe(light.color);
  expect(dark.border).not.toBe(light.border);
  expect(dark.icon).toBe(dark.color);
  expect(light.icon).toBe(light.color);
});

test('support widget: right of the site name, external link opening a new tab, themed, label only on wide screens', async ({ page, context }) => {
  await mockPosts(page, normal);
  await page.goto('/about');
  const w = page.locator('header a.support-widget');
  await expect(w).toHaveAttribute('href', 'https://litt.ly/theman');
  await expect(w).toHaveAttribute('target', '_blank');
  await expect(w).toHaveAttribute('rel', /noopener/);
  await expect(w).toHaveAttribute('rel', /noreferrer/);
  await expect(w).not.toHaveAttribute('data-link', /.*/); // external: never routed by the SPA
  await expect(w).toHaveAttribute('aria-label', /커피 한 잔 후원하기/);
  // right of the brand name, before the nav
  await page.setViewportSize({ width: 1440, height: 900 });
  const [wb, nb, nav] = await Promise.all([w.boundingBox(), page.locator('.site-header__name').boundingBox(), page.locator('.site-header__nav').boundingBox()]);
  expect(nb.x + nb.width).toBeLessThanOrEqual(wb.x);
  expect(wb.x + wb.width).toBeLessThanOrEqual(nav.x + 1);
  // wide: bigger bold icon + two-line label in Cafe24 Syongsyong
  const label = w.locator('.support-widget__label');
  await expect(label).toBeVisible();
  await expect(label.locator('span')).toHaveText(['커피 한 잔', '후원하기']); // explicit line break
  const [l1, l2] = await Promise.all([label.locator('span').nth(0).boundingBox(), label.locator('span').nth(1).boundingBox()]);
  expect(l2.y).toBeGreaterThanOrEqual(l1.y + l1.height - 0.5); // second line sits below the first, no overlap
  const fs = await label.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(Math.abs(l2.y - l1.y - fs * 1.125)).toBeLessThan(0.75); // line pitch = 1.125em (2px tighter than the 1.25 it was at 16px)
  await expect(label).toHaveCSS('font-family', /^"Cafe24 Syongsyong"/);
  await page.evaluate(() => document.fonts.load('14px "Cafe24 Syongsyong"', '커피 한 잔 후원하기'));
  expect(await page.evaluate(() => document.fonts.check('14px "Cafe24 Syongsyong"', '커피 한 잔 후원하기'))).toBe(true);
  const icon = w.locator('svg');
  const ib = await icon.boundingBox();
  expect(ib.width).toBeGreaterThanOrEqual(30); // enlarged to match the two text lines
  expect(parseFloat(await icon.evaluate((el) => getComputedStyle(el).strokeWidth))).toBeGreaterThanOrEqual(2); // bold stroke
  expect(ib.height).toBeLessThanOrEqual(wb.height);
  // narrow: icon only (label hidden, accessible name stays), still inside the viewport
  await page.setViewportSize({ width: 390, height: 800 });
  await expect(w.locator('.support-widget__label')).toBeHidden();
  const nb2 = await w.boundingBox();
  expect(nb2.x).toBeGreaterThanOrEqual(0);
  expect(nb2.width).toBeGreaterThanOrEqual(44);
  // theme: border/text/icon colors come from the theme tokens (differ light vs dark)
  const look = () => w.evaluate((el) => { const cs = getComputedStyle(el); return { color: cs.color, border: cs.borderTopColor, icon: getComputedStyle(el.querySelector('svg')).stroke }; });
  await page.evaluate(() => { document.documentElement.dataset.theme = 'light'; });
  const light = await look();
  await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
  const dark = await look();
  expect(dark.color).not.toBe(light.color);
  expect(dark.border).not.toBe(light.border);
  expect(dark.icon).not.toBe(light.icon);
  // click opens a new tab (the external request is stubbed)
  await context.route('https://litt.ly/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>리틀리</title>' }));
  const [popup] = await Promise.all([context.waitForEvent('page'), w.click()]);
  await popup.waitForLoadState();
  expect(popup.url()).toBe('https://litt.ly/theman');
  expect(page.url()).toContain('/about'); // this tab stays on the blog
});

test('privacy policy mentions the external support link (litt.ly)', async ({ page }) => {
  await page.goto('/privacy');
  await expect(page.locator('#main .article')).toContainText('리틀리(litt.ly)');
  await expect(page.locator('#main .article h2').filter({ hasText: '외부 링크(후원)' })).toHaveCount(1);
});

test('header controls stay inside the viewport at in-between widths (widget + name + nav + toggle)', async ({ page }) => {
  await mockPosts(page, normal);
  await page.goto('/about');
  for (const width of [360, 390, 640, 700, 859, 860, 1000, 1099, 1100, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    const boxes = await page.locator('.support-widget, .site-header__name, .site-header__nav a, .theme-toggle').evaluateAll((els) =>
      els.map((el) => { const r = el.getBoundingClientRect(); return { l: Math.round(r.left), r: Math.round(r.right) }; }));
    for (const b of boxes) {
      expect(b.l, `left @${width}`).toBeGreaterThanOrEqual(0);
      expect(b.r, `right @${width}`).toBeLessThanOrEqual(width);
    }
    // the nav itself must not be horizontally clipped
    const clipped = await page.locator('.site-header__nav').evaluate((el) => el.scrollWidth > el.clientWidth + 1);
    expect(clipped, `nav clipped @${width}`).toBe(false);
  }
});

test('brand: header shows "TheMan의 Patch Notes" with "IT Security Blog" as the sub-line; home h1 carries name + tagline', async ({ page }) => {
  await mockPosts(page, normal);
  await page.goto('/about');
  const brand = page.locator('.site-header__name');
  await expect(brand).toHaveAttribute('href', '/');
  await expect(brand.locator('.site-header__title')).toHaveText('TheMan의 Patch Notes');
  await expect(brand.locator('.site-header__sub')).toHaveText('IT Security Blog');
  const g = await brand.evaluate((el) => {
    const t = el.querySelector('.site-header__title').getBoundingClientRect();
    const s = el.querySelector('.site-header__sub').getBoundingClientRect();
    return { titleSize: parseFloat(getComputedStyle(el.querySelector('.site-header__title')).fontSize), subSize: parseFloat(getComputedStyle(el.querySelector('.site-header__sub')).fontSize), titleBottom: t.bottom, subTop: s.top };
  });
  expect(g.subSize).toBeLessThan(g.titleSize);
  expect(g.subTop).toBeGreaterThanOrEqual(g.titleBottom - 1); // a second line under the name
  await page.setViewportSize({ width: 360, height: 800 });
  const small = await brand.locator('.site-header__title').evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(small).toBeLessThan(g.titleSize); // smaller name on narrow screens
  // 360px: name, widget and theme toggle share the first header row (the toggle must not wrap under the name)
  const row = await page.evaluate(() => {
    const r = (s) => document.querySelector(s).getBoundingClientRect();
    return { name: r('.site-header__name'), widget: r('.support-widget'), toggle: r('.theme-toggle'), nav: r('.site-header__nav') };
  });
  expect(row.toggle.top).toBeLessThan(row.name.bottom);
  expect(row.widget.top).toBeLessThan(row.name.bottom);
  expect(row.nav.top).toBeGreaterThanOrEqual(row.name.bottom - 1); // the menu is the second row
  await expect(page.locator('#main .article')).toContainText('기술을 읽고, 생각을 적는다');
  await page.goto('/');
  await expect(page.locator('h1.home-sr')).toHaveText('TheMan의 Patch Notes: 기술을 읽고, 생각을 적는다');
});
