/**
 * Markdown Renderer
 * - Uses Marked.js for parsing
 * - Uses DOMPurify for sanitization
 * - Ensures code blocks are treated as pure text
 */

export function renderMarkdown(markdown) {
    if (!markdown) return '';

    if (typeof marked === 'undefined') {
        console.warn('Marked.js not loaded');
        return markdown;
    }

    // 🔒 핵심 설정
    marked.setOptions({
        gfm: true,
        breaks: false,          // ❗ 매우 중요: 개행 깨짐 방지
        headerIds: false,
        mangle: false,
        smartLists: true,
        smartypants: false
    });

    /**
     * Renderer override
     * - 코드블럭은 마크다운 문법 무시
     * - plain text 그대로 출력
     */
    const renderer = new marked.Renderer();

    // ``` 코드블럭
    renderer.code = (code, language) => {
        const langClass = language ? `language-${language}` : 'language-plain';

        return `
<pre class="code-block">
    <div class="code-toolbar">
        <span class="code-lang">${language || 'text'}</span>
        <button class="copy-btn" data-copy>Copy</button>
    </div>
    <code class="${langClass}">${escapeHtml(code)}</code>
</pre>`;
    };

    // 인라인 코드
    renderer.codespan = (code) => {
        return `<code class="inline-code">${escapeHtml(code)}</code>`;
    };

    let rawHtml;
    try {
        rawHtml = marked.parse(markdown, { renderer });
    } catch (e) {
        console.error('Markdown parse error:', e);
        return '<p class="error">Markdown rendering failed.</p>';
    }

    // 🔐 Sanitize
    if (typeof DOMPurify !== 'undefined') {
        return DOMPurify.sanitize(rawHtml, {
            USE_PROFILES: { html: true },
            ADD_TAGS: ['pre', 'code', 'button', 'div', 'span'],
            ADD_ATTR: ['class', 'data-copy']
        });
    }

    return rawHtml;
}

/**
 * Markdown → Plain text (preview용)
 */
export function stripMarkdown(markdown, maxLength = 150) {
    if (!markdown) return '';

    try {
        if (typeof marked !== 'undefined') {
            marked.setOptions({
                gfm: true,
                breaks: false,
                headerIds: false,
                mangle: false
            });

            const html = marked.parse(markdown);
            const tmp = document.createElement('div');
            tmp.innerHTML = html;

            let plain = tmp.textContent || tmp.innerText || '';
            plain = plain.replace(/\s+/g, ' ').trim();

            return plain.length > maxLength
                ? plain.slice(0, maxLength) + '...'
                : plain;
        }

        return markdown.slice(0, maxLength);
    } catch {
        return markdown.slice(0, maxLength);
    }
}

/**
 * HTML escape (코드블럭 보호용)
 */
function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
