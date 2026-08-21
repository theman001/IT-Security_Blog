import { fetchCategories, fetchAllPostsSimple, resetCache } from '../assets/js/api.js';

export default async function render(container) {
    try {
        const [flatCategories, flatPosts] = await Promise.all([
            fetchCategories(),
            fetchAllPostsSimple()
        ]);

        const tree = buildTree(flatCategories, flatPosts);

        container.innerHTML = `
            <div class="explorer-header" style="margin-bottom: 2rem;">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 0.5rem;">
                    <h1 style="margin: 0;">Category Explorer</h1>
                    <button id="reset-cache-btn" class="btn-icon-only" title="Reset DB Cache" style="width: 32px; height: 32px; border: none;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
                            <path d="M3 3v5h5"></path>
                            <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"></path>
                            <path d="M16 21h5v-5"></path>
                        </svg>
                    </button>
                </div>
                <p style="color: var(--muted); margin: 0;">Navigate through the knowledge base.</p>
            </div>
            <div class="category-tree-container">
                ${renderTree(tree)}
            </div>
        `;

        // Reset Cache Button Listener
        const resetBtn = container.querySelector('#reset-cache-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', resetCache);
        }

        // Event Delegation for Tree Interactions
        const treeContainer = container.querySelector('.category-tree-container');
        treeContainer.addEventListener('click', (e) => {
            // Handle Toggle Button Click
            const toggleBtn = e.target.closest('.tree-toggle');
            if (toggleBtn) {
                e.preventDefault();
                e.stopPropagation();
                const item = toggleBtn.closest('.tree-item');
                item.classList.toggle('expanded');
                return;
            }

            // Handle Row content Click (Expand/Collapse)
            const contentRow = e.target.closest('.tree-content');
            if (contentRow) {
                // If clicking directly on a link (post or category link), let it handle navigation
                if (e.target.tagName === 'A' || e.target.closest('a')) return;

                const item = contentRow.closest('.tree-item');
                // Only toggle if it has children (subcategories OR posts)
                if (item.classList.contains('has-children')) {
                    item.classList.toggle('expanded');
                }
            }
        });

    } catch (e) {
        console.error('Categories Render Error:', e);
        container.innerHTML = '<p class="error">Failed to load categories.</p>';
    }
}

// Convert Flat List to Nested Tree & Skip Root 'contents'
function buildTree(categories, posts) {
    const lookup = {};
    const rootItems = [];

    // 1. Initialize Lookup with Categories
    categories.forEach(item => {
        lookup[item.id] = {
            ...item,
            type: 'category',
            children: [],
            posts: [] // Separate array for posts
        };
    });

    // 2. Add Posts to valid Categories
    posts.forEach(post => {
        if (lookup[post.category_id]) {
            lookup[post.category_id].posts.push({
                ...post,
                type: 'post'
            });
        }
    });

    // 3. Build Category Tree Structure
    categories.forEach(item => {
        if (item.parent_id === null) {
            rootItems.push(lookup[item.id]);
        } else {
            if (lookup[item.parent_id]) {
                lookup[item.parent_id].children.push(lookup[item.id]);
            }
        }
    });

    // 4. Skip 'contents' root folder if it exists
    const root = rootItems.find(r => r.slug === 'contents');
    if (root && rootItems.length === 1) {
        return root.children;
    }

    return rootItems;
}

// Recursive Render Function with Card UI
function renderTree(nodes) {
    if (!nodes || nodes.length === 0) return '';

    let html = '<ul class="tree-list">';

    nodes.forEach(node => {
        // A node has "children" if it has subcategories OR posts
        const subCategories = node.children || [];
        const posts = node.posts || [];
        const hasChildren = (subCategories.length + posts.length) > 0;
        const totalCount = subCategories.length + posts.length;

        // Icons
        const chevron = `<svg class="chevron-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
        const folderIcon = `<svg class="folder-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`;

        html += `
            <li class="tree-item ${hasChildren ? 'has-children' : ''}">
                <div class="tree-content">
                    <span class="tree-toggle ${hasChildren ? '' : 'hidden'}">${chevron}</span>
                    <span class="tree-icon">${folderIcon}</span>
                    <a href="/categories/${node.slug}" data-link class="tree-label">
                        ${node.name}
                    </a>
                    <span class="tree-badge">
                        ${totalCount}
                    </span>
                </div>
                <!-- Render Subcategories FIRST, then Posts -->
                ${hasChildren ? `
                    <div class="tree-children">
                        ${renderTree(subCategories)}
                        ${renderPosts(posts)}
                    </div>
                ` : ''}
            </li>
        `;
    });

    html += '</ul>';
    return html;
}

// Helper to render posts list
function renderPosts(posts) {
    if (!posts || posts.length === 0) return '';
    let html = '<ul class="tree-list tree-posts">'; // Separate class if needed

    // Icon for posts
    const fileIcon = `<svg class="file-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.7;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`;

    posts.forEach(post => {
        html += `
            <li class="tree-item tree-post-item">
                <div class="tree-content">
                    <!-- Spacer for alignment with chevron -->
                    <span class="tree-toggle hidden"></span> 
                    <span class="tree-icon">${fileIcon}</span>
                    <a href="/posts/${post.slug}" data-link class="tree-label post-label">
                        ${post.title}
                    </a>
                </div>
            </li>
        `;
    });

    html += '</ul>';
    return html;
}
