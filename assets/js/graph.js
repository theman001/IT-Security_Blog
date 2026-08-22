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

// oklch()/etc aren't safe to feed directly into a canvas radial-gradient
// lighten-mix by hand. getComputedStyle(probeEl).color looked like the
// obvious way to resolve them to concrete rgb, but this Chromium build
// hands the string straight back as "oklch(0.48 0.15 25)" instead of
// converting it — so a naive numeric-match parse silently read L/C/H as if
// they were 0-255 RGB and produced near-black nonsense colors. Canvas
// fillStyle + getImageData is spec-guaranteed to resolve to concrete 8-bit
// sRGB no matter the input notation, so use that instead.
const _colorProbeCanvas = document.createElement('canvas');
_colorProbeCanvas.width = 1;
_colorProbeCanvas.height = 1;
const _colorProbeCtx = _colorProbeCanvas.getContext('2d', { willReadFrequently: true });
function resolveRgb(cssColor) {
    _colorProbeCtx.clearRect(0, 0, 1, 1);
    _colorProbeCtx.fillStyle = cssColor;
    _colorProbeCtx.fillRect(0, 0, 1, 1);
    const [r, g, b] = _colorProbeCtx.getImageData(0, 0, 1, 1).data;
    return { r, g, b };
}
const lighten = ({ r, g, b }, amt) => ({ r: r + (255 - r) * amt, g: g + (255 - g) * amt, b: b + (255 - b) * amt });
const rgba = ({ r, g, b }, a) => `rgba(${r | 0}, ${g | 0}, ${b | 0}, ${a})`;

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

    // Label <span> elements are created once and repositioned in place on
    // every tick — rebuilding labelsLayer.innerHTML from scratch (destroying
    // and recreating every node's element) ~60x/sec was the actual cause of
    // the choppy, stuttering node movement: full DOM churn every frame,
    // competing with the canvas redraw for the same frame budget.
    const labelEls = nodes.map(n => {
        const span = document.createElement('span');
        span.className = 'graph-node-label';
        span.textContent = n.name;
        labelsLayer.appendChild(span);
        return span;
    });

    // Not const: measuring clientWidth/Height right after innerHTML can catch
    // the container mid-layout (e.g. before web fonts finish loading and
    // reflow the grid row this sits in) — a ResizeObserver below keeps these
    // in sync with reality instead of baking in a one-time, possibly-stale
    // size for the canvas's entire lifetime (that's exactly what let the
    // canvas grow past its own container and block the "explore full graph"
    // link sitting under it).
    let width = container.clientWidth || 640;
    let height = Math.max(360, container.clientHeight || 420);

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

    const centerForce = forceCenter(width / 2, height / 2);
    const simulation = forceSimulation(nodes)
        .force('link', forceLink(links).id(d => d.id).distance(64).strength(0.7))
        .force('charge', forceManyBody().strength(-170))
        .force('center', centerForce)
        .force('collide', forceCollide(d => radiusFor(d) + 10))
        .force('pointer', pointerRepulsion)
        .on('tick', () => { clampToBounds(); draw(); });

    const resizeObserver = new ResizeObserver((entries) => {
        const entry = entries[0];
        const newWidth = entry.contentRect.width || width;
        const newHeight = Math.max(360, entry.contentRect.height || height);
        if (newWidth === width && newHeight === height) return;
        width = newWidth;
        height = newHeight;
        centerForce.x(width / 2).y(height / 2);
        clampToBounds();
        draw();
        simulation.alpha(0.15).restart();
    });
    resizeObserver.observe(container);

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
        simulation.stop();
        for (let i = 0; i < 300; i++) simulation.tick();
    }

    let hoveredNode = null;
    let draggingNode = null;
    let matchSet = null; // null = no active filter; Set of ids = filtered

    // Resolving oklch() -> rgb via a probe element is too slow to redo every
    // frame; only recompute when the palette actually changes.
    let lastAccentRaw = null;
    let colorCache = null;
    function getPaletteColors(style) {
        const accentRaw = style.getPropertyValue('--accent').trim();
        const accent2Raw = style.getPropertyValue('--accent-2').trim();
        const key = accentRaw + '|' + accent2Raw;
        if (colorCache && lastAccentRaw === key) return colorCache;
        lastAccentRaw = key;
        const accent = resolveRgb(accentRaw);
        const accent2 = resolveRgb(accent2Raw);
        colorCache = {
            accent, accent2,
            accentLight: lighten(accent, 0.4),
            accent2Light: lighten(accent2, 0.4),
        };
        return colorCache;
    }

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
        const { accent, accent2, accentLight, accent2Light } = getPaletteColors(style);

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
            const active = n === hoveredNode || n === draggingNode;
            const alpha = dimmed ? 0.15 : (active ? 1 : 0.85);
            const base = n.isRoot ? accent : accent2;
            const light = n.isRoot ? accentLight : accent2Light;

            // Soft halo — gives the node some depth instead of a flat disc.
            ctx.beginPath();
            ctx.arc(n.x, n.y, r * (active ? 2.1 : 1.7), 0, Math.PI * 2);
            ctx.fillStyle = rgba(base, alpha * 0.16);
            ctx.fill();

            // Body — small radial gradient (off-center highlight) rather than
            // a single flat fill.
            const grad = ctx.createRadialGradient(
                n.x - r * 0.35, n.y - r * 0.35, r * 0.1,
                n.x, n.y, r
            );
            grad.addColorStop(0, rgba(light, alpha));
            grad.addColorStop(1, rgba(base, alpha));
            ctx.beginPath();
            ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
            ctx.fillStyle = grad;
            ctx.fill();

            // Thin bright rim for definition against busy backgrounds.
            ctx.beginPath();
            ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
            ctx.strokeStyle = rgba(light, alpha * 0.9);
            ctx.lineWidth = 1.25;
            ctx.stroke();

            // Root categories get a second, wider ring — a hierarchy cue that
            // doesn't rely on color alone.
            if (n.isRoot && !dimmed) {
                ctx.beginPath();
                ctx.arc(n.x, n.y, r + 5, 0, Math.PI * 2);
                ctx.strokeStyle = rgba(base, 0.45);
                ctx.lineWidth = 1;
                ctx.stroke();
            }
        });

        nodes.forEach((n, i) => {
            const span = labelEls[i];
            const dimmed = matchSet && !matchSet.has(n.id);
            span.style.left = n.x + 'px';
            span.style.top = (n.y + radiusFor(n) + 6) + 'px';
            span.classList.toggle('dimmed', !!dimmed);
        });
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
            resizeObserver.disconnect();
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
