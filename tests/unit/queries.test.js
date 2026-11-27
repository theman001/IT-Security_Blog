import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listPosts, getPost, listCategories, getCategoryPosts } from '../../functions/_lib/queries.js';
import { decodeCursor } from '../../functions/_lib/cursor.js';

// Fake db: returns queued row-sets in call order, records every call.
const fakeDb = (...results) => {
  const calls = [];
  return {
    calls,
    query: async (text, params) => {
      calls.push({ text, params });
      return results.length > 1 ? results.shift() : results[0] ?? [];
    },
  };
};
const row = (i, extra = {}) => ({
  id: i, title: `t${i}`, slug: `tech/a/p${i}`, date: `2026-01-${String(i).padStart(2, '0')}`,
  description: 'desc', body_head: null, reading_minutes: 2,
  category_id: 1, category_name: 'A', category_path: 'tech/a', tags: ['x'], author_type: 'admin', ...extra,
});
// every content_md must be wrapped in left(...) or length(...)
const bareBody = (text) => text.replace(/(left|length)\(\s*\w*\.?content_md[^)]*\)/g, '').includes('content_md');

test('listPosts requests limit+1, trims, and builds nextCursor', async () => {
  const db = fakeDb([row(3), row(2), row(1)]);
  const out = await listPosts(db, { limit: 2 });
  assert.equal(out.items.length, 2);
  assert.deepEqual(decodeCursor(out.nextCursor), { date: '2026-01-02', id: 2 });
  assert.ok(db.calls[0].params.includes(3));
});
test('listPosts returns nextCursor null on last page', async () => {
  const out = await listPosts(fakeDb([row(2), row(1)]), { limit: 2 });
  assert.equal(out.nextCursor, null);
  assert.equal(out.items.length, 2);
});
test('listPosts maps summary fields', async () => {
  const [it] = (await listPosts(fakeDb([row(1, { tags: null, description: '', body_head: '# H\nbody' })]), { limit: 5 })).items;
  assert.deepEqual(it.tags, []);
  assert.equal(it.section, 'tech');
  assert.equal(it.readingMinutes, 2);
  assert.equal(it.excerpt, 'H body');
  assert.equal(it.categoryPath, 'tech/a');
  assert.equal(it.date, '2026-01-01');
});
test('listPosts never selects bare content_md and binds all user values', async () => {
  const db = fakeDb([]);
  const evil = "x'; DROP TABLE reports;--";
  await listPosts(db, { section: 'tech', category: evil, limit: 7, cursor: { date: '2026-01-05', id: 9 } });
  const { text, params } = db.calls[0];
  assert.equal(bareBody(text), false);
  assert.match(text, /to_char\(/);
  assert.match(text, /ORDER BY[^;]*created_at DESC, r\.id DESC/);
  for (const v of ['tech', evil, 8, '2026-01-05', 9]) assert.ok(params.includes(v), String(v));
  for (const v of ['tech', evil, '2026-01-05']) assert.ok(!text.includes(v));
  assert.doesNotMatch(text, /DROP/);
});
test('listPosts without filters has no unbound placeholders', async () => {
  const db = fakeDb([]);
  await listPosts(db, { limit: 20 });
  const n = Math.max(0, ...[...db.calls[0].text.matchAll(/\$(\d+)/g)].map((m) => +m[1]));
  assert.equal(n, db.calls[0].params.length);
});

const postRow = (extra = {}) => ({
  ...row(5), content_md: '# body', description: 'd',
  prev_slug: 'tech/a/p4', prev_title: 'P4', next_slug: null, next_title: null,
  rel_slug: null, rel_title: null, rel_description: null, rel_body_head: null, rel_date: null,
  ...extra,
});
test('getPost unknown slug -> null (and no second query)', async () => {
  const db = fakeDb([]);
  assert.equal(await getPost(db, 'nope'), null);
  assert.equal(db.calls.length, 1);
  assert.deepEqual(db.calls[0].params, ['nope']);
});
test('getPost null related row -> related null; prev/next mapped; relatedBy list', async () => {
  const db = fakeDb([postRow()], [row(8), row(7)]);
  const out = await getPost(db, 'tech/a/p5');
  assert.equal(out.related, null);
  assert.deepEqual(out.prev, { slug: 'tech/a/p4', title: 'P4' });
  assert.equal(out.next, null);
  assert.equal(out.post.contentMd, '# body');
  assert.equal(out.post.description, 'd');
  assert.deepEqual(out.relatedBy.map((x) => x.id), [8, 7]);
  assert.deepEqual(db.calls[1].params.slice(0, 1), ['tech/a/p5']);
  assert.equal(bareBody(db.calls[1].text), false);
});
test('getPost: category-less post gets no prev/next; window subquery selects explicit columns', async () => {
  const db = fakeDb([postRow({ category_id: null, prev_slug: 'essays/other', prev_title: 'O', next_slug: 'essays/n', next_title: 'N' })], []);
  const out = await getPost(db, 'essays/x');
  assert.equal(out.prev, null);
  assert.equal(out.next, null);
  const sub = db.calls[0].text.match(/FROM \(([\s\S]*?)\) nb\b/)[1];
  assert.doesNotMatch(sub, /x\.\*/);
  assert.match(sub, /x\.id, x\.category_id, x\.slug, x\.title, x\.created_at/);
});
test('getPost maps related, tags null -> []', async () => {
  const db = fakeDb([postRow({ tags: null, rel_slug: 'essays/x', rel_title: 'X', rel_description: '', rel_body_head: 'hello **w**', rel_date: '2026-02-01' })], []);
  const out = await getPost(db, 'tech/a/p5');
  assert.deepEqual(out.post.tags, []);
  assert.deepEqual(out.related, { slug: 'essays/x', title: 'X', excerpt: 'hello w', date: '2026-02-01', section: 'essays' });
  assert.deepEqual(out.relatedBy, []);
});

const cat = (id, slug, extra = {}) => ({ id, name: slug.split('/').pop(), slug, parent_id: null, depth: 0, post_count: 1, total_post_count: 3, sub_category_count: 1, ...extra });
test('listCategories maps path/section/counts', async () => {
  const out = await listCategories(fakeDb([cat(1, 'tech'), cat(2, 'tech/sec', { parent_id: 1, depth: 1 })]));
  assert.deepEqual(out[0], { id: 1, name: 'tech', path: 'tech', section: 'tech', parentId: null, depth: 0, postCount: 1, totalPostCount: 3, subCategoryCount: 1 });
  assert.equal(out[1].parentId, 1);
});
test('getCategoryPosts unknown -> null; known -> category/children/posts', async () => {
  assert.equal(await getCategoryPosts(fakeDb([]), 'nope'), null);
  const db = fakeDb([cat(1, 'tech')], [cat(2, 'tech/sec', { parent_id: 1 })], [row(1)]);
  const out = await getCategoryPosts(db, 'tech');
  assert.equal(out.category.path, 'tech');
  assert.equal(out.children[0].path, 'tech/sec');
  assert.equal(out.posts.length, 1);
  assert.deepEqual(db.calls[0].params, ['tech']);
  for (const c of db.calls) assert.equal(bareBody(c.text), false);
});

test('listSitemapEntries: slug+date only, fixed ordering, no body', async () => {
  const { listSitemapEntries } = await import('../../functions/_lib/queries.js');
  const db = fakeDb([{ slug: 'a', date: '2026-01-01' }]);
  assert.deepEqual(await listSitemapEntries(db), [{ slug: 'a', date: '2026-01-01' }]);
  assert.match(db.calls[0].text, /to_char\(created_at, 'YYYY-MM-DD'\)/);
  assert.match(db.calls[0].text, /ORDER BY created_at DESC, id DESC/);
  assert.ok(!db.calls[0].text.includes('content_md'));
});
