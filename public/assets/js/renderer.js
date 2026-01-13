/**
 * Markdown Renderer (SAFE & STABLE)
 */
export function renderMarkdown(markdown) {
    if (!markdown) return '';

    if (typeof marked === 'undefined') {
        return markdown;
    }

    marked.setOptions({
        gfm: true,
        breaks: false,          // ← 반드시 false
        headerIds: false,
        mangle: false
    });

    let html;
    try {
        html = marked.parse(markdown);
    } catch (e) {
        console.error('Marked parse failed:', e);
        return '<p class="error">Markdown rendering failed.</p>';
    }

    // ✅ DOMPurify는 "전체 HTML"만 정화
    // ❌ pre / code / 줄바꿈에는 절대 관여하지 않음
    if (typeof DOMPurify !== 'undefined') {
        return DOMPurify.sanitize(html, {
            USE_PROFILES: { html: true }
        });
    }

    return html;
}
