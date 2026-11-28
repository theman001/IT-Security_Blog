import { fail } from './http.js';
import { decodeSlug } from './slug.js';
import { getPost, listCategories, listPosts, listSitemapEntries } from './queries.js';
import { renderShell } from './shell.js';
import { postLayoutHtml } from '../../src/lib/post-header.js';
import { SECTIONS } from './sections.js';
import { DEFAULT_DESCRIPTION, SITE, buildRss, buildSitemap, headTagsHtml, metaTags, pageMeta, siteOrigin } from './seo.js';

const ok = (body, type, status = 200) =>
  new Response(body, { status, headers: { 'Content-Type': type, 'Cache-Control': 'public, max-age=60, s-maxage=600, stale-while-revalidate=60' } });
const NOT_ALLOWED = () => fail(405, 'method_not_allowed', 'Only GET is supported', { headers: { Allow: 'GET, HEAD' } });
const INTERNAL = () => fail(500, 'internal', 'Internal error', { cache: 'none' });
const asParts = (p) => (p == null ? [] : Array.isArray(p) ? p : [p]);
const notFound = (ctx, deps) => renderShell(ctx.env, ctx.request, { status: 404, noindex: true }, deps.HTMLRewriter);
const page = (ctx, deps, meta, extra) =>
  renderShell(ctx.env, ctx.request, { headTags: headTagsHtml(meta), mainHtml: extra?.mainHtml, noindex: extra?.noindex }, deps.HTMLRewriter);

// GET/HEAD only; any thrown error -> opaque 500 (HTML shell for pages, JSON for feeds), never the message.
async function guarded(ctx, deps, run, onError) {
  if (!['GET', 'HEAD'].includes(ctx.request.method)) return NOT_ALLOWED();
  try {
    return await run(new URL(ctx.request.url));
  } catch (e) {
    console.error('edge error', e?.name, e?.code); // never log message (may hold connection info)
    try {
      return await onError();
    } catch {
      return INTERNAL();
    }
  }
}
const shell500 = (ctx, deps) => () => renderShell(ctx.env, ctx.request, { status: 500, noindex: true, cache: 'none' }, deps.HTMLRewriter);

// Same payload as /api/posts/<slug>, so the SPA can skip that request. `<` escaped: no </script> breakout.
const inlineData = (out) => `<script type="application/json" id="post-data">${JSON.stringify(out).replace(/</g, '\\u003c')}</script>`;

export const handlePost = (ctx, deps) =>
  guarded(ctx, deps, async () => {
    const slug = decodeSlug(asParts(ctx.params?.slug));
    if (!slug) return notFound(ctx, deps);
    const out = await getPost(deps.getDb(ctx.env), slug);
    if (!out) return notFound(ctx, deps);
    return page(ctx, deps, metaTags(out, siteOrigin(ctx.env, ctx.request)), { mainHtml: postLayoutHtml(out.post, { related: out.related }) + inlineData(out) });
  }, shell500(ctx, deps));

// Static-file lookups (served by Pages, never edge-cached by us); `/categories/*` may contain dots.
export const isAssetPath = (raw) =>
  raw.startsWith('/assets/') || (!raw.startsWith('/categories/') && /\.[A-Za-z0-9]{1,8}$/.test(raw.slice(raw.lastIndexOf('/') + 1)));

// Trailing slashes: `/about/` == `/about` (200, canonical without slash); the SPA router ignores them too.
export const handleCatchAll = (ctx, deps) =>
  guarded(ctx, deps, async (url) => {
    const raw = url.pathname;
    if (raw === '/api' || raw.startsWith('/api/')) return fail(404, 'not_found', 'Not found');
    if (isAssetPath(raw)) {
      const res = await ctx.env.ASSETS.fetch(ctx.request);
      // Pages falls back to index.html (200) for missing files: that is a soft 404.
      return res.status === 200 && /text\/html/i.test(res.headers.get('content-type') ?? '') ? notFound(ctx, deps) : res;
    }
    const path = raw.length > 1 ? raw.replace(/\/+$/, '') : raw;
    const origin = siteOrigin(ctx.env, ctx.request);
    if (path === '/') return page(ctx, deps, pageMeta({ title: '', description: DEFAULT_DESCRIPTION, path }, origin));
    if (path === '/about') return page(ctx, deps, pageMeta({ title: 'About', description: `${SITE} 소개: 기술을 읽고, 생각을 적는 블로그와 운영자.`, path }, origin));
    if (path === '/privacy') return page(ctx, deps, pageMeta({ title: '개인정보처리방침', description: `${SITE} 개인정보처리방침.`, path }, origin));
    if (path === '/contact') return page(ctx, deps, pageMeta({ title: '문의하기', description: `${SITE} 문의 안내.`, path }, origin));
    const key = path.slice(1);
    if (Object.hasOwn(SECTIONS, key)) return page(ctx, deps, pageMeta({ title: SECTIONS[key].title, description: SECTIONS[key].description, path }, origin));
    if (path.startsWith('/categories/')) {
      const cat = decodeSlug(path.slice('/categories/'.length).split('/'));
      if (!cat || !Object.hasOwn(SECTIONS, cat.split('/')[0])) return notFound(ctx, deps); // the SPA only lists section-rooted categories
      // The section root is the section list page: one URL per page (permanent, so the duplicate leaves the index).
      if (Object.hasOwn(SECTIONS, cat)) return new Response(null, { status: 301, headers: { Location: `/${cat}`, 'Cache-Control': 'public, max-age=0, s-maxage=600' } });
      const hit = (await listCategories(deps.getDb(ctx.env))).find((c) => c.path === cat);
      if (!hit) return notFound(ctx, deps);
      return page(ctx, deps, pageMeta({ title: hit.name, description: DEFAULT_DESCRIPTION, path: `/categories/${cat}` }, origin));
    }
    return notFound(ctx, deps);
  }, shell500(ctx, deps));

export const handleSitemap = (ctx, deps) =>
  guarded(ctx, deps, async () => {
    const db = deps.getDb(ctx.env);
    const [cats, posts] = await Promise.all([listCategories(db), listSitemapEntries(db)]);
    const entries = [
      { path: '/' }, { path: '/about' }, { path: '/privacy' }, { path: '/contact' },
      ...Object.keys(SECTIONS).map((k) => ({ path: `/${k}` })),
      // deeper section-rooted categories only (what the SPA can render); roots are the sections above
      ...cats.filter((c) => c.path.includes('/') && Object.hasOwn(SECTIONS, c.path.split('/')[0])).map((c) => ({ path: `/categories/${c.path}` })),
      ...posts.map((p) => ({ path: `/posts/${p.slug}`, date: p.date })),
    ];
    return ok(buildSitemap(entries, siteOrigin(ctx.env, ctx.request)), 'application/xml; charset=utf-8');
  }, async () => INTERNAL());

export const handleRss = (ctx, deps) =>
  guarded(ctx, deps, async () => {
    const { items } = await listPosts(deps.getDb(ctx.env), { limit: 20 });
    return ok(buildRss(items, siteOrigin(ctx.env, ctx.request)), 'application/rss+xml; charset=utf-8');
  }, async () => INTERNAL());

export const handleRobots = (ctx) => {
  if (!['GET', 'HEAD'].includes(ctx.request.method)) return NOT_ALLOWED();
  return ok(`User-agent: *\nAllow: /\n\nSitemap: ${siteOrigin(ctx.env, ctx.request)}/sitemap.xml\n`, 'text/plain; charset=utf-8');
};
