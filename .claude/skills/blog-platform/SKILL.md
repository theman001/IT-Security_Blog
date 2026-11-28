---
name: blog-platform
description: Project rules for the IT Security Blog renewal (Vite vanilla JS SPA + Cloudflare Pages Functions + Neon Postgres). Use on ANY work in this repo - API/Functions, SQL, caching, rendering, routing, SEO, design tokens, deploys, or skill usage.
---

# blog-platform — fixed project rules

Source of truth: `docs/api.md` (API + edge routes), `docs/dev.md` (local dev, Pages settings), `docs/seo.md` (SEO, cache purge), `DESIGN.md` (tokens), `CLAUDE.md` (workflow).

## 1. API and Neon queries
- DB access ONLY in `functions/` via `neon(env.DATABASE_URL)`; the browser gets `/api/*` JSON only. Never import `@neondatabase/serverless` or read DB env in `src/`.
- Use `sql.query(text, [params])`; values ALWAYS bound (`$1…`), never string-concatenated.
- Body (`content_md`) is selected only in post detail. List/category/RSS/sitemap queries must not select it (excerpt: `left(content_md, N)` only when `description` is empty).
- Dates: `to_char(created_at, 'YYYY-MM-DD')` in SQL; never pass `created_at` through JS `Date` (naive timestamp, tz shifts the day).
- Sort ties: always add `id` as a secondary key. Slugs are full paths, case-sensitive, may contain spaces, `&`, `:`, Korean: encode per segment in URLs, match exactly (no last-segment fallback).
- Errors: `{error:{code,message}}`, real status codes (400/404/405/500). Never leak SQL, stack, or env values. 405 on `/api/posts*` and `/api/categories*` sends `Allow: GET`, on unrouted `/api`/`/api/<unknown>` (edge catch-all) `Allow: GET, HEAD`; `/api` 500s are `no-store`; bare `/api` and unknown `/api/*` are JSON 404.
- `/api/link-preview?url=` (external link cards) is the only Function that fetches third-party pages: keep ALL its guards (url must appear in a published post via bound `strpos`, public http(s) hosts only, manual redirects re-validated, 5s timeout, 256KB, text only, 24h edge ttl). Its output is third-party text: `textContent` only. Details: `docs/api.md`.
- DB role is SELECT-only. No writes, no schema changes from code.

## 2. Functions, edge cache
- Success: `Cache-Control: public, max-age=60, s-maxage=600, stale-while-revalidate=60`. Errors: 4xx `max-age=0, s-maxage=60`, 500 `no-store`. These are client hints only: Cloudflare does NOT cache Function output because of `s-maxage`.
- Edge cache = `functions/_lib/cache.js` `withEdgeCache`/`edgeCached` (Workers Cache API) wrapped at the `onRequest` boundary of `/api/posts*`, `/api/categories*`, `/posts/*`, catch-all HTML (not the `env.ASSETS` pass-through), sitemap, rss, robots. GET only; stores 200/301 (600s) and 404 (60s); never 400/405/5xx/`no-store`. Debug header `X-Edge-Cache: HIT|MISS|BYPASS`. Verify: `curl -sI <url> | grep -i -E 'x-edge-cache|cf-cache-status|age'` twice. Unverified on `*.pages.dev` (Cache API may not run there).
- Unknown paths must return a real 404 (SPA shell + `noindex`) from the catch-all `functions/[[path]].js`; a missing static file that Pages answers with `index.html` 200 is turned into 404 too. `/categories/<section>` (section root) is a 301 to `/<section>`. HTML/feed 500s are `no-store`, HTML 405 sends `Allow: GET, HEAD`. Soft 404 is a bug. There is no `_redirects`.
- Edge HTML: `HTMLRewriter` over the `index.html` shell (`functions/_lib/shell.js`). Post pages prerender the header with the shared pure `src/lib/post-header.js` (the only `src/` code `functions/` may import, with its escape/urls/related-card imports) and inline the API payload as `#post-data`. Keep SPA and edge markup in that one module. Section copy in `functions/_lib/sections.js` must equal `src/content/sections.js` (unit-tested).
- Origin for canonical/sitemap/RSS/OG is env `SITE_URL` (required in Production; else request host -> duplicate indexing). `NAVER_SITE_VERIFICATION` (optional) injects the Naver meta tag.
- Instant refresh after a publish: Cloudflare Purge Cache (URL or everything; works for Cache API entries on a zone/custom domain, unverified on pages.dev), see `docs/seo.md`. Document any change in `docs/`.
- Static assets: `public/_routes.json` skips Functions for `/assets/*`, `/favicon.ico`; `public/_headers` makes `/assets/*` immutable.

