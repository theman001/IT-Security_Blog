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

    // Navigation Logic (Prev / List / Next)
    // 1. List Button: Go to category page
    const listUrl = (post.categoryName && post.categoryName !== 'Uncategorized')
        ? `/categories/contents/${post.categoryName}`
        : '/categories';

    // 2. Prev/Next Buttons using fetched data
    // Slug already contains 'contents/...' structure from DB
    const prevLink = post.prev
        ? `<a href="/posts/${post.prev.slug}" data-link class="nav-btn prev-btn" title="${post.prev.title}">← Prev</a>`
        : `<span class="nav-btn disabled">← Prev</span>`;

    const nextLink = post.next
        ? `<a href="/posts/${post.next.slug}" data-link class="nav-btn next-btn" title="${post.next.title}">Next →</a>`
        : `<span class="nav-btn disabled">Next →</span>`;

    const listLink = `<a href="${listUrl}" data-link class="nav-btn list-btn">List</a>`;

    // Inject styles and content
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
                
                ${post.description ? `<p class="post-description">${post.description}</p>` : ''}
                
                ${tagsHtml}

                <div class="post-meta-info">
                    <span>${post.date}</span>
                </div>
            </header>
            
            <div class="markdown-body">
                ${htmlContent}
            </div>
            
            <div class="post-navigation-container">
                ${prevLink}
                ${listLink}
                ${nextLink}
            </div>
        </article>
    `;

    // Trigger Code Syntax Highlighting
    if (window.Prism) {
        window.Prism.highlightAll();
    }
}
