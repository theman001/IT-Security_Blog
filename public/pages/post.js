import { fetchPostBySlug } from '../assets/js/api.js';
import { renderMarkdown } from '../assets/js/renderer.js';

export default async function render(container, params) {
    if (!params || !params.slug) {
        container.innerHTML = '<p class="error">Invalid post URL.</p>';
        return;
    }

    const post = await fetchPostBySlug(params.slug);

    if (!post) {
        container.innerHTML = '<p class="error">Post not found.</p>';
        return;
    }

    // Render MD to HTML (using marked + dompurify from renderer.js)
    const htmlContent = renderMarkdown(post.content);

    container.innerHTML = `
        <article class="post-content">
            <header class="post-header">
                <div class="post-category-label">
                    ${post.categoryName || 'Uncategorized'}
                </div>
                <h1 class="post-title">
                    ${post.title}
                </h1>
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
