import { escapeHtml as e } from '../lib/escape.js';
import { categoryHref, postHref } from '../lib/urls.js';
import { SECTIONS } from '../content/sections.js';

// Post-page sidebar: the section's category tree with its posts, folders collapsible (<details>).
// Input = GET /api/section-nav payload. A post belongs to the folder part of its slug. Every field is escaped.
const parentOf = (path) => path.split('/').slice(0, -1).join('/');

function buildTree(section, { categories = [], posts = [] }) {
  const nodes = new Map();
  const node = (path) => {
    if (!nodes.has(path)) nodes.set(path, { path, name: path.split('/').pop(), children: [], posts: [], total: 0 });
    return nodes.get(path);
  };
  const link = (path) => {
    if (path === section || !path.startsWith(`${section}/`)) return;
    const parent = node(parentOf(path));
    const n = node(path);
    if (!parent.children.includes(n)) parent.children.push(n);
    link(parent.path);
  };
  node(section).name = SECTIONS[section]?.title ?? section;
  for (const c of categories) {
    node(c.path).name = c.name;
    link(c.path);
  }
  for (const p of posts) {
    const dir = parentOf(p.slug) || section;
    node(dir).posts.push(p);
    link(dir);
  }
  const sum = (n) => {
    n.children.sort((a, b) => (a.path < b.path ? -1 : 1));
    n.total = n.posts.length + n.children.reduce((t, c) => t + sum(c), 0);
    return n.total;
  };
  sum(node(section));
  return node(section);
}

const listHtml = (n, cur, open, withAll) => `<ul>${
  withAll ? `<li><a class="sidenav__all" data-link href="${e(categoryHref(n.path))}">전체 보기</a></li>` : ''
}${n.children.map((c) => catHtml(c, cur, open)).join('')}${n.posts
  .map((p) => `<li><a class="sidenav__post" data-link href="${e(postHref(p.slug))}"${p.slug === cur ? ' aria-current="page"' : ''}>${e(p.title)}</a></li>`)
  .join('')}</ul>`;

const catHtml = (n, cur, open) =>
  `<li><details${open.has(n.path) ? ' open' : ''}><summary><span class="sidenav__name">${e(n.name)}</span><span class="sidenav__count">${n.total}</span></summary>${listHtml(n, cur, open, true)}</details></li>`;

/** `<nav class="sidenav">`; the folders on the way to the current post start open, the others collapsed. */
export function sectionNavHtml(data, section, currentSlug) {
  const root = buildTree(section, data);
  const open = new Set();
  for (let d = parentOf(currentSlug); d && d !== section; d = parentOf(d)) open.add(d);
  const title = SECTIONS[section]?.title ?? section;
  return `<nav class="sidenav" aria-label="${e(title)} 카테고리와 글"><p class="sidenav__title"><a data-link href="${e(categoryHref(section))}">${e(title)}</a></p>${listHtml(root, currentSlug, open, false)}</nav>`;
}
