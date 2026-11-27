# IT Security Blog

Security/infra engineering blog. Vanilla JS SPA on Cloudflare Pages, content stored as markdown in Neon Postgres and served through Pages Functions.

## Stack
- Frontend: Vanilla JS (ES modules), CSS variables, Vite. History API router.
- Backend: Cloudflare Pages Functions (`functions/`), `@neondatabase/serverless` (SELECT-only role).
- Rendering: `marked` -> `DOMPurify` -> `Prism.js` (client side).
- SEO: edge meta injection for `/posts/*`, generated `sitemap.xml`, `robots.txt`, `rss.xml`.
- Publishing: INSERT a row into the DB; changes appear after the edge cache (up to 10 min) or a cache purge. No rebuild.

## Local development
```bash
cp .dev.vars.example .dev.vars    # set DATABASE_URL (read-only role); never commit
npm ci
npm run pages:dev                 # Functions + DB on http://localhost:8788
npm run dev                       # Vite HMR on http://localhost:5173 (proxies /api -> 8788)
npm run build                     # production bundle in dist/
```
Details: [docs/dev.md](docs/dev.md). API contract: [docs/api.md](docs/api.md).

## Deployment (Cloudflare Pages)
- Build command `npm run build`, output `dist`, Functions from `/functions`.
- Env var `DATABASE_URL` in Production and Preview (separate lists; applies from the next deployment).
- `main` = production (auto deploy on push). `renewal` and other branches = preview URLs.
- Flow: work on a branch -> preview -> pull request -> maintainer merges.
- Rollback: Cloudflare Pages dashboard -> Deployments -> roll back to a previous deployment, or revert the merge commit.

## Working with Claude Code
See [CLAUDE.md](CLAUDE.md). Skills and their provenance: [.claude/SKILLS.lock.md](.claude/SKILLS.lock.md).
