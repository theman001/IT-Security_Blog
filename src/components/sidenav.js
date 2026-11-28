import { escapeHtml as e } from '../lib/escape.js';
import { categoryHref, postHref } from '../lib/urls.js';
import { SECTIONS } from '../content/sections.js';

// Post-page sidebar: tech / trends / essays as collapsible folders, each with its category tree and posts.
// Input = GET /api/nav payload. A post belongs to the folder part of its slug. Every field is escaped.
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
  node(section).name = SECTIONS[section].title;
  for (const c of categories) {
    if (c.path === section || c.path.startsWith(`${section}/`)) node(c.path).name = c.name;
    link(c.path);
  }
  for (const p of posts) {
    const dir = parentOf(p.slug);
    if (dir !== section && !dir.startsWith(`${section}/`)) continue;
    node(dir).posts.push(p);
    link(dir);
  }
  node(section).name = SECTIONS[section].title; // the section row keeps its static title, not the DB's folder name
  const sum = (n) => {
    n.children.sort((a, b) => (a.path < b.path ? -1 : 1));
    n.total = n.posts.length + n.children.reduce((t, c) => t + sum(c), 0);
    return n.total;
  };
  sum(node(section));
  return node(section);
}

const listHtml = (n, cur, open) => `<ul><li><a class="sidenav__all" data-link href="${e(categoryHref(n.path))}">전체 보기</a></li>${n.children
  .map((c) => folderHtml(c, cur, open))
  .join('')}${n.posts
  .map((p) => `<li><a class="sidenav__post" data-link href="${e(postHref(p.slug))}"${p.slug === cur ? ' aria-current="page"' : ''}>${e(p.title)}</a></li>`)
  .join('')}</ul>`;

const folderHtml = (n, cur, open) =>
  `<li><details${open.has(n.path) ? ' open' : ''}><summary><span class="sidenav__name">${e(n.name)}</span><span class="sidenav__count">${n.total}</span></summary>${listHtml(n, cur, open)}</details></li>`;

/**
 * `<nav class="sidenav">`: the three sections in a fixed order. Only the folders on the way to the current post
 * start open (so its section is open and the other sections are collapsed).
 */
export function sidenavHtml(data, currentSlug) {
  const open = new Set();
  for (let d = parentOf(currentSlug); d; d = parentOf(d)) open.add(d);
  const items = Object.keys(SECTIONS).map((s) => folderHtml(buildTree(s, data), currentSlug, open));
  return `<nav class="sidenav" aria-label="카테고리와 글"><ul class="sidenav__sections">${items.join('')}</ul></nav>`;
}
