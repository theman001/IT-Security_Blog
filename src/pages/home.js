import '../styles/home.css';
import { getPosts } from '../lib/api.js';
import { escapeHtml as e } from '../lib/escape.js';
import { SITE, SITE_TAGLINE } from '../lib/site.js';
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

// lead: post | null (none yet) | undefined (request failed)
const leadHtml = (p) =>
  p
    ? `<p class="home-label home-lead__kicker"><span>사유</span><span class="home-lead__def">개념, 구성, 판단, 추리 따위를 행하는 인간의 이성 작용</span></p>
  <h2 class="home-lead__title"><a class="home-lead__link" data-link href="${e(postHref(p.slug))}">${e(p.title)}</a></h2>
  <p class="home-lead__excerpt">${e(p.excerpt)}</p>
  <p class="post-meta"><time datetime="${e(p.date)}">${e(p.date)}</time><span>읽는 시간 ${e(p.readingMinutes)}분</span></p>`
    : notice(p === undefined ? '불러오지 못했습니다.' : '아직 사유 글이 없습니다.');

const recentHtml = (list) =>
  list?.length
    ? `<ul class="home-recent__list">${list
        .map(
          (p) => `<li><p class="post-meta"><time datetime="${e(p.date)}">${e(p.date)}</time><span>${e(p.section)}</span></p>
<a class="post-link" data-link href="${e(postHref(p.slug))}">${e(p.title)}</a></li>`,
        )
        .join('')}</ul>`
    : notice(list ? '아직 글이 없습니다.' : '최근 글을 불러오지 못했습니다.');

const sectionHtml = ([key, label], list, empty = `아직 ${label} 글이 없습니다.`) => `<section class="home-section home-section--${key}" data-section="${key}" aria-labelledby="home-${key}">
  <header class="home-section__head">
    <h2 id="home-${key}" class="home-label">${label}</h2>
    <a class="home-more" data-link aria-label="${label} 더 보기" href="${e(categoryHref(key))}">더 보기 →</a>
  </header>
  ${
    list?.length
      ? `<div class="home-section__items">${list.map(key === 'essays' ? pullQuoteHtml : postCardHtml).join('')}</div>`
      : notice(list ? empty : `${label} 글을 불러오지 못했습니다.`)
  }
</section>`;

export default {
  async load() {
    // one essays request feeds both the lead (first) and the Essays section (next 3)
    const [essays, recent, tech, trends] = await Promise.all([
      items(getPosts({ section: 'essays', limit: 4 })),
      items(getPosts({ limit: 8 })),
      items(getPosts({ section: 'tech', limit: 3 })),
      items(getPosts({ section: 'trends', limit: 3 })),
    ]);
    const first = essays ? (essays[0] ?? null) : undefined;
    return {
      lead: first,
      recent: recent?.filter((p) => p.slug !== first?.slug).slice(0, 5) ?? null,
      sections: [tech, trends, essays && essays.slice(1)],
    };
  },
  render({ lead, recent, sections }) {
    return {
      title: '',
      html: `<h1 class="home-sr">${e(SITE)}: ${e(SITE_TAGLINE)}</h1>
<div class="home-top">
  <div class="home-lead">${leadHtml(lead)}</div>
  <aside class="home-recent" aria-labelledby="home-recent">
    <h2 id="home-recent" class="home-label">최근 글</h2>
    ${recentHtml(recent)}
  </aside>
</div>
<hr class="home-rule" />
<div class="home-sections">${SECTIONS.map((s, i) => sectionHtml(s, sections[i], s[0] === 'essays' && lead ? '아직 다른 사유 글이 없습니다.' : undefined)).join('')}</div>`,
    };
  },
};
