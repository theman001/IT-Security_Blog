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

test('content-injection vectors are stripped while normal markdown survives', async ({ page }) => {
  const payload = [
    '<style>body{display:none}</style>',
    '<div style="position:fixed;top:0">overlay</div>',
    '<form action="https://evil.example/p"><input type=password><button>go</button><textarea>t</textarea><select><option>o</option></select></form>',
    '<img name=foo srcset="http://evil.example/a.png 2x" src="/a.png">',
    '<a name=bar href="/y">named</a>',
    '<video src="/v" poster="/p" controls></video><audio src="/a"></audio><picture><source srcset="http://evil.example/x"></picture>',
    '<iframe src="/x"></iframe><object data="/x"></object><embed src="/x"><svg><a href="/x">s</a></svg><math><mi>m</mi></math>',
    '',
    '| h |\n|---|\n| c |',
    '',
    '```js\nlet a = 1;\n```',
    '',
    '![alt](/ok.png) [link](https://example.com)',
  ].join('\n');
  const out = await html(page, payload);
  for (const re of [/<style/i, /<form/i, /<input/i, /<button/i, /<textarea/i, /<select/i, /<video/i, /<audio/i,
    /<source/i, /<picture/i, /<iframe/i, /<object/i, /<embed/i, /<svg/i, /<math/i,
    /\sstyle=/i, /\sname=/i, /srcset/i, /poster/i]) {
    expect(out, String(re)).not.toMatch(re);
  }
  await mount(page, payload);
  const root = page.locator('#root');
  await expect(root.locator('div.table-wrap > table')).toHaveCount(1);
  await expect(root.locator('.code-block code .token').first()).toBeVisible();
  await expect(root.locator('img[src="/ok.png"]')).toHaveAttribute('loading', 'lazy');
  await expect(root.locator('a[href="https://example.com"]')).toHaveAttribute('target', '_blank');
  await expect(root.locator('img[src="/a.png"]')).toHaveCount(1); // image kept, only name/srcset removed
  expect(await page.evaluate(() => getComputedStyle(document.body).display)).not.toBe('none');
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

const noClipboard = (page) => page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true }));

test('legacy copy fallback: execCommand false -> no "Copied!", focus returns to the button', async ({ page }) => {
  await mount(page, '```js\nx\n```');
  await noClipboard(page);
  await page.evaluate(() => { document.execCommand = () => false; });
  const btn = page.locator('.code-block__copy');
  await btn.click();
  await page.waitForTimeout(100);
  await expect(btn).toHaveText('Copy');
  await expect(btn).toBeFocused();
});

test('legacy copy fallback: execCommand true -> "Copied!" and focus returns to the button', async ({ page }) => {
  await mount(page, '```js\nx\n```');
  await noClipboard(page);
  await page.evaluate(() => { document.execCommand = () => true; });
  const btn = page.locator('.code-block__copy');
  await btn.click();
  await expect(btn).toHaveText('Copied!');
  await expect(btn).toBeFocused();
});

