import { renderMarkdown } from '../assets/js/renderer.js';
import { renderErrorState } from '../assets/js/components.js';

export default async function render(container) {
    // Current Path to decide which file to load
    const path = window.location.pathname;
    const filename = path.replace('/', '') + '.md'; // /about -> about.md

    try {
        const response = await fetch(`/static/${filename}`);
        if (!response.ok) throw new Error('Static file not found');

        const markdown = await response.text();
        const htmlContent = renderMarkdown(markdown);

        // Render Markdown Content Only — markdown files already contain their own headers.
        container.innerHTML = `
        <div class="markdown-body">
            ${htmlContent}
        </div>
    `;

    } catch (e) {
        console.error(e);
        container.innerHTML = renderErrorState({ title: '404', message: 'Page not found.' });
    }
}
