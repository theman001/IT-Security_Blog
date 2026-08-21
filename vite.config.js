import { defineConfig } from 'vite';

export default defineConfig({
  // repo root doubles as the Vite project root; `public/` (assets/xp, static/*.md)
  // is Vite's default publicDir and is copied to dist/ verbatim, since those
  // files are referenced by runtime string paths (fetch/url()), not import
  // statements Vite's bundler can see.
  build: {
    target: 'es2020'
  }
});
