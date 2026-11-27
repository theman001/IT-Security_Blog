import { mkdirSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { fixture } from './mock-api.js';

const deep = fixture('categories-deep');
const shallow = fixture('categories-shallow');
const xssCats = fixture('categories-xss');

const post = (i, categoryPath, over = {}) => ({
  id: i,
  title: `글 ${i}`,
  slug: `${categoryPath}/p${i}`,
  date: '2026-11-20',
  section: categoryPath.split('/')[0],
  readingMinutes: 3,
  excerpt: `요약 ${i}`,
  categoryId: 1,
  categoryName: categoryPath.split('/').pop(),
  categoryPath,
  tags: ['태그'],
  authorType: 'admin',
  ...over,
});
const many = (n, path, start = 1) => Array.from({ length: n }, (_, i) => post(start + i, path));
const deepPosts = [...many(25, 'tech/security/reversing'), ...many(1, 'tech/security/web', 100), ...many(1, 'tech/security', 200), ...many(2, 'trends', 300)];

/** Mock /api/categories and /api/posts (category filter incl. descendants, cursor = offset). */
async function mockList(page, cats, posts, { failMoreOnce = false } = {}) {
  const calls = [];
  let failed = false;
  await page.route('**/api/categories', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: cats }) }));
  await page.route('**/api/posts?*', (r) => {
    const q = new URL(r.request().url()).searchParams;
    calls.push(Object.fromEntries(q));
    if (failMoreOnce && q.get('cursor') && !failed) {
      failed = true;
      return r.fulfill({ status: 500, contentType: 'application/json', body: '{"error":{"code":"internal","message":"x"}}' });
    }
    const c = q.get('category');
    const all = posts.filter((p) => !c || p.categoryPath === c || p.categoryPath.startsWith(`${c}/`));
    const at = Number(q.get('cursor') ?? 0);
    const limit = Number(q.get('limit') ?? 20);
    const items = all.slice(at, at + limit);
    return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ items, nextCursor: at + limit < all.length ? String(at + limit) : null }) });
  });
  return calls;
}

test('section page: header, description, count, rows', async ({ page }) => {
  const calls = await mockList(page, deep, deepPosts);
  await page.goto('/tech');
  await expect(page.locator('h1')).toHaveText('기술');
  await expect(page.locator('.list-desc')).not.toBeEmpty();
  await expect(page.locator('.list-count')).toHaveText('27개의 글');
  await expect(page.locator('.post-row')).toHaveCount(20);
  expect(await page.title()).toBe('기술 - IT Security Blog');
  expect(calls[0]).toEqual({ category: 'tech', limit: '20' });
  await page.goto('/trends');
  await expect(page.locator('h1')).toHaveText('동향·사건사고');
  await expect(page.locator('.post-row')).toHaveCount(2);
  await page.goto('/essays');
  await expect(page.locator('h1')).toHaveText('사유');
  await expect(page.locator('.list-empty')).toHaveText('아직 글이 없습니다. 홈으로');
  await expect(page.locator('.list-empty a')).toHaveAttribute('href', '/');
  await expect(page.locator('.list-more__btn')).toHaveCount(0);
});

test('chips: direct children with counts, 전체 active; click navigates and loads that category', async ({ page }) => {
  const calls = await mockList(page, deep, deepPosts);
  await page.goto('/tech');
  const chips = page.locator('.chips .chip');
  await expect(chips).toHaveText(['전체', '보안(27)', '인프라(0)']);
  await expect(chips.first()).toHaveAttribute('aria-current', 'page');
  await expect(chips.nth(1)).not.toHaveAttribute('aria-current', 'page');
  await expect(chips.nth(1)).toHaveAttribute('href', '/categories/tech/security');
  await chips.nth(1).click();
  await expect(page).toHaveURL(/\/categories\/tech\/security$/);
  await expect(page.locator('h1')).toHaveText('보안');
  await expect(page.locator('.list-count')).toHaveText('27개의 글');
  expect(calls.at(-1)).toEqual({ category: 'tech/security', limit: '20' });
  await expect(page.locator('.crumbs a')).toHaveText(['Tech']);
  await expect(page.locator('.crumbs [aria-current="page"]')).toHaveText('보안');
  await expect(page.locator('.chips .chip')).toHaveText(['전체', '리버싱(25)', '웹(1)']);
  // leaf category: no chips
  await page.locator('.chips .chip').nth(1).click();
  await expect(page.locator('h1')).toHaveText('리버싱');
  await expect(page.locator('.crumbs li')).toHaveText(['Tech', '보안', '리버싱']);
  await expect(page.locator('.crumbs a').nth(1)).toHaveAttribute('href', '/categories/tech/security');
  await expect(page.locator('.chips')).toHaveCount(0);
});

