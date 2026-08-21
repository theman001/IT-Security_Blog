// Force-directed category graph — replaces the collapsible folder tree.
// Physics via d3-force (data-only, no DOM/SVG binding from d3 itself);
// rendering is hand-rolled Canvas2D + an HTML label overlay (crisper text,
// and real elements a screen reader can at least locate). A parallel plain
// <nav><ul><a>...</a></ul></nav> list carries the *actual* accessible/
// keyboard path — the canvas is decorative+pointer-only on top of it.
import { forceSimulation, forceManyBody, forceLink, forceCenter, forceCollide } from 'd3-force';

function buildNodesAndLinks(categories) {
    // Same "skip a lone 'contents' wrapper root" rule the old tree view used.
    let effective = categories;
    const roots = categories.filter(c => c.parent_id === null);
    if (roots.length === 1 && roots[0].slug === 'contents') {
        const rootId = roots[0].id;
        effective = categories.filter(c => c.id !== rootId);
    }

    const idsInSet = new Set(effective.map(c => c.id));
    const nodes = effective.map(c => ({
        id: c.id,
        slug: c.slug,
        name: c.name,
        path: c.path,
        parent_id: c.parent_id,
        isRoot: !idsInSet.has(c.parent_id),
        count: parseInt(c.post_count || 0, 10) + parseInt(c.sub_category_count || 0, 10),
    }));

    const links = nodes
        .filter(n => idsInSet.has(n.parent_id))
        .map(n => ({ source: n.parent_id, target: n.id }));

    return { nodes, links };
}

const radiusFor = (n) => 10 + Math.sqrt(n.count) * 4;

/**
 * Renders an interactive force-directed graph of `categories` into
 * `container`. Calls `onNodeNavigate(path)` with an app-relative path
 * (e.g. "/categories/Security/Hack") when a node is activated.
 * Returns { teardown, setFilter(term) }.
 */
export function renderCategoryGraph(container, categories, { onNodeNavigate } = {}) {
    const { nodes, links } = buildNodesAndLinks(categories);

    container.innerHTML = `
        <canvas class="category-graph-canvas"></canvas>
        <div class="category-graph-labels" aria-hidden="true"></div>
        <nav class="category-graph-fallback" aria-label="Categories (list view)">
            <ul>
                ${nodes.map(n => `<li><a href="/categories/${n.slug}" data-link>${n.name} <span class="graph-fallback-count">${n.count}</span></a></li>`).join('')}
            </ul>
        </nav>
    `;

    const canvas = container.querySelector('.category-graph-canvas');
    const labelsLayer = container.querySelector('.category-graph-labels');
    const ctx = canvas.getContext('2d');

    const width = container.clientWidth || 640;
    const height = Math.max(360, container.clientHeight || 420);

    const simulation = forceSimulation(nodes)
        .force('link', forceLink(links).id(d => d.id).distance(64).strength(0.7))
        .force('charge', forceManyBody().strength(-170))
        .force('center', forceCenter(width / 2, height / 2))
        .force('collide', forceCollide(d => radiusFor(d) + 10));

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
        simulation.stop();
        for (let i = 0; i < 300; i++) simulation.tick();
    }

    let hoveredNode = null;
    let matchSet = null; // null = no active filter; Set of ids = filtered

    function draw() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const pxW = Math.round(width * dpr);
        const pxH = Math.round(height * dpr);
        if (canvas.width !== pxW || canvas.height !== pxH) {
            canvas.width = pxW;
            canvas.height = pxH;
            canvas.style.width = width + 'px';
            canvas.style.height = height + 'px';
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, width, height);

        const style = getComputedStyle(document.documentElement);
        const borderColor = style.getPropertyValue('--border').trim();
        const accent = style.getPropertyValue('--accent').trim();
        const accent2 = style.getPropertyValue('--accent-2').trim();

        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 1;
        links.forEach(l => {
            ctx.beginPath();
            ctx.moveTo(l.source.x, l.source.y);
            ctx.lineTo(l.target.x, l.target.y);
            ctx.stroke();
        });

        nodes.forEach(n => {
            const r = radiusFor(n);
            const dimmed = matchSet && !matchSet.has(n.id);
            ctx.beginPath();
            ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
            ctx.fillStyle = n.isRoot ? accent : accent2;
            ctx.globalAlpha = dimmed ? 0.15 : (n === hoveredNode ? 1 : 0.85);
            ctx.fill();
            ctx.globalAlpha = 1;
        });

        labelsLayer.innerHTML = nodes.map(n => {
            const dimmed = matchSet && !matchSet.has(n.id);
            return `<span class="graph-node-label${dimmed ? ' dimmed' : ''}" style="left:${n.x}px; top:${n.y + radiusFor(n) + 6}px;">${n.name}</span>`;
        }).join('');
    }

    simulation.on('tick', draw);
    if (prefersReducedMotion) draw();

    function nodeAtPoint(clientX, clientY) {
        const rect = canvas.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        return nodes.find(n => (x - n.x) ** 2 + (y - n.y) ** 2 <= radiusFor(n) ** 2);
    }

    function handleClick(e) {
        const n = nodeAtPoint(e.clientX, e.clientY);
        if (n && onNodeNavigate) onNodeNavigate(`/categories/${n.slug}`);
    }
    function handleMove(e) {
        const n = nodeAtPoint(e.clientX, e.clientY);
        canvas.style.cursor = n ? 'pointer' : 'default';
        if (n !== hoveredNode) {
            hoveredNode = n;
            draw();
        }
    }
    canvas.addEventListener('click', handleClick);
    canvas.addEventListener('mousemove', handleMove);

    function onThemeChange() { draw(); }
    document.addEventListener('themechange', onThemeChange);

    return {
        teardown() {
            simulation.stop();
            canvas.removeEventListener('click', handleClick);
            canvas.removeEventListener('mousemove', handleMove);
            document.removeEventListener('themechange', onThemeChange);
        },
        setFilter(term) {
            const t = term.trim().toLowerCase();
            matchSet = t ? new Set(nodes.filter(n => n.name.toLowerCase().includes(t)).map(n => n.id)) : null;
            draw();
        },
    };
}
