import { fetchCategories, resetCache } from '../assets/js/api.js';
import { renderEmptyState } from '../assets/js/components.js';
import { renderCategoryGraph } from '../assets/js/graph.js';
import { navigateTo } from '../assets/js/router.js';

// The SPA router only swaps #main-content's innerHTML on navigation — it
// never reloads the page — so the previous visit's d3-force simulation must
// be torn down explicitly before starting a new one, or it keeps ticking
// (and its tick handler keeps touching now-detached canvas/label elements).
let currentGraphTeardown = null;

export default async function render(container) {
    if (currentGraphTeardown) {
        currentGraphTeardown();
        currentGraphTeardown = null;
    }

    try {
        const flatCategories = await fetchCategories();

        container.innerHTML = `
            <div class="explorer-header">
                <div class="explorer-header-row">
                    <h1>Category Graph</h1>
                    <button id="reset-cache-btn" class="btn-icon-only" title="Reset DB Cache">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
                            <path d="M3 3v5h5"></path>
                            <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"></path>
                            <path d="M16 21h5v-5"></path>
                        </svg>
                    </button>
                </div>
                <p class="explorer-subtitle">Drag, hover, and click through the knowledge base as a live graph.</p>
                <input type="search" id="category-filter" class="category-filter-input"
                       placeholder="Filter categories..." aria-label="Filter categories">
            </div>
            <div class="category-graph-container glass-full" data-glass-surface="tree"></div>
        `;

        const resetBtn = container.querySelector('#reset-cache-btn');
        if (resetBtn) resetBtn.addEventListener('click', resetCache);

        const graphContainer = container.querySelector('.category-graph-container');
        const graph = renderCategoryGraph(graphContainer, flatCategories, {
            onNodeNavigate: (path) => navigateTo(path),
        });

        const filterEl = container.querySelector('#category-filter');
        filterEl.addEventListener('input', () => graph.setFilter(filterEl.value));

        currentGraphTeardown = graph.teardown;

    } catch (e) {
        console.error('Categories Render Error:', e);
        container.innerHTML = renderEmptyState('Failed to load categories.');
    }
}
