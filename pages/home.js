import { fetchPosts, fetchPostsByCategory } from '../assets/js/api.js';
import { stripMarkdown, renderMarkdown } from '../assets/js/renderer.js';

export default async function render(container, params) {
    let mode = 'latest';
    let posts = [];
    let subCategories = []; // Separate variable for subs
    let pageTitle = 'Latest Posts';
    let pageDesc = 'Exploring the world of IT Security and Development.';

    try {
        if (params && params.slug) {
            // --- Category View ---
            mode = 'category';
            console.log(`Fetching category: ${params.slug}`); // Debug

            // Should return { posts: [], subCategories: [], category: {...} }
            const result = await fetchPostsByCategory(params.slug);

            posts = result.posts || [];
            subCategories = result.subCategories || [];

            // Set Titles
            const parts = params.slug.split('/');
            const folderName = parts[parts.length - 1];
            pageTitle = folderName;

            if (result.category && result.category.post_count) {
                pageDesc = `${result.category.post_count} posts in this category`;
            } else {
                pageDesc = `Browsing ${folderName}`;
            }

        } else {
            // --- Home View (Introduction from main.md) ---
            const res = await fetch('/static/main.md');
            if (res.ok) {
                const text = await res.text();
                const htmlContent = renderMarkdown(text);
                container.innerHTML = `<div class="markdown-body" style="padding: 1rem 0;">${htmlContent}</div>`;
                return; // Stop here, do not run post list rendering logic below
            } else {
                // Fallback if main.md is missing
                console.warn('main.md not found, falling back to post list.');
                posts = await fetchPosts();
            }
        }
    } catch (e) {
        console.error('Home Render Error:', e);
        container.innerHTML = '<p class="error">Failed to load content.</p>';
        return;
    }

    // --- Render Header (Only for Category View now) ---
    let html = `
        <h1 style="margin-bottom: 0.5rem;">${pageTitle}</h1>
        <p style="color: var(--muted); margin-bottom: 2rem;">${pageDesc}</p>
    `;

    // --- Render Sub-Categories ---
    if (mode === 'category' && subCategories.length > 0) {
        html += `<div class="section-title">Sub-Categories</div>
                 <div class="post-list" style="grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); margin-bottom: 3rem;">`;

        subCategories.forEach(sub => {
            html += `
                <div class="post-card" style="padding: 1rem; display: flex; align-items: center; justify-content: space-between;">
                    <a href="/categories/${sub.slug}" data-link style="text-decoration: none; color: var(--text-color); font-weight: 600; display: flex; align-items: center;">
                        <span style="margin-right: 8px;">📂</span> ${sub.name}
                    </a>
                    <span style="background: var(--code-bg); padding: 2px 8px; border-radius: 12px; font-size: 0.8rem; color: var(--muted);">
                        ${(parseInt(sub.post_count || 0) + parseInt(sub.sub_category_count || 0))}
                    </span>
                </div>`;
        });
        html += `</div>`;
    }

    // --- Render Posts (For Category View) ---
    if (posts.length > 0) {
        if (mode === 'category') html += `<div class="section-title">Posts</div>`;

        html += `<div class="post-list">`;
        posts.forEach(post => {
            // Use description if available, otherwise fallback to stripped content
            const excerpt = post.description || stripMarkdown(post.content || '', 180);
            html += `
                <article class="post-card">
                    <div class="post-meta" style="margin-bottom: 0.5rem; font-size: 0.85rem; color: var(--muted);">${post.date}</div>
                    <h2 class="post-title" style="margin-top: 0;">
                        <a href="/posts/${post.slug}" data-link>${post.title}</a>
                    </h2>
                    <p class="post-excerpt" style="color: var(--muted); font-size: 0.95rem;">${excerpt}</p>
                </article>
            `;
        });
        html += `</div>`;
    } else {
        // No posts found (handled for both Home and Empty Category)
        if (mode === 'category' && subCategories.length === 0) {
            html += `<div style="text-align: center; color: var(--muted); padding: 2rem;">
                        <p>This folder is currently empty.</p>
                      </div>`;
        } else if (subCategories.length === 0 && mode === 'category') { // Only show Not Found if no subcategories either
            html += `<div style="text-align: center; color: var(--muted); padding: 2rem;">
                        <h3>Post not found.</h3>
                      </div>`;
        }
    }

    container.innerHTML = html;
}
