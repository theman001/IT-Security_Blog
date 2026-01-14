/**
 * Render Markdown → HTML
 * - Marked: Markdown parsing
 * - DOMPurify: XSS protection
 * - NO syntax highlight here
 */
export function renderMarkdown(markdown) {
    if (!markdown) return '';

    if (typeof marked === 'undefined') {
        console.error('marked not loaded');
        return '';
    }

    marked.setOptions({
        gfm: true,
        breaks: false,
        headerIds: false,
        mangle: false
    });

    /* Custom renderer removed to avoid link issues */
    /* marked.use({ ... }) */

    let html = '';
    try {
        html = marked.parse(markdown);
    } catch (e) {
        console.error('Markdown parse error', e);
        return '<p class="error">Markdown rendering failed.</p>';
    }

    if (typeof DOMPurify !== 'undefined') {
        return DOMPurify.sanitize(html, {
            USE_PROFILES: { html: true }
        });
    }

    return html;
}

/**
 * Markdown → Plain text (excerpt)
 */
export function stripMarkdown(markdown, maxLength = 150) {
    if (!markdown) return '';

    try {
        if (typeof marked !== 'undefined') {
            const html = marked.parse(markdown);
            const tmp = document.createElement('div');
            tmp.innerHTML = html;

            let text = tmp.textContent || '';
            text = text.replace(/\s+/g, ' ').trim();

            return text.length > maxLength
                ? text.slice(0, maxLength) + '...'
                : text;
        }
    } catch { }

    return markdown.slice(0, maxLength);
}
