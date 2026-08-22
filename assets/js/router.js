import home from '../../pages/home.js';
import categories from '../../pages/categories.js';
import post from '../../pages/post.js';
import staticPage from '../../pages/static.js';
import errorPage from '../../pages/error.js';
import hidden from '../../pages/hidden.js';
import { renderSkeletonList, renderSkeletonPost } from './components.js';
import { enhanceCodeBlocks } from './code-enhance.js';
import { initLiquidGlass } from './liquid-glass.ts';
import { toAppPath, toRealPath } from './base-path.js';

// Route Definition — `view` is the already-imported render function itself,
// not a path string. This used to store a string and re-fetch each page via
// `import(match.route.view)` at navigation time; Vite can't statically
// analyze a dynamic import() with a runtime variable (the "cannot be
// analyzed" build warning), so in production that call was left as a literal
// browser-native dynamic import, which resolved the path against the
// bundle's own URL instead of reusing the module already bundled in above.
// On this project's Cloudflare Pages deployment that resolved path happened
// to still serve a years-old pre-Vite copy of the file — silently running
// completely different code than what's in this repo, with no build error
// to reveal it. Calling the statically-imported function directly removes
// any runtime path resolution from the picture.
const routes = [
    { path: '/', view: home },
    { path: '/categories', view: categories },
    { path: '/categories/:slug', view: home },
    { path: '/posts/:slug', view: post },
    { path: '/about', view: staticPage },
    { path: '/architecture', view: staticPage },
    { path: '/hidden', view: hidden } // Easter Egg
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

// Some browsers (this Chromium build included) fire `popstate` even for a
// same-document in-page anchor click (e.g. a TOC link), not just real
// back/forward navigation — contrary to what the spec implies. Without this
// guard, that popstate re-ran the whole router, which re-rendered the page
// and reset scroll to 0 (post.js does that on purpose for real navigations),
// silently cancelling the native "scroll to #fragment" the click just asked
// for. Only re-render when the app-relative path actually changed.
let lastRenderedPath = null;

const handlePopstate = () => {
    if (toAppPath(location.pathname) === lastRenderedPath) return; // hash-only change — let the browser's native anchor scroll happen
    router();
};

export const router = async () => {
    const appPath = toAppPath(location.pathname);
    lastRenderedPath = appPath;

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
            route: { view: errorPage, path: '/error' },
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

        const params = match.result ? getParams(match) : {};

        await match.route.view(container, params);

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
window.addEventListener("popstate", handlePopstate);
