import { test, expect } from '@playwright/test';
import { mockSite, postHref } from './mock-api.js';

let site;
test.beforeEach(async ({ page }) => {
  site = await mockSite(page);
});

const activeIs = (page, sel) => page.evaluate((s) => document.activeElement?.matches(s), sel);
const SITE = 'IT Security Blog';

test('keyboard: Tab order is skip link, site name, support widget, nav links (Home first), theme toggle; Enter on skip link focuses #main', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.home-lead')).toBeVisible();
  const stops = [];
  for (let i = 0; i < 9; i++) {
    await page.keyboard.press('Tab');
    stops.push(await page.evaluate(() => {
      const a = document.activeElement;
      return a.classList.contains('skip-link') ? 'skip' : a.classList.contains('theme-toggle') ? 'toggle' : a.getAttribute('href');
    }));
  }
  expect(stops).toEqual(['skip', '/', 'https://ctee.kr/place/theman', '/', '/tech', '/trends', '/essays', '/about', 'toggle']);
  for (let i = 0; i < 8; i++) await page.keyboard.press('Shift+Tab'); // toggle -> nav -> support widget -> name -> skip link
  expect(await activeIs(page, '.skip-link')).toBe(true);
  await page.keyboard.press('Enter');
  expect(await activeIs(page, '#main')).toBe(true);
});

test('keyboard: Enter on a post card link navigates and moves focus to #main with a new title', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.home-lead')).toBeVisible();
  await page.locator('.theme-toggle').focus();
  for (let i = 0; i < 12 && !(await activeIs(page, '.home-lead__link')); i++) await page.keyboard.press('Tab');
  expect(await activeIs(page, '.home-lead__link')).toBe(true);
  await page.keyboard.press('Shift+Tab');
  expect(await activeIs(page, '.home-lead__link')).toBe(false);
  await page.keyboard.press('Tab');
  expect(await activeIs(page, '.home-lead__link')).toBe(true);
  const marker = await page.evaluate(() => (window.__same = 1));
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(postHref(site.lead.slug));
  await expect(page.locator('h1')).toHaveText(site.lead.title);
  expect(await page.evaluate(() => window.__same)).toBe(marker); // pushState, no reload
  expect(await activeIs(page, '#main')).toBe(true);
  expect(await page.title()).toBe(`${site.lead.title} - ${SITE}`);
});

for (const [label, href, title] of [
  ['section', '/tech', '기술'],
  ['about', '/about', 'About'],
]) {
  test(`keyboard: nav link to ${label} moves focus to #main and updates the title`, async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.home-lead')).toBeVisible();
    await page.locator(`.site-header__nav a[href="${href}"]`).focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(href);
    await expect(page.locator('h1')).toBeVisible();
    expect(await activeIs(page, '#main')).toBe(true);
    expect(await page.title()).toBe(`${title} - ${SITE}`);
    await expect(page.locator(`.site-header__nav a[href="${href}"]`)).toHaveAttribute('aria-current', 'page');
  });
}

test('keyboard: focused links, buttons, chips and summaries show a visible outline', async ({ page }) => {
  const outline = (sel) =>
    page.locator(sel).first().evaluate((el) => {
      el.focus();
      const s = getComputedStyle(el);
      return { matches: el.matches(':focus-visible'), style: s.outlineStyle, width: parseFloat(s.outlineWidth) };
    });
  const expectRing = async (sel) => {
    await page.keyboard.press('Tab'); // keyboard modality, so :focus-visible applies to the focus() below
    const o = await outline(sel);
    expect(o, sel).toMatchObject({ matches: true });
    expect(o.style, sel).not.toBe('none');
    expect(o.width, sel).toBeGreaterThan(0);
  };
  await page.goto('/');
  await expect(page.locator('.home-lead')).toBeVisible();
  await expectRing('.home-lead__link');
  await expectRing('.site-header__nav a');
  await expectRing('.theme-toggle');
  await page.goto('/categories/tech/security');
  await expect(page.locator('.chips .chip').first()).toBeVisible();
  await expectRing('.chips .chip');
  await expectRing('.cat-tree summary');
  await page.setViewportSize({ width: 390, height: 844 }); // the tree becomes a collapsed disclosure
  await expectRing('.cat-nav > summary');
  await page.goto(postHref(site.tech.post.slug));
  await expect(page.locator('h1')).toBeVisible();
  await expectRing('details.post-toc-mobile summary');
});

const PAGES = [
  ['home', () => '/', '.home-lead'],
  ['post tech', () => postHref(site.tech.post.slug), '.article'],
  ['post essay', () => postHref(site.essay.post.slug), '.article'],
  ['section', () => '/tech', '.list-row, .list-rows > *'],
  ['category', () => '/categories/tech/security', '.cat-tree'],
  ['about', () => '/about', '.static-page'],
  ['not-found', () => '/no/such/page', '.nf'],
];

for (const theme of ['light', 'dark']) {
  for (const [name, url, ready] of PAGES) {
    test(`a11y structure: ${name} (${theme})`, async ({ page }) => {
      await page.addInitScript((t) => localStorage.setItem('theme', t), theme);
      await page.goto(url());
      await expect(page.locator(ready).first()).toBeAttached();
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await expect(page.locator('html')).toHaveAttribute('lang', 'ko');
      await expect(page.locator('main')).toHaveCount(1);
      await expect(page.locator('h1')).toHaveCount(1);
      const bad = await page.evaluate(() => {
        const name = (el) =>
          (el.getAttribute('aria-label') || '').trim() ||
          (el.getAttribute('aria-labelledby') ? [...document.querySelectorAll(`#${el.getAttribute('aria-labelledby')}`)].map((n) => n.textContent).join('').trim() : '') ||
          el.textContent.trim() ||
          [...el.querySelectorAll('img[alt]')].map((i) => i.alt).join('').trim();
        const ids = [...document.querySelectorAll('[id]')].map((n) => n.id);
        return {
          imgs: [...document.querySelectorAll('img:not([alt])')].map((n) => n.outerHTML.slice(0, 80)),
          unnamed: [...document.querySelectorAll('a[href], button')].filter((n) => !name(n)).map((n) => n.outerHTML.slice(0, 80)),
          dupIds: ids.filter((id, i) => ids.indexOf(id) !== i),
        };
      });
      expect(bad).toEqual({ imgs: [], unnamed: [], dupIds: [] });
    });
  }
}

test('reduced motion: no transition runs on the essay page, incl. the reading-progress line', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(postHref(site.essay.post.slug));
  await expect(page.locator('.reading-progress')).toHaveCount(1);
  const running = await page.evaluate(() =>
    [...document.querySelectorAll('*, *::before, *::after')]
      .concat([...document.querySelectorAll('.reading-progress')])
      .filter((el) => getComputedStyle(el).transitionDuration.split(',').some((d) => parseFloat(d) > 0))
      .map((el) => el.tagName + '.' + el.className),
  );
  expect(running).toEqual([]);
  expect(await page.locator('.reading-progress').evaluate((el) => getComputedStyle(el).transitionDuration)).toBe('0s');
});
