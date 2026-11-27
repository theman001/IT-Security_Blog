// History API router.
//
// Page = { load?(params, query) -> data, render(data) -> { title, html }, mount?(root, data), unmount?() }
// `html` is a trusted string (pages build it with escapeHtml); the router does not sanitize it.
// Patterns: `/p/:id` (decoded param) and a trailing `*` splat. The splat is ONE string of the
// remaining decoded segments joined with '/' (params['*'] === 'a/b/c'); it needs >= 1 segment.
// `route('*', page)` registers the not-found page. Routes match in registration order.
import { escapeHtml } from './lib/escape.js';

const SITE = 'IT Security Blog';
const routes = [];
let notFoundPage = {
  render: () => ({
    title: '페이지를 찾을 수 없습니다',
    html: '<p>페이지를 찾을 수 없습니다.</p><p><a href="/" data-link>홈으로</a></p>',
  }),
};
let current = null; // mounted page
let navId = 0; // guards stale async loads
let lastKey = ''; // pathname + search of the last rendered location (hash ignored)
const listeners = [];

const segments = (path) => path.split('/').filter(Boolean);
const decode = (s) => decodeURIComponent(s); // throws URIError on bad input

export function route(pattern, page) {
  if (pattern === '*') notFoundPage = page;
  else routes.push({ segs: segments(pattern), page });
}

/** Subscribe to navigations (called at the start of each one with the new pathname). */
export const onNavigate = (fn) => listeners.push(fn);

function match(pathname) {
  let parts;
  try {
    parts = segments(pathname).map(decode);
  } catch {
    return { page: notFoundPage, params: {} };
  }
  for (const { segs, page } of routes) {
    const splat = segs.at(-1) === '*';
    const fixed = splat ? segs.slice(0, -1) : segs;
    if (splat ? parts.length <= fixed.length : parts.length !== fixed.length) continue;
    const params = {};
    if (fixed.every((s, i) => (s.startsWith(':') ? ((params[s.slice(1)] = parts[i]), true) : s === parts[i]))) {
      if (splat) params['*'] = parts.slice(fixed.length).join('/');
      return { page, params };
    }
  }
  return { page: notFoundPage, params: {} };
}

async function show(initial = false) {
  const id = ++navId;
  const url = new URL(location.href);
  lastKey = url.pathname + url.search;
  current?.unmount?.();
  current = null;
  listeners.forEach((fn) => fn(url.pathname));

  let { page, params } = match(url.pathname);
  let data;
  let out;
  try {
    data = await page.load?.(params, url.searchParams);
    if (id !== navId) return;
    out = page.render(data);
  } catch (err) {
    if (id !== navId) return;
    page = null;
    out = {
      title: '오류',
      html: `<p role="alert">${escapeHtml(err?.message || '문제가 발생했습니다.')}</p><p><a href="/" data-link>홈으로</a></p>`,
    };
  }
  const main = document.getElementById('main');
  main.innerHTML = out.html;
  document.title = out.title ? `${out.title} - ${SITE}` : SITE;
  current = page;
  try {
    page?.mount?.(main, data);
  } catch (err) {
    try {
      page.unmount?.(); // release whatever mount() set up before it threw
    } catch {
      // already failing; keep showing the mount error
    }
    current = null;
    main.innerHTML = `<p role="alert">${escapeHtml(err?.message || '문제가 발생했습니다.')}</p>`;
  }
  if (!initial) {
    main.focus();
    scrollTo(0, 0);
  }
  scrollToHash(); // after the reset above, so a deep link is not overwritten
}

// Scroll to the element named by location.hash (the browser could not: the content did not exist yet).
function scrollToHash() {
  let id;
  try {
    id = decodeURIComponent(location.hash.slice(1));
  } catch {
    return;
  }
  document.getElementById(id)?.scrollIntoView();
}

export function navigate(path, { replace = false } = {}) {
  history[replace ? 'replaceState' : 'pushState'](null, '', path);
  return show();
}

export function start() {
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest?.('a[data-link]');
    if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
    const u = new URL(a.href, location.href);
    if (u.origin !== location.origin) return;
    if (u.hash && u.pathname + u.search === location.pathname + location.search) return; // in-page anchor: browser handles it
    e.preventDefault();
    if (u.pathname + u.search === location.pathname + location.search) {
      // same page: no extra history entry, just return to the top
      document.getElementById('main').focus();
      scrollTo(0, 0);
      return;
    }
    navigate(u.pathname + u.search + u.hash);
  });
  addEventListener('popstate', () => {
    if (location.pathname + location.search !== lastKey) show();
  });
  return show(true);
}
