import home from '../../pages/home.js';
import categories from '../../pages/categories.js';
import post from '../../pages/post.js';
import staticPage from '../../pages/static.js';
import errorPage from '../../pages/error.js';
import { renderSkeletonList, renderSkeletonPost } from './components.js';
import { enhanceCodeBlocks } from './code-enhance.js';
import { initLiquidGlass } from './liquid-glass.ts';
import { toAppPath, toRealPath } from './base-path.js';

// Route Definition
const routes = [
    { path: '/', view: '../../pages/home.js' },
    { path: '/categories', view: '../../pages/categories.js' },
    { path: '/categories/:slug', view: '../../pages/home.js' },
    { path: '/posts/:slug', view: '../../pages/post.js' },
    { path: '/about', view: '../../pages/static.js' },
    { path: '/architecture', view: '../../pages/static.js' },
    { path: '/hidden', view: '../../pages/hidden.js' } // Easter Egg
];

const pathToRegex = path => new RegExp("^" + path.replace(/\//g, "\\/").replace(/:\w+/g, "(.+)") + "$");

const getParams = match => {
    const values = match.result.slice(1);
    const keys = Array.from(match.route.path.matchAll(/:(\w+)/g)).map(result => result[1]);
    return Object.fromEntries(keys.map((key, i) => [
        key,
        decodeURIComponent(values[i]) // Decode URL params (e.g. %20 -> space)
    ]));
};

export const navigateTo = url => {
    history.pushState(null, null, toRealPath(url));
    router();
};

export const router = async () => {
    const appPath = toAppPath(location.pathname);

    // 1. Match Route
    const potentialMatches = routes.map(route => {
        return {
            route: route,
            result: appPath.match(pathToRegex(route.path))
        };
    });

    let match = potentialMatches.find(potentialMatch => potentialMatch.result !== null);

    if (!match) {
        match = {
            route: { view: '../../pages/error.js', path: '/error' },
            result: [appPath]
        };
    }

    // 2. Target Container (Must be main-content to save Header/Footer)
    const container = document.getElementById('main-content');
    if (!container) return; // Should not happen

    // 3. Render
    try {
        container.innerHTML = match.route.path === '/posts/:slug'
            ? renderSkeletonPost()
            : renderSkeletonList();

        // Dynamic Import
        const module = await import(match.route.view);
        const params = match.result ? getParams(match) : {};

        await module.default(container, params);

        // Toggle hidden-route class for mobile nav visibility
        if (appPath === '/hidden') {
            document.body.classList.add('hidden-route');
        } else {
            document.body.classList.remove('hidden-route');
        }

        // Update active highlights
        updateActiveLinks();

        // Prism syntax highlight (manual), then the glass/copy-button hooks that
        // depend on the highlighted markup being final
        if (window.Prism) {
            Prism.highlightAll();
        }
        enhanceCodeBlocks(container);
        initLiquidGlass(container);

    } catch (e) {
        console.error('Render Error:', e);
        container.innerHTML = '<h2>Error loading page</h2>';
    }
};

const updateActiveLinks = () => {
    const currentPath = toAppPath(location.pathname);
    const links = document.querySelectorAll('[data-link]');

    links.forEach(link => {
        const href = link.getAttribute('href');

        // Reset
        link.classList.remove('active');

        // Logic: Home is strict, others are prefix or match
        if (href === '/' && currentPath === '/') {
            link.classList.add('active');
        } else if (href !== '/' && currentPath.startsWith(href)) {
            link.classList.add('active');
        } else if (href === '/categories' && currentPath.startsWith('/posts/')) {
            link.classList.add('active');
        }
    });
};

// Handle Browser Back/Forward
window.addEventListener("popstate", router);
