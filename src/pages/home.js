import '../styles/home.css';
import { getPosts } from '../lib/api.js';
import { escapeHtml as e } from '../lib/escape.js';
import { categoryHref, postHref } from '../lib/urls.js';
import { postCardHtml, pullQuoteHtml } from '../components/post-card.js';

const SECTIONS = [
  ['tech', 'Tech'],
  ['trends', 'Trends'],
  ['essays', 'Essays'],
];

// null = request failed (shown as a notice, never fails the page)
const items = (p) => p.then((r) => r.items, () => null);
const notice = (text) => `<p class="home-notice">${e(text)}</p>`;

const leadHtml = (p) =>
  p
    ? `<p class="home-label">대표 사유</p>
  <h2 class="home-lead__title"><a class="home-lead__link" data-link href="${e(postHref(p.slug))}">${e(p.title)}</a></h2>
  <p class="home-lead__excerpt">${e(p.excerpt)}</p>
  <p class="post-meta"><time datetime="${e(p.date)}">${e(p.date)}</time><span>읽는 시간 ${e(p.readingMinutes)}분</span></p>`
    : notice('아직 사유 글이 없습니다.');

const recentHtml = (list) =>
  list?.length
    ? `<ul class="home-recent__list">${list
        .map(
          (p) => `<li><p class="post-meta"><time datetime="${e(p.date)}">${e(p.date)}</time><span>${e(p.section)}</span></p>
<a class="post-link" data-link href="${e(postHref(p.slug))}">${e(p.title)}</a></li>`,
        )
        .join('')}</ul>`
    : notice(list ? '아직 글이 없습니다.' : '최근 글을 불러오지 못했습니다.');

const sectionHtml = ([key, label], list) => `<section class="home-section home-section--${key}" data-section="${key}" aria-labelledby="home-${key}">
  <header class="home-section__head">
    <h2 id="home-${key}" class="home-label">${label}</h2>
    <a class="home-more" data-link href="${e(categoryHref(key))}">더 보기 →</a>
  </header>
  ${
    list?.length
      ? `<div class="home-section__items">${list.map(key === 'essays' ? pullQuoteHtml : postCardHtml).join('')}</div>`
      : notice(list ? `아직 ${label} 글이 없습니다.` : `${label} 글을 불러오지 못했습니다.`)
  }
</section>`;

export default {
  async load() {
    const [lead, recent, ...sections] = await Promise.all([
      items(getPosts({ section: 'essays', limit: 1 })),
      items(getPosts({ limit: 8 })),
      ...SECTIONS.map(([key]) => items(getPosts({ section: key, limit: 3 }))),
    ]);
    const first = lead?.[0] ?? null;
    return { lead: first, recent: recent?.filter((p) => p.slug !== first?.slug) ?? null, sections };
  },
  render({ lead, recent, sections }) {
    return {
      title: '',
      html: `<h1 class="home-sr">IT Security Blog</h1>
<div class="home-top">
  <div class="home-lead">${leadHtml(lead)}</div>
  <aside class="home-recent" aria-labelledby="home-recent">
    <h2 id="home-recent" class="home-label">최근 글</h2>
    ${recentHtml(recent)}
  </aside>
</div>
<hr class="home-rule" />
<div class="home-sections">${SECTIONS.map((s, i) => sectionHtml(s, sections[i])).join('')}</div>`,
    };
  },
};
