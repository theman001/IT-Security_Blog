import '../styles/article.css';
import '../styles/post.css';
import { ApiError, getPost } from '../lib/api.js';
import { escapeHtml as e } from '../lib/escape.js';
import { categoryHref, postHref } from '../lib/urls.js';
import { buildToc, observeToc } from '../components/toc.js';
import { relatedByHtml, relatedCardHtml } from '../components/related-card.js';
import { mountNotFound, notFoundView } from './not-found.js';

const TOC_MIN = 3;
const TOC_LABEL = '이 글의 목차';
let cleanups = [];

// "tech/security/x" -> ["tech", "tech/security"]; each prefix is a category link
const crumbHtml = (path) => {
  const parts = String(path ?? '').split('/').filter(Boolean);
  if (!parts.length) return '';
  const links = parts.map((p, i) => `<a data-link href="${e(categoryHref(parts.slice(0, i + 1).join('/')))}">${e(p)}</a>`);
  return `<p class="post-crumb">${links.join('<span class="post-crumb__sep" aria-hidden="true"> / </span>')}</p>`;
};

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
      const [data, { renderMarkdown }, { enhanceCodeBlocks }] = await Promise.all([
        getPost(params['*']),
        import('../render/markdown.js'),
        import('../render/code-blocks.js'),
      ]);
      return { ...data, bodyHtml: renderMarkdown(data.post.contentMd), enhanceCodeBlocks };
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return { notFound: true };
      throw err;
    }
  },

  render(data) {
    if (data.notFound) return notFoundView();
    const { post, related, relatedBy } = data;
    const essay = post.slug.split('/')[0] === 'essays';
    const meta = `<p class="post-meta"><time datetime="${e(post.date)}">${e(post.date)}</time><span>${e(post.readingMinutes)}분</span></p>`;
    const tags = post.tags?.length ? `<p class="post-tags">${post.tags.map((t) => `<span class="post-tag">#${e(t)}</span>`).join(' ')}</p>` : '';
    return {
      title: post.title,
      html: `<div class="post post--${essay ? 'essay' : 'tech'}">
${essay ? '<div class="reading-progress" aria-hidden="true"></div>' : ''}
${essay && related ? relatedCardHtml(related, '이 생각의 계기가 된 글') : ''}
<header class="post-head">
  ${crumbHtml(post.categoryPath)}
  <h1 class="post-title">${e(post.title)}</h1>
  ${meta}
  ${tags}
  ${!essay && post.description ? `<p class="post-lead">${e(post.description)}</p>` : ''}
</header>
<div class="post-body">
  <article class="article${essay ? ' essay' : ''}">${data.bodyHtml}</article>
</div>
${essay ? '' : relatedByHtml(relatedBy)}
${navHtml(data, post.slug, essay)}
</div>`,
    };
  },

  mount(root, data) {
    if (data.notFound) {
      cleanups.push(mountNotFound(root));
      return;
    }
    const article = root.querySelector('.article');
    data.enhanceCodeBlocks(article);

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
