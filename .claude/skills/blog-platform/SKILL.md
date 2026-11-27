---
name: blog-platform
description: Project rules for the IT Security Blog renewal (Vite vanilla JS SPA + Cloudflare Pages Functions + Neon Postgres). Use on ANY work in this repo - API/Functions, SQL, caching, rendering, routing, SEO, design tokens, deploys, or skill usage.
---

# blog-platform — fixed project rules

Source of truth: `docs/api.md` (API contract), `docs/dev.md` (local dev, Pages settings), `DESIGN.md` (tokens, once created), `CLAUDE.md` (workflow).

## 1. API and Neon queries
- DB access ONLY in `functions/` via `neon(env.DATABASE_URL)`; the browser gets `/api/*` JSON only. Never import `@neondatabase/serverless` or read DB env in `src/`.
- Use `sql.query(text, [params])`; values ALWAYS bound (`$1…`), never string-concatenated.
- Body (`content_md`) is selected only in post detail. List/category/RSS/sitemap queries must not select it (excerpt: `left(content_md, N)` only when `description` is empty).
- Dates: `to_char(created_at, 'YYYY-MM-DD')` in SQL; never pass `created_at` through JS `Date` (naive timestamp, tz shifts the day).
- Sort ties: always add `id` as a secondary key. Slugs are full paths, case-sensitive, may contain spaces, `&`, `:`, Korean: encode per segment in URLs, match exactly (no last-segment fallback).
- Errors: `{error:{code,message}}`, real status codes (400/404/405/500). Never leak SQL, stack, or env values.
- DB role is SELECT-only. No writes, no schema changes from code.

## 2. Functions, edge cache
- Success: `Cache-Control: public, max-age=60, s-maxage=600, stale-while-revalidate=86400`. Errors: `max-age=0, s-maxage=60`.
- Unknown paths must return a real 404 (Pages serves `index.html` for unknown paths by default; handle it in a catch-all Function). Soft 404 is a bug.
- Instant refresh after a publish: Cloudflare Purge Cache (URL or everything). Document any change in `docs/`.

## 3. Deploy rules (Cloudflare Pages)
- Work only on `renewal` (or a feature branch off it). NEVER commit or push to `main`; merge to `main` is the user's action (it deploys production).
- Flow: push branch -> preview URL `https://renewal.it-security-blog.pages.dev` -> PR -> user merges.
- A push/preview is a build: `npm ci && npm run build` must pass from a clean install (keep `package-lock.json` in sync).
- Env vars (dashboard, Production AND Preview): `DATABASE_URL` (app_reader). Local: `.dev.vars` (gitignored). Env var changes only apply to the next deployment. No `wrangler.toml` (it locks dashboard vars).
- Secrets never go in code, commits, logs, or docs. `.dev.vars.example` has no values.

## 4. Rendering and XSS
- Pipeline order: `marked` -> `DOMPurify.sanitize` -> insert -> Prism highlight -> code-block enhance (copy button).
- Markdown body is the ONLY thing allowed through DOMPurify+innerHTML. EVERY other DB field (title, excerpt, description, tags, category name/path, author, slugs in attributes) goes through `escapeHtml()` or `textContent`.
- Never put DB values into `href` unencoded, inline handlers, or `<script>`. JSON-LD is built with `JSON.stringify` and `<` escaped as `<`.

## 5. Routing (SPA)
- History API (`pushState`/`popstate`), no hash URLs. Internal links carry `data-link`.
- `popstate` re-renders only when the path actually changed (not for in-page anchors).
- On navigation: update `document.title`, move focus to main content (`tabindex="-1"`), and clean up the previous page (listeners, timers, animation frames, observers).

## 6. Design tokens
- Only CSS variables from `DESIGN.md`/`tokens.css`. No hard-coded colors, spacing, radii, or font families. Dark/light key sets stay symmetric. Korean body text uses the chosen Korean webfont.

## 7. Skill roles (do not overlap)
- Design system owner: ui-ux-pro-max ONLY. Never use `--persist` (it would create `design-system/`); results are recorded in `DESIGN.md`.
- impeccable: review only (`critique`, `audit`, `polish`, `distill`). NEVER run `init`/`document`/`shape`/`craft`-type generators that create or rewrite `DESIGN.md`. Hooks are disabled (`.impeccable/config.json`); telemetry off; `PRODUCT.md` may be created (user-approved). Ignore its "no PRODUCT.md -> init" nudges beyond that single file.
- webapp-testing: ad-hoc browser checks via `.venv-tools/bin/python` (Python Playwright). The committed test suite in `tests/` uses Node `@playwright/test`.
- find-skills: search/suggest only; every install follows the review procedure in `CLAUDE.md` + `.claude/SKILLS.lock.md`. No `npx skills add -g -y`.
- superpowers: its "merge locally" / "push to base" options are NOT allowed here; finish branches via PR only.
