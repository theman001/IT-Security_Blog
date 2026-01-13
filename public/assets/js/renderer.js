/**
 * Render Markdown safely
 * - Front Matter 제거는 문서 맨 위에서만 수행
 * - 코드블럭은 그대로 유지
 */
export function renderMarkdown(markdown) {
    if (!markdown) return '';

    if (typeof marked === 'undefined') {
        return markdown;
    }

    try {
        let source = markdown;

        // ✅ Front Matter 제거 (문서 최상단에 있을 때만)
        if (source.startsWith('---')) {
            const fmEnd = source.indexOf('\n---', 3);
            if (fmEnd !== -1) {
                source = source.slice(fmEnd + 4).trimStart();
            }
        }

        marked.setOptions({
            gfm: true,
            breaks: false,        // ❗ 유지
            headerIds: false,
            mangle: false
        });

        const html = marked.parse(source);

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
