// Raw WebGL2 fullscreen-shader background for the home hero tile — no Three.js,
// just a single screen-covering triangle and a fragment shader (the standard
// "shadertoy" pattern). Palette-reactive: reads --accent/--accent-2/--bg from
// the current theme and re-renders on `themechange` (same event liquid-glass.ts
// listens to). Pauses under prefers-reduced-motion / when the tab is hidden.

const VERTEX_SRC = `#version 300 es
layout(location = 0) in vec2 aPos;
void main() {
    gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAGMENT_SRC = `#version 300 es
precision highp float;
out vec4 fragColor;

uniform vec2 uResolution;
uniform float uTime;
uniform vec2 uMouse;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uColorBg;

// Simple 2D hash/noise — cheap, no texture lookups needed.
float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

// Circuit-board-ish flowing lines: layered noise sheared by time, thresholded
// into thin bright traces. Deliberately abstract, not a literal circuit.
void main() {
    vec2 uv = gl_FragCoord.xy / uResolution.xy;
    vec2 p = uv * vec2(uResolution.x / uResolution.y, 1.0) * 6.0;

    vec2 mouseOffset = (uMouse - 0.5) * 0.6;
    p += mouseOffset;

    float t = uTime * 0.06;
    float n1 = noise(p + vec2(t, -t * 0.6));
    float n2 = noise(p * 1.8 - vec2(t * 0.4, t));
    float traces = smoothstep(0.94, 0.995, max(n1, n2 * 0.9));

    float glow = pow(max(n1, n2), 6.0) * 0.5;

    vec3 col = uColorBg;
    col = mix(col, uColorA, glow);
    col += traces * uColorB;

    // Vignette so the effect fades toward the tile edges rather than hard-cutting.
    float vignette = smoothstep(1.05, 0.3, length(uv - 0.5) * 1.4);
    col = mix(uColorBg, col, vignette);

    fragColor = vec4(col, 1.0);
}`;

function compileShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const info = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error('Shader compile failed: ' + info);
    }
    return shader;
}

function hexToRgb01(cssColorString) {
    // Reads a computed color (oklch()/rgb()/etc — browsers normalize
    // getComputedStyle color reads to rgb()/rgba() strings) into 0..1 floats.
    const probe = document.createElement('div');
    probe.style.color = cssColorString;
    probe.style.display = 'none';
    document.body.appendChild(probe);
    const rgb = getComputedStyle(probe).color;
    document.body.removeChild(probe);
    const match = rgb.match(/[\d.]+/g) || ['128', '128', '128'];
    return [match[0] / 255, match[1] / 255, match[2] / 255];
}

/**
 * Mounts a fullscreen WebGL2 shader onto `canvas`. Returns a teardown
 * function. No-ops (returns a no-op teardown) if WebGL2 or reduced-motion
 * rules it out — callers should have a static CSS gradient fallback under
 * the canvas for that case.
 */
export function mountHeroShader(canvas) {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return () => { };

    const gl = canvas.getContext('webgl2', { antialias: true, alpha: false });
    if (!gl) return () => { };

    let program;
    try {
        const vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SRC);
        const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SRC);
        program = gl.createProgram();
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            throw new Error('Program link failed: ' + gl.getProgramInfoLog(program));
        }
    } catch (e) {
        console.warn('Hero shader unavailable, falling back to static background:', e);
        return () => { };
    }

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    // Single triangle covering the whole clip space — cheaper than two
    // triangles for a fullscreen pass, standard shadertoy-style trick.
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const uResolution = gl.getUniformLocation(program, 'uResolution');
    const uTime = gl.getUniformLocation(program, 'uTime');
    const uMouse = gl.getUniformLocation(program, 'uMouse');
    const uColorA = gl.getUniformLocation(program, 'uColorA');
    const uColorB = gl.getUniformLocation(program, 'uColorB');
    const uColorBg = gl.getUniformLocation(program, 'uColorBg');

    let colorA = [0.4, 0.8, 0.7];
    let colorB = [0.8, 0.4, 0.7];
    let colorBg = [0.08, 0.08, 0.1];

    function readPaletteColors() {
        const style = getComputedStyle(document.documentElement);
        colorA = hexToRgb01(style.getPropertyValue('--accent').trim() || '#66ccaa');
        colorB = hexToRgb01(style.getPropertyValue('--accent-2').trim() || '#cc66aa');
        colorBg = hexToRgb01(style.getPropertyValue('--bg').trim() || '#151518');
    }
    readPaletteColors();

    let mouseX = 0.5;
    let mouseY = 0.5;
    function onPointerMove(e) {
        const rect = canvas.getBoundingClientRect();
        mouseX = (e.clientX - rect.left) / rect.width;
        mouseY = 1 - (e.clientY - rect.top) / rect.height;
    }
    canvas.addEventListener('pointermove', onPointerMove);

    function resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 1.5); // capped — this is a decorative background, not the main content
        const width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
        const height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
            gl.viewport(0, 0, width, height);
        }
    }

    let running = true;
    let rafId = null;
    const startTime = performance.now();

    function frame() {
        if (!running) return;
        resize();
        gl.useProgram(program);
        gl.bindVertexArray(vao);
        gl.uniform2f(uResolution, canvas.width, canvas.height);
        gl.uniform1f(uTime, (performance.now() - startTime) / 1000);
        gl.uniform2f(uMouse, mouseX, mouseY);
        gl.uniform3fv(uColorA, colorA);
        gl.uniform3fv(uColorB, colorB);
        gl.uniform3fv(uColorBg, colorBg);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        rafId = requestAnimationFrame(frame);
    }

    function onThemeChange() {
        readPaletteColors();
    }
    document.addEventListener('themechange', onThemeChange);

    function onVisibilityChange() {
        if (document.hidden) {
            running = false;
            if (rafId) cancelAnimationFrame(rafId);
        } else if (!running) {
            running = true;
            frame();
        }
    }
    document.addEventListener('visibilitychange', onVisibilityChange);

    frame();

    return function teardown() {
        running = false;
        if (rafId) cancelAnimationFrame(rafId);
        canvas.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('themechange', onThemeChange);
        document.removeEventListener('visibilitychange', onVisibilityChange);
        const lose = gl.getExtension('WEBGL_lose_context');
        if (lose) lose.loseContext();
    };
}
