import './styles/tokens.css';
import './styles/base.css';
import './styles/shell.css';
import { route, start } from './router.js';
import home from './pages/home.js';
import post from './pages/post.js';
import { mountHeader } from './components/header.js';
import { mountFooter } from './components/footer.js';

mountHeader(document.querySelector('body > header'));
mountFooter(document.querySelector('body > footer'));
route('/', home);
route('/posts/*', post);
start();