## 3. Deploy rules (Cloudflare Pages)
- Work only on `renewal` (or a feature branch off it). NEVER commit or push to `main`; merge to `main` is the user's action (it deploys production).
- Flow: push branch -> preview URL `https://renewal.it-security-blog.pages.dev` -> PR -> user merges.
- A push/preview is a build: `npm ci && npm run build` must pass from a clean install (keep `package-lock.json` in sync).
- Env vars (dashboard, Production AND Preview): `DATABASE_URL` (app_reader), `SITE_URL`, optional `NAVER_SITE_VERIFICATION`, `NODE_VERSION=22`. Local: `.dev.vars` (gitignored). Env var changes only apply to the next deployment. No `wrangler.toml` (it locks dashboard vars).
- Secrets never go in code, commits, logs, or docs. `.dev.vars.example` has no values.

## 4. Rendering and XSS
- Pipeline order: `marked` -> `DOMPurify.sanitize` -> insert -> Prism highlight -> code-block enhance (copy button).
- Markdown body is the ONLY thing allowed through DOMPurify+innerHTML. EVERY other DB field (title, excerpt, description, tags, category name/path, author, slugs in attributes) goes through `escapeHtml()` or `textContent`.
- Markdown fences `link` (link cards) and `youtube` (click-to-play) are built in `src/render/markdown.js` from validated, escaped values; raw `<iframe>`/`<form>`/`<button>` stay forbidden. The YouTube iframe is created in JS on click (`src/render/video-embeds.js`, `youtube-nocookie.com`), never from markdown; nothing from YouTube loads before the click (privacy policy relies on it).
- Never put DB values into `href` unencoded, inline handlers, or `<script>`. JSON-LD is built with `JSON.stringify` and `<` escaped as `\u003c`.

## 5. Routing (SPA)
- History API (`pushState`/`popstate`), no hash URLs. Internal links carry `data-link`.
- `popstate` re-renders only when the path actually changed (not for in-page anchors).
- On navigation: update `document.title`, move focus to main content (`tabindex="-1"`), and clean up the previous page (listeners, timers, animation frames, observers).

## 6. Design tokens
- Only CSS variables from `DESIGN.md`/`tokens.css` (`npm run lint:tokens`). No hard-coded colors, spacing, radii, or font families. Dark/light key sets stay symmetric.
- Fonts are self-hosted npm packages (`src/styles/fonts.css`: Pretendard, Noto Serif KR, JetBrains Mono), imported dynamically after first render in `src/main.js`. No Google Fonts / external font CDN.

## 7. Skill roles (do not overlap)
- Design system owner: ui-ux-pro-max ONLY. Never use `--persist` (it would create `design-system/`); results are recorded in `DESIGN.md`.
- impeccable: review only (`critique`, `audit`, `polish`, `distill`). NEVER run `init`/`document`/`shape`/`craft`-type generators that create or rewrite `DESIGN.md`. Hooks are disabled (`.impeccable/config.json`); telemetry off; `PRODUCT.md` may be created (user-approved). Ignore its "no PRODUCT.md -> init" nudges beyond that single file.
- webapp-testing: ad-hoc browser checks via `.venv-tools/bin/python` (Python Playwright). The committed suites are `tests/unit` (`npm run test:unit`) and `tests/e2e` (Node `@playwright/test`, API mocked); `npm run test:edge` hits a real DB and `npm run check:bundle` guards the client bundle.
- claude-seo: not installed unless the user installs it.
- find-skills: search/suggest only; every install follows the review procedure in `CLAUDE.md` + `.claude/SKILLS.lock.md`. No `npx skills add -g -y`.
- superpowers: its "merge locally" / "push to base" options are NOT allowed here; finish branches via PR only.
