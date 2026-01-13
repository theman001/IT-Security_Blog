/**
 * Markdown Renderer
 * - Safe for Cloudflare Pages
 * - Code blocks are rendered as pure text
 * - No markdown parsing inside ``` blocks
 * - Rendering failure will NEVER break the page
 */

export function renderMarkdown(markdown) {
    if (!markdown) return '';

    /* ---------- Guard: marked existence ---------- */
    if (typeof window.marked === 'undefined') {
        console.error('[Markdown] marked is not loaded');
        return `<pre><code>${escapeHtml(markdown)}</code></pre>`;
    }

    try {
        /* ---------- Marked global options ---------- */
        window.marked.setOptions({
            gfm: true,
            breaks: false,          // IMPORTANT: 줄바꿈 강제 X
            headerIds: false,
            mangle: false
        });

        /* ---------- Custom Renderer ---------- */
        const renderer = new window.marked.Renderer();

        /**
         * Code block (```lang)
         * - Treat content as pure text
         * - No markdown parsing inside
         */
        renderer.code = (code, language) => {
            const langClass = language ? `language-${language}` : '';
            return `
                <pre class="code-block ${langClass}">
                    <code>${escapeHtml(code)}</code>
                </pre>
            `;
        };

        /**
         * Inline code (`code`)
         */
        renderer.codespan = (text) => {
            return `<code class="inline-code">${escapeHtml(text)}</code>`;
        };

        /* ---------- Parse ---------- */
        let html = window.marked.parse(markdown, { renderer });

        /* ---------- Sanitize ---------- */
        if (typeof window.DOMPurify !== 'undefined') {
            html = window.DOMPurify.sanitize(html, {
                USE_PROFILES: { html: true },
                ADD_TAGS: ['pre', 'code'],
                ADD_ATTR: ['class']
            });
        }

        return html;

    } catch (err) {
        console.error('[Markdown] rendering failed:', err);

        /* ---------- Absolute fallback ---------- */
        return `
            <pre class="code-block">
                <code>${escapeHtml(markdown)}</code>
            </pre>
        `;
    }
}

/**
 * Plain-text preview generator
 */
export function stripMarkdown(markdown, maxLength = 150) {
    if (!markdown) return '';

    try {
        if (typeof window.marked === 'undefined') {
            return markdown.substring(0, maxLength);
        }

        const html = window.marked.parse(markdown);
        const tmp = document.createElement('div');
        tmp.innerHTML = html;

        let text = (tmp.textContent || '').replace(/\s+/g, ' ').trim();

        return text.length > maxLength
            ? text.substring(0, maxLength) + '...'
            : text;

    } catch {
        return markdown.substring(0, maxLength);
    }
}

/* ---------- Utils ---------- */
function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
