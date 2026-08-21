// Ported from docs/references/liquid-glass/liquidGlass.ts + the runtime glue in
// LiquidGlass.astro (redrawGlass/initGlass), stripped of the Astro/anime.js-only
// bits (background image spinner) this blog doesn't use. The displacement-map
// math is unchanged from the original.

type DisplacementOptions = {
    height: number;
    width: number;
    radius: number;
    depth: number;
    strength?: number;
    chromaticAberration?: number;
};

const getDisplacementMap = ({
    height,
    width,
    radius,
    depth,
}: Omit<DisplacementOptions, 'chromaticAberration' | 'strength'>) =>
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(`<svg height="${height}" width="${width}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <style>
        .mix { mix-blend-mode: screen; }
    </style>
    <defs>
        <linearGradient
          id="Y"
          x1="0"
          x2="0"
          y1="${Math.ceil((radius / height) * 15)}%"
          y2="${Math.floor(100 - (radius / height) * 15)}%">
            <stop offset="0%" stop-color="#0F0" />
            <stop offset="100%" stop-color="#000" />
        </linearGradient>
        <linearGradient
          id="X"
          x1="${Math.ceil((radius / width) * 15)}%"
          x2="${Math.floor(100 - (radius / width) * 15)}%"
          y1="0"
          y2="0">
            <stop offset="0%" stop-color="#F00" />
            <stop offset="100%" stop-color="#000" />
        </linearGradient>
    </defs>

    <rect x="0" y="0" height="${height}" width="${width}" fill="#808080" />
    <g filter="blur(2px)">
      <rect x="0" y="0" height="${height}" width="${width}" fill="#000080" />
      <rect x="0" y="0" height="${height}" width="${width}" fill="url(#Y)" class="mix" />
      <rect x="0" y="0" height="${height}" width="${width}" fill="url(#X)" class="mix" />
      <rect
          x="${depth}"
          y="${depth}"
          height="${height - 2 * depth}"
          width="${width - 2 * depth}"
          fill="#808080"
          rx="${radius}"
          ry="${radius}"
          filter="blur(${depth}px)"
      />
    </g>
</svg>`);

const getDisplacementFilter = ({
    height,
    width,
    radius,
    depth,
    strength = 100,
    chromaticAberration = 0,
}: DisplacementOptions) =>
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(`<svg height="${height}" width="${width}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
        <filter id="displace" color-interpolation-filters="sRGB">
            <feImage x="0" y="0" height="${height}" width="${width}" href="${getDisplacementMap({ height, width, radius, depth })}" result="displacementMap" />
            <feDisplacementMap
                transform-origin="center"
                in="SourceGraphic"
                in2="displacementMap"
                scale="${strength + chromaticAberration * 2}"
                xChannelSelector="R"
                yChannelSelector="G"
            />
            <feColorMatrix
                type="matrix"
                values="1 0 0 0 0
                        0 0 0 0 0
                        0 0 0 0 0
                        0 0 0 1 0"
                result="displacedR"
            />
            <feDisplacementMap
                in="SourceGraphic"
                in2="displacementMap"
                scale="${strength + chromaticAberration}"
                xChannelSelector="R"
                yChannelSelector="G"
            />
            <feColorMatrix
                type="matrix"
                values="0 0 0 0 0
                        0 1 0 0 0
                        0 0 0 0 0
                        0 0 0 1 0"
                result="displacedG"
            />
            <feDisplacementMap
                in="SourceGraphic"
                in2="displacementMap"
                scale="${strength}"
                xChannelSelector="R"
                yChannelSelector="G"
            />
            <feColorMatrix
                type="matrix"
                values="0 0 0 0 0
                        0 0 0 0 0
                        0 0 1 0 0
                        0 0 0 1 0"
                result="displacedB"
            />
            <feBlend in="displacedR" in2="displacedG" mode="screen" />
            <feBlend in2="displacedB" mode="screen" />
        </filter>
    </defs>
</svg>`) + '#displace';

