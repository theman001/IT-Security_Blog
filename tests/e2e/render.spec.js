import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const sample = readFileSync(new URL('../fixtures/sample.md', import.meta.url), 'utf8');

test.beforeEach(async ({ page }) => {
  await page.goto('/tests/fixtures/render-harness.html');
  await page.waitForFunction(() => window.__ready);
});

const mount = (page, md) => page.evaluate((m) => window.__h.mount(m), md);
const html = (page, md) => page.evaluate((m) => window.__h.renderMarkdown(m), md);

test('renders markdown to the expected tags', async ({ page }) => {
  await mount(page, sample);
  const root = page.locator('#root');
  await expect(root.locator('h2')).toHaveText('개요');
  await expect(root.locator('h3')).toHaveText('목록');
  await expect(root.locator('ul > li')).toHaveCount(2);
  await expect(root.locator('ol > li')).toHaveCount(2);
  await expect(root.locator('blockquote')).toContainText('조용한 콜아웃');
  await expect(root.locator('div.table-wrap > table th')).toHaveCount(2);
  const img = root.locator('img');
  await expect(img).toHaveAttribute('src', '/img/a.png');
  await expect(img).toHaveAttribute('loading', 'lazy');
  await expect(img).toHaveAttribute('decoding', 'async');
});

test('heading ids are toc-heading-N and unique, assigned after sanitize', async ({ page }) => {
  await mount(page, '## a\n\n### b\n\n## c\n\n<h2 id="toc-heading-0">spoof</h2>');
  const ids = await page.locator('#root h2, #root h3').evaluateAll((els) => els.map((e) => e.id));
  expect(ids).toEqual(['toc-heading-0', 'toc-heading-1', 'toc-heading-2', 'toc-heading-3']);
  expect(new Set(ids).size).toBe(ids.length);
  // content-supplied id gets stripped/replaced, never trusted
  expect(await page.locator('#root h2').last().textContent()).toBe('spoof');
});

test('links: external gets noopener + _blank, internal untouched, javascript: removed', async ({ page }) => {
  await mount(page, sample);
  const ext = page.locator('#root a[href^="https://example.com"]');
  await expect(ext).toHaveAttribute('target', '_blank');
  await expect(ext).toHaveAttribute('rel', 'noopener noreferrer');
  const internal = page.locator('#root a[href="/posts/a"]');
  expect(await internal.getAttribute('target')).toBeNull();
  expect(await internal.getAttribute('rel')).toBeNull();
});

test('XSS payloads are neutralised and global DOMPurify state does not leak', async ({ page }) => {
  let dialog = false;
  page.on('dialog', (d) => { dialog = true; d.dismiss(); });
  const payload = [
    '<img src=x onerror=alert(1)>',
    '<script>alert(1)</script>',
    '[x](javascript:alert(1))',
    '<a href="javascript:alert(1)">y</a>',
    '![i](javascript:alert(1))',
    '![d](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)',
    '<svg onload=alert(1)></svg>',
  ].join('\n\n');
  await mount(page, payload);
  await page.waitForTimeout(300); // let a would-be onerror fire
  expect(dialog).toBe(false);
  const out = await page.locator('#root').innerHTML();
  expect(out).not.toMatch(/onerror|onload/i);
  expect(out).not.toMatch(/<script/i);
  expect(out).not.toMatch(/javascript:/i);
  expect(out).not.toMatch(/src="data:/i);
  // a second call after the first must not be affected by hooks from the first
  const again = await html(page, '[a](https://example.com)');
  expect(again.match(/target="_blank"/g)).toHaveLength(1);
});

test('returns fallback html when rendering throws', async ({ page }) => {
  const out = await page.evaluate(() => window.__h.renderMarkdown(Symbol('x')));
  expect(out).toBe('<p>Markdown rendering failed.</p>');
});

test('code block: wrapper, label, prism tokens, idempotent', async ({ page }) => {
  await mount(page, '```js\nconst x = 1;\n```\n\n```nosuchlang\nplain\n```\n\n```\nno lang\n```');
  const blocks = page.locator('#root .code-block');
  await expect(blocks).toHaveCount(3);
  await expect(blocks.nth(0).locator('.code-block__lang')).toHaveText('js');
  await expect(blocks.nth(0).locator('code .token').first()).toBeVisible();
  await expect(blocks.nth(1).locator('code .token')).toHaveCount(0);
  await expect(blocks.nth(2).locator('.code-block__lang')).toHaveText('text');
  await page.evaluate(() => window.__h.enhanceCodeBlocks(window.__h.root));
  await expect(blocks).toHaveCount(3);
  await expect(page.locator('#root .code-block .code-block__copy')).toHaveCount(3);
  await expect(page.locator('#root .code-block .code-block .code-block__copy')).toHaveCount(0);
});

test('copy button writes exact code, shows Copied! then returns to Copy', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await mount(page, '```js\nconst a = "<b>&</b>";\nfoo(a);\n```');
  await page.clock.install();
  const btn = page.getByRole('button', { name: 'Copy' });
  await expect(btn).toHaveAttribute('type', 'button');
  await btn.click();
  await expect(page.getByRole('button', { name: 'Copied!' })).toBeVisible();
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  expect(clip).toBe('const a = "<b>&</b>";\nfoo(a);\n');
  await page.clock.runFor(1700);
  await expect(page.locator('.code-block__copy')).toHaveText('Copied!');
  await page.clock.runFor(200);
  await expect(page.locator('.code-block__copy')).toHaveText('Copy');
});

