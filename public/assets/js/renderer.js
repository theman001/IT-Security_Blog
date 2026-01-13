/**
 * Markdown Renderer (Marked v8+ compatible)
 */

export function renderMarkdown(markdown) {
    if (!markdown) return '';

    if (typeof marked === 'undefined') {
        console.warn('Marked.js not loaded');
        return markdown;
    }

    marked.setOptions({
        gfm: true,
        breaks: false,          // 🔒 절대 true 금지
        headerIds: false,
        mangle: false
    });

    const renderer = new marked.Renderer();

    /**
     * Fenced code block
     * @param {string} code
     * @param {string} infostring
     */
    renderer.code = (code, infostring = '') => {
        const language = infostring.trim().split(/\s+/)[0] || 'text';

        return `
<pre class="code-block">
  <div class="code-toolbar">
    <span class="code-lang">${language}</span>
    <button class="copy-btn" data-copy>Copy</button>
  </div>
  <code class="language-${language}">${escapeHtml(code)}</code>
</pre>`;
    };

    // Inline code
    renderer.codespan = (code) => {
        return `<code class="inline-code">${escapeHtml(code)}</code>`;
    };

    let html;
    try {
        html = marked.parse(markdown, { renderer });
    } catch (err) {
        console.error('Marked parse error:', err);
        return '<p class="error">Markdown rendering failed.</p>';
    }

    if (typeof DOMPurify !== 'undefined') {
        return DOMPurify.sanitize(html, {
            USE_PROFILES: { html: true },
            ADD_TAGS: ['pre', 'code', 'button', 'div', 'span'],
            ADD_ATTR: ['class', 'data-copy']
        });
    }

    return html;
}

/**
 * Markdown → Plain text (preview)
 */
export function stripMarkdown(markdown, maxLength = 150) {
    if (!markdown) return '';

    try {
        const html = marked.parse(markdown);
        const div = document.createElement('div');
        div.innerHTML = html;

        let text = div.textContent || '';
        text = text.replace(/\s+/g, ' ').trim();

        return text.length > maxLength
            ? text.slice(0, maxLength) + '...'
            : text;
    } catch {
        return markdown.slice(0, maxLength);
    }
}

/**
 * Escape HTML inside code blocks
 */
function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
