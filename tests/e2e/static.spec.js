import { mkdirSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { fixture, mockPosts, mockPost } from './mock-api.js';

const normal = fixture('posts-normal');
const xss = fixture('posts-xss');
const NF = '페이지를 찾을 수 없습니다';
const SITE = 'IT Security Blog';

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
  for (const [url, h1] of [['/about', 'About'], ['/tech', '기술'], ['/trends', '동향·사건사고'], ['/essays', '사유']]) {
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
