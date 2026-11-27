import './styles/tokens.css';
import './styles/base.css';
import './styles/shell.css';
import { start } from './router.js';
import { mountHeader } from './components/header.js';
import { mountFooter } from './components/footer.js';

mountHeader(document.querySelector('body > header'));
mountFooter(document.querySelector('body > footer'));
start();