test('tree: shown for a 3-level section with ancestors open and current marked; not for 2 levels', async ({ page }) => {
  await mockList(page, deep, deepPosts);
  await page.goto('/categories/tech/security/reversing');
  const tree = page.locator('.cat-tree');
  await expect(tree).toBeVisible();
  await expect(tree.locator('a[aria-current="page"]')).toHaveText(/리버싱/);
  await expect(tree.locator('a[aria-current="page"]')).toBeVisible();
  await expect(tree.locator('details[open]')).toHaveCount(2); // tech, tech/security
  await expect(tree.getByRole('link', { name: /^웹/ })).toBeVisible(); // sibling shown inside open ancestor
  await page.goto('/trends');
  await expect(page.locator('.cat-tree')).toHaveCount(0); // trends only 1 level
  // navigate via tree
  await page.goto('/tech');
  await page.locator('.cat-tree summary a', { hasText: '보안' }).click();
  await expect(page.locator('h1')).toHaveText('보안');
});

test('tree is absent when the section is only 2 levels deep', async ({ page }) => {
  await mockList(page, shallow, many(3, 'tech/security'));
  await page.goto('/tech');
  await expect(page.locator('.chips .chip')).toHaveCount(2);
  await expect(page.locator('.cat-tree')).toHaveCount(0);
  await page.goto('/categories/tech/security');
  await expect(page.locator('.post-row')).toHaveCount(3);
  await expect(page.locator('.cat-tree')).toHaveCount(0);
});

test('tree is a collapsed "카테고리" disclosure below 1024px and a sidebar above', async ({ page }) => {
  await mockList(page, deep, deepPosts);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/tech');
  await expect(page.locator('.cat-nav > summary')).toHaveText('카테고리');
  await expect(page.locator('.cat-tree')).toBeHidden();
  await page.locator('.cat-nav > summary').click();
  await expect(page.locator('.cat-tree')).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.locator('.cat-nav > summary')).toBeHidden();
  await expect(page.locator('.cat-tree')).toBeVisible();
  const [side, main] = await Promise.all([page.locator('.list-side').boundingBox(), page.locator('.list-main').boundingBox()]);
  expect(side.x + side.width).toBeLessThanOrEqual(main.x);
});

test('JS breakpoint and CSS breakpoint agree (tree open + sidebar at 1100px; em-based media query)', async ({ page }) => {
  await mockList(page, deep, deepPosts);
  await page.setViewportSize({ width: 1100, height: 800 });
  await page.goto('/tech');
  const state = () =>
    page.evaluate(() => ({
      open: document.querySelector('.cat-nav').open,
      sidebar: getComputedStyle(document.querySelector('.list-page--tree')).gridTemplateColumns.split(' ').length === 2,
    }));
  await expect.poll(state).toEqual({ open: true, sidebar: true });
  // JS uses (min-width: 64em); a px breakpoint in CSS would drift from it when the browser default font size is not 16px
  const css = await page.evaluate(() => [...document.styleSheets].flatMap((s) => { try { return [...s.cssRules]; } catch { return []; } }).filter((r) => r.media && r.cssText.includes('.list-page--tree')).map((r) => r.conditionText));
  expect(css.length).toBeGreaterThan(0);
  expect(css.some((c) => c.includes('1024px'))).toBe(false);
  expect(css.some((c) => c.includes('64em'))).toBe(true);
});

