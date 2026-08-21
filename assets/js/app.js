import { router, navigateTo } from './router.js';
import { initThemeSwitcher } from './theme-switcher.js';
import { initLiquidGlass } from './liquid-glass.ts';

// --- App Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Init Theme/Mode switcher (palette + light/dark attributes were
    //    already set synchronously by the inline script in index.html <head>)
    initThemeSwitcher();

    // 2. Init Router (Wait for DOM)
    router();

    // 3. Wire up the persistent chrome's glass surfaces (header now; mobile
    //    nav/category tree get their .glass-full class in later phases)
    initLiquidGlass();

    // 3. Global Link Interception (SPA behavior)
    document.body.addEventListener('click', e => {
        const link = e.target.closest('[data-link]');

        if (link) {
            e.preventDefault();
            const href = link.getAttribute('href'); // Safer than link.href
            navigateTo(href);
        }
    });
});

// Expose for debugging
window.appInitialized = true;
