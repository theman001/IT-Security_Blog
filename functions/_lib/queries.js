import { encodeCursor } from './cursor.js';
import { makeExcerpt } from './excerpt.js';
import { sectionOf } from './slug.js';

// Body is never selected in lists: only a 600-char head, and only when description is empty.
const SUMMARY_COLS = `r.id, r.title, r.slug, to_char(r.created_at, 'YYYY-MM-DD') AS date, r.description,
  CASE WHEN coalesce(btrim(r.description), '') = '' THEN left(r.content_md, 600) END AS body_head,
  GREATEST(1, CEIL(length(r.content_md) / 500.0))::int AS reading_minutes,
  r.category_id, c.name AS category_name, c.slug AS category_path, r.tags, r.author_type`;
const SUMMARY_FROM = `FROM reports r LEFT JOIN categories c ON c.id = r.category_id`;

const toSummary = (r) => ({
  id: r.id,
  title: r.title,
  slug: r.slug,
  date: r.date,
  section: sectionOf(r.slug),
  readingMinutes: r.reading_minutes,
  excerpt: makeExcerpt(r.description, r.body_head),
  categoryId: r.category_id ?? null,
  categoryName: r.category_name ?? null,
  categoryPath: r.category_path ?? null,
  tags: r.tags ?? [],
  authorType: r.author_type ?? null,
});

export async function listPosts(db, { section, category, limit, cursor }) {
  const params = [];
  const where = [];
  const bind = (v) => (params.push(v), `$${params.length}`);
  if (section) where.push(`split_part(r.slug, '/', 1) = ${bind(section)}`);
  if (category) {
    const p = bind(category); // the category itself or any descendant, exact path match
    where.push(`(c.slug = ${p} OR left(c.slug, length(${p}) + 1) = ${p} || '/')`);
  }
  if (cursor) where.push(`(r.created_at, r.id) < (${bind(cursor.date)}::timestamp, ${bind(cursor.id)}::int)`);
  const text = `SELECT ${SUMMARY_COLS} ${SUMMARY_FROM}
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY r.created_at DESC, r.id DESC LIMIT ${bind(limit + 1)}::int`;
  const rows = await db.query(text, params);
  const items = rows.slice(0, limit).map(toSummary);
  const last = items[items.length - 1];
  return { items, nextCursor: rows.length > limit ? encodeCursor({ date: last.date, id: last.id }) : null };
}

export async function getPost(db, slug) {
  // prev/next: same category, created_at ASC, id ASC (window computed before the slug filter).
  const rows = await db.query(
    `SELECT ${SUMMARY_COLS}, r.content_md,
       r.prev_slug, r.prev_title, r.next_slug, r.next_title,
       rel.slug AS rel_slug, rel.title AS rel_title, rel.description AS rel_description,
       CASE WHEN coalesce(btrim(rel.description), '') = '' THEN left(rel.content_md, 600) END AS rel_body_head,
       to_char(rel.created_at, 'YYYY-MM-DD') AS rel_date
     FROM (
       SELECT x.*,
         LAG(x.slug) OVER w AS prev_slug, LAG(x.title) OVER w AS prev_title,
         LEAD(x.slug) OVER w AS next_slug, LEAD(x.title) OVER w AS next_title
       FROM reports x WINDOW w AS (PARTITION BY x.category_id ORDER BY x.created_at, x.id)
     ) r
     LEFT JOIN categories c ON c.id = r.category_id
     LEFT JOIN reports rel ON rel.slug = r.related_slug
     WHERE r.slug = $1`,
    [slug],
  );
  const r = rows[0];
  if (!r) return null;
  const relatedBy = await db.query(
    `SELECT ${SUMMARY_COLS} ${SUMMARY_FROM} WHERE r.related_slug = $1 ORDER BY r.created_at DESC, r.id DESC LIMIT 10`,
    [slug],
  );
  return {
    post: { ...toSummary(r), contentMd: r.content_md ?? '', description: r.description ?? '' },
    prev: r.prev_slug ? { slug: r.prev_slug, title: r.prev_title } : null,
    next: r.next_slug ? { slug: r.next_slug, title: r.next_title } : null,
    related: r.rel_slug
      ? { slug: r.rel_slug, title: r.rel_title, excerpt: makeExcerpt(r.rel_description, r.rel_body_head), date: r.rel_date, section: sectionOf(r.rel_slug) }
      : null,
    relatedBy: relatedBy.map(toSummary),
  };
}

const CATEGORY_SELECT = `SELECT c.id, c.name, c.slug, c.parent_id, c.depth,
  (SELECT count(*) FROM reports r WHERE r.category_id = c.id)::int AS post_count,
  (SELECT count(*) FROM reports r JOIN categories d ON d.id = r.category_id
     WHERE d.slug = c.slug OR left(d.slug, length(c.slug) + 1) = c.slug || '/')::int AS total_post_count,
  (SELECT count(*) FROM categories k WHERE k.parent_id = c.id)::int AS sub_category_count
  FROM categories c`;

const toCategory = (c) => ({
  id: c.id,
  name: c.name,
  path: c.slug,
  section: sectionOf(c.slug),
  parentId: c.parent_id ?? null,
  depth: c.depth,
  postCount: c.post_count,
  totalPostCount: c.total_post_count,
  subCategoryCount: c.sub_category_count,
});

export async function listCategories(db) {
  return (await db.query(`${CATEGORY_SELECT} ORDER BY c.slug`, [])).map(toCategory);
}

export async function getCategoryPosts(db, path) {
  const [cat] = await db.query(`${CATEGORY_SELECT} WHERE c.slug = $1`, [path]);
  if (!cat) return null;
  const [children, posts] = await Promise.all([
    db.query(`${CATEGORY_SELECT} WHERE c.parent_id = $1 ORDER BY c.slug`, [cat.id]),
    db.query(`SELECT ${SUMMARY_COLS} ${SUMMARY_FROM} WHERE r.category_id = $1 ORDER BY r.created_at, r.id`, [cat.id]),
  ]);
  return { category: toCategory(cat), children: children.map(toCategory), posts: posts.map(toSummary) };
}
