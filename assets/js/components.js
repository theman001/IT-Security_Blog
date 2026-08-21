// Shared render helpers — every page module builds its markup from these
// instead of hand-rolling <article class="post-card"> etc. inline. Keeps
// markup (and its inline styles) in exactly one place per plan Phase 2.

const folderIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`;

export function renderPostCard(post) {
    const excerpt = post.description || post.excerpt || '';
    return `
        <article class="post-card">
            <div class="post-meta">${post.date || ''}</div>
            <h2 class="post-title">
                <a href="/posts/${post.slug}" data-link>${post.title}</a>
            </h2>
            <p class="post-excerpt">${excerpt}</p>
        </article>
    `;
}

export function renderSubCategoryTile(sub) {
    const count = parseInt(sub.post_count || 0) + parseInt(sub.sub_category_count || 0);
    return `
        <div class="post-card subcategory-tile">
            <a href="/categories/${sub.slug}" data-link class="subcategory-link">
                <span class="subcategory-icon">${folderIcon}</span>
                <span>${sub.name}</span>
            </a>
            <span class="tree-badge">${count}</span>
        </div>
    `;
}

export function renderPostList(posts, { emptyMessage } = {}) {
    if (!posts || posts.length === 0) {
        return emptyMessage ? renderEmptyState(emptyMessage) : '';
    }
    return `<div class="post-list">${posts.map(renderPostCard).join('')}</div>`;
}

export function renderSubCategoryGrid(subCategories) {
    if (!subCategories || subCategories.length === 0) return '';
    return `<div class="post-list subcategory-grid">${subCategories.map(renderSubCategoryTile).join('')}</div>`;
}

export function renderPostMetaBadges({ categoryName, authorType }) {
    const categoryHtml = (categoryName && categoryName !== 'Uncategorized')
        ? `<span class="post-category-label">${categoryName}</span>`
        : '';
    const authorHtml = authorType ? `<span class="post-author-label">By ${authorType}</span>` : '';
    return `<div class="post-meta-top">${categoryHtml}${authorHtml}</div>`;
}

export function renderPostTags(tags) {
    if (!tags || tags.length === 0) return '';
    return `<div class="post-tags">${tags.map(tag => `<span class="tag-badge">#${tag}</span>`).join('')}</div>`;
}

export function renderPostNav({ prev, next, listUrl }) {
    const prevLink = prev
        ? `<a href="/posts/${prev.slug}" data-link class="nav-btn prev-btn" title="${prev.title}">← Prev</a>`
        : `<span class="nav-btn disabled">← Prev</span>`;
    const nextLink = next
        ? `<a href="/posts/${next.slug}" data-link class="nav-btn next-btn" title="${next.title}">Next →</a>`
        : `<span class="nav-btn disabled">Next →</span>`;
    return `
        <div class="post-navigation-container">
            ${prevLink}
            <a href="${listUrl}" data-link class="nav-btn list-btn">List</a>
            ${nextLink}
        </div>
    `;
}

export function renderEmptyState(message, { icon = '' } = {}) {
    return `
        <div class="empty-state">
            ${icon ? `<div class="empty-state-icon">${icon}</div>` : ''}
            <p>${message}</p>
        </div>
    `;
}

export function renderErrorState({ title = 'Error', message = 'Something went wrong.', detail = '', showHomeLink = true } = {}) {
    return `
        <div class="error-state">
            <h1 class="error-state-title">${title}</h1>
            <h2 class="error-state-message">${message}</h2>
            ${detail ? `<p class="error-state-detail">${detail}</p>` : ''}
            ${showHomeLink ? `<a href="/" data-link class="back-link">Go Home</a>` : ''}
        </div>
    `;
}

export function renderSkeletonList(count = 3) {
    const card = `
        <div class="post-card skeleton" aria-hidden="true">
            <div class="skeleton-line skeleton-line-meta"></div>
            <div class="skeleton-line skeleton-line-title"></div>
            <div class="skeleton-line skeleton-line-excerpt"></div>
        </div>
    `;
    return `<div class="post-list" role="status" aria-label="Loading posts">${card.repeat(count)}</div>`;
}

export function renderSkeletonPost() {
    return `
        <div class="skeleton-post" role="status" aria-label="Loading post">
            <div class="skeleton-line skeleton-line-meta" style="width: 30%;"></div>
            <div class="skeleton-line skeleton-line-heading"></div>
            <div class="skeleton-line"></div>
            <div class="skeleton-line"></div>
            <div class="skeleton-line" style="width: 80%;"></div>
        </div>
    `;
}

/** Fixed top progress bar reflecting page scroll. Call initReadingProgress()
 *  once the returned markup is in the DOM. */
export function renderReadingProgress() {
    return `<div class="reading-progress glass-lite"><div class="reading-progress-bar"></div></div>`;
}

// The SPA router only swaps #main-content's innerHTML — it never reloads the
// page — so each post view calling initReadingProgress() must drop the
// previous route's scroll listener, or they pile up on `window` forever.
let currentProgressListener = null;

export function initReadingProgress(root = document) {
    if (currentProgressListener) {
        window.removeEventListener('scroll', currentProgressListener);
        currentProgressListener = null;
    }

    const bar = root.querySelector('.reading-progress-bar');
    if (!bar) return;

    const update = () => {
        const scrollTop = window.scrollY;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const pct = docHeight > 0 ? Math.min(100, (scrollTop / docHeight) * 100) : 0;
        bar.style.width = `${pct}%`;
    };

    update();
    currentProgressListener = update;
    window.addEventListener('scroll', update, { passive: true });
}

/** Builds a table of contents from h2/h3 headings inside `root` (assigning
 *  ids as needed). Only returns markup when there are 3+ headings — a
 *  short post doesn't need a TOC. */
export function buildTOC(root) {
    const headings = root.querySelectorAll('.markdown-body h2, .markdown-body h3');
    if (headings.length < 3) return '';

    const items = Array.from(headings).map((heading, i) => {
        if (!heading.id) heading.id = `toc-heading-${i}`;
        const indent = heading.tagName === 'H3' ? ' class="post-toc-sub"' : '';
        return `<li${indent}><a href="#${heading.id}">${heading.textContent}</a></li>`;
    });

    return `
        <nav class="post-toc glass-lite" aria-label="Table of contents">
            <div class="post-toc-title">On this page</div>
            <ul>${items.join('')}</ul>
        </nav>
    `;
}
