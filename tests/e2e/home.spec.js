import { test, expect } from '@playwright/test';
import { fixture, mockPosts } from './mock-api.js';

const normal = fixture('posts-normal');
const lead = normal.find((p) => p.section === 'essays'); // newest essay
const section = (page, name) => page.locator(`[data-section="${name}"]`);

test('title is exactly the site name', async ({ page }) => {
  await mockPosts(page, normal);
  await page.goto('/');
  await expect(page.locator('.home-lead')).toBeVisible();
  expect(await page.title()).toBe('IT Security Blog');
});

test('lead essay comes first, before the Tech section; recent column excludes it', async ({ page }) => {
  const calls = await mockPosts(page, normal);
  await page.goto('/');
  const leadBox = page.locator('.home-lead');
  await expect(leadBox.getByRole('link', { name: lead.title })).toBeVisible();
  await expect(leadBox).toContainText(lead.excerpt);
  await expect(leadBox).toContainText('읽는 시간');
  // DOM order: lead precedes tech
  const order = await page.evaluate(() => {
    const l = document.querySelector('.home-lead');
    const t = document.querySelector('[data-section="tech"]');
    return l.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_FOLLOWING;
  });
  expect(order).toBeTruthy();
  const recent = page.locator('.home-recent');
  await expect(recent.locator('a')).toHaveCount(5);
  await expect(recent.getByRole('link', { name: lead.title })).toHaveCount(0);
  // requests: essays (lead + Essays section share it), recent, tech, trends
  expect(calls).toHaveLength(4);
  expect(calls).toEqual(
    expect.arrayContaining([
      { section: 'essays', limit: '4' },
      { limit: '8' },
      { section: 'tech', limit: '3' },
      { section: 'trends', limit: '3' },
    ]),
  );
});

test('sections: 3 cards each, "더 보기" links, essays as pull quotes', async ({ page }) => {
  await mockPosts(page, normal);
  await page.goto('/');
  await expect(section(page, 'tech').locator('article')).toHaveCount(3);
  await expect(section(page, 'trends').locator('article')).toHaveCount(3);
  await expect(section(page, 'tech').getByRole('link', { name: /더 보기/ })).toHaveAttribute('href', '/tech');
  await expect(section(page, 'trends').getByRole('link', { name: /더 보기/ })).toHaveAttribute('href', '/trends');
  await expect(section(page, 'essays').getByRole('link', { name: /더 보기/ })).toHaveAttribute('href', '/essays');
  const quotes = section(page, 'essays').locator('blockquote');
  await expect(quotes).toHaveCount(3);
  const others = normal.filter((p) => p.section === 'essays').slice(1, 4);
  await expect(quotes.first()).toContainText(others[0].excerpt);
});

test('Essays section does not repeat the lead essay', async ({ page }) => {
  await mockPosts(page, normal);
  await page.goto('/');
  await expect(section(page, 'essays').locator('blockquote')).toHaveCount(3);
  await expect(section(page, 'essays')).not.toContainText(lead.excerpt);
  await expect(section(page, 'essays').getByRole('link', { name: lead.title })).toHaveCount(0);
});

test('only one essay: Essays section says there are no other essays', async ({ page }) => {
  await mockPosts(page, normal.filter((p) => p.section !== 'essays' || p.slug === lead.slug));
  await page.goto('/');
  await expect(page.locator('.home-lead h2')).toContainText(lead.title);
  await expect(section(page, 'essays').locator('.home-notice')).toHaveText('아직 다른 사유 글이 없습니다.');
  await expect(section(page, 'essays').locator('blockquote')).toHaveCount(0);
});

test('failed lead request is distinct from "no essays"', async ({ page }) => {
  await mockPosts(page, normal, { fail: ['essays'] });
  await page.goto('/');
  await expect(page.locator('.home-lead .home-notice')).toHaveText('불러오지 못했습니다.');
  await expect(section(page, 'tech').locator('article')).toHaveCount(3);
});

test('"더 보기" links have distinct accessible names', async ({ page }) => {
  await mockPosts(page, normal);
  await page.goto('/');
  for (const [key, name] of [['tech', 'Tech'], ['trends', 'Trends'], ['essays', 'Essays']]) {
    const more = section(page, key).locator('.home-more');
    await expect(more).toHaveAttribute('aria-label', `${name} 더 보기`);
    await expect(more).toHaveText('더 보기 →');
  }
});

