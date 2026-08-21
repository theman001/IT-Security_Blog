import { defineConfig } from 'vite';

export default defineConfig({
  // repo root doubles as the Vite project root; `public/` (assets/xp, static/*.md)
  // is Vite's default publicDir and is copied to dist/ verbatim, since those
  // files are referenced by runtime string paths (fetch/url()), not import
  // statements Vite's bundler can see.
  build: {
    target: 'es2020'
  },
  server: {
    // Listen on all interfaces, not just 127.0.0.1 — this project is developed
    // through a remote code-server, and the port-forwarding proxy may reach
    // the dev server over an interface other than loopback.
    host: true,
    allowedHosts: ["dev.taeuk.site"]
  }
});
