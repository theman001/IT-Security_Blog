import { renderMarkdown } from '../assets/js/renderer.js';

export default async function render(container) {
    // Current Path to decide which file to load
    const path = window.location.pathname;
    const filename = path.replace('/', '') + '.md'; // /about -> about.md

    try {
        const response = await fetch(`/static/${filename}`);
        if (!response.ok) throw new Error('Static file not found');

        const markdown = await response.text();
        const htmlContent = renderMarkdown(markdown);

        // Simple title extraction (remove first # line)
        const titleMatch = markdown.match(/^# (.*$)/m);
        const title = titleMatch ? titleMatch[1] : filename.toUpperCase();
        // Render Markdown Content Only
        // User requested to remove the automatic header since markdown files already contain headers.
        container.innerHTML = `
        <div class="markdown-body">
            ${htmlContent}
        </div>
    `;

        // Trigger Syntax Highlighting
        if (window.Prism) {
            window.Prism.highlightAll();
        }

    } catch (e) {
        console.error(e);
        container.innerHTML = '<p class="error">Page not found.</p>';
    }
}
