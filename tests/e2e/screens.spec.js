import { mkdirSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { mockSite, postHref } from './mock-api.js';

// SCREENSHOTS=1 also writes full-page PNGs to .superpowers/screens/final (git-ignored).
// The 390px no-horizontal-overflow assertion always runs.
const SHOTS = !!process.env.SCREENSHOTS;
const OUT = '.superpowers/screens/final';
const VIEWPORTS = { 1440: { width: 1440, height: 900 }, 390: { width: 390, height: 844 } };

let site;
test.beforeEach(async ({ page }) => {
  site = await mockSite(page);
});

const PAGES = [
  ['home', () => '/'],
  ['post-tech', () => postHref(site.tech.post.slug)],
  ['post-essay', () => postHref(site.essay.post.slug)],
  ['section', () => '/tech'],
  ['category', () => '/categories/tech/security'],
  ['about', () => '/about'],
  ['not-found', () => '/no/such/page'],
];

for (const [vp, size] of Object.entries(VIEWPORTS)) {
  for (const theme of ['light', 'dark']) {
    for (const [name, url] of PAGES) {
      test(`${name} ${vp} ${theme}`, async ({ page }) => {
        test.skip(vp === '1440' && !SHOTS, 'screenshots only');
        await page.setViewportSize(size);
        await page.addInitScript((t) => localStorage.setItem('theme', t), theme);
        await page.goto(url());
        await expect(page.locator('h1')).toBeAttached(); // home's h1 is screen-reader-only
        await expect(page.locator('.home-notice, [aria-busy="true"]')).toHaveCount(0);
        await page.evaluate(() => document.fonts.ready);
        if (vp === '390') {
          const w = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
          expect(w.scroll).toBeLessThanOrEqual(w.client);
        }
        if (SHOTS) {
          mkdirSync(OUT, { recursive: true });
          await page.screenshot({ path: `${OUT}/${name}-${vp}-${theme}.png`, fullPage: true });
        }
      });
    }
  }
}

test('390px: header shows the site name, all four nav links and the theme toggle inside the viewport', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS[390]);
  await page.goto('/');
  await expect(page.locator('h1')).toBeAttached();
  const boxes = await page.locator('.site-header__name, .site-header__nav a, .theme-toggle').evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return { left: r.left, right: r.right, w: r.width };
    }),
  );
  expect(boxes).toHaveLength(6);
  for (const b of boxes) {
    expect(b.w).toBeGreaterThan(0);
    expect(b.left).toBeGreaterThanOrEqual(0);
    expect(b.right).toBeLessThanOrEqual(390);
  }
});
