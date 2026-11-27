import { marked } from 'marked';
import DOMPurify from 'dompurify';

const FAILED = '<p>Markdown rendering failed.</p>';
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/**
 * Markdown -> sanitized HTML string. marked -> DOMPurify (no hooks, so no global state
 * leaks between calls) -> a DOM pass that only ADDS safe attributes, so content can't spoof them.
 */
export function renderMarkdown(md) {
  try {
    const clean = DOMPurify.sanitize(marked.parse(md, { gfm: true, breaks: false }), {
      USE_PROFILES: { html: true },
    });
    const tpl = document.createElement('template'); // inert: nothing loads or runs
    tpl.innerHTML = clean;
    const root = tpl.content;

    // Content-supplied ids could spoof/clobber page elements: drop them all, then assign ours.
    // (marked emits no heading ids, so this only affects raw HTML inside the markdown.)
    root.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
    root.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach((h, i) => (h.id = `toc-heading-${i}`));

    root.querySelectorAll('table').forEach((t) => {
      const wrap = document.createElement('div');
      wrap.className = 'table-wrap';
      t.replaceWith(wrap);
      wrap.append(t);
    });

    root.querySelectorAll('a[href]').forEach((a) => {
      const href = a.getAttribute('href');
      if (!/^(?:https?:)?\/\//i.test(href)) return; // relative / mailto / #hash untouched
      try {
        if (new URL(href, location.href).origin === location.origin) return;
      } catch {
        return;
      }
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    });

    root.querySelectorAll('img').forEach((img) => {
      const src = img.getAttribute('src') ?? '';
      // relative or https only (asset.taeuk.site is https); drops data:, http:, anything else
      if (HAS_SCHEME.test(src) && !/^https:/i.test(src)) return img.remove();
      img.loading = 'lazy';
      img.decoding = 'async';
    });

    const out = document.createElement('div');
    out.append(root);
    return out.innerHTML;
  } catch {
    return FAILED;
  }
}
