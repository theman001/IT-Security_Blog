import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  // repo root doubles as the Vite project root; `public/` (assets/xp, static/*.md)
  // is Vite's default publicDir and is copied to dist/ verbatim, since those
  // files are referenced by runtime string paths (fetch/url()), not import
  // statements Vite's bundler can see.
  build: {
    target: 'es2020'
  },
  // Dev-only: the remote code-server's port-forwarding proxy exposes the dev
  // server at dev.taeuk.site/proxy/<port>/ (a path prefix, not a subdomain),
  // so index.html's own asset tags need that prefix or every CSS/JS request
  // resolves against the domain root instead and 404s. Production (Cloudflare
  // Pages) is served from the real domain root, so `base` stays '/' there.
  // assets/js/base-path.js carries the matching prefix for the handful of
  // runtime fetch()/pushState calls Vite's own base-rewriting can't reach.
  base: command === 'serve' ? '/proxy/5173/' : '/',
  server: {
    // Listen on all interfaces, not just 127.0.0.1 — the forwarding proxy may
    // reach the dev server over an interface other than loopback.
    host: true,
    // Pinned rather than left to auto-increment: `base` above is hardcoded to
    // this port, so silently moving to 5174 when 5173 is busy would silently
    // break asset loading again.
    port: 5173,
    strictPort: true,
    allowedHosts: ["dev.taeuk.site"]
  }
}));
