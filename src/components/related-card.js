import { escapeHtml as e } from '../lib/escape.js';
import { postHref } from '../lib/urls.js';

/** Bordered card: accent label (omitted when empty), title link, 2-line excerpt, date. */
export const relatedCardHtml = (r, label) => `<article class="related-card">
  ${label ? `<p class="related-card__label">${e(label)}</p>` : ''}
  <h3 class="related-card__title"><a data-link href="${e(postHref(r.slug))}">${e(r.title)}</a></h3>
  <p class="related-card__excerpt">${e(r.excerpt)}</p>
  <time class="related-card__date" datetime="${e(r.date)}">${e(r.date)}</time>
</article>`;

/** "이 글에서 이어진 사유" box with one card per post; empty list -> ''. */
export const relatedByHtml = (list) =>
  list?.length
    ? `<section class="related-by" aria-labelledby="related-by-h">
  <h2 id="related-by-h" class="related-card__label">이 글에서 이어진 사유</h2>
  ${list.map((r) => relatedCardHtml(r)).join('')}
</section>`
    : '';
