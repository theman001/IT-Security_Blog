import { fetchCategories } from '../assets/js/api.js';

export default async function render(container) {
    try {
        const flatCategories = await fetchCategories();
        const tree = buildTree(flatCategories);

        container.innerHTML = `
            <div class="explorer-header" style="margin-bottom: 2rem;">
                <h1 style="margin-bottom: 0.5rem;">Category Explorer</h1>
                <p style="color: var(--muted);">Navigate through the knowledge base.</p>
            </div>
            <div class="category-tree-container">
                ${renderTree(tree)}
            </div>
        `;

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

            // Handle Row Click (Expand/Collapse as well if it has children)
            const contentRow = e.target.closest('.tree-content');
            if (contentRow) {
                // If clicking directly on the link, let it navigate (don't toggle)
                if (e.target.tagName === 'A' || e.target.closest('a')) return;

                const item = contentRow.closest('.tree-item');
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
function buildTree(items) {
    const lookup = {};
    const rootItems = [];

    // 1. Initialize Lookup
    items.forEach(item => {
        lookup[item.id] = { ...item, children: [] };
    });

    // 2. Build Tree Structure
    items.forEach(item => {
        if (item.parent_id === null) {
            rootItems.push(lookup[item.id]);
        } else {
            if (lookup[item.parent_id]) {
                lookup[item.parent_id].children.push(lookup[item.id]);
            }
        }
    });

    // 3. Skip 'contents' root folder if it exists
    // Assuming the root folder slug is 'contents', we return its children directly.
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
        const hasChildren = node.children && node.children.length > 0;

        // SVG Icons
        // Use a standard right-pointing chevron for collapsed state >
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
                        ${hasChildren ? node.children.length : (node.post_count || 0)}
                    </span>
                </div>
                ${hasChildren ? renderTree(node.children) : ''}
            </li>
        `;
    });

    html += '</ul>';
    return html;
}
