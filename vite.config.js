import { defineConfig } from 'vite';

// `npm run dev` (Vite :5173) proxies /api/* to `wrangler pages dev` (:8788).
export default defineConfig({
  server: {
    proxy: { '/api': 'http://127.0.0.1:8788' },
  },
});
