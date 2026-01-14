import home from '../../pages/home.js';
import categories from '../../pages/categories.js';
import post from '../../pages/post.js';
import staticPage from '../../pages/static.js';
import errorPage from '../../pages/error.js';

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
    history.pushState(null, null, url);
    router();
};

export const router = async () => {
    // 1. Match Route
    const potentialMatches = routes.map(route => {
        return {
            route: route,
            result: location.pathname.match(pathToRegex(route.path))
        };
    });

    let match = potentialMatches.find(potentialMatch => potentialMatch.result !== null);

    if (!match) {
        match = {
            route: { view: '../../pages/error.js' },
            result: [location.pathname]
        };
    }

    // 2. Target Container (Must be main-content to save Header/Footer)
    const container = document.getElementById('main-content');
    if (!container) return; // Should not happen

    // 3. Render
    try {
        container.innerHTML = '<div style="padding: 2rem; text-align: center; color: #888;">Loading...</div>'; // Simple Loading

        // Dynamic Import
        const module = await import(match.route.view);
        const params = match.result ? getParams(match) : {};

        // Fix for categories/slug merging params
        if (match.route.path === '/categories/:slug' && params.slug) {
            // keep params as is
        }

        await module.default(container, params);

        // Prism syntax highlight (manual)
        if (window.Prism) {
            Prism.highlightAll();
        }

    } catch (e) {
        console.error('Render Error:', e);
        container.innerHTML = '<h2>Error loading page</h2>';
    }
};

// Handle Browser Back/Forward
window.addEventListener("popstate", router);
