import { fetchPosts, fetchPostsByCategory } from '../assets/js/api.js';
import { renderMarkdown, stripMarkdown } from '../assets/js/renderer.js';
import { renderPostList, renderSubCategoryGrid, renderEmptyState } from '../assets/js/components.js';
import { BASE_PATH } from '../assets/js/base-path.js';

function withExcerpt(post) {
    return { ...post, excerpt: post.description || stripMarkdown(post.content || '', 180) };
}

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
            // --- Home View (Introduction from main.md + recent posts teaser) ---
            const [res, allPosts] = await Promise.all([fetch(`${BASE_PATH}static/main.md`), fetchPosts()]);
            if (res.ok) {
                const text = await res.text();
                const htmlContent = renderMarkdown(text);
                const recentPosts = allPosts.slice(0, 5).map(withExcerpt);
                container.innerHTML = `
                    <div class="markdown-body home-intro">${htmlContent}</div>
                    ${recentPosts.length > 0 ? `
                        <div class="section-title">Recent Posts</div>
                        ${renderPostList(recentPosts)}
                    ` : ''}
                `;
                return; // Stop here, do not run category-view rendering logic below
            } else {
                // Fallback if main.md is missing
                console.warn('main.md not found, falling back to post list.');
                posts = allPosts;
            }
        }
    } catch (e) {
        console.error('Home Render Error:', e);
        container.innerHTML = renderEmptyState('Failed to load content.');
        return;
    }

    // --- Render Header (Only for Category View now) ---
    let html = `
        <h1 style="margin-bottom: 0.5rem;">${pageTitle}</h1>
        <p style="color: var(--muted); margin-bottom: 2rem;">${pageDesc}</p>
    `;

    // --- Render Sub-Categories ---
    if (mode === 'category' && subCategories.length > 0) {
        html += `<div class="section-title">Sub-Categories</div>${renderSubCategoryGrid(subCategories)}`;
    }

    // --- Render Posts (For Category View) ---
    if (posts.length > 0) {
        if (mode === 'category') html += `<div class="section-title">Posts</div>`;
        html += renderPostList(posts.map(withExcerpt));
    } else if (mode === 'category' && subCategories.length === 0) {
        html += renderEmptyState('This folder is currently empty.');
    }

    container.innerHTML = html;
}
