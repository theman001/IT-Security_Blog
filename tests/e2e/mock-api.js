import { readFileSync } from 'node:fs';

export const fixture = (name) => JSON.parse(readFileSync(new URL(`../fixtures/api/${name}.json`, import.meta.url), 'utf8')).items;

/**
 * Mock GET /api/posts like the real endpoint: filter by ?section, cut to ?limit, newest first as given.
 * `fail` = sections whose request answers 500 ('all' = the unfiltered recent request).
 */
export async function mockPosts(page, items, { fail = [] } = {}) {
  const calls = [];
  await page.route('**/api/posts?*', (route) => {
    const q = new URL(route.request().url()).searchParams;
    calls.push(Object.fromEntries(q));
    if (fail.includes(q.get('section') ?? 'all')) {
      return route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":{"code":"internal","message":"x"}}' });
    }
    const list = items.filter((p) => !q.get('section') || p.section === q.get('section')).slice(0, Number(q.get('limit') ?? 20));
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: list, nextCursor: null }) });
  });
  return calls;
}

const FILL = Array.from({ length: 14 }, (_, i) => `본문 문단 ${i + 1}번입니다. 읽기 흐름과 스크롤 길이를 만들기 위한 충분히 긴 문장이 이어진다.`).join('\n\n');

/** A post-detail fixture (`GET /api/posts/<slug>` body). `{{FILL}}` in contentMd becomes a tall block of paragraphs. */
export function postFixture(name) {
  const r = JSON.parse(readFileSync(new URL(`../fixtures/api/${name}.json`, import.meta.url), 'utf8'));
  r.post.contentMd = r.post.contentMd.replaceAll('{{FILL}}', FILL);
  return r;
}

/**
 * Mock GET /api/posts/<slug>. `responses` = post-detail bodies keyed by decoded slug (post.slug).
 * Unknown slug -> 404 in the API's error shape; slug starting with `boom` -> 500.
 * Returns the raw (still encoded) request pathnames.
 */
export async function mockPost(page, responses) {
  const bySlug = new Map(responses.map((r) => [r.post.slug, r]));
  const calls = [];
  // post-page sidebar (GET /api/section-nav): the deep category fixture + the served posts + a few fixed ones
  await page.route('**/api/section-nav?*', (route) => {
    const section = new URL(route.request().url()).searchParams.get('section');
    const posts = [...bySlug.values()].map((r) => ({ slug: r.post.slug, title: r.post.title }));
    for (const p of [{ slug: 'tech/security/reversing/r1', title: '리버싱 글 1' }, { slug: 'tech/security/web/w1', title: '웹 글 <1>' }, { slug: 'trends/t1', title: '동향 글 1' }]) {
      if (!posts.some((x) => x.slug === p.slug)) posts.push(p);
    }
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ categories: fixture('categories-deep').filter((c) => c.section === section), posts: posts.filter((p) => p.slug.startsWith(`${section}/`)) }),
    });
  });
  await page.route('**/api/posts/**', (route) => {
    const { pathname } = new URL(route.request().url());
    calls.push(pathname);
    const slug = pathname.slice('/api/posts/'.length).split('/').map(decodeURIComponent).join('/');
    const hit = bySlug.get(slug);
    if (slug.startsWith('boom')) return route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":{"code":"internal","message":"x"}}' });
    if (!hit) return route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":{"code":"not_found","message":"Post not found"}}' });
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(hit) });
  });
  return calls;
}

/** Everything the site needs for a whole-site walk (a11y / screenshots): lists, categories, tech + essay posts, and the home lead essay's slug. */
export async function mockSite(page) {
  const posts = fixture('posts-normal');
  const lead = posts.find((p) => p.section === 'essays');
  const essay = postFixture('post-essay');
  const tech = postFixture('post-tech');
  await mockPosts(page, posts);
  await mockPost(page, [tech, essay, { ...essay, post: { ...essay.post, slug: lead.slug, title: lead.title } }]);
  await page.route('**/api/categories', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: fixture('categories-deep') }) }));
  return { posts, lead, tech, essay };
}

export const postHref = (slug) => `/posts/${slug.split('/').map(encodeURIComponent).join('/')}`;
