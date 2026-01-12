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
            <header class="post-header" style="margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border);">
                <div style="font-size: 0.9rem; color: var(--link); margin-bottom: 0.5rem; font-weight: 500;">
                    ${post.category}
                </div>
                <h1 style="margin: 0 0 0.5rem 0; font-size: 2.2rem; line-height: 1.2;">
                    ${post.title}
                </h1>
                <div class="post-meta" style="color: var(--muted); font-size: 0.9rem;">
                    <span>${post.date}</span>
                </div>
            </header>
            
            <div class="markdown-body">
                ${htmlContent}
            </div>
            
            <div style="margin-top: 3rem; padding-top: 2rem; border-top: 1px solid var(--border);">
                <a href="/" data-link>← Back to Home</a>
            </div>
        </article>
    `;

    // Trigger Code Syntax Highlighting
    if (window.Prism) {
        window.Prism.highlightAll();
    }
}
