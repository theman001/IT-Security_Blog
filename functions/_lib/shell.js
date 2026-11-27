import { escapeAttr } from './seo.js';

const CACHE = {
  ok: 'public, max-age=0, s-maxage=600, stale-while-revalidate=86400',
  notFound: 'public, max-age=0, s-maxage=60',
  none: 'no-store',
};
// Default <head> tags the shell ships with; removed when a page supplies its own.
const REPLACED = ['title', 'meta[name="description"]', 'link[rel="canonical"]', 'meta[property^="og:"]', 'meta[name^="twitter:"]'];

// '/' not '/index.html': Pages 308-redirects the latter.
export async function fetchShell(env, request) {
  const res = await env.ASSETS.fetch(new Request(new URL('/', request.url)));
  if (!res.ok) throw new Error('shell unavailable');
  return res;
}

export function headExtras(env, { noindex } = {}) {
  const naver = String(env?.NAVER_SITE_VERIFICATION ?? '').trim();
  return (noindex ? '<meta name="robots" content="noindex">' : '') +
    (naver ? `<meta name="naver-site-verification" content="${escapeAttr(naver)}">` : '');
}

// mainHtml/headTags must already be escaped by the caller (seo.js builders, post-header.js).
// HTMLRewriter (Workers global) is injectable for tests; everything else is plain.
export async function renderShell(env, request, { status = 200, headTags = '', noindex = false, cache, mainHtml } = {}, HR = globalThis.HTMLRewriter) {
  const shell = await fetchShell(env, request);
  const res = new Response(shell.body, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': CACHE[cache ?? (status === 200 ? 'ok' : 'notFound')] },
  });
  const inject = headTags + headExtras(env, { noindex });
  const rw = new HR();
  if (headTags) for (const sel of REPLACED) rw.on(sel, { element: (el) => el.remove() });
  rw.on('head', { element: (el) => el.onEndTag((end) => end.before(inject, { html: true })) });
  // First-paint content (LCP + crawlers); the SPA replaces #main once its data has loaded.
  if (mainHtml) rw.on('main#main', { element: (el) => el.setInnerContent(mainHtml, { html: true }) });
  return rw.transform(res);
}
