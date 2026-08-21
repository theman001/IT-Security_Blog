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
const LABEL_FONT = '600 12px "JetBrains Mono", monospace';
const POINTER_RADIUS = 100;
const CLICK_DRAG_THRESHOLD = 6; // px — beyond this, a mouseup is a drag, not a click

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

    // A fresh, genuinely different layout every visit — d3-force's own
    // default jitter uses a fixed-seed PRNG (reproducible on purpose), which
    // is exactly why it looked identical on every reload.
    ctx.font = LABEL_FONT;
    nodes.forEach(n => {
        n.x = Math.random() * width;
        n.y = Math.random() * height;
        n.labelHalfWidth = ctx.measureText(n.name).width / 2 + 4;
    });

    function clampToBounds() {
        nodes.forEach(n => {
            const r = radiusFor(n);
            const halfW = Math.max(r, n.labelHalfWidth);
            n.x = Math.min(width - halfW, Math.max(halfW, n.x));
            n.y = Math.min(height - r - 22, Math.max(r, n.y)); // 22 ≈ label line height
        });
    }

    // Nodes near the pointer drift away from it — the graph reacts to
    // hover/touch instead of just settling once and going static.
    const pointer = { x: 0, y: 0 };
    let pointerActive = false;
    function pointerRepulsion(alpha) {
        if (!pointerActive) return;
        nodes.forEach(n => {
            if (n.fx != null) return; // being dragged — don't fight the drag
            const dx = n.x - pointer.x;
            const dy = n.y - pointer.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            if (dist < POINTER_RADIUS) {
                const push = ((POINTER_RADIUS - dist) / POINTER_RADIUS) * 14 * alpha;
                n.vx += (dx / dist) * push;
                n.vy += (dy / dist) * push;
            }
        });
    }

    const simulation = forceSimulation(nodes)
        .force('link', forceLink(links).id(d => d.id).distance(64).strength(0.7))
        .force('charge', forceManyBody().strength(-170))
        .force('center', forceCenter(width / 2, height / 2))
        .force('collide', forceCollide(d => radiusFor(d) + 10))
        .force('pointer', pointerRepulsion)
        .on('tick', () => { clampToBounds(); draw(); });

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
        simulation.stop();
        for (let i = 0; i < 300; i++) simulation.tick();
    }

    let hoveredNode = null;
    let draggingNode = null;
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
            ctx.globalAlpha = dimmed ? 0.15 : (n === hoveredNode || n === draggingNode ? 1 : 0.85);
            ctx.fill();
            ctx.globalAlpha = 1;
        });

        labelsLayer.innerHTML = nodes.map(n => {
            const dimmed = matchSet && !matchSet.has(n.id);
            return `<span class="graph-node-label${dimmed ? ' dimmed' : ''}" style="left:${n.x}px; top:${n.y + radiusFor(n) + 6}px;">${n.name}</span>`;
        }).join('');
    }

    if (prefersReducedMotion) {
        clampToBounds();
        draw();
    }

    function nodeAtPoint(clientX, clientY) {
        const rect = canvas.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        return nodes.find(n => (x - n.x) ** 2 + (y - n.y) ** 2 <= (radiusFor(n) + 4) ** 2);
    }

    function toCanvasPoint(clientX, clientY) {
        const rect = canvas.getBoundingClientRect();
        return { x: clientX - rect.left, y: clientY - rect.top };
    }

    let downPoint = null;

    function onPointerDown(clientX, clientY) {
        const n = nodeAtPoint(clientX, clientY);
        downPoint = { x: clientX, y: clientY };
        if (n) {
            draggingNode = n;
            const p = toCanvasPoint(clientX, clientY);
            n.fx = p.x;
            n.fy = p.y;
            simulation.alphaTarget(0.3).restart();
            canvas.style.cursor = 'grabbing';
        }
    }

    function onPointerMove(clientX, clientY) {
        const p = toCanvasPoint(clientX, clientY);
        pointer.x = p.x;
        pointer.y = p.y;
        pointerActive = true;
        if (simulation.alpha() < 0.05) simulation.alphaTarget(0.05).restart();

        if (draggingNode) {
            draggingNode.fx = p.x;
            draggingNode.fy = p.y;
            return;
        }
        const n = nodeAtPoint(clientX, clientY);
        canvas.style.cursor = n ? 'grab' : 'default';
        if (n !== hoveredNode) {
            hoveredNode = n;
            draw();
        }
    }

    function onPointerUp(clientX, clientY) {
        if (draggingNode) {
            const moved = Math.hypot(clientX - downPoint.x, clientY - downPoint.y);
            const releasedNode = draggingNode;
            releasedNode.fx = null;
            releasedNode.fy = null;
            draggingNode = null;
            simulation.alphaTarget(0);
            if (moved < CLICK_DRAG_THRESHOLD && onNodeNavigate) {
                onNodeNavigate(`/categories/${releasedNode.slug}`);
            }
        }
        canvas.style.cursor = nodeAtPoint(clientX, clientY) ? 'grab' : 'default';
    }

    function onPointerLeave() {
        pointerActive = false;
        simulation.alphaTarget(0);
    }

    const handleMouseDown = (e) => onPointerDown(e.clientX, e.clientY);
    const handleMouseMove = (e) => onPointerMove(e.clientX, e.clientY);
    const handleMouseUp = (e) => onPointerUp(e.clientX, e.clientY);
    const handleMouseLeave = () => onPointerLeave();

    const handleTouchStart = (e) => {
        const t = e.touches[0];
        onPointerDown(t.clientX, t.clientY);
    };
    const handleTouchMove = (e) => {
        const t = e.touches[0];
        onPointerMove(t.clientX, t.clientY);
        if (draggingNode) e.preventDefault(); // stop the page from scrolling while dragging a node
    };
    const handleTouchEnd = (e) => {
        const t = e.changedTouches[0];
        onPointerUp(t.clientX, t.clientY);
        pointerActive = false;
    };

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    canvas.addEventListener('touchstart', handleTouchStart, { passive: true });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd);

    function onThemeChange() { draw(); }
    document.addEventListener('themechange', onThemeChange);

    return {
        teardown() {
            simulation.stop();
            canvas.removeEventListener('mousedown', handleMouseDown);
            canvas.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            canvas.removeEventListener('mouseleave', handleMouseLeave);
            canvas.removeEventListener('touchstart', handleTouchStart);
            canvas.removeEventListener('touchmove', handleTouchMove);
            canvas.removeEventListener('touchend', handleTouchEnd);
            document.removeEventListener('themechange', onThemeChange);
        },
        setFilter(term) {
            const t = term.trim().toLowerCase();
            matchSet = t ? new Set(nodes.filter(n => n.name.toLowerCase().includes(t)).map(n => n.id)) : null;
            draw();
        },
    };
}
