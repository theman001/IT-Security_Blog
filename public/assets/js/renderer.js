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

    marked.setOptions({
        gfm: true,
        breaks: false,      // ✅ 반드시 false
        headerIds: false,
        mangle: false,
        smartypants: false // 따옴표/기호 자동 변환 방지 (보안 블로그 필수)
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
            const html = marked.parse(markdown);
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