test('language lookup ignores inherited Object properties (```constructor stays plain text)', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e));
  await mount(page, '```constructor\nplain\n```\n\n```toString\nplain\n```');
  await expect(page.locator('#root .code-block')).toHaveCount(2);
  await expect(page.locator('#root .code-block code .token')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('copy button announces state changes politely; Prism auto-highlighting is off', async ({ page }) => {
  await mount(page, '```js\nx\n```');
  await expect(page.locator('.code-block__copy')).toHaveAttribute('aria-live', 'polite');
  expect(await page.evaluate(() => window.__h.Prism.manual)).toBe(true);
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

test('```link fence renders a hand-written link card; external opens in a new tab; nothing is fetched', async ({ page }) => {
  const reqs = [];
  page.on('request', (r) => reqs.push(r.url()));
  await mount(page, '앞 문단\n\n```link\nurl: https://example.org/a?x=1&y=2\ntitle: 외부 글 <b>제목</b>\ndescription: 한두 줄 설명 & 요약\n```\n\n뒤 문단');
  const card = page.locator('#root a.link-card');
  await expect(card).toHaveCount(1);
  await expect(card).toHaveAttribute('href', 'https://example.org/a?x=1&y=2');
  await expect(card).toHaveAttribute('target', '_blank');
  await expect(card).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(card.locator('.link-card__host')).toHaveText('example.org');
  await expect(card.locator('.link-card__title')).toHaveText('외부 글 <b>제목</b>'); // text, not markup
  await expect(card.locator('.link-card__desc')).toHaveText('한두 줄 설명 & 요약');
  await expect(page.locator('#root p')).toHaveCount(2);
  expect(reqs.filter((u) => u.includes('example.org'))).toHaveLength(0);
});

test('link card: site path stays in the tab, title falls back to the host, bad urls stay code blocks', async ({ page }) => {
  await mount(page, '```link\nurl: /posts/tech/a\ntitle: 내부 글\n```\n\n```link\nurl: https://example.org/z\n```\n\n```link\nurl: javascript:alert(1)\ntitle: x\n```\n\n```link\nurl: //evil.example/x\ntitle: y\n```\n\n```link\ntitle: no url\n```');
  const cards = page.locator('#root a.link-card');
  await expect(cards).toHaveCount(2);
  expect(await cards.nth(0).getAttribute('target')).toBeNull();
  await expect(cards.nth(0).locator('.link-card__host')).toHaveCount(0);
  await expect(cards.nth(1).locator('.link-card__title')).toHaveText('example.org');
  await expect(cards.nth(1).locator('.link-card__desc')).toHaveCount(0);
  await expect(page.locator('#root pre')).toHaveCount(3); // the three invalid ones fall back to code blocks
  expect(await page.locator('#root a[href^="javascript"]').count()).toBe(0);
});

test('link card styling: bordered card with tokens, whole card is the link', async ({ page }) => {
  await mount(page, '```link\nurl: https://example.org/a\ntitle: 제목\ndescription: 설명\n```');
  const c = page.locator('#root a.link-card');
  await expect(c).toHaveCSS('border-top-style', 'solid');
  await expect(c).toHaveCSS('text-decoration-line', 'none');
  const ok = await c.evaluate((el) => { const r = el.getBoundingClientRect(); return r.height > 60 && el.querySelector('.link-card__title').getBoundingClientRect().top >= r.top; });
  expect(ok).toBe(true);
});

test('image size hint "WxH" in the title becomes width/height (no layout shift) and is not a tooltip', async ({ page }) => {
  await mount(page, '![a](https://asset.taeuk.site/p/a.png "800x600")\n\n![b](https://asset.taeuk.site/p/b.png "진짜 제목")\n\n![c](https://asset.taeuk.site/p/c.png)\n\n![d](https://asset.taeuk.site/p/d.png "0x0")\n\n<img src="https://asset.taeuk.site/p/e.png" width="300" height="100" title="1x1">');
  const img = page.locator('#root img');
  await expect(img.nth(0)).toHaveAttribute('width', '800');
  await expect(img.nth(0)).toHaveAttribute('height', '600');
  expect(await img.nth(0).getAttribute('title')).toBeNull();
  await expect(img.nth(1)).toHaveAttribute('title', '진짜 제목'); // an ordinary title is untouched
  expect(await img.nth(1).getAttribute('width')).toBeNull();
  expect(await img.nth(2).getAttribute('width')).toBeNull();
  expect(await img.nth(3).getAttribute('width')).toBeNull(); // 0x0 ignored
  await expect(img.nth(4)).toHaveAttribute('width', '300'); // explicit attributes win
  await expect(img.nth(4)).toHaveAttribute('height', '100');
});

test('image with width/height reserves its box before the file loads and never overflows the column', async ({ page }) => {
  await page.route('https://asset.taeuk.site/**', () => {}); // never answers: the image stays "loading"
  await mount(page, '앞\n\n![a](https://asset.taeuk.site/p/a.png "2000x1000")\n\n뒤');
  const box = await page.locator('#root img').evaluate((el) => { const r = el.getBoundingClientRect(); return { w: r.width, h: r.height, col: el.parentElement.getBoundingClientRect().width }; });
  expect(box.w).toBeLessThanOrEqual(box.col + 0.5); // capped by max-width: 100%
  expect(box.h).toBeGreaterThan(0); // height reserved from the 2:1 hint even though nothing has loaded
  expect(box.h / box.w).toBeCloseTo(0.5, 2);
});

test('pending link card reserves room for its metadata; hand-written cards do not', async ({ page }) => {
  await mount(page, '```link\nurl: https://example.org/a\n```\n\n```link\nurl: https://example.org/b\ntitle: 직접\n```');
  const h = (i) => page.locator('#root a.link-card').nth(i).evaluate((el) => el.getBoundingClientRect().height);
  expect(await h(0)).toBeGreaterThanOrEqual(160); // title + two description lines
  expect(await h(1)).toBeLessThan(160);
});
