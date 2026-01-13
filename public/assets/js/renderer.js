/**
 * Renders Markdown content into HTML using Marked.js and DOMPurify
 * - Code blocks are preserved exactly
 * - Only fenced blocks are treated as code
 * - Front Matter is stripped before rendering
 */
export function renderMarkdown(markdown) {
    if (!markdown) return '';

    if (typeof marked === 'undefined') {
        return markdown;
    }

    try {
        // 1️⃣ Front Matter 제거 (--- ... ---)
        const cleaned = markdown.replace(
            /^---[\s\S]*?---\s*/m,
            ''
        );

        // 2️⃣ marked 기본 옵션 (중요)
        marked.setOptions({
            gfm: true,
            breaks: false,        // ❗ 반드시 false
            headerIds: false,
            mangle: false
        });

        const html = marked.parse(cleaned);

        // 3️⃣ Sanitization (pre/code 건드리지 않음)
        if (typeof DOMPurify !== 'undefined') {
            return DOMPurify.sanitize(html, {
                USE_PROFILES: { html: true }
            });
        }

        return html;

    } catch (e) {
        console.error('Markdown render failed:', e);
        return '<p class="error">Markdown rendering failed.</p>';
    }
}


/**
 * Strips markdown syntax for preview text
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

        return markdown.slice(0, maxLength);

    } catch {
        return markdown.slice(0, maxLength);
    }
}
