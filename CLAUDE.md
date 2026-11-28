# IT Security Blog — Renewal (CLAUDE.md)
Brand: **TheMan의 Patch Notes** (en: TheMan's Patch Notes), subtitle `IT Security Blog`, tagline 기술을 읽고, 생각을 적는다. Single source `src/lib/site.js` (router, header, edge `seo.js`); `index.html`/`public/404.html` are static copies kept in sync by `tests/unit/site.test.js`. The repo/project name stays IT-Security_Blog.

Repo: `theman001/IT-Security_Blog`. Work branch: `renewal`. The user merges `renewal` -> `main` via PR.
Detailed rules live in the `blog-platform` skill (`.claude/skills/blog-platform/SKILL.md`); read it before any work.
Docs: `docs/api.md` (API + edge routes), `docs/dev.md` (local dev, Pages settings), `docs/seo-strategy.md` (SEO strategy + implementation/file map), `docs/seo.md` (Naver/Google, cache purge, Lighthouse), `docs/post-merge-checklist.md`, `docs/contents-repo.md` (Blog_Contents), `docs/backlog.md` (future work: analytics/ads, favicon, contact info; sponsor widget is done), `docs/PLAN.md`, `DESIGN.md` (tokens).

## 1. Overview and architecture
- Frontend: Vanilla JS (ES modules), HTML5, CSS variables, Vite. NO React/Next/frameworks or framework-specific skills.
- Routing: History API (`pushState`) SPA. No hash URLs.
- Host: Cloudflare Pages + Pages Functions (`/functions`). Production = `main` (auto-deploys on push).
- Data: Neon Serverless Postgres (`reports`, `categories`), markdown stored in DB. DB is read from Functions only, via `neon(env.DATABASE_URL)` with a SELECT-only role (`app_reader`). The browser gets `/api/*` JSON only.
- Rendering: client-side `marked` -> `DOMPurify` -> `Prism.js`. Fonts (Pretendard, Noto Serif KR, JetBrains Mono) are self-hosted npm packages in `src/styles/fonts.css`, loaded after first render.
- SEO at the edge: every HTML route goes through Functions + `HTMLRewriter` on the `index.html` shell (title, description, canonical, OG/Twitter; posts also JSON-LD `BlogPosting`, a prerendered post header via shared `src/lib/post-header.js`, and the API payload inlined as `<script id="post-data">`). sitemap/robots/rss generated from the DB. Unknown paths: real 404 (SPA shell + `noindex`); `/categories/<section>` -> 301 `/<section>`. Origin comes from env `SITE_URL`.
- Publishing = Blog_Contents `main` -> GitHub Actions sync -> Neon (no rebuild of this repo). Edge cache up to 10 min via the Workers Cache API wrapper `functions/_lib/cache.js` (200/301 600s, 404 60s; never 5xx/405/400/no-store; `s-maxage` alone does not cache Function output; debug header `X-Edge-Cache`); purge via Cloudflare Purge Cache for instant refresh (`docs/seo.md`). Success headers carry `stale-while-revalidate=60`.

## 2. Commands
```bash
npm ci                 # clean install (must pass; Cloudflare runs it)
npm run dev            # Vite :5173, proxies /api to :8788 (needs pages:dev running)
npm run pages:dev      # vite build + wrangler pages dev dist -> :8788 (Functions + DB)
npm run build          # -> dist/
npm run test:unit      # node --test tests/unit/*.test.js (no network, no DB)
npm test               # test:unit + Playwright e2e (tests/e2e, API mocked, starts Vite :5173)
npm run test:edge      # build + wrangler on :8799 + real DB: 404/meta/sitemap/rss (skips w/o DATABASE_URL)
npm run lint:tokens    # no hard-coded color/space/radius/font outside tokens.css
npm run check:bundle   # runs vite build first (SKIP_BUILD=1 to reuse dist/), then dist/ must not contain DB URL/driver/role strings
.venv-tools/bin/python script.py   # ad-hoc Playwright (webapp-testing skill)
```
Local secrets: copy `.dev.vars.example` -> `.dev.vars` (gitignored). See `docs/dev.md`.
Env vars (Cloudflare Production and Preview are separate lists; apply from the next deployment): `DATABASE_URL` (required, `app_reader`), `SITE_URL` (required in Production, e.g. `https://<domain>`; canonical/sitemap/RSS/OG origin, falls back to request host), `NAVER_SITE_VERIFICATION` (optional, injects the Naver meta tag), `NODE_VERSION=22` (build).

## 3. Directory layout
```
functions/         Pages Functions (import from src/ only the pure post-header.js chain: escape, urls, related-card, and the constants in lib/site.js)
  api/posts, api/categories   JSON API (catch-all [[slug]]/[[path]]); api/link-preview.js (external link card metadata, guarded fetch), api/nav.js (post-page sidebar data)
  posts/[[slug]].js           post HTML: meta + JSON-LD + prerendered header + inline payload; 404 if missing
  [[path]].js                 catch-all: /, /about, /privacy, /contact (content TBD), sections, /categories/*, assets, 404, bare /api 404
  sitemap.xml.js robots.txt.js rss.xml.js
  _lib/   handlers (API), edge-handlers, queries (SQL), seo (meta/sitemap/RSS), shell (HTMLRewriter),
          http (JSON + cache headers), cache (Cache API wrapper), slug, cursor, excerpt, sections, db
src/               main.js, router.js, pages/ (home, section, post, about, not-found), components/, render/ (markdown, code blocks),
                   lib/ (api, escape, theme, urls, post-header), content/ (sections.js, about.md), styles/ (tokens.css + per-area CSS, fonts.css)
tests/unit/        node --test (handlers, queries, edge, seo, http, slug, cursor, excerpt, escape, urls, post-header, headers, lint, bundle)
tests/e2e/         Playwright specs (API mocked via tests/fixtures/api/*.json); tests/fixtures/
scripts/           check-tokens.mjs, check-bundle.mjs, test-edge.mjs (+ lib/)
public/            _headers (immutable /assets/*), _routes.json (Functions skip /assets, favicon.*, apple-touch-icon), 404.html, favicon.svg/.ico, apple-touch-icon.png
docs/              api.md, dev.md, seo.md, post-merge-checklist.md, contents-repo.md, backlog.md, PLAN.md, superpowers/specs/
.claude/skills/    vendored reviewed skills + blog-platform; .claude/SKILLS.lock.md = provenance
DESIGN.md          design tokens contract (single source for color/space/radius/font)
```

## 4. Absolute rules
1. NEVER commit or push to `main`. Work on `renewal`; check the preview `https://renewal.it-security-blog.pages.dev`. Only the user merges the PR. (History rewrite was a one-off, already done.)
2. Secrets: allowed in chat; in code/commits/logs only after user approval. Default home: Cloudflare env var `DATABASE_URL` + local `.dev.vars`. Never print secret values or full post bodies when inspecting the DB.
3. Ask before hard-to-reverse actions: history rewrite, force push, DB writes/schema changes, mass deletes, installing third-party skills.
4. No third-party skill without review (section 6). No `curl | bash`, no `npx skills add -g -y`.
5. Design token contract: color/space/radius/font only via CSS variables from `DESIGN.md`/`tokens.css`. No hard-coded values.
6. Do not say "done" before verifying: build passes, Playwright passes, checked in a real browser/preview.
7. SQL: parameter binding only; body only in post detail; dates via `to_char(created_at,'YYYY-MM-DD')`.
8. XSS: markdown through DOMPurify; every other DB field through `escapeHtml()`/`textContent`.
9. Env var changes apply only to the next deployment; Preview and Production vars are separate.

## 5. Skill roles (non-overlapping)
| Skill | Source | Role |
|---|---|---|
| find-skills | vercel-labs/skills | search and propose skills; install only via section 6 |
| ui-ux-pro-max | nextlevelbuilder | the ONLY owner of design-system generation; record results in `DESIGN.md`; never `--persist` |
| impeccable | pbakaus | REVIEW ONLY: critique, audit, polish, distill. Never `init`/`document`-style commands that write `DESIGN.md`. Hooks off, telemetry off. May create `PRODUCT.md` |
| webapp-testing | anthropics/skills | Playwright rendering/behavior checks (Python venv `.venv-tools/`) |
| claude-seo | AgriciDaniel | SEO diagnosis + priority plan. NOT installed unless the user installs it via `/plugin` (reviewed SHA in SKILLS.lock.md); implementation is ours |
| superpowers | obra | brainstorming -> writing-plans -> subagent-driven-development -> review orchestration; finish branches via PR only, never local merge to `main` |
| blog-platform | this repo | project rules (API, SQL, cache, deploy, XSS, routing, tokens) |

Design-system owner is UI UX Pro Max alone. Impeccable reviews; it does not design. Find new skills with find-skills, but they still need review.

## 6. Skill review procedure (every new skill)
1. Re-read the repo README install method. 2. `git clone --depth 1` into a temp dir, record SHA. 3. Read SKILL.md, scripts, install scripts, hooks, postinstall; report runtimes, network/telemetry, global changes, files created. 4. Install only after user approval (pure skills: copy the reviewed SHA to `.claude/skills/<name>/`; plugins: the user runs `/plugin ...`). 5. Update `.claude/SKILLS.lock.md`. 6. Verify plugin-installed SHA equals the reviewed one.

## 7. Workflow
brainstorming (one question at a time) -> writing-plans (`docs/PLAN.md`) -> sequential foundation work (Functions API + client, `tokens.css`, layout/router, theme + no-flash script, markdown pipeline) -> parallel page work in git worktrees via subagent-driven-development (home, post, category, static, 404; subagents use tokens only and REPORT needed changes to shared files: tokens, common components, router) -> two-stage review per task (spec compliance, then code quality) -> Impeccable critique + audit -> verification (tests, preview) -> PR to `main` (user merges).
Status: implementation, edge SEO, tests and docs are done on `renewal` (Lighthouse mobile on preview 2026-11-27: Perf 99-100, A11y 100, BP 96, SEO 100 on all pages except one sample tech post at 92 (generic link text "링크" in the sample markdown, a content issue), per-page table in `docs/seo.md`). Impeccable audit run (19/20, see .claude/SKILLS.lock.md); critique not run. Remaining: PR to `main` (controller opens, user merges), then `docs/post-merge-checklist.md` (set `SITE_URL` in Production, Naver/Google registration, remove `sample-*` posts, optional `llms.txt`).

## 8. Known data facts (see docs/api.md, docs/contents-repo.md)
- One `reports` table; sections are the first slug segment: `tech` | `trends` | `essays`. Slugs and category slugs are FULL paths (e.g. `tech/security/reversing/01-kakao-auth`), lowercase-hyphen in the new Blog_Contents structure, still matched case-sensitively/exactly. No `contents` wrapper.
- `reports.related_slug` (nullable text): an essay links to the post that prompted it; the API returns `related` (target) and `relatedBy` (posts pointing here). A missing target must render fine.
- `tags` is `text[]`; `author_type` is `admin`; `created_at` is a naive date-only timestamp -> `to_char(created_at,'YYYY-MM-DD')`. `categories` has no order/description column (sorted by slug; section copy lives in `src/content/sections.js`, mirrored in `functions/_lib/sections.js`, a unit test keeps them equal).
- Titles may contain `<`, `>`, `&`: escaping is required.
- The Blog_Contents sync has already replaced production DB content with new sample posts (`sample-*`); the old live frontend reads the same DB. Do not write to the DB from this repo.

## 9. Definition of done
- [ ] No DB credentials in the working tree or browser bundle. Git history (origin/main and renewal) still contains the old `app_reader` password string until it is rotated (`docs/post-merge-checklist.md` section 7, owner's decision)
- [ ] All non-markdown fields escaped; XSS tests pass
- [ ] Publishing works by DB INSERT only
- [ ] `/posts/*` first HTML has unique title, description, OG, JSON-LD
- [ ] sitemap.xml, robots.txt, rss.xml work; unknown paths are real 404
- [ ] Lighthouse mobile: Perf >= 90, A11y >= 95, Best Practices >= 95, SEO >= 95
- [ ] Korean body renders in the chosen webfont
- [ ] Hard-coded color/space grep = 0
- [ ] Playwright suite fully green
- [ ] CLAUDE.md, README.md, docs/api.md, SKILLS.lock.md, blog-platform skill up to date
- [ ] PR body: summary, preview URL, screenshots, test results, remaining work, rollback (Pages dashboard previous deployment, or revert merge commit)
