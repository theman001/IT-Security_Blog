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
