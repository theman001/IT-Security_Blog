import { getTheme, toggleTheme } from '../lib/theme.js';
import { onNavigate } from '../router.js';

const SECTIONS = [
  ['tech', 'Tech'],
  ['trends', 'Trends'],
  ['essays', 'Essays'],
  ['about', 'About'],
];

// /tech/..., /posts/tech/... -> 'tech'
const sectionOf = (pathname) => {
  const [a, b] = pathname.split('/').filter(Boolean);
  return a === 'posts' ? b : a;
};

export function mountHeader(el) {
  el.className = 'site-header';
  el.innerHTML = `<div class="site-header__inner">
  <a class="site-header__name" href="/" data-link>IT Security Blog</a>
  <nav class="site-header__nav" aria-label="주요 메뉴">${SECTIONS.map(([s, label]) => `<a href="/${s}" data-link>${label}</a>`).join('')}</nav>
  <button type="button" class="theme-toggle">다크 모드</button>
</div>`;
  const links = [...el.querySelectorAll('nav a')];
  const btn = el.querySelector('.theme-toggle');
  const sync = () => btn.setAttribute('aria-pressed', String(getTheme() === 'dark'));
  sync();
  btn.addEventListener('click', () => (toggleTheme(), sync()));
  onNavigate((pathname) => {
    const s = sectionOf(pathname);
    for (const a of links) {
      if (a.getAttribute('href') === `/${s}`) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    }
  });
}
