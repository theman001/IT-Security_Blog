import { fetchPosts, fetchPostsByCategory, fetchCategories } from '../assets/js/api.js';
import { renderMarkdown, stripMarkdown } from '../assets/js/renderer.js';
import { renderPostList, renderSubCategoryGrid, renderEmptyState } from '../assets/js/components.js';
import { BASE_PATH } from '../assets/js/base-path.js';
import { renderCategoryGraph } from '../assets/js/graph.js';
import { navigateTo } from '../assets/js/router.js';

function withExcerpt(post) {
    return { ...post, excerpt: post.description || stripMarkdown(post.content || '', 180) };
}

// The SPA router only swaps #main-content's innerHTML — it never reloads the
// page — so the previous visit's WebGL context and graph simulation must be
// torn down explicitly before a new one starts, or they keep running behind
// a detached canvas.
let currentTeardowns = [];
function teardownPrevious() {
    currentTeardowns.forEach(fn => fn());
    currentTeardowns = [];
}

export default async function render(container, params) {
    teardownPrevious();

    if (params && params.slug) {
        await renderCategoryView(container, params);
    } else {
        await renderBentoHome(container);
    }
}

async function renderBentoHome(container) {
    try {
        const [mdRes, allPosts, categories] = await Promise.all([
            fetch(`${BASE_PATH}static/main.md`),
            fetchPosts(),
            fetchCategories(),
        ]);

        const introHtml = mdRes.ok ? renderMarkdown(await mdRes.text()) : '';
        const recentPosts = allPosts.slice(0, 4).map(withExcerpt);

        container.innerHTML = `
            <section class="home-masthead">
                <h1 class="home-masthead-title">THEMAN의 블로그</h1>
                <p class="home-masthead-tagline">재현 안 되는 버그와 재현되는 나의 실수들에 대한 고찰.<br>"...분명 어제는 됐습니다."</p>
            </section>
            <div class="bento-grid">
                <div class="bento-interview bento-tile">
                    <div class="markdown-body home-intro">${introHtml}</div>
                </div>
                <div class="bento-tile bento-graph-preview" data-glass-surface="tree">
                    <div class="bento-mini-graph"></div>
                    <a href="/categories" data-link class="bento-tile-link">전체 그래프 열기 →</a>
                </div>
            </div>
            <section class="home-posts">
                <h2 class="home-posts-heading">최근에 쓴 것들</h2>
                ${renderPostList(recentPosts)}
            </section>
            <a href="/hidden" data-link class="home-egg">
                🕵️ 이 페이지 어딘가에 자잘한 이스터에그가 있다. 버그처럼 보인다면 그건 이스터에그다 <span class="home-egg-arrow">→</span>
            </a>
        `;

        const miniGraphEl = container.querySelector('.bento-mini-graph');
        const miniGraph = renderCategoryGraph(miniGraphEl, categories, {
            onNodeNavigate: (path) => navigateTo(path),
        });
        currentTeardowns.push(miniGraph.teardown);

    } catch (e) {
        console.error('Home Render Error:', e);
        container.innerHTML = renderEmptyState('Failed to load content.');
    }
}

async function renderCategoryView(container, params) {
    try {
        const result = await fetchPostsByCategory(params.slug);
        const posts = result.posts || [];
        const subCategories = result.subCategories || [];

        const parts = params.slug.split('/');
        const folderName = parts[parts.length - 1];
        const pageDesc = result.category && result.category.post_count
            ? `${result.category.post_count} posts in this category`
            : `Browsing ${folderName}`;

        let html = `
            <h1 style="margin-bottom: 0.5rem;">${folderName}</h1>
            <p style="color: var(--muted); margin-bottom: 2rem;">${pageDesc}</p>
        `;

        if (subCategories.length > 0) {
            html += `<div class="section-title">Sub-Categories</div>${renderSubCategoryGrid(subCategories)}`;
        }

        if (posts.length > 0) {
            html += `<div class="section-title">Posts</div>${renderPostList(posts.map(withExcerpt))}`;
        } else if (subCategories.length === 0) {
            html += renderEmptyState('This folder is currently empty.');
        }

        container.innerHTML = html;
    } catch (e) {
        console.error('Category View Render Error:', e);
        container.innerHTML = renderEmptyState('Failed to load content.');
    }
}
