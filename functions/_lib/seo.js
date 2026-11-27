// Pure SEO builders (no Workers globals): head tags, sitemap, RSS.
export const SITE = 'IT Security Blog';
export const DEFAULT_DESCRIPTION = '보안 취약점 분석, 보안 동향, 그리고 보안을 바라보는 생각을 기록하는 IT 보안 블로그.';

const MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeText = (s) => String(s ?? '').replace(/[&<>]/g, (c) => MAP[c]);
export const escapeAttr = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => MAP[c]);
export const xmlEscape = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (c === "'" ? '&apos;' : MAP[c]));

export const encodePath = (path) => String(path).split('/').map(encodeURIComponent).join('/');
const flat = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const abs = (origin, path) => origin + (path === '/' ? '/' : encodePath(path));

export function siteOrigin(env, request) {
  const v = String(env?.SITE_URL ?? '').trim().replace(/\/+$/, '');
  return v || new URL(request.url).origin;
}

export function metaTags(input, origin) {
  const p = input.post ?? input; // accepts getPost() output or its .post
  const title = `${p.title} - ${SITE}`;
  const description = flat(p.description) || flat(p.excerpt);
  const url = origin + '/posts/' + encodePath(p.slug);
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: p.title,
    datePublished: p.date,
    dateModified: p.date,
    description,
    url,
    mainEntityOfPage: url,
    author: { '@type': 'Person', name: SITE }, // author is not stored
    keywords: (p.tags ?? []).join(', '),
    articleSection: p.categoryName ?? p.section,
  }).replace(/</g, '\\u003c');
  return {
    title,
    description,
    canonical: url,
    og: {
      'og:type': 'article',
      'og:title': title,
      'og:description': description,
      'og:url': url,
      'og:site_name': SITE,
      'article:published_time': p.date,
    },
    twitter: { 'twitter:card': 'summary', 'twitter:title': title, 'twitter:description': description },
    jsonLd,
  };
}

export function pageMeta({ title, description, path }, origin) {
  const full = path === '/' ? SITE : `${title} - ${SITE}`;
  const url = abs(origin, path);
  return {
    title: full,
    description,
    canonical: url,
    og: { 'og:type': 'website', 'og:title': full, 'og:description': description, 'og:url': url, 'og:site_name': SITE },
    twitter: { 'twitter:card': 'summary', 'twitter:title': full, 'twitter:description': description },
    jsonLd: '',
  };
}

export function headTagsHtml(m) {
  const t = [`<title>${escapeText(m.title)}</title>`, `<meta name="description" content="${escapeAttr(m.description)}">`, `<link rel="canonical" href="${escapeAttr(m.canonical)}">`];
  for (const [k, v] of Object.entries(m.og)) t.push(`<meta property="${escapeAttr(k)}" content="${escapeAttr(v)}">`);
  for (const [k, v] of Object.entries(m.twitter)) t.push(`<meta name="${escapeAttr(k)}" content="${escapeAttr(v)}">`);
  if (m.jsonLd) t.push(`<script type="application/ld+json">${m.jsonLd.replace(/</g, '\\u003c')}</script>`);
  return t.join('\n');
}

// entries: [{path: '/posts/a b', date?: 'YYYY-MM-DD'}] with decoded paths.
export function buildSitemap(entries, origin) {
  const urls = entries.slice(0, 50000).map((e) => // sitemap protocol limit per file
    `<url><loc>${xmlEscape(abs(origin, e.path))}</loc>${e.date ? `<lastmod>${xmlEscape(e.date)}</lastmod>` : ''}</url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

// items: post summaries {title, slug, date, excerpt}.
export function buildRss(items, origin) {
  const rows = items.map((i) => {
    const link = xmlEscape(origin + '/posts/' + encodePath(i.slug));
    return `<item><title>${xmlEscape(i.title)}</title><link>${link}</link><guid isPermaLink="true">${link}</guid>` +
      `<pubDate>${new Date(i.date + 'T00:00:00+09:00').toUTCString()}</pubDate><description>${xmlEscape(i.excerpt)}</description></item>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>${xmlEscape(SITE)}</title><link>${xmlEscape(origin + '/')}</link>` +
    `<description>${xmlEscape(DEFAULT_DESCRIPTION)}</description><language>ko</language>\n${rows.join('\n')}\n</channel></rss>\n`;
}
