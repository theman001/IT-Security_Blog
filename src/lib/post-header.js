// Post markup shared by the SPA (src/pages/post.js) and the edge prerender
// (functions/posts/[[slug]].js). Pure: no DOM, no CSS, no browser globals. Every field is escaped.
import { escapeHtml as e } from './escape.js';
import { categoryHref } from './urls.js';
import { relatedCardHtml } from '../components/related-card.js';

export const sectionOfSlug = (slug) => String(slug ?? '').split('/')[0];

// "tech/security/x" -> ["tech", "tech/security"]; each prefix is a category link
const crumbHtml = (path) => {
  const parts = String(path ?? '').split('/').filter(Boolean);
  if (!parts.length) return '';
  const links = parts.map((p, i) => `<a data-link href="${e(categoryHref(parts.slice(0, i + 1).join('/')))}">${e(p)}</a>`);
  return `<p class="post-crumb">${links.join('<span class="post-crumb__sep" aria-hidden="true"> / </span>')}</p>`;
};

/** `<header class="post-head">`: crumb, h1, meta line, tags, tech description lead. */
export function postHeaderHtml(post, { section }) {
  const essay = section === 'essays';
  const meta = `<p class="post-meta"><time datetime="${e(post.date)}">${e(post.date)}</time><span>${e(post.readingMinutes)}분</span></p>`;
  const tags = post.tags?.length ? `<p class="post-tags">${post.tags.map((t) => `<span class="post-tag">#${e(t)}</span>`).join(' ')}</p>` : '';
  return `<header class="post-head">
  ${crumbHtml(post.categoryPath)}
  <h1 class="post-title">${e(post.title)}</h1>
  ${meta}
  ${tags}
  ${!essay && post.description ? `<p class="post-lead">${e(post.description)}</p>` : ''}
</header>`;
}

/**
 * The whole post layout. The client passes the rendered body and the trailing sections;
 * the edge passes neither (empty article) so the header is in the first HTML.
 */
export function postLayoutHtml(post, { related, bodyHtml = '', tailHtml = '' } = {}) {
  const section = sectionOfSlug(post.slug);
  const essay = section === 'essays';
  return `<div class="post post--${essay ? 'essay' : 'tech'}">
${essay ? '<div class="reading-progress" aria-hidden="true"></div>' : '<div class="post-sidenav"></div>'}
${essay && related ? relatedCardHtml(related, '이 생각의 계기가 된 글') : ''}
${postHeaderHtml(post, { section })}
<div class="post-body">
  <article class="article${essay ? ' essay' : ''}">${bodyHtml}</article>
</div>
${tailHtml}
</div>`;
}
