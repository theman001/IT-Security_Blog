import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  // repo root doubles as the Vite project root; `public/` (assets/xp, static/*.md)
  // is Vite's default publicDir and is copied to dist/ verbatim, since those
  // files are referenced by runtime string paths (fetch/url()), not import
  // statements Vite's bundler can see.
  build: {
    target: 'es2020'
  },
  // Dev-only: code-server offers two proxy modes. /proxy/<port>/ STRIPS that
  // prefix before forwarding, which breaks Vite's dev server — its whole
  // module graph (not just index.html's own <link>/<script> tags, every
  // deeper `import` it rewrites too) is served under one absolute `base`,
  // and a relative base isn't honored in dev the way it is for a production
  // build (verified: Vite kept emitting root-absolute hrefs regardless).
  // /absproxy/<port>/ passes the full path through unchanged instead, which
  // is what an absolute `base` here actually needs — use that URL to access
  // the dev server. Production (Cloudflare Pages) is served from the real
  // domain root, so `base` stays '/' there.
  base: command === 'serve' ? '/absproxy/5173/' : '/',
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