test('copy button does not throw when the clipboard API is unavailable', async ({ page }) => {
  await mount(page, '```js\nx\n```');
  const errors = [];
  page.on('pageerror', (e) => errors.push(e));
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true }));
  await page.locator('.code-block__copy').click();
  await page.waitForTimeout(100);
  expect(errors).toEqual([]);
});

const toc = (page, md) =>
  page.evaluate((m) => {
    window.__h.mount(m);
    const r = window.__h.buildToc(window.__h.root);
    return r;
  }, md);

test('toc: 2 headings count 2, 3 headings count 3 with nested h3', async ({ page }) => {
  expect((await toc(page, '## a\n\n## b\n\ntext')).count).toBe(2);
  const r = await toc(page, '## a\n\n### a1\n\n## b');
  expect(r.count).toBe(3);
  await page.evaluate((h) => { document.body.insertAdjacentHTML('beforeend', `<div id="t">${h}</div>`); }, r.html);
  const nav = page.locator('#t nav[aria-label="이 글의 목차"]');
  await expect(nav.locator('ol > li > a[href="#toc-heading-0"]')).toHaveText('a');
  await expect(nav.locator('li.toc-h3 a[href="#toc-heading-1"]')).toHaveText('a1');
});

test('toc: heading text is escaped', async ({ page }) => {
  const r = await toc(page, '## &lt;b&gt;x&lt;/b&gt; & "q"\n\n## y\n\n## z');
  expect(r.html).toContain('&lt;b&gt;x&lt;/b&gt;');
  expect(r.html).not.toContain('<b>');
});

test('observeToc marks current heading and cleans up', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 400 });
  const filler = '\n\n' + 'para\n\n'.repeat(60);
  const r = await toc(page, `## a${filler}## b${filler}## c${filler}`);
  await page.evaluate((h) => {
    document.body.insertAdjacentHTML('beforeend', `<div id="t">${h}</div>`);
    window.__stop = window.__h.observeToc(window.__h.root, document.querySelector('#t nav'));
  }, r.html);
  await expect(page.locator('#t a[aria-current="true"]')).toHaveAttribute('href', '#toc-heading-0');
  await page.locator('#toc-heading-2').scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollTo(0, document.getElementById('toc-heading-2').offsetTop - 5));
  await expect(page.locator('#t a[aria-current="true"]')).toHaveAttribute('href', '#toc-heading-2');
  await expect(page.locator('#t a[aria-current="true"]')).toHaveCount(1);
  await page.evaluate(() => window.__stop());
});

test('article styling applies tokens (table wrapper scrolls, code scrolls without wrapping)', async ({ page }) => {
  await mount(page, sample);
  const ov = await page.locator('.table-wrap').evaluate((e) => getComputedStyle(e).overflowX);
  expect(ov).toBe('auto');
  const ws = await page.locator('.code-block pre').evaluate((e) => getComputedStyle(e).whiteSpace);
  expect(ws).toBe('pre');
});
