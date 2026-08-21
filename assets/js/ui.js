/**
 * UI Management Script
 * Handles Scroll-aware navigation and other UI interactions.
 */

export const initScrollAwareNav = () => {
    let lastScrollY = window.scrollY;
    const body = document.body;
    const threshold = 10; // Minimum scroll difference to trigger

    window.addEventListener('scroll', () => {
        const currentScrollY = window.scrollY;

        // Ignore bounce scrolling (safari) or negative scroll
        if (currentScrollY < 0) return;

        // If at the top OR bottom, show nav
        if (currentScrollY < 50 || (window.innerHeight + window.scrollY) >= document.body.offsetHeight - 10) {
            body.classList.remove('nav-hidden');
            lastScrollY = currentScrollY;
            return;
        }

        // Determine scroll direction
        if (Math.abs(currentScrollY - lastScrollY) > threshold) {
            if (currentScrollY > lastScrollY) {
                // Scrolling Down -> Hide Nav
                body.classList.add('nav-hidden');
            } else {
                // Scrolling Up -> Show Nav
                body.classList.remove('nav-hidden');
            }
            lastScrollY = currentScrollY;
        }
    });
};

// Auto-initialize when imported if document is ready, or wait
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initScrollAwareNav);
} else {
    initScrollAwareNav();
}
