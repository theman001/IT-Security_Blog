import '../styles/article.css';
import '../styles/post.css';
import { ApiError, getPost, getSectionNav } from '../lib/api.js';
import { escapeHtml as e } from '../lib/escape.js';
import { categoryHref, postHref } from '../lib/urls.js';
import { postLayoutHtml, sectionOfSlug } from '../lib/post-header.js';
import { buildToc, observeToc } from '../components/toc.js';
import { relatedByHtml } from '../components/related-card.js';
import { sectionNavHtml } from '../components/section-nav.js';
import { mountNotFound, notFoundView } from './not-found.js';
import { SECTIONS } from '../content/sections.js';

const TOC_MIN = 3;
const TOC_LABEL = '이 글의 목차';
let cleanups = [];

// Left column (>= 1280px) / collapsible list (below): the section's categories and posts. Filled after first render;
// the empty .post-sidenav column is reserved by CSS (and by the edge prerender) so the body never shifts.
function mountSideNav(root, slug) {
  const side = root.querySelector('.post-sidenav');
  if (!side) return () => {};
  let dead = false;
  const section = sectionOfSlug(slug);
  getSectionNav(section)
    .then((data) => {
      if (dead || !side.isConnected) return;
      const html = sectionNavHtml(data, section, slug);
      side.innerHTML = html;
      root.querySelector('.post-body')?.insertAdjacentHTML('beforebegin', `<details class="post-sidenav-mobile"><summary>${e(SECTIONS[section]?.title ?? section)} 글 둘러보기</summary>${html}</details>`);
      const nav = side.querySelector('.sidenav');
      const cur = nav?.querySelector('[aria-current="page"]');
      if (cur) nav.scrollTop = Math.max(0, cur.offsetTop - nav.clientHeight / 2); // keep the current post in view inside the sticky list
    })
    .catch(() => {}); // the sidebar is optional: the page works without it
  return () => {
    dead = true;
  };
}

const navHtml = ({ prev, next }, slug, essay) => {
  const word = essay ? '사유' : '글';
  const link = (p, rel, label) =>
    p
      ? `<a class="post-nav__${rel}" rel="${rel}" data-link href="${e(postHref(p.slug))}"><span class="post-nav__label">${label}</span><span class="post-nav__title">${e(p.title)}</span></a>`
      : '<span></span>';
  const up = slug.split('/').slice(0, -1).join('/');
  return `<nav class="post-nav" aria-label="이전·다음 ${word}">
  ${link(prev, 'prev', `이전 ${word}`)}
  <a class="post-nav__list" data-link href="${e(up ? categoryHref(up) : '/')}">목록</a>
  ${link(next, 'next', `다음 ${word}`)}
</nav>`;
};

export default {
  async load(params) {
    try {
      // dynamic: markdown/DOMPurify/Prism stay out of the main chunk
      const [data, { renderMarkdown }, { enhanceCodeBlocks }, { hydrateLinkCards }, { enableVideoEmbeds }, { enableImageZoom }] = await Promise.all([
        getPost(params['*']),
        import('../render/markdown.js'),
        import('../render/code-blocks.js'),
        import('../render/link-cards.js'),
        import('../render/video-embeds.js'),
        import('../render/image-zoom.js'),
      ]);
      return { ...data, bodyHtml: renderMarkdown(data.post.contentMd), enhanceCodeBlocks, hydrateLinkCards, enableVideoEmbeds, enableImageZoom };
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return { notFound: true };
      throw err;
    }
  },

  render(data) {
    if (data.notFound) return notFoundView();
    const { post, related, relatedBy } = data;
    const essay = sectionOfSlug(post.slug) === 'essays';
    return {
      title: post.title,
      html: postLayoutHtml(post, {
        related,
        bodyHtml: data.bodyHtml,
        tailHtml: `${essay ? '' : relatedByHtml(relatedBy)}\n${navHtml(data, post.slug, essay)}`,
      }),
    };
  },

  mount(root, data) {
    if (data.notFound) {
      cleanups.push(mountNotFound(root));
      return;
    }
    const article = root.querySelector('.article');
    data.enhanceCodeBlocks(article);
    cleanups.push(data.hydrateLinkCards(article), data.enableVideoEmbeds(article), data.enableImageZoom(article));
    cleanups.push(mountSideNav(root, data.post.slug));

    const bar = root.querySelector('.reading-progress');
    if (bar) {
      let raf = 0;
      const update = () => {
        raf = 0;
        const max = document.documentElement.scrollHeight - innerHeight;
        bar.style.width = `${max > 0 ? Math.min(100, Math.max(0, (scrollY / max) * 100)) : 0}%`;
      };
      const onScroll = () => { raf ||= requestAnimationFrame(update); };
      addEventListener('scroll', onScroll, { passive: true });
      addEventListener('resize', onScroll);
      update();
      cleanups.push(() => {
        removeEventListener('scroll', onScroll);
        removeEventListener('resize', onScroll);
        cancelAnimationFrame(raf);
        bar.remove();
      });
      return; // essays have no table of contents
    }

    const toc = buildToc(article);
    if (toc.count < TOC_MIN) return;
    const body = article.parentElement;
    body.classList.add('post-body--toc');
    // two copies: the <details> shows below 1200px, the sticky column at >= 1200px (CSS hides the other)
    article.insertAdjacentHTML('beforebegin', `<details class="post-toc-mobile"><summary>${TOC_LABEL}</summary>${toc.html}</details>`);
    article.insertAdjacentHTML('afterend', `<aside class="post-toc">${toc.html}</aside>`);
    for (const nav of body.querySelectorAll('nav')) cleanups.push(observeToc(article, nav));
  },

  unmount() {
    cleanups.forEach((fn) => fn());
    cleanups = [];
  },
};
