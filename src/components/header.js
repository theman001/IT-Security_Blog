import { getTheme, toggleTheme } from '../lib/theme.js';
import { onNavigate } from '../router.js';

const SECTIONS = [
  ['', 'Home'],
  ['tech', 'Tech'],
  ['trends', 'Trends'],
  ['essays', 'Essays'],
  ['about', 'About'],
];

// Moon while the theme is light (click = go dark), sun while dark; CSS picks one from aria-pressed. Strokes use currentColor, so the icon follows the theme tokens.
const ICONS = `<svg class="theme-toggle__moon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/></svg><svg class="theme-toggle__sun" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`;

// /tech/..., /posts/tech/... -> 'tech'; the home page has no segment ('')
const sectionOf = (pathname) => {
  const [a, b] = pathname.split('/').filter(Boolean);
  return (a === 'posts' ? b : a) ?? '';
};

export function mountHeader(el) {
  el.className = 'site-header';
  el.innerHTML = `<div class="site-header__inner">
  <a class="site-header__name" href="/" data-link>IT Security Blog</a>
  <nav class="site-header__nav" aria-label="주요 메뉴">${SECTIONS.map(([s, label]) => `<a href="/${s}" data-link>${label}</a>`).join('')}</nav>
  <button type="button" class="theme-toggle" aria-label="다크 모드">${ICONS}</button>
</div>`;
  const links = [...el.querySelectorAll('nav a')];
  const btn = el.querySelector('.theme-toggle');
  const sync = () => btn.setAttribute('aria-pressed', String(getTheme() === 'dark'));
  sync();
  btn.addEventListener('click', () => (toggleTheme(), sync()));
  // With an explicit data-theme getTheme() ignores the OS, so this only matters when none is set.
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', sync);
  onNavigate((pathname) => {
    const s = sectionOf(pathname);
    for (const a of links) {
      if (a.getAttribute('href') === `/${s}`) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    }
  });
}