test('더 보기 loads the next page with nextCursor, then disappears; focus moves to first new row', async ({ page }) => {
  const calls = await mockList(page, deep, deepPosts);
  await page.goto('/categories/tech/security/reversing');
  await expect(page.locator('.post-row')).toHaveCount(20);
  const more = page.getByRole('button', { name: '더 보기' });
  await more.click();
  await expect(page.locator('.post-row')).toHaveCount(25);
  expect(calls.at(-1)).toEqual({ category: 'tech/security/reversing', limit: '20', cursor: '20' });
  await expect(page.locator('.list-more__btn')).toHaveCount(0);
  await expect(page.locator('.post-row').nth(20).locator('a')).toBeFocused();
});

test('더 보기 failure shows an inline error and retries', async ({ page }) => {
  await mockList(page, deep, deepPosts, { failMoreOnce: true });
  await page.goto('/categories/tech/security/reversing');
  await page.getByRole('button', { name: '더 보기' }).click();
  await expect(page.locator('.list-error')).toBeVisible();
  await expect(page.locator('.post-row')).toHaveCount(20);
  const retry = page.getByRole('button', { name: '다시 시도' });
  await expect(retry).toBeEnabled();
  await expect(retry).not.toHaveAttribute('aria-busy', 'true');
  await retry.click();
  await expect(page.locator('.post-row')).toHaveCount(25);
  await expect(page.locator('.list-error')).toHaveCount(0);
});

test('더 보기 retry that succeeds with more pages left restores the "더 보기" label', async ({ page }) => {
  const more = many(45, 'tech/security/reversing');
  await mockList(page, deep, more, { failMoreOnce: true });
  await page.goto('/categories/tech/security/reversing');
  await page.getByRole('button', { name: '더 보기' }).click();
  await expect(page.getByRole('button', { name: '다시 시도' })).toBeVisible();
  await page.getByRole('button', { name: '다시 시도' }).click();
  await expect(page.locator('.post-row')).toHaveCount(40);
  await expect(page.getByRole('button', { name: '더 보기' })).toBeVisible();
  await expect(page.getByRole('button', { name: '다시 시도' })).toHaveCount(0);
});

test('empty category: one sentence with a home link', async ({ page }) => {
  await mockList(page, deep, deepPosts);
  await page.goto('/categories/tech/infra');
  await expect(page.locator('.post-row')).toHaveCount(0);
  await expect(page.locator('.list-empty')).toHaveText('아직 글이 없습니다. 홈으로');
});

test('section without a DB row still renders its static header and empty state', async ({ page }) => {
  await mockList(page, deep.filter((c) => c.path !== 'essays'), deepPosts);
  await page.goto('/essays');
  await expect(page.locator('h1')).toHaveText('사유');
  await expect(page.locator('.list-desc')).not.toBeEmpty();
  await expect(page.locator('.list-count')).toHaveText('0개의 글');
  await expect(page.locator('.list-empty')).toHaveText('아직 글이 없습니다. 홈으로');
  expect(await page.title()).toBe('사유 - IT Security Blog');
});

test('section root row missing but deeper categories exist: header, crumb, chips and tree survive', async ({ page }) => {
  await mockList(page, deep.filter((c) => c.path !== 'tech'), deepPosts);
  await page.goto('/tech');
  await expect(page.locator('h1')).toHaveText('기술');
  await expect(page.locator('.list-count')).toHaveText('27개의 글');
  await expect(page.locator('.chips .chip')).toHaveText(['전체', '보안(27)', '인프라(0)']);
  await expect(page.locator('.post-row')).toHaveCount(20);
  await page.goto('/categories/tech/security/reversing');
  await expect(page.locator('.crumbs li')).toHaveText(['Tech', '보안', '리버싱']);
  await expect(page.locator('.crumbs a').first()).toHaveAttribute('href', '/tech');
  await expect(page.locator('.cat-tree')).toBeVisible();
  await expect(page.locator('.cat-tree > li > details > summary a')).toContainText('Tech');
  await expect(page.locator('.cat-tree a[aria-current="page"]')).toHaveText(/리버싱/);
  await page.goto('/categories/tech/nope');
  await expect(page.locator('#main')).toContainText('페이지를 찾을 수 없습니다');
});