test('XSS strings render as text only', async ({ page }) => {
  let dialogs = 0;
  page.on('dialog', (d) => (dialogs++, d.dismiss()));
  await mockPosts(page, fixture('posts-xss'));
  await page.goto('/');
  await expect(page.locator('.home-lead')).toContainText('<script>alert(1)</script>');
  await expect(section(page, 'tech')).toContainText('<script>alert(1)</script>');
  await expect(section(page, 'tech')).toContainText('"><img src=x onerror=alert(1)>');
  expect(await page.locator('#main script, #main img, #main svg, #main b, #main i').count()).toBe(0);
  expect(dialogs).toBe(0);
  // the odd slug survives as an encoded, round-trippable href
  const href = await section(page, 'tech').locator('article a').first().getAttribute('href');
  expect(href.startsWith('/posts/tech/')).toBe(true);
  expect(href).not.toMatch(/["<> ]/);
});

test('postRowHtml escapes tags and handles empty tags', async ({ page }) => {
  await mockPosts(page, []);
  await page.goto('/');
  const r = await page.evaluate(async (post) => {
    const { postRowHtml } = await import('/src/components/post-card.js');
    const d = document.createElement('div');
    d.innerHTML = postRowHtml(post) + postRowHtml({ ...post, tags: [], categoryPath: null });
    return { img: d.querySelectorAll('img,svg,script').length, tags: [...d.querySelectorAll('.post-row__tag')].map((e) => e.textContent) };
  }, fixture('posts-xss')[0]);
  expect(r.img).toBe(0);
  expect(r.tags).toEqual(['#"><img src=x onerror=alert(1)>', '#<svg onload=alert(1)>']);
});

test('empty section shows a one-line notice, rest renders', async ({ page }) => {
  await mockPosts(page, normal.filter((p) => p.section !== 'trends'));
  await page.goto('/');
  await expect(section(page, 'trends').locator('.home-notice')).toHaveCount(1);
  await expect(section(page, 'trends').locator('article')).toHaveCount(0);
  await expect(section(page, 'tech').locator('article')).toHaveCount(3);
  await expect(page.locator('.home-lead')).toBeVisible();
});

test('a failing section request shows its notice, others still render', async ({ page }) => {
  await mockPosts(page, normal, { fail: ['tech'] });
  await page.goto('/');
  await expect(section(page, 'tech').locator('.home-notice')).toContainText('불러오지 못했습니다');
  await expect(section(page, 'trends').locator('article')).toHaveCount(3);
  await expect(section(page, 'essays').locator('blockquote')).toHaveCount(3);
  await expect(page.locator('.home-lead')).toBeVisible();
});

test('no essays at all: no lead, page still renders with a notice', async ({ page }) => {
  await mockPosts(page, normal.filter((p) => p.section !== 'essays'));
  await page.goto('/');
  await expect(page.locator('.home-lead')).toHaveCount(1); // region exists...
  await expect(page.locator('.home-lead .home-notice')).toHaveCount(1); // ...holding only a notice
  await expect(page.locator('.home-lead h2')).toHaveCount(0);
  await expect(section(page, 'tech').locator('article')).toHaveCount(3);
  await expect(section(page, 'essays').locator('.home-notice')).toHaveCount(1);
});

test('everything failing still renders the page shell', async ({ page }) => {
  await mockPosts(page, normal, { fail: ['all', 'tech', 'trends', 'essays'] });
  await page.goto('/');
  await expect(page.locator('.home-notice')).toHaveCount(5);
});

test('card click navigates via pushState (no reload) to the encoded slug', async ({ page }) => {
  await mockPosts(page, fixture('posts-xss').slice(1, 2).map((p) => ({ ...p, slug: 'tech/a b&c:한글/01', title: 'T' })));
  await page.goto('/');
  await page.evaluate(() => (window.marker = 'same-document'));
  const a = section(page, 'tech').locator('article a').first();
  await expect(a).toHaveAttribute('data-link', '');
  await expect(a).toHaveAttribute('href', '/posts/tech/a%20b%26c%3A%ED%95%9C%EA%B8%80/01');
  await a.click();
  await expect(page).toHaveURL(/\/posts\/tech\/a%20b%26c%3A%ED%95%9C%EA%B8%80\/01$/);
  expect(await page.evaluate(() => window.marker)).toBe('same-document');
});

test('navigating back to home moves focus to #main', async ({ page }) => {
  await mockPosts(page, normal);
  await page.goto('/tech');
  await page.getByRole('link', { name: 'IT Security Blog' }).first().click();
  await expect(page.locator('.home-lead')).toBeVisible();
  await expect(page.locator('#main')).toBeFocused();
});

test('long text does not overflow horizontally', async ({ page }) => {
  await mockPosts(page, fixture('posts-long'));
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.locator('.home-lead')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  }
});

test('links meet the 44px touch target on mobile', async ({ page }) => {
  await mockPosts(page, normal);
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/');
  await expect(page.locator('.home-lead')).toBeVisible();
  const small = await page.evaluate(() =>
    [...document.querySelectorAll('#main a')]
      .map((a) => a.getBoundingClientRect())
      .filter((r) => r.height < 44 - 0.5)
      .length,
  );
  expect(small).toBe(0);
});

test('single column below 1024px, asymmetric above', async ({ page }) => {
  await mockPosts(page, normal);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const x = () =>
    page.evaluate(() => [document.querySelector('.home-lead'), document.querySelector('.home-recent')].map((e) => e.getBoundingClientRect()));
  let [l, r] = await x();
  expect(r.left).toBeGreaterThan(l.right - 1);
  expect(l.width).toBeGreaterThan(r.width * 1.5);
  await page.setViewportSize({ width: 800, height: 900 });
  [l, r] = await x();
  expect(r.top).toBeGreaterThan(l.bottom - 1);
});

test('screenshots for review', async ({ page }) => {
  await mockPosts(page, normal);
  for (const [name, width, height] of [['home-1440', 1440, 1000], ['home-390', 390, 900]]) {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await expect(page.locator('.home-lead')).toBeVisible();
    await page.screenshot({ path: `.superpowers/screens/${name}.png`, fullPage: true });
  }
});
