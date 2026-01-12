import { fetchPostBySlug } from '../assets/js/api.js';
import { renderMarkdown } from '../assets/js/renderer.js';

export default async function render(container, params) {
    // Scroll to Top on Render
    window.scrollTo(0, 0);

    if (!params || !params.slug) {
        container.innerHTML = '<p class="error">Invalid post URL.</p>';
        return;
    }

    console.log('[DEBUG] Post Page Params:', params);

    const post = await fetchPostBySlug(params.slug);

    if (!post) {
        container.innerHTML = '<p class="error">Post not found.</p>';
        return;
    }

    // Render MD to HTML (using marked + dompurify from renderer.js)
    const htmlContent = renderMarkdown(post.content);

    // Generate Tags HTML
    const tagsHtml = post.tags && post.tags.length > 0
        ? `<div class="post-tags">
            ${post.tags.map(tag => `<span class="tag-badge">#${tag}</span>`).join('')}
           </div>`
        : '';

    // Category Label Logic
    const categoryHtml = (post.categoryName && post.categoryName !== 'Uncategorized')
        ? `<span class="post-category-label">${post.categoryName}</span>`
        : '';

    container.innerHTML = `
        <article class="post-content">
            <header class="post-header">
                <div class="post-meta-top">
                    ${categoryHtml}
                    <span class="post-author-label">By ${post.authorType}</span>
                </div>
                
                <h1 class="post-title">
                    ${post.title}
                </h1>
                
                ${tagsHtml}

                <div class="post-meta-info">
                    <span>${post.date}</span>
                </div>
            </header>
            
            <div class="markdown-body">
                ${htmlContent}
            </div>
            
            <div class="back-link-container">
                <a href="/" data-link class="back-link">← Back to Home</a>
            </div>
        </article>
    `;

    // Trigger Code Syntax Highlighting
    if (window.Prism) {
        window.Prism.highlightAll();
    }
}
