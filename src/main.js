import './styles/tokens.css';
import './styles/base.css';
import './styles/shell.css';
import { route, start } from './router.js';
import home from './pages/home.js';
import post from './pages/post.js';
import { sectionPage, categoryPage } from './pages/section.js';
import { mountHeader } from './components/header.js';
import { mountFooter } from './components/footer.js';

mountHeader(document.querySelector('body > header'));
mountFooter(document.querySelector('body > footer'));
route('/', home);
route('/posts/*', post);
for (const key of ['tech', 'trends', 'essays']) route(`/${key}`, sectionPage(key));
route('/categories/*', categoryPage);
start();
