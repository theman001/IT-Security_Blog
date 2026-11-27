import { escapeHtml } from '../lib/escape.js';

/**
 * Build the table of contents from the h2/h3 (with ids) inside `root`.
 * Returns {html, count}. The CALLER shows the TOC only when count >= 3
 * (fewer headings don't need navigation); buildToc itself never hides anything.
 */
export function buildToc(root) {
  const heads = [...root.querySelectorAll('h2[id], h3[id]')];
  const items = heads
    .map((h) => {
      const cls = h.tagName === 'H3' ? ' class="toc-h3"' : '';
      return `<li${cls}><a href="#${escapeHtml(h.id)}">${escapeHtml(h.textContent.trim())}</a></li>`;
    })
    .join('');
  return { html: `<nav aria-label="이 글의 목차"><ol>${items}</ol></nav>`, count: heads.length };
}

/**
 * Mark the heading currently being read with aria-current="true" on its TOC link.
 * Returns a cleanup function (call it on unmount).
 */
export function observeToc(rootEl, navEl) {
  const heads = [...rootEl.querySelectorAll('h2[id], h3[id]')];
  const links = new Map(heads.map((h) => [h, navEl.querySelector(`a[href="#${CSS.escape(h.id)}"]`)]));
  const visible = new Set();
  const mark = () => {
    // current = first visible heading in document order, else keep the previous one
    const cur = heads.find((h) => visible.has(h));
    if (!cur) return;
    links.forEach((a, h) => {
      if (!a) return;
      if (h === cur) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
  };
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) (e.isIntersecting ? visible.add(e.target) : visible.delete(e.target));
      mark();
    },
    { rootMargin: '0px 0px -70% 0px' }, // active band = top 30% of the viewport
  );
  heads.forEach((h) => io.observe(h));
  return () => io.disconnect();
}
