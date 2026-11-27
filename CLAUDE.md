# IT Security Blog — Renewal (CLAUDE.md)

Repo: `theman001/IT-Security_Blog`. Work branch: `renewal`. The user merges `renewal` -> `main` via PR.
Detailed rules live in the `blog-platform` skill (`.claude/skills/blog-platform/SKILL.md`); read it before any work.
Docs: `docs/api.md` (API contract), `docs/dev.md` (local dev, Pages settings), `docs/PLAN.md` and `DESIGN.md` (after Phase 3).

## 1. Overview and architecture
- Frontend: Vanilla JS (ES modules), HTML5, CSS variables, Vite. NO React/Next/frameworks or framework-specific skills.
- Routing: History API (`pushState`) SPA. No hash URLs.
- Host: Cloudflare Pages + Pages Functions (`/functions`). Production = `main` (auto-deploys on push).
- Data: Neon Serverless Postgres (`reports`, `categories`), markdown stored in DB. DB is read from Functions only, via `neon(env.DATABASE_URL)` with a SELECT-only role (`app_reader`). The browser gets `/api/*` JSON only.
- Rendering: client-side `marked` -> `DOMPurify` -> `Prism.js`.
- SEO at the edge: `/posts/*` is rewritten by Functions (`HTMLRewriter`: title, description, canonical, OG/Twitter, JSON-LD `BlogPosting`, optionally prerendered body). sitemap/robots/rss generated from the DB. Unknown paths return a real 404.
- Publishing = DB INSERT only (no rebuild). Edge cache 5-10 min (`s-maxage=600`); purge via Cloudflare Purge Cache for instant refresh.

## 2. Commands
```bash
npm ci                 # clean install (must pass; Cloudflare runs it)
npm run dev            # Vite :5173, proxies /api to :8788
npm run pages:dev      # vite build + wrangler pages dev dist -> :8788 (Functions + DB)
npm run build          # -> dist/
npm test               # Playwright suite in tests/ (Phase 6)
.venv-tools/bin/python script.py   # ad-hoc Playwright (webapp-testing skill)
```
Local secrets: copy `.dev.vars.example` -> `.dev.vars` (gitignored). See `docs/dev.md`.

## 3. Directory layout
```
functions/         Pages Functions: api/*, posts catch-all (meta injection), sitemap/robots/rss, 404 handling
src/               frontend: main.js, router, pages/, components/, render/ (markdown pipeline), styles/tokens.css
tests/             Playwright tests (+ route mocks for XSS tests)
docs/              api.md, dev.md, PLAN.md
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
| claude-seo | AgriciDaniel | SEO diagnosis + priority plan (installed in Phase 5; implementation is ours) |
| superpowers | obra | brainstorming -> writing-plans -> subagent-driven-development -> review orchestration; finish branches via PR only, never local merge to `main` |
| blog-platform | this repo | project rules (API, SQL, cache, deploy, XSS, routing, tokens) |

Design-system owner is UI UX Pro Max alone. Impeccable reviews; it does not design. Find new skills with find-skills, but they still need review.

## 6. Skill review procedure (every new skill)
1. Re-read the repo README install method. 2. `git clone --depth 1` into a temp dir, record SHA. 3. Read SKILL.md, scripts, install scripts, hooks, postinstall; report runtimes, network/telemetry, global changes, files created. 4. Install only after user approval (pure skills: copy the reviewed SHA to `.claude/skills/<name>/`; plugins: the user runs `/plugin ...`). 5. Update `.claude/SKILLS.lock.md`. 6. Verify plugin-installed SHA equals the reviewed one.

## 7. Workflow
brainstorming (one question at a time) -> writing-plans (`docs/PLAN.md`) -> sequential foundation work (Functions API + client, `tokens.css`, layout/router, theme + no-flash script, markdown pipeline) -> parallel page work in git worktrees via subagent-driven-development (home, post, category, static, 404; subagents use tokens only and REPORT needed changes to shared files: tokens, common components, router) -> two-stage review per task (spec compliance, then code quality) -> Impeccable critique + audit -> verification (tests, preview) -> PR to `main` (user merges).
Phases: 0 repo/history/base (done), 1 skills (done), 2 CLAUDE.md/README, 3 design direction (`DESIGN.md`, `docs/PLAN.md`), 4 implementation, 5 SEO (+claude-seo, Naver verification tag slot, sitemap/RSS submission guide, llms.txt optional, cache purge docs), 6 verification, 7 PR/rollback/post-merge checklist.

## 8. Known data facts (verified 2026-11-27, see docs/api.md)
- 29 posts, 11 categories; slugs and category slugs are FULL paths (case-sensitive; spaces, `&`, `:`, Korean). No `contents` wrapper.
- `tags` is `text[]`; `author_type` is always `admin`; `created_at` is a naive timestamp, date-only (00:00).
- Some titles contain `<`, `>`, `&`: escaping is required.

## 9. Definition of done
- [ ] No DB credentials in browser bundle or repo
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
