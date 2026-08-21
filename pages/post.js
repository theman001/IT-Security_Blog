import { fetchPostBySlug } from '../assets/js/api.js';
import { renderMarkdown } from '../assets/js/renderer.js';
import {
    renderPostMetaBadges,
    renderPostTags,
    renderPostNav,
    renderErrorState,
    renderReadingProgress,
    initReadingProgress,
    buildTOC,
} from '../assets/js/components.js';

export default async function render(container, params) {
    // Scroll to Top on Render
    window.scrollTo(0, 0);

    if (!params || !params.slug) {
        container.innerHTML = renderErrorState({ title: '400', message: 'Invalid post URL.' });
        return;
    }

    const post = await fetchPostBySlug(params.slug);

    if (!post) {
        container.innerHTML = renderErrorState({ title: '404', message: 'Post not found.' });
        return;
    }

    // Render MD to HTML (using marked + dompurify from renderer.js)
    const htmlContent = renderMarkdown(post.content);

    // 1. List Button: Go to category page
    const listUrl = (post.categoryName && post.categoryName !== 'Uncategorized')
        ? `/categories/contents/${post.categoryName}`
        : '/categories';

    container.innerHTML = `
        ${renderReadingProgress()}
        <article class="post-content">
            <header class="post-header">
                ${renderPostMetaBadges(post)}

                <h1 class="post-title">
                    ${post.title}
                </h1>

                ${renderPostTags(post.tags)}

                <div class="post-meta-info">
                    <span>${post.date}</span>
                </div>
            </header>

            <div class="markdown-body">
                ${htmlContent}
            </div>

            ${renderPostNav({ prev: post.prev, next: post.next, listUrl })}
        </article>
    `;

    initReadingProgress(container);

    // TOC needs the (now-rendered) markdown body — insert it right after the header
    const tocHtml = buildTOC(container);
    if (tocHtml) {
        container.querySelector('.post-header').insertAdjacentHTML('afterend', tocHtml);
    }
}
