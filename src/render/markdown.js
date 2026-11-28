import { Marked } from 'marked';
import DOMPurify from 'dompurify';
import { escapeHtml as e } from '../lib/escape.js';
import { parseYouTube } from '../lib/youtube.js';

const FAILED = '<p>Markdown rendering failed.</p>';
// The html profile still passes content-injection vectors: global <style>, style= overlays,
// off-site <form>/<input> phishing, name= DOM clobbering, srcset/poster/media bypassing the
// https-only image rule. Markdown has no use for any of them.
const FORBID_TAGS = ['style', 'form', 'input', 'button', 'textarea', 'select', 'option',
  'video', 'audio', 'source', 'picture', 'track'];
const FORBID_ATTR = ['style', 'name', 'srcset', 'poster'];
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

// ```link fence -> link card. Only `url:` -> title/description come from the page's own metadata, filled in
// later by hydrateLinkCards (src/render/link-cards.js); `title:`/`description:` write them by hand instead.
// url must be http(s) or a site path; anything else leaves the block as a normal code block.
const linkCard = ({ text, lang }) => {
  if (lang?.trim() !== 'link') return false;
  const f = {};
  for (const line of text.split('\n')) {
    const i = line.indexOf(':');
    if (i > 0) f[line.slice(0, i).trim().toLowerCase()] ??= line.slice(i + 1).trim();
  }
  const url = f.url ?? '';
  let host = '';
  if (/^https?:\/\//i.test(url)) {
    try {
      host = new URL(url).hostname;
    } catch {
      return false;
    }
  } else if (!/^\/(?!\/)/.test(url)) return false;
  return `<a class="link-card" href="${e(url)}"${host && !f.title && !f.description ? ' data-preview' : ''}>${host ? `<span class="link-card__host">${e(host)}</span>` : ''}<span class="link-card__title">${e(f.title || host || url)}</span>${f.description ? `<span class="link-card__desc">${e(f.description)}</span>` : ''}</a>\n`;
};

// ```youtube fence (`url:` or a bare url/id on the first line; optional `title:`) -> click-to-play placeholder.
// The iframe is created on click by src/render/video-embeds.js; an invalid url stays a normal code block.
const videoEmbed = ({ text }) => {
  const f = {};
  const lines = text.split('\n');
  for (const line of lines) {
    const i = line.indexOf(':');
    if (i > 0 && /^[a-z]+$/i.test(line.slice(0, i).trim())) f[line.slice(0, i).trim().toLowerCase()] ??= line.slice(i + 1).trim();
  }
  const v = parseYouTube(f.url ?? lines[0]);
  if (!v) return false;
  const label = e(f.title || 'YouTube 영상 재생');
  const href = `https://www.youtube.com/watch?v=${v.id}${v.start ? `&t=${v.start}` : ''}`;
  return `<div class="video-embed" data-video="${v.id}" data-start="${v.start}"><a class="video-embed__play" href="${href}"><span class="video-embed__icon" aria-hidden="true"></span><span class="video-embed__label">${label}</span><span class="video-embed__host">youtube.com</span></a></div>\n`;
};

const fences = new Map([['link', linkCard], ['youtube', videoEmbed]]);
const parser = new Marked({ renderer: { code: (tok) => fences.get(tok.lang?.trim())?.(tok) ?? false } });

/**
 * Markdown -> sanitized HTML string. marked -> DOMPurify (no hooks, so no global state
 * leaks between calls) -> a DOM pass that only ADDS safe attributes, so content can't spoof them.
 */
export function renderMarkdown(src) {
  try {
    const clean = DOMPurify.sanitize(parser.parse(src, { gfm: true, breaks: false }), {
      USE_PROFILES: { html: true },
      FORBID_TAGS,
      FORBID_ATTR,
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