test('unknown category or section -> 페이지를 찾을 수 없습니다 with title', async ({ page }) => {
  await mockList(page, deep, deepPosts);
  for (const url of ['/categories/tech/nope', '/categories/other/x', '/categories/tech/security/reversing/deeper', '/categories/constructor/x', '/categories/__proto__/x', '/categories/toString']) {
    await page.goto(url);
    await expect(page.locator('#main')).toContainText('페이지를 찾을 수 없습니다');
    expect(await page.title()).toBe('페이지를 찾을 수 없습니다 - IT Security Blog');
    await expect(page.locator('.list-rows')).toHaveCount(0);
  }
});

test('XSS strings render as text only', async ({ page }) => {
  let dialogs = 0;
  page.on('dialog', (d) => (dialogs++, d.dismiss()));
  const bad = [
    post(1, 'tech/<img src=x onerror=alert(1)>', { title: '<script>alert(1)</script>', tags: ['"><svg onload=alert(1)>'], excerpt: '<b>x</b>', categoryName: '<i>c</i>' }),
  ];
  await mockList(page, xssCats, bad);
  await page.goto('/tech');
  await expect(page.locator('.chips .chip').nth(1)).toHaveText('<img src=x onerror=alert(1)>(1)');
  await page.locator('.chips .chip').nth(1).click();
  await expect(page.locator('h1')).toHaveText('<img src=x onerror=alert(1)>');
  await expect(page.locator('.post-row .post-link')).toHaveText('<script>alert(1)</script>');
  await expect(page.locator('.post-row__tag')).toHaveText('#"><svg onload=alert(1)>');
  await expect(page.locator('#main img, #main svg, #main b, #main script')).toHaveCount(0);
  await expect(page.locator('.crumbs li').last()).toHaveText('<img src=x onerror=alert(1)>');
  expect(dialogs).toBe(0);
});

test('a path with spaces, &, : and Korean round-trips href -> request', async ({ page }) => {
  const path = 'tech/인프라 & ops:aws';
  const calls = await mockList(page, xssCats, [post(1, path, { title: '클라우드 글' })]);
  await page.goto('/tech');
  const chip = page.locator('.chips .chip').nth(2);
  await expect(chip).toHaveAttribute('href', '/categories/tech/%EC%9D%B8%ED%94%84%EB%9D%BC%20%26%20ops%3Aaws');
  await chip.click();
  await expect(page.locator('h1')).toHaveText('인프라 & ops:aws');
  await expect(page.locator('.post-row')).toHaveCount(1);
  expect(calls.at(-1).category).toBe(path);
  await page.reload();
  await expect(page.locator('h1')).toHaveText('인프라 & ops:aws');
  expect(calls.at(-1).category).toBe(path);
});

test('screenshots for review', async ({ page }) => {
  test.skip(!process.env.SCREENSHOTS, 'set SCREENSHOTS=1 to write .superpowers/screens/*.png');
  mkdirSync('.superpowers/screens', { recursive: true });
  await mockList(page, deep, deepPosts);
  for (const [w, h] of [[1440, 900], [390, 844]]) {
    await page.setViewportSize({ width: w, height: h });
    for (const [name, url] of [['section', '/tech'], ['category-tree', '/categories/tech/security/reversing']]) {
      await page.goto(url);
      await expect(page.locator('h1')).toBeVisible();
      await page.screenshot({ path: `.superpowers/screens/list-${name}-${w}.png`, fullPage: true });
    }
  }
});
