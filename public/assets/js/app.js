import { router, navigateTo } from './router.js';

// --- Theme Management ---
const themeStyle = document.getElementById('theme-style');
const savedTheme = localStorage.getItem('theme') || 'light';

// Apply saved theme immediately
if (themeStyle) {
    document.documentElement.setAttribute('data-theme', savedTheme);
    themeStyle.href = `/themes/${savedTheme}.css`;
}

function initTheme() {
    // 1. Find Button by ID (Added id="theme-toggle" in HTML)
    const toggleBtn = document.getElementById('theme-toggle');

    if (!toggleBtn) {
        console.warn('Theme toggle button not found (ID: theme-toggle)');
        return;
    }

    // 2. Initial Icon State
    updateThemeIcon(savedTheme, toggleBtn);

    // 3. Add Event Listener (One-time)
    toggleBtn.onclick = (e) => {
        e.stopPropagation();
        const currentThm = document.documentElement.getAttribute('data-theme');
        const newThm = currentThm === 'dark' ? 'light' : 'dark';

        document.documentElement.setAttribute('data-theme', newThm);
        themeStyle.href = `/themes/${newThm}.css`;
        localStorage.setItem('theme', newThm);

        updateThemeIcon(newThm, toggleBtn);
    };
}

function updateThemeIcon(theme, btn) {
    if (!btn) return;
    const sun = btn.querySelector('.sun-icon');
    const moon = btn.querySelector('.moon-icon');

    if (sun && moon) {
        if (theme === 'dark') {
            sun.style.display = 'none';
            moon.style.display = 'block';
        } else {
            sun.style.display = 'block';
            moon.style.display = 'none';
        }
    }
}

// --- App Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Init Theme
    initTheme();

    // 2. Init Router (Wait for DOM)
    router();

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
