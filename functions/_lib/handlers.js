import { json, fail } from './http.js';
import { decodeSlug } from './slug.js';
import { decodeCursor } from './cursor.js';
import { listPosts, getPost, listCategories, getCategoryPosts } from './queries.js';

const SECTIONS = ['tech', 'trends', 'essays'];
const asParts = (p) => (p == null ? [] : Array.isArray(p) ? p : [p]);

// Shared wrapper: GET only; any thrown error (incl. DB / missing env) -> opaque 500.
async function guarded({ request, env, params }, { getDb }, run) {
  if (request.method !== 'GET') return fail(405, 'method_not_allowed', 'Only GET is supported', { headers: { Allow: 'GET' } });
  try {
    return await run(new URL(request.url), asParts(params?.slug ?? params?.path), () => getDb(env));
  } catch (e) {
    console.error('api error', e?.name, e?.code); // never log message (may hold connection info)
    return fail(500, 'internal', 'Internal error');
  }
}

export const handlePosts = (ctx, deps) =>
  guarded(ctx, deps, async (url, parts, db) => {
    if (parts.length) {
      const slug = decodeSlug(parts);
      if (!slug) return fail(400, 'bad_request', 'Invalid slug');
      const out = await getPost(db(), slug);
      return out ? json(out) : fail(404, 'not_found', 'Post not found');
    }
    const q = url.searchParams;
    let limit = 20;
    if (q.has('limit')) {
      const s = q.get('limit');
      limit = /^\d{1,3}$/.test(s) ? Number(s) : 0;
      if (limit < 1 || limit > 50) return fail(400, 'bad_request', 'limit must be 1-50');
    }
    const section = q.get('section') ?? undefined;
    if (section !== undefined && !SECTIONS.includes(section)) return fail(400, 'bad_request', 'Invalid section');
    let category;
    if (q.has('category')) {
      // URLSearchParams already decoded it: re-encode so decodeSlug validates without double-decoding.
      category = decodeSlug(q.get('category').split('/').map(encodeURIComponent));
      if (!category) return fail(400, 'bad_request', 'Invalid category');
    }
    let cursor;
    if (q.has('cursor')) {
      cursor = decodeCursor(q.get('cursor'));
      if (!cursor) return fail(400, 'bad_request', 'Invalid cursor');
    }
    return json(await listPosts(db(), { section, category, limit, cursor }));
  });

export const handleCategories = (ctx, deps) =>
  guarded(ctx, deps, async (_url, parts, db) => {
    if (!parts.length) return json({ items: await listCategories(db()) });
    if (parts[parts.length - 1] !== 'posts') return fail(404, 'not_found', 'Not found');
    const path = decodeSlug(parts.slice(0, -1));
    if (!path) return fail(400, 'bad_request', 'Invalid category path');
    const out = await getCategoryPosts(db(), path);
    return out ? json(out) : fail(404, 'not_found', 'Category not found');
  });
