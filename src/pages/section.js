// Section lists (/tech /trends /essays) and category lists (/categories/*), one module.
// Design: the Page contract has no pathname, so `makeListPage(fixedPath | null)` builds a Page:
// a fixed path for the three section routes, `null` = read the splat (`params['*']`).
// Exports: `sectionPage(key)` is makeListPage(key); `categoryPage` is makeListPage(null).
import '../styles/list.css';
import { getCategories, getPosts } from '../lib/api.js';
import { escapeHtml as e } from '../lib/escape.js';
import { categoryHref } from '../lib/urls.js';
import { postRowHtml } from '../components/post-card.js';
import { SECTIONS } from '../content/sections.js';
import { mountNotFound, notFoundView } from './not-found.js';

const LIMIT = 20;
// 64em = the list.css 1024px breakpoint at the default font size (lint forbids px in JS strings)
const DESKTOP = '(min-width: 64em)';
const label = (c) => SECTIONS[c.path]?.label ?? c.name; // section roots show Tech/Trends/Essays
const link = (c, text, cur, cls = '') =>
  `<a${cls ? ` class="${cls}"` : ''} data-link href="${e(categoryHref(c.path))}"${c.path === cur ? ' aria-current="page"' : ''}>${text}</a>`;

const parentPath = (c) => c.path.slice(0, Math.max(0, c.path.lastIndexOf('/')));
const rowsHtml = (items) => items.map(postRowHtml).join('');

function crumbsHtml(cat, byPath) {
  const parts = cat.path.split('/');
  if (parts.length < 2) return '';
  const li = parts.map((_, i) => {
    const c = byPath.get(parts.slice(0, i + 1).join('/'));
    if (!c) return '';
    return i === parts.length - 1 ? `<li><span aria-current="page">${e(label(c))}</span></li>` : `<li>${link(c, e(label(c)))}</li>`;
  });
  return `<nav class="crumbs" aria-label="경로"><ol>${li.join('')}</ol></nav>`;
}

function chipsHtml(cat, kids) {
  if (!kids.length) return '';
  const all = link(cat, '전체', cat.path, 'chip');
  const chips = kids.map((c) => link(c, `${e(c.name)}(${e(c.totalPostCount)})`, '', 'chip'));
  return `<nav class="chips" aria-label="하위 카테고리">${[all, ...chips].join('')}</nav>`;
}

function treeNode(c, kidsOf, cur) {
  const a = link(c, `${e(label(c))}<span class="cat-count">${e(c.totalPostCount)}</span>`, cur);
  const kids = kidsOf(c);
  if (!kids.length) return `<li>${a}</li>`;
  const open = cur === c.path || cur.startsWith(`${c.path}/`);
  return `<li><details${open ? ' open' : ''}><summary>${a}</summary><ul>${kids.map((k) => treeNode(k, kidsOf, cur)).join('')}</ul></details></li>`;
}

export function makeListPage(fixed) {
  let cleanup = null;
  return {
    async load(params) {
      const path = fixed ?? params['*'];
      if (!SECTIONS[path.split('/')[0]]) return { notFound: true };
      const [cats, posts] = await Promise.all([getCategories(), getPosts({ category: path, limit: LIMIT })]);
      const list = cats.items;
      const key = path.split('/')[0];
      // A section with no DB row (no folder yet) still exists: synthesize its root so header, crumb, tree and empty state work.
      if (!list.some((c) => c.path === key)) {
        const kids = list.filter((c) => parentPath(c) === key);
        list.unshift({ id: null, name: SECTIONS[key].title, path: key, parentId: null, depth: 1, postCount: 0, totalPostCount: kids.reduce((n, c) => n + c.totalPostCount, 0), subCategoryCount: kids.length, section: key });
      }
      const byPath = new Map(list.map((c) => [c.path, c]));
      const cat = byPath.get(path);
      if (!cat) return { notFound: true };
      return { cat, byPath, cats: cats.items, posts };
    },
    render(data) {
      if (data.notFound) return notFoundView();
      const { cat, byPath, cats, posts } = data;
      const sec = SECTIONS[cat.path.split('/')[0]];
      const isSection = cat.depth === 1;
      const kidsOf = (p) => cats.filter((c) => parentPath(c) === p.path); // by path: a synthesized root has no id
      const root = byPath.get(cat.path.split('/')[0]);
      const inSection = cats.filter((c) => c.path === root?.path || c.path.startsWith(`${root?.path}/`));
      const tree = root && Math.max(...inSection.map((c) => c.depth)) >= 3;
      const title = isSection ? sec.title : cat.name;
      const html = `<div class="list-page${tree ? ' list-page--tree' : ''}">
  <header class="list-head">
    ${crumbsHtml(cat, byPath)}
    <h1 class="list-title">${e(title)}</h1>
    ${isSection ? `<p class="list-desc">${e(sec.description)}</p>` : ''}
    <p class="list-count">${e(cat.totalPostCount)}개의 글</p>
  </header>
  ${tree ? `<aside class="list-side"><details class="cat-nav"><summary>카테고리</summary><nav aria-label="카테고리"><ul class="cat-tree">${treeNode(root, kidsOf, cat.path)}</ul></nav></details></aside>` : ''}
  <div class="list-main">
    ${chipsHtml(cat, kidsOf(cat))}
    <h2 class="list-sr">글 목록</h2>
    <div class="list-rows">${rowsHtml(posts.items)}</div>
    ${posts.items.length ? '' : '<p class="list-empty">아직 글이 없습니다. <a data-link href="/">홈으로</a></p>'}
    ${posts.nextCursor ? '<div class="list-more"><button type="button" class="list-more__btn">더 보기</button></div>' : ''}
  </div>
</div>`;
      return { title, html };
    },
    mount(root, data) {
      if (data.notFound) {
        cleanup = mountNotFound(root);
        return;
      }
      const ac = new AbortController();
      const { signal } = ac;
      // desktop: the tree is a permanent sidebar (open); below that it is a collapsed disclosure
      const nav = root.querySelector('.cat-nav');
      if (nav) {
        const mq = matchMedia(DESKTOP);
        const sync = () => {
          nav.open = mq.matches;
        };
        sync();
        mq.addEventListener('change', sync, { signal });
      }
      const box = root.querySelector('.list-more');
      if (box) {
        const rows = root.querySelector('.list-rows');
        const btn = box.querySelector('button');
        let cursor = data.posts.nextCursor;
        btn.addEventListener(
          'click',
          async () => {
            box.querySelector('.list-error')?.remove();
            btn.disabled = true;
            btn.setAttribute('aria-busy', 'true');
            try {
              const next = await getPosts({ category: data.cat.path, limit: LIMIT, cursor });
              if (signal.aborted) return;
              const before = rows.children.length;
              rows.insertAdjacentHTML('beforeend', rowsHtml(next.items));
              rows.children[before]?.querySelector('a')?.focus();
              cursor = next.nextCursor;
              if (!cursor) box.remove();
            } catch {
              if (signal.aborted) return;
              btn.textContent = '다시 시도';
              box.insertAdjacentHTML('afterbegin', '<p class="list-error" role="alert">글을 불러오지 못했습니다.</p>');
            }
            btn.disabled = false;
            btn.removeAttribute('aria-busy');
          },
          { signal },
        );
      }
      cleanup = () => ac.abort();
    },
    unmount() {
      cleanup?.();
      cleanup = null;
    },
  };
}

export const sectionPage = (key) => makeListPage(key);
export const categoryPage = makeListPage(null);
