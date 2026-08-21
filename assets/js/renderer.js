import { marked } from 'marked';
import DOMPurify from 'dompurify';

/**
 * Render Markdown → HTML
 * - Marked: Markdown parsing
 * - DOMPurify: XSS protection
 * - NO syntax highlight here
 */
export function renderMarkdown(markdown) {
    if (!markdown) return '';

    marked.setOptions({
        gfm: true,
        breaks: false,
        headerIds: false,
        mangle: false
    });

    let html = '';
    try {
        html = marked.parse(markdown);
    } catch (e) {
        console.error('Markdown parse error', e);
        return '<p class="error">Markdown rendering failed.</p>';
    }

    return DOMPurify.sanitize(html, {
        USE_PROFILES: { html: true }
    });
}

/**
 * Markdown → Plain text (excerpt)
 */
export function stripMarkdown(markdown, maxLength = 150) {
    if (!markdown) return '';

    try {
        const html = marked.parse(markdown);
        const tmp = document.createElement('div');
        tmp.innerHTML = html;

        let text = tmp.textContent || '';
        text = text.replace(/\s+/g, ' ').trim();

        return text.length > maxLength
            ? text.slice(0, maxLength) + '...'
            : text;
    } catch {
        return markdown.slice(0, maxLength);
    }
}
