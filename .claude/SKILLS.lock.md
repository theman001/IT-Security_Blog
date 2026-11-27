# SKILLS.lock

Reviewed 2026-11-27. Every skill was cloned with `--depth 1` into a temp dir, its SHA recorded, and its SKILL.md/scripts/hooks read before install. Pure skills are vendored into `.claude/skills/<name>/`.

| Skill | Source | Commit SHA (reviewed) | Installed | Role | Notes |
|---|---|---|---|---|---|
| find-skills | https://github.com/vercel-labs/skills (`skills/find-skills`) | e7fd0e9e52f029fe87729d8185cb8caf7049f678 | 2026-11-27 | Search and propose skills | **Modified**: Step 6 (`npx skills add -g -y`) replaced with the project review procedure. Pure SKILL.md. The `npx skills` CLI has telemetry (`DISABLE_TELEMETRY=1`). |
| ui-ux-pro-max | https://github.com/nextlevelbuilder/ui-ux-pro-max-skill (`.claude/skills/ui-ux-pro-max`) v2.15.0 | 11ca2b3bdd555649f278ee348c32a9302b24dcf1 | 2026-11-27 | Sole owner of design-system generation; output recorded in DESIGN.md | `scripts/tests/` excluded. Stdlib Python, offline. Do NOT use `--persist` (writes `design-system/`). |
| impeccable | https://github.com/pbakaus/impeccable (`.claude/skills/impeccable`), engine 0.1.31 | 2fc5e1459efbbf06d92c7306517c286bf12490cf | 2026-11-27 | Review only: critique, audit, polish, distill | Skill folder only. **Not installed**: hooks, subagents, `.claude/settings.json`. Engine `impeccable-linux-x64` downloaded from GitHub release `engine-v0.1.31`, sha256 `01c64286…89be77` matched `engine-checksums.txt`, stored at `~/.impeccable/bin/0.1.31/`. `.impeccable/config.json`: telemetry false, hook disabled. Engine binary source not audited. PRODUCT.md creation allowed by user; `init`/`document` that touch DESIGN.md are forbidden. |
| webapp-testing | https://github.com/anthropics/skills (`skills/webapp-testing`) | e4bb5d960d87126ff3b3a8af1a104b7db67560ba | 2026-11-27 | Playwright rendering/behavior checks | Unmodified. Runtime: `.venv-tools/` (gitignored) with Python Playwright 1.65.2; Chromium headless shell in `~/.cache/ms-playwright`. |
| superpowers | https://github.com/obra/superpowers | 22f0b463e7a5e579904dd6211a520321035526f7 (reviewed = installed; v7.0.2) | 2026-11-27 (user ran `/plugin install superpowers@claude-plugins-official`, scope: user) | brainstorming -> plans -> subagent-driven-development -> review | Plugin. SessionStart hook injects text only (no network). Brainstorm visual server loads one image from primeradiant.com. Installed gitCommitSha verified equal to reviewed SHA. "Merge locally" option is forbidden here. |
| claude-seo | https://github.com/AgriciDaniel/claude-seo | 5d7d85ef32ade08dd4265cb678af8357ca6e6098 (reviewed; v2.6.3) | deferred to Phase 5 | SEO diagnosis and priority plan | Plugin. PostToolUse hook (JSON-LD validator on html/jsx/vue/php edits). `/seo setup` creates an isolated Python venv and Chromium; no telemetry (PRIVACY.md). Verify installed SHA. |

## Usage notes (this build, 2026-11-27)
- superpowers: used `brainstorming` (design spec), `writing-plans` (`docs/PLAN.md`), `subagent-driven-development` (per-task implement + spec/quality review). Branches finished via PR only.
- ui-ux-pro-max: used for palette and typography candidates, recorded by hand in `DESIGN.md`. `--persist` never run (no `design-system/`).
- webapp-testing: not used in the committed suite (that is Node `@playwright/test` in `tests/e2e/`); only ad-hoc Python checks via `.venv-tools/` if any.
- find-skills: not used.
- impeccable: review-only; status: pending review run.
- claude-seo: not installed (reviewed only). SEO diagnosis was done with Lighthouse, see `docs/seo.md`. Install via `/plugin` only if the user wants it.
