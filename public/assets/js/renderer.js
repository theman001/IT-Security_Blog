/**
 * Markdown Renderer
 * - Marked.js로 Markdown → HTML 변환
 * - DOMPurify로 전체 HTML만 Sanitizing
 * - 코드블럭(pre/code)은 Marked 결과를 그대로 유지
 */

export function renderMarkdown(markdown) {
    if (!markdown) return '';

    // Marked 로딩 안 됐을 때 안전 처리
    if (typeof marked === 'undefined') {
        console.error('[renderer] marked is not loaded');
        return '<p class="error">Markdown engine not loaded.</p>';
    }

    // ✅ Marked 설정 (절대 바꾸지 말 것)
    marked.setOptions({
        gfm: true,
        breaks: false,     // ⚠️ 반드시 false (코드블럭 보호)
        headerIds: false,
        mangle: false
    });

    let html;
    try {
        html = marked.parse(markdown);
    } catch (e) {
        console.error('[renderer] marked.parse failed:', e);
        return '<p class="error">Markdown rendering failed.</p>';
    }

    // DOMPurify는 "HTML 전체"만 정화
    // ❌ pre / code / 줄바꿈 / 공백에는 관여하지 않음
    if (typeof DOMPurify !== 'undefined') {
        try {
            return DOMPurify.sanitize(html, {
                USE_PROFILES: { html: true }
            });
        } catch (e) {
            console.error('[renderer] DOMPurify failed:', e);
            return '<p class="error">Content sanitizing failed.</p>';
        }
    }

    // DOMPurify가 없는 경우 fallback
    return html;
}

/**
 * Markdown → Plain text (미리보기용)
 * - 게시글 목록 요약 등에 사용
 * - 코드블럭 / 포맷 제거
 */
export function stripMarkdown(markdown, maxLength = 150) {
    if (!markdown) return '';

    try {
        if (typeof marked !== 'undefined') {
            const html = marked.parse(markdown);
            const tmp = document.createElement('div');
            tmp.innerHTML = html;

            let text = tmp.textContent || tmp.innerText || '';
            text = text.replace(/\s+/g, ' ').trim();

            if (text.length > maxLength) {
                return text.slice(0, maxLength) + '...';
            }
            return text;
        }
    } catch (e) {
        console.warn('[renderer] stripMarkdown failed:', e);
    }

    // 최후 fallback
    return markdown.replace(/[#*`]/g, '').slice(0, maxLength);
}