/** Feature-detects real `backdrop-filter: url(#svgFilter)` support (Chromium only). */
export function supportsBackdropFilterUrl(): boolean {
    const testEl = document.createElement('div');
    testEl.style.cssText = 'backdrop-filter: url(#test)';
    return (
        testEl.style.backdropFilter === 'url(#test)' ||
        testEl.style.backdropFilter === 'url("#test")'
    );
}

function prefersReducedGlass(): boolean {
    return (
        window.matchMedia('(prefers-reduced-transparency: reduce)').matches ||
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
}

type SurfaceParams = {
    depth: number;
    strength: number;
    chromaticAberration: number;
    blur: number;
    brightness: number;
    saturate: number;
};

/** Reads the current palette's --glass-{surface}-* tokens from tokens.css. */
function readSurfaceParams(surface: string): SurfaceParams {
    const style = getComputedStyle(document.documentElement);
    const num = (name: string, fallback: number) => {
        const raw = style.getPropertyValue(`--glass-${surface}-${name}`).trim();
        const parsed = parseFloat(raw);
        return Number.isNaN(parsed) ? fallback : parsed;
    };
    return {
        depth: num('depth', 12),
        strength: num('strength', 80),
        chromaticAberration: num('cab', 4),
        blur: num('blur', 4),
        brightness: num('brightness', 1.05),
        saturate: num('saturate', 1.2),
    };
}

const observers = new WeakMap<Element, ResizeObserver>();
const tracked = new Set<HTMLElement>();

function redrawGlass(el: HTMLElement): void {
    const surface = el.dataset.glassSurface;
    if (!surface) return;

    if (prefersReducedGlass() || !supportsBackdropFilterUrl()) {
        el.classList.add('glass-reduced');
        el.style.backdropFilter = '';
        (el.style as any).webkitBackdropFilter = '';
        return;
    }

    el.classList.remove('glass-reduced');

    const rect = el.getBoundingClientRect();
    const width = Math.round(rect.width);
    const height = Math.round(rect.height);
    if (width === 0 || height === 0) return;

    const radius = parseFloat(getComputedStyle(el).borderRadius) || 0;
    const { depth, strength, chromaticAberration, blur, brightness, saturate } =
        readSurfaceParams(surface);

    const filterUrl = getDisplacementFilter({
        height,
        width,
        radius,
        depth,
        strength,
        chromaticAberration,
    });

    const filterValue = `blur(${blur / 2}px) url('${filterUrl}') blur(${blur}px) brightness(${brightness}) saturate(${saturate})`;
    el.style.backdropFilter = filterValue;
    (el.style as any).webkitBackdropFilter = filterValue;
}

function redrawAll(): void {
    tracked.forEach(redrawGlass);
}

let mediaListenersBound = false;
function bindMediaListeners(): void {
    if (mediaListenersBound) return;
    mediaListenersBound = true;
    document.addEventListener('themechange', redrawAll);
    window
        .matchMedia('(prefers-reduced-transparency: reduce)')
        .addEventListener('change', redrawAll);
    window
        .matchMedia('(prefers-reduced-motion: reduce)')
        .addEventListener('change', redrawAll);
}

/**
 * Wires every `.glass-full` element under `root` to a real backdrop-filter
 * displacement map (or the CSS `.glass-reduced` fallback). Safe to call
 * repeatedly (e.g. after a route render) — already-observed elements are
 * skipped rather than double-observed.
 */
export function initLiquidGlass(root: ParentNode = document): void {
    bindMediaListeners();

    // The SPA router replaces #main-content's innerHTML on every navigation,
    // so any previously-tracked element (e.g. the category tree container)
    // may now be detached. Drop those instead of tracking them forever.
    tracked.forEach((el) => {
        if (el.isConnected) return;
        tracked.delete(el);
        observers.get(el)?.disconnect();
        observers.delete(el);
    });

    root.querySelectorAll<HTMLElement>('.glass-full').forEach((el) => {
        tracked.add(el);
        redrawGlass(el);

        if (observers.has(el)) return;
        const resizeObserver = new ResizeObserver(() => redrawGlass(el));
        resizeObserver.observe(el);
        observers.set(el, resizeObserver);
    });
}
