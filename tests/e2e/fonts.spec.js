import { test, expect } from '@playwright/test';
import { mockPost, postFixture } from './mock-api.js';

const tech = postFixture('post-tech');
const essay = postFixture('post-essay');
const href = (slug) => `/posts/${slug.split('/').map(encodeURIComponent).join('/')}`;
const ff = (loc) => loc.evaluate((el) => getComputedStyle(el).fontFamily);

// Font CDNs are never hit: stub them so the tests don't depend on the network.
test.beforeEach(async ({ page }) => {
  await page.route(/fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.jsdelivr\.net/, (r) => r.fulfill({ contentType: 'text/css', body: '' }));
});

test('head preconnects to the font CDNs and links the font stylesheets', async ({ page }) => {
  await mockPost(page, [tech]);
  await page.goto(href(tech.post.slug));
  const links = await page.evaluate(() => [...document.head.querySelectorAll('link')].map((l) => ({ rel: l.rel, href: l.getAttribute('href'), co: l.crossOrigin })));
  for (const [h, co] of [['https://fonts.googleapis.com', null], ['https://fonts.gstatic.com', 'anonymous'], ['https://cdn.jsdelivr.net', 'anonymous']]) {
    expect(links).toContainEqual({ rel: 'preconnect', href: h, co });
  }
  const sheets = links.filter((l) => l.rel === 'stylesheet').map((l) => l.href);
  expect(sheets).toContainEqual(expect.stringMatching(/^https:\/\/cdn\.jsdelivr\.net\/.*pretendardvariable-dynamic-subset\.min\.css$/));
  expect(sheets).toContainEqual(expect.stringMatching(/^https:\/\/fonts\.googleapis\.com\/css2\?.*Noto\+Serif\+KR.*JetBrains\+Mono.*display=swap/));
});

test('tech post: body Pretendard, headings serif, code mono, UI default Pretendard', async ({ page }) => {
  await mockPost(page, [tech]);
  await page.goto(href(tech.post.slug));
  await expect(page.locator('h1')).toHaveText(tech.post.title);
  expect(await ff(page.locator('.article'))).toMatch(/^"Pretendard Variable"/);
  expect(await ff(page.locator('h1'))).toMatch(/^"Noto Serif KR"/);
  expect(await ff(page.locator('pre code').first())).toMatch(/^"JetBrains Mono"/);
  expect(await ff(page.locator('body'))).toMatch(/^"Pretendard Variable"/);
});

test('essay post: body Noto Serif KR', async ({ page }) => {
  await mockPost(page, [essay]);
  await page.goto(href(essay.post.slug));
  await expect(page.locator('.article.essay')).toBeVisible();
  expect(await ff(page.locator('.article.essay'))).toMatch(/^"Noto Serif KR"/);
});
