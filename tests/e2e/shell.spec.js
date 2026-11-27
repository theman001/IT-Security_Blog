import { test, expect } from '@playwright/test';

// Test pages are registered through the router module itself: the dev server serves
// the same module instance main.js uses, so no test hook ships in the app.
const setup = (page) =>
  page.evaluate(async () => {
    const { route } = await import('/src/router.js');
    const w = window;
    w.renders = 0;
    w.unmounts = [];
    const mk = (title, extra = {}) => ({
      render: (d) => (w.renders++, { title, html: `<h1>${title}</h1><a data-link href="/b">to b</a><a data-link href="#x">hash</a>${d ?? ''}` }),
      unmount: () => w.unmounts.push(title || 'home'),
      ...extra,
    });
    route('/', mk(''));
    route('/a', mk('A'));
    route('/b', mk('B'));
    route('/p/:id', { load: async (p) => `<p id="param">${p.id}</p>`, ...mk('P') });
    route('/s/*', { load: async (p) => `<p id="param">${p['*']}</p>`, ...mk('S') });
    route('/slow', { load: () => new Promise((r) => (w.releaseSlow = r)).then(() => '<p>slow-data</p>'), ...mk('Slow') });
    route('/boom', { load: async () => { throw new Error('<b>nope</b>'); }, ...mk('Boom') });
    const { navigate } = await import('/src/router.js');
    w.go = navigate;
    w.marker = 'same-document';
  });

test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', (r) => r.fulfill({ status: 500, body: '{}' }));
});

test('theme toggle persists across reload', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  const btn = page.getByRole('button', { name: "다크 모드" });
  await expect(btn).toHaveAttribute('aria-pressed', 'false');
  await btn.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(btn).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('button', { name: "다크 모드" })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: "다크 모드" }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('stored theme is applied before DOMContentLoaded (no flash)', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('theme', 'dark');
    new MutationObserver((_, ob) => {
      if (document.documentElement.dataset.theme) {
        window.__setAt = document.readyState;
        ob.disconnect();
      }
    }).observe(document, { attributes: true, subtree: true, attributeFilter: ['data-theme'] }); // <html> may not exist yet
  });
  await page.goto('/');
  expect(await page.evaluate(() => window.__setAt)).toBe('loading');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('no stored theme leaves data-theme unset and follows OS', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBeUndefined();
  await expect(page.getByRole('button', { name: "다크 모드" })).toHaveAttribute('aria-pressed', 'true');
});

test('internal link click uses pushState, focuses #main, sets title', async ({ page }) => {
  await page.goto('/a');
  await setup(page);
  await page.evaluate(() => window.go('/a', { replace: true }));
  await expect(page).toHaveTitle('A - IT Security Blog');
  await page.locator('#main a[href="/b"]').click();
  await expect(page).toHaveURL(/\/b$/);
  await expect(page.locator('#main h1')).toHaveText('B');
  await expect(page.locator('#main')).toBeFocused();
  await expect(page).toHaveTitle('B - IT Security Blog');
  expect(await page.evaluate(() => window.marker)).toBe('same-document');
  expect(await page.evaluate(() => window.unmounts)).toEqual(['A']);
});

test('header links navigate and mark aria-current', async ({ page }) => {
  await page.goto('/');
  await setup(page);
  await page.evaluate(async () => {
    const { route } = await import('/src/router.js');
    route('/about', { render: () => ({ title: 'About', html: '<h1>About</h1>' }) });
    route('/tech', { render: () => ({ title: 'Tech', html: '<h1>Tech</h1>' }) });
    window.go('/');
  });
  await expect(page).toHaveTitle('IT Security Blog');
  const nav = page.locator('header nav');
  await expect(nav.locator('[aria-current]')).toHaveCount(0);
  await nav.getByRole('link', { name: 'About' }).click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(nav.locator('[aria-current="page"]')).toHaveText('About');
  await nav.getByRole('link', { name: 'Tech' }).click();
  await expect(nav.locator('[aria-current="page"]')).toHaveText('Tech');
  await expect(nav.locator('[aria-current]')).toHaveCount(1);
  expect(await nav.getByRole('link').allTextContents()).toEqual(['Tech', 'Trends', 'Essays', 'About']);
  await page.goBack();
  await expect(nav.locator('[aria-current="page"]')).toHaveText('About');
});

test('back/forward re-render without reload', async ({ page }) => {
  await page.goto('/');
  await setup(page);
  await page.evaluate(() => window.go('/a'));
  await page.evaluate(() => window.go('/b'));
  await expect(page.locator('#main h1')).toHaveText('B');
  await page.goBack();
  await expect(page.locator('#main h1')).toHaveText('A');
  await page.goBack();
  await expect(page).toHaveTitle('IT Security Blog');
  await page.goForward();
  await expect(page.locator('#main h1')).toHaveText('A');
  expect(await page.evaluate(() => window.marker)).toBe('same-document');
});

test('hash-only change does not re-render (click and back)', async ({ page }) => {
  await page.goto('/');
  await setup(page);
  await page.evaluate(() => window.go('/a'));
  const before = await page.evaluate(() => window.renders);
  await page.locator('#main a[href="#x"]').click();
  await expect(page).toHaveURL(/\/a#x$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/a$/);
  expect(await page.evaluate(() => window.renders)).toBe(before);
  expect(await page.evaluate(() => window.marker)).toBe('same-document');
});

test('params and splat are decoded; splat is one slash-joined string', async ({ page }) => {
  await page.goto('/');
  await setup(page);
  await page.evaluate(() => window.go('/p/a%20b'));
  await expect(page.locator('#param')).toHaveText('a b');
  await page.evaluate(() => window.go('/s/Security/Hack%20X/한글'));
  await expect(page.locator('#param')).toHaveText('Security/Hack X/한글');
});

test('stale async load never renders after a newer navigation', async ({ page }) => {
  await page.goto('/');
  await setup(page);
  await page.evaluate(() => { window.go('/slow'); });
  await page.evaluate(() => window.go('/b'));
  await expect(page.locator('#main h1')).toHaveText('B');
  await page.evaluate(() => window.releaseSlow());
  await page.waitForTimeout(100);
  await expect(page.locator('#main h1')).toHaveText('B');
  await expect(page).toHaveTitle('B - IT Security Blog');
  await expect(page.locator('#main')).not.toContainText('slow-data');
});

test('load error renders escaped message and navigation keeps working', async ({ page }) => {
  await page.goto('/');
  await setup(page);
  await page.evaluate(() => window.go('/boom'));
  await expect(page.locator('#main')).toContainText('<b>nope</b>');
  await expect(page.locator('#main b')).toHaveCount(0);
  await page.evaluate(() => window.go('/a'));
  await expect(page.locator('#main h1')).toHaveText('A');
});

test('unknown path shows 404; registered not-found page replaces it', async ({ page }) => {
  await page.goto('/nope/x');
  await expect(page.locator('#main')).toContainText('찾을 수 없');
  await setup(page);
  await page.evaluate(async () => {
    const { route } = await import('/src/router.js');
    route('*', { render: () => ({ title: '404', html: '<h1>custom 404</h1>' }) });
    window.go('/still/nope');
  });
  await expect(page.locator('#main h1')).toHaveText('custom 404');
});

test('shell landmarks: skip link, main, footer RSS', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('a.skip-link')).toHaveAttribute('href', '#main');
  await expect(page.locator('main#main')).toHaveAttribute('tabindex', '-1');
  await expect(page.locator('footer a[href="/rss.xml"]')).toBeVisible();
});
