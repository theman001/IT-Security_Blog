import { defineConfig } from 'vite';

// Vite's dev server serves index.html for the *base path with its trailing
// slash* (and for any nested SPA route past it), but a request for the bare
// base with no trailing slash — exactly what a code-server "Ports" link or a
// hand-typed URL often is — 404s outright instead of redirecting. Confirmed:
// GET /absproxy/5173 -> 404, GET /absproxy/5173/ -> 200, GET /absproxy/5173/categories -> 200.
function redirectBareBasePlugin(base) {
  const baseNoSlash = base.endsWith('/') ? base.slice(0, -1) : base;
  return {
    name: 'redirect-bare-base-to-trailing-slash',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url.split('?')[0];
        if (url === baseNoSlash) {
          res.statusCode = 302;
          res.setHeader('Location', base + (req.url.includes('?') ? '?' + req.url.split('?')[1] : ''));
          res.end();
          return;
        }
        next();
      });
    },
  };
}

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
  plugins: command === 'serve' ? [redirectBareBasePlugin('/absproxy/5173/')] : [],
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
