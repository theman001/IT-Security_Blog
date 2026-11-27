import { test, expect } from '@playwright/test';
import { mockPost, postFixture } from './mock-api.js';

const tech = postFixture('post-tech');
const essay = postFixture('post-essay');
const href = (slug) => `/posts/${slug.split('/').map(encodeURIComponent).join('/')}`;
const ff = (loc) => loc.evaluate((el) => getComputedStyle(el).fontFamily);

test('fonts are same-origin: no external font hosts in the document or the requests', async ({ page }) => {
  const external = [];
  page.on('request', (r) => { if (!r.url().startsWith('http://localhost') && !r.url().startsWith('data:')) external.push(r.url()); });
  await mockPost(page, [tech]);
  await page.goto(href(tech.post.slug));
  await expect(page.locator('h1')).toHaveText(tech.post.title);
  const html = await page.evaluate(() => document.documentElement.outerHTML);
  expect(html).not.toMatch(/fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.jsdelivr\.net|rel="preconnect"/);
  const names = await page.evaluate(() => [...document.fonts].map((f) => f.family.replace(/["']/g, '')));
  for (const fam of ['Pretendard Variable', 'Noto Serif KR Variable', 'JetBrains Mono']) expect(names).toContain(fam);
  expect(external).toEqual([]);
});

test('tech post: body Pretendard, headings serif, code mono, UI default Pretendard', async ({ page }) => {
  await mockPost(page, [tech]);
  await page.goto(href(tech.post.slug));
  await expect(page.locator('h1')).toHaveText(tech.post.title);
  expect(await ff(page.locator('.article'))).toMatch(/^"Pretendard Variable"/);
  expect(await ff(page.locator('h1'))).toMatch(/^"Noto Serif KR Variable"/);
  expect(await ff(page.locator('pre code').first())).toMatch(/^"JetBrains Mono"/);
  expect(await ff(page.locator('body'))).toMatch(/^"Pretendard Variable"/);
});

test('essay post: body Noto Serif KR', async ({ page }) => {
  await mockPost(page, [essay]);
  await page.goto(href(essay.post.slug));
  await expect(page.locator('.article.essay')).toBeVisible();
  expect(await ff(page.locator('.article.essay'))).toMatch(/^"Noto Serif KR Variable"/);
});
