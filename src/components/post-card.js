import '../styles/cards.css';
import { escapeHtml as e } from '../lib/escape.js';
import { postHref } from '../lib/urls.js';

const time = (date) => `<time class="post-date" datetime="${e(date)}">${e(date)}</time>`;
const cat = (p) => (p.categoryPath ? `<span class="post-cat">${e(p.categoryPath)}</span>` : '');
const title = (p, cls) => `<a class="${cls}" data-link href="${e(postHref(p.slug))}">${e(p.title)}</a>`;

/** Card: top rule, date + category path, title link, 2-line excerpt. */
export const postCardHtml = (p) => `<article class="post-card">
  <p class="post-meta">${time(p.date)}${cat(p)}</p>
  <h3 class="post-card__title">${title(p, 'post-link')}</h3>
  <p class="post-excerpt">${e(p.excerpt)}</p>
</article>`;

/** List row: date · category, title link, excerpt, `#tag` spans (tags may be []). */
export const postRowHtml = (p) => `<article class="post-row">
  <p class="post-meta">${time(p.date)}${cat(p)}</p>
  <h3 class="post-row__title">${title(p, 'post-link')}</h3>
  <p class="post-excerpt">${e(p.excerpt)}</p>
  ${p.tags?.length ? `<p class="post-row__tags">${p.tags.map((t) => `<span class="post-row__tag">#${e(t)}</span>`).join(' ')}</p>` : ''}
</article>`;

/** Essay: the excerpt as a large serif quote, small title link and date below. */
export const pullQuoteHtml = (p) => `<figure class="pull-quote">
  <blockquote class="pull-quote__text"><p>${e(p.excerpt)}</p></blockquote>
  <figcaption class="pull-quote__by">${title(p, 'post-link')}${time(p.date)}</figcaption>
</figure>`;
