import './styles/tokens.css';
import './styles/base.css';
import './styles/shell.css';
import { route, start } from './router.js';
import home from './pages/home.js';
import post from './pages/post.js';
import about from './pages/about.js';
import notFound from './pages/not-found.js';
import { sectionPage, categoryPage } from './pages/section.js';
import { mountHeader } from './components/header.js';
import { mountFooter } from './components/footer.js';

mountHeader(document.querySelector('body > header'));
route('/', home);
route('/posts/*', post);
for (const key of ['tech', 'trends', 'essays']) route(`/${key}`, sectionPage(key));
route('/categories/*', categoryPage);
route('/about', about);
route('*', notFound);
// Footer after the first render: mounted earlier it sits in the viewport and jumps down (CLS) when content arrives.
start().finally(() => {
  mountFooter(document.querySelector('body > footer'));
  // Webfonts after the first paint: the page text shows in the fallback face first (font-display: swap),
  // so ~0.5MB of Korean subsets do not delay LCP.
  requestAnimationFrame(() => setTimeout(() => import('./styles/fonts.css')));
});
