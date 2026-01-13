/**
 * Renders Markdown content into HTML using Marked.js and cleans it with DOMPurify.
 * @param {string} markdown - The raw markdown string.
 * @returns {string} The sanitized and rendered HTML.
 */
export function renderMarkdown(markdown) {
    if (!markdown) return '';

    if (typeof marked === 'undefined') {
        return markdown;
    }

    // ✅ 커스텀 렌더링 규칙
    const renderer = new marked.Renderer();

    // 🔒 코드블럭은 "순수 텍스트"로만 처리
    renderer.code = (code, language) => {
        const escaped = code
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        const langClass = language ? `language-${language}` : 'language-plain';

        return `
<pre class="code-block ${langClass}">
<code>${escaped}</code>
</pre>`;
    };

    marked.setOptions({
        gfm: true,
        breaks: false,      // 🔥 반드시 false
        headerIds: false,
        mangle: false,
        renderer
    });

    const rawHtml = marked.parse(markdown);

    if (typeof DOMPurify !== 'undefined') {
        return DOMPurify.sanitize(rawHtml, {
            USE_PROFILES: { html: true },
            ADD_TAGS: ['pre', 'code'],
            ADD_ATTR: ['class']
        });
    }

    return rawHtml;
}


/**
 * Strips markdown syntax to return plain text for previews.
 * @param {string} markdown 
 * @param {number} maxLength 
 * @returns {string} Plain text excerpt
 */
export function stripMarkdown(markdown, maxLength = 150) {
    if (!markdown) return '';

    try {
        // 1. If marked is available, we can parse to HTML then extract text
        // This is cleaner than regex for complex markdown
        if (typeof marked !== 'undefined') {
            const html = marked.parse(markdown, {
                gfm: true,
                breaks: false   // ✅ 여기서도 false
            });
            const tmp = document.createElement('DIV');
            tmp.innerHTML = html;
            let plain = tmp.textContent || tmp.innerText || '';

            // Collapse whitespaces
            plain = plain.replace(/\s+/g, ' ').trim();

            if (plain.length > maxLength) {
                return plain.substring(0, maxLength) + '...';
            }
            return plain;
        }

        // Fallback simple regex if marked is missing (unlikely now)
        return markdown.replace(/[#*`]/g, '').substring(0, maxLength) + '...';

    } catch (e) {
        return markdown.substring(0, maxLength);
    }
}
