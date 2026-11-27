# IT Security Blog 리뉴얼 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사유를 얼굴로 한 에디토리얼 블로그를 Vite SPA + Pages Functions + Neon(읽기 전용)으로 구현한다.

**Architecture:** Functions가 `/api/*` JSON, `/posts/*` 메타 주입, sitemap/robots/rss, 진짜 404를 담당한다. 브라우저 SPA(History API)는 `/api/*`만 호출하고, 마크다운은 `marked -> DOMPurify -> Prism`으로 렌더한다. 모든 스타일은 `DESIGN.md` 토큰(`src/styles/tokens.css`)만 쓴다.

**Tech Stack:** Vite 8, Vanilla JS(ESM), `@neondatabase/serverless` 1.x(`sql.query`), marked 18, dompurify 3, prismjs 1.30, wrangler 4, `node --test`(단위), `@playwright/test`(E2E).

**Spec:** `docs/superpowers/specs/2026-11-27-blog-renewal-design.md` (+ `DESIGN.md`, `docs/api.md`, `CLAUDE.md`, `.claude/skills/blog-platform/SKILL.md`)

## Global Constraints
- 브랜치 `renewal`만. `main` push/머지 금지(사용자만). 커밋 메시지 끝에 `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- DB는 Functions에서만, `sql.query(text, [params])` 바인딩 필수. 목록 쿼리는 `content_md` 미선택(요약 필요 시 `left(content_md, 600)`만). 날짜는 `to_char(created_at,'YYYY-MM-DD')`. 정렬 보조 키 `id`.
- 섹션 = slug 첫 세그먼트 (`tech` | `trends` | `essays`). 글 URL은 모두 `/posts/<slug>`. 슬러그 정확 일치만.
- API 성공 캐시 `public, max-age=60, s-maxage=600, stale-while-revalidate=86400`; 오류 `max-age=0, s-maxage=60`. 오류 본문 `{error:{code,message}}`.
- 마크다운만 DOMPurify+innerHTML. 그 외 모든 DB 값은 `escapeHtml()`/`textContent`. JSON-LD는 `JSON.stringify` 후 `<`를 `<`로.
- 색/간격/반경/폰트는 `tokens.css` 변수만. 하드코딩 grep 결과 0건 유지(`npm run lint:tokens`).
- 기술·동향 본문 폭 `72ch`, 16px/1.75, 사유 본문 `60ch`, 18px/1.9. 목차는 소제목(h2/h3) 3개 이상일 때만, `>=1200px` 오른쪽 고정.
- 서브에이전트는 공통 파일(`tokens.css`, `src/components/*`, `src/router.js`, `src/lib/*`)을 직접 고치지 않고 보고한다.
- 각 Task 끝에서 `npm run build` 와 해당 테스트가 통과해야 한다. 완료 선언 전 `superpowers:verification-before-completion`.

## Review Focus
1. 연결 대상 글이 삭제된 사유 글(`related_slug`가 존재하지 않는 slug): 카드 없이 정상 렌더, 오류 없음. (Task 2, 7)
2. 공백·`&`·`:`·한글이 든 slug/카테고리 경로의 왕복(인코딩 -> API -> 링크 -> 재조회). 대소문자 불일치·`..`·빈 세그먼트는 400/404. (Task 1, 6)
3. 제목/태그/카테고리명에 `<script>`, `"><img onerror>`가 든 응답: 어디서도 실행되지 않음(목록, 상세, `<title>`, 메타 태그, JSON-LD, RSS). (Task 4, 6, 8)
4. 글이 0개인 섹션/카테고리, 태그 `[]`, `description` 빈 값, 소제목 3개 미만 글: 빈 상태와 대체 요약이 깨지지 않음. (Task 1, 6)
5. 없는 경로(`/nope`, `/posts/없는글`, `/posts/`, `/tech/없는카테고리`)의 HTTP 상태가 진짜 404이고 본문에 SPA 셸이 아니라 404 페이지가 온다. (Task 8)

---

## 파일 구조
```
functions/
  _lib/{http.js, slug.js, cursor.js, excerpt.js, db.js, queries.js, seo.js}
  api/posts/[[slug]].js        # 목록(/api/posts) + 상세(/api/posts/<slug…>)
  api/categories/[[path]].js   # 목록 + <path…>/posts
  posts/[[slug]].js            # HTML 메타 주입 + 404
  [[path]].js                  # 알려진 SPA 경로만 index.html, 나머지 404
  sitemap.xml.js  robots.txt.js  rss.xml.js
src/
  main.js  router.js  lib/{escape.js, api.js, theme.js}
  components/{header.js, footer.js, post-card.js, toc.js, related-card.js}
  pages/{home.js, post.js, section.js, about.js, not-found.js}
  render/{markdown.js, code-blocks.js}
  styles/{tokens.css, base.css, article.css}
  content/{about.md, sections.js}
tests/{unit/*.test.js, e2e/*.spec.js, fixtures/*.json}
docs/{api.md, dev.md, contents-repo.md, PLAN.md}
scripts/check-tokens.mjs
playwright.config.js
```

---

### Task 1: API 공용 라이브러리 + 단위 테스트
**Files:** Create `functions/_lib/{http,slug,cursor,excerpt}.js`, `tests/unit/{http,slug,cursor,excerpt}.test.js`; Modify `package.json`(scripts `test:unit`: `node --test tests/unit`).
**Interfaces — Produces:**
- `json(data: object, opts?: {status?: number, cache?: 'ok'|'err'}) -> Response` (헤더는 Global Constraints 값)
- `fail(status: number, code: string, message: string) -> Response`
- `decodeSlug(parts: string[]|string) -> string|null` — 세그먼트를 `decodeURIComponent` 후 `/`로 합침. 빈 세그먼트, `.`/`..`, 디코딩 실패면 `null`.
- `sectionOf(slug: string) -> string` (첫 세그먼트)
- `encodeCursor({date: string, id: number}) -> string`, `decodeCursor(s: string) -> {date,id}|null` (base64url JSON, 형식 불일치는 null)
- `makeExcerpt(description: string|null, bodyHead: string, max = 180) -> string` — description이 비어 있지 않으면 그대로, 아니면 마크다운 기호(헤더, 코드펜스, 링크, 이미지, `*_>|`)를 제거하고 공백을 정리해 `max`자 + `...`.
- [ ] Step 1: 테스트 작성(이름과 단언): `decodeSlug(['tech','a%20b','x%26y'])==='tech/a b/x&y'`; `decodeSlug(['tech','..'])===null`; `decodeSlug(['%E0%A4%A'])===null`(잘못된 퍼센트 시퀀스); `decodeCursor('###')===null`; `decodeCursor(encodeCursor({date:'2026-01-01',id:5}))` 왕복; `makeExcerpt('요약','본문')==='요약'`; `makeExcerpt('', '# 제목\n```js\nx\n```\n본문'.repeat(40)).endsWith('...')` 이고 길이 `<=183`; `fail(404,'not_found','x')`의 status 404, 본문 `{error:{code:'not_found',message:'x'}}`, `Cache-Control`에 `s-maxage=60`.
- [ ] Step 2: `npm run test:unit` 실행, 모두 실패(모듈 없음) 확인.
- [ ] Step 3: 위 시그니처대로 구현.
- [ ] Step 4: `npm run test:unit` 통과 확인.
- [ ] Step 5: 커밋 `feat(api): add shared http/slug/cursor/excerpt helpers`.

### Task 2: 쿼리 모듈과 API 엔드포인트
**Files:** Create `functions/_lib/{db,queries}.js`, `functions/api/posts/[[slug]].js`, `functions/api/categories/[[path]].js`, `tests/unit/queries.test.js`; Delete `functions/api/health.js`.
**Interfaces — Consumes:** Task 1 전부. **Produces:**
- `getDb(env) -> {query(text: string, params: any[]) => Promise<any[]>}` (`neon(env.DATABASE_URL).query` 래핑, 값 없으면 throw)
- `listPosts(db, {section?: string, category?: string, limit: number, cursor?: {date,id}}) -> {items: PostSummary[], nextCursor: string|null}`
- `getPost(db, slug) -> {post, prev, next, related, relatedBy}|null` — `docs/api.md` 갱신본(Task 3)의 모양. `related`는 `related_slug`를 `LEFT JOIN`한 결과, 없거나 대상이 없으면 `null`. `relatedBy`는 `related_slug = 이 글의 slug`인 글 목록(요약, 최신순).
- `listCategories(db) -> Category[]` (`path = slug`, `postCount`, `totalPostCount`, `subCategoryCount`, `section`)
- `getCategoryPosts(db, path) -> {category, children, posts}|null`
- 엔드포인트: `GET /api/posts?section=&category=&limit=&cursor=`, `GET /api/posts/<slug…>`, `GET /api/categories`, `GET /api/categories/<path…>/posts`. GET 외 405, 잘못된 `limit`(1-50 밖)/`cursor`/`section`(허용 외)은 400.
- [ ] Step 1: 가짜 db(`{query: async (text, params) => rows}`로 호출 인자 기록)로 테스트: `listPosts`가 `limit+1`행을 요청해 `nextCursor`를 만들고 마지막 항목이 잘림; 쿼리 텍스트에 `content_md` 단독 SELECT가 없음(`left(content_md`만); 값이 모두 `params`에 있고 텍스트에 사용자 값이 없음; `getPost` 없는 slug는 `null`; `related`가 null인 행은 `related: null`; `tags`가 null이면 `[]`.
- [ ] Step 2: 실행해 실패 확인. Step 3: 구현(쿼리는 `docs/api.md`와 부록 A의 LAG/LEAD 방식, 날짜 `to_char`, `ORDER BY ... , id`). Step 4: 단위 통과.
- [ ] Step 5: `npm run pages:dev` 후 실제 DB로 `curl -s localhost:8788/api/categories`, `/api/posts?limit=2`, 존재하지 않는 `/api/posts/x` 가 404 JSON인지 확인(응답에서 비밀값 없음).
- [ ] Step 6: 커밋 `feat(api): add posts and categories endpoints`.

### Task 3: 문서 갱신 + 디자인 토큰
**Files:** Modify `docs/api.md`; Create `docs/contents-repo.md`, `src/styles/tokens.css`, `src/styles/base.css`, `scripts/check-tokens.mjs`; Modify `package.json`(`lint:tokens`).
- [ ] Step 1: `docs/api.md`를 설계 문서 7절대로 갱신(section 필터, `readingMinutes`, `related`, `relatedBy`, `section`).
- [ ] Step 2: `docs/contents-repo.md`: 새 폴더 구조, front matter(`related`), `_category.md`, `sync_to_db.js` 수정안(diff 형태), 이름 규칙(영소문자-하이픈), 옛 파일 삭제 시 DB 삭제 주의. Blog_Contents에는 push하지 않음.
- [ ] Step 3: `tokens.css`를 `DESIGN.md` 값으로 작성(라이트 `:root`, 다크 `[data-theme="dark"]`와 `prefers-color-scheme` 미지정 시 OS 기준; 두 세트 키 동일). `base.css`: 리셋, 본문/제목 타입, 포커스 링, `prefers-reduced-motion`.
- [ ] Step 4: `scripts/check-tokens.mjs`: `src/**/*.{css,js,html}`(단 `tokens.css` 제외)에서 `#[0-9a-f]{3,8}`, `rgb(`, `hsl(`, `oklch(`, 숫자 `px` 중 토큰 선언 밖 사용을 찾아 있으면 비정상 종료(허용: `0`, `1px`, `100%`, 미디어쿼리 `px`). 테스트: `tests/unit/check-tokens.test.js`가 위반 문자열 샘플에서 실패, 깨끗한 샘플에서 성공.
- [ ] Step 5: `npm run lint:tokens` 와 `npm run test:unit` 통과, 커밋 `feat(design): add tokens, base styles, token lint, docs`.

### Task 4: 앱 셸(라우터, 레이아웃, 테마, 클라이언트)
**Files:** Create `src/{main.js,router.js}`, `src/lib/{escape,api,theme}.js`, `src/components/{header,footer}.js`, `playwright.config.js`, `tests/e2e/shell.spec.js`, `tests/unit/escape.test.js`; Modify `index.html`(`<head>` 인라인 테마 스크립트, 폰트 preconnect/로드).
**Interfaces — Produces:**
- `escapeHtml(value: unknown) -> string` (`& < > " '` 치환, null/undefined는 `''`)
- `api.getPosts(params) / getPost(slug) / getCategories() / getCategoryPosts(path)` — 모두 `fetch('/api/...')`, 비정상 응답은 `{status,code}` 가진 `ApiError` throw, slug는 세그먼트별 `encodeURIComponent`.
- 라우터: `route(pattern: string, page: Page)`, `navigate(path: string)`, 링크 `a[data-link]` 가로채기, `popstate`는 경로가 바뀐 경우에만 재렌더. `Page = {load(params)->Promise<data>, render(data)->{title:string, html:string}, mount?(root, data), unmount?()}`. 이동 시 이전 페이지 `unmount()`, `document.title = '<title> - IT Security Blog'`(홈은 `IT Security Blog`), 본문 컨테이너(`#main`, `tabindex="-1"`)로 포커스.
- 테마: `localStorage['theme']`가 `light|dark`면 `<html data-theme>`에 즉시 적용(인라인 스크립트), 없으면 OS 설정. `toggleTheme()`.
- [ ] Step 1: Playwright 설정(`webServer: npm run build && npx vite preview`, `baseURL`, 모든 `/api/*` 는 테스트에서 `page.route`로 모의). 테스트: 토글 후 새로고침해도 `data-theme` 유지; 첫 페인트 전에 `data-theme`가 이미 설정됨(`page.addInitScript`로 localStorage 설정 후 `document.documentElement.dataset.theme` 를 `DOMContentLoaded` 전에 확인); 내부 링크 클릭이 `pushState`로 이동하고 포커스가 `#main`; 뒤로가기 동작; 해시 앵커 이동 시 재렌더 없음.
- [ ] Step 2: 단위 테스트 `escapeHtml('<a href="x">&\'')==='&lt;a href=&quot;x&quot;&gt;&amp;&#39;'`, `escapeHtml(null)===''`. Step 3~4: 구현 후 `npm run test:unit && npx playwright test tests/e2e/shell.spec.js` 통과. 
- [ ] Step 5: 커밋 `feat(app): add router, shell layout, theme, api client`.

### Task 5: 마크다운 파이프라인, 코드 블록, 목차
**Files:** Create `src/render/{markdown,code-blocks}.js`, `src/components/toc.js`, `src/styles/article.css`, `tests/e2e/render.spec.js`, `tests/fixtures/sample.md`.
**Interfaces — Produces:**
- `renderMarkdown(md: string) -> string` — `marked.parse` (gfm, breaks false) -> `DOMPurify.sanitize(html, {USE_PROFILES:{html:true}})`. 실패 시 `<p>Markdown rendering failed.</p>`. 제목에 id(`toc-heading-N`) 부여.
- `enhanceCodeBlocks(root: HTMLElement) -> void` — Prism 하이라이트(`prismjs` + 필요한 언어: bash, javascript, typescript, python, json, sql, yaml, c, cpp, java, powershell), 언어 라벨 + 복사 버튼(클릭 후 1.8초 `Copied!`).
- `buildToc(root: HTMLElement) -> {html: string, count: number}` — h2/h3가 3개 미만이면 `count`가 그 개수, 호출 측이 `<3`이면 표시하지 않음.
- [ ] Step 1: 테스트(페이지 컴포넌트에 의존하지 않도록 `renderMarkdown`/`enhanceCodeBlocks`만 불러오는 `tests/fixtures/render-harness.html`을 Vite dev 서버로 서빙해 사용): 제목/표/목록/인용/이미지가 각 태그로 렌더; `<img src=x onerror=alert(1)>`와 `<script>` 포함 본문에서 `dialog` 이벤트 미발생이고 `onerror` 속성 제거; 코드 블록에 `.token` 존재; 복사 버튼 클릭 시 클립보드에 코드 텍스트(`permissions: ['clipboard-write']`)와 버튼 텍스트 `Copied!` -> 1.8초 후 복귀; h2/h3 2개면 TOC 비표시, 3개면 표시.
- [ ] Step 2~4: 실패 확인, 구현, 통과. 이미지 `src`는 `asset.taeuk.site`와 상대 경로만 허용하도록 `DOMPurify` 훅에서 http 외부 이미지는 유지하되 `loading="lazy"` 부여.
- [ ] Step 5: 커밋 `feat(render): add markdown pipeline, code blocks, toc`.

### Task 6: 페이지 (병렬 가능: 6a~6d, git worktree + subagent)
공통: 각 페이지는 `Page` 계약을 구현하고 모의 응답 E2E를 가진다. 모든 DB 값은 `escapeHtml`. `tests/fixtures/*.json`에 API 응답 샘플(정상, 빈 목록, XSS 문자열, 연결 대상 없음)을 둔다.
- **6a 홈** `src/pages/home.js`, `src/components/post-card.js`: `GET /api/posts?section=essays&limit=1`(대표 사유) + `GET /api/posts?limit=8`(최근) + 섹션별 `limit=3`. 위계: 마스트헤드, 대표 사유 + 최근 글 열, 섹션 3개(Essays는 인용 형태: `description`을 인용으로). 빈 섹션은 안내 문구. 테스트: 대표 사유가 첫 영역에 있음, 섹션이 비어도 렌더, XSS 제목이 텍스트로만 표시.
- **6b 글 상세** `src/pages/post.js`, `src/components/{toc,related-card}.js`: 섹션이 `essays`면 사유 레이아웃(좁은 폭, 진행선, 목차 없음, 상단 `related` 카드), 아니면 기술 레이아웃(오른쪽 고정 목차, 하단 `relatedBy` 박스, 이전/목록/다음). 목록 버튼은 slug에서 마지막 세그먼트를 뺀 `/categories/<경로>`(섹션 루트면 `/tech` 등). 테스트: 두 레이아웃 분기, `related: null`이면 카드 없음, 목차 3개 기준, 이전/다음 링크 인코딩 왕복(`a b&c:한글`), 404 응답 시 not-found 페이지.
- **6c 섹션/카테고리 목록** `src/pages/section.js`: `/tech` `/trends` `/essays` 와 `/categories/<경로>`. 하위 카테고리 칩, 깊이 3 이상이면 접이식 트리 사이드바, "더 보기"로 cursor 페이지네이션. 테스트: 칩 필터, 3단계 카테고리에서 트리 표시(2단계는 칩만), 빈 상태, 더 보기가 `nextCursor`로 두 번째 요청.
- **6d 정적/404** `src/pages/{about,not-found}.js`, `src/content/{about.md,sections.js}`: About은 `renderMarkdown(about.md)`(Vite `?raw`), 404는 최근 글 3개와 홈 링크. 테스트: 미등록 경로가 404 페이지(`document.title` 반영).
- 각 서브태스크: [ ] 실패하는 E2E 작성 -> [ ] 구현 -> [ ] `npx playwright test <spec>` 통과 -> [ ] `npm run lint:tokens` -> [ ] 커밋 `feat(pages): add <page>`. 6a~6d는 서로 파일이 겹치지 않는다. 공통 파일 수정이 필요하면 보고한다.
- 6 전체 완료 후: Impeccable `critique`, `audit`(리뷰 전용) 실행, 지적 사항은 별도 수정 커밋.

### Task 7: 폰트 로딩과 성능 기본
**Files:** Modify `index.html`, `src/styles/base.css`; Create `public/fonts/`(JetBrains Mono 자체 호스팅 woff2).
- [ ] Step 1: 테스트(E2E): 한글 본문 요소의 `getComputedStyle().fontFamily`가 기술 글에서 `Pretendard`, 사유 글에서 `Noto Serif KR`로 시작; `document.fonts.check('16px "Pretendard Variable"')` 참.
- [ ] Step 2: Pretendard 동적 서브셋 CSS와 Noto Serif KR을 `font-display: swap`으로 로드(외부 CDN 사용 시 `preconnect`), 본문 폰트는 `--font-body-tech`/`--font-body-essay` 토큰으로 섹션 컨테이너에서 전환. Step 3~4: 통과 확인, 커밋 `feat(fonts): load Pretendard, Noto Serif KR, JetBrains Mono`.

### Task 8: 엣지 — 404, 메타 주입, sitemap/robots/rss
**Files:** Create `functions/_lib/seo.js`, `functions/posts/[[slug]].js`, `functions/[[path]].js`, `functions/{sitemap.xml,robots.txt,rss.xml}.js`, `tests/unit/seo.test.js`, `tests/e2e/edge.spec.js`.
**Interfaces — Produces:**
- `metaTags(post: PostDetail, origin: string) -> {title: string, description: string, canonical: string, og: Record<string,string>, twitter: Record<string,string>, jsonLd: string}` — 모든 문자열은 속성/텍스트 이스케이프, `jsonLd`는 `BlogPosting`(headline, datePublished, author, keywords)을 `JSON.stringify` 후 `<`를 `<`.
- `xmlEscape(s: string) -> string`
- `functions/posts/[[slug]].js`: `getPost` 성공이면 `env.ASSETS.fetch('/index.html')` 응답에 `HTMLRewriter`로 `<title>`, `meta[name=description]`, `link[rel=canonical]`, `og:*`, `twitter:*`, JSON-LD 주입(가능하면 `#main`에 본문 HTML 프리렌더도 주입하되 DOMPurify가 없는 서버에서는 `escapeHtml`한 `description`만), 없으면 404 상태로 404 HTML(404 페이지 셸 + `noindex`).
- `functions/[[path]].js`: 알려진 SPA 경로(`/`, `/about`, `/tech`, `/trends`, `/essays`, `/categories/**`)이고 카테고리가 존재할 때만 `index.html` 200, 아니면 404(+ 404 페이지). `/assets/*`, 파일 확장자가 있는 경로는 `env.ASSETS` 그대로.
- sitemap: 모든 글 `loc`/`lastmod`(DB 날짜), 섹션·카테고리 URL 포함. robots: sitemap 위치, `Allow: /`. rss: 최근 20개, 제목/요약은 `xmlEscape`. 네이버 서치어드바이저 인증용 `<meta name="naver-site-verification">` 자리는 환경변수 `NAVER_SITE_VERIFICATION`이 있을 때만 주입(없으면 생략).
- [ ] Step 1: 단위 테스트: `metaTags`의 title에 `<script>`가 든 글로 호출 시 결과에 raw `<script`가 없음; `jsonLd`에 `</script>` 문자열이 없음; `xmlEscape('a&b<c>')==='a&amp;b&lt;c&gt;'`.
- [ ] Step 2: 구현. Step 3: 로컬 `npm run pages:dev`에서 `curl -s -o /dev/null -w "%{http_code}" localhost:8788/nope` -> `404`, `/posts/없는글` -> `404`, 실제 글 `/posts/<slug>` 응답에 `og:title`과 `application/ld+json`, `/sitemap.xml`·`/rss.xml` 200과 XML 유효성(`xmllint --noout`).
- [ ] Step 4: 커밋 `feat(edge): add 404 handling, meta injection, sitemap/robots/rss`.

### Task 9: 검증과 프리뷰
- [ ] Step 1: Playwright로 1440/390 스크린샷(홈, 기술 글, 사유 글, 섹션, 404, 라이트/다크), 키보드 탐색(Tab 순서, 페이지 이동 후 포커스)을 `tests/e2e/a11y.spec.js`에 추가.
- [ ] Step 2: `npm run build` 후 `dist/`에 `postgresql://`/`DATABASE_URL`/`neon`이 없음을 `grep -r`로 확인.
- [ ] Step 3: `npm test`(단위+E2E) 전체 통과, `npm run lint:tokens` 0건.
- [ ] Step 4: push -> 프리뷰 URL에서 `curl`: `/posts/<slug>` OG/JSON-LD, 없는 경로 404, `/sitemap.xml`, `/rss.xml`, `/robots.txt`.
- [ ] Step 5: 이 시점에 `claude-seo` 설치(사용자가 `/plugin` 실행, `/seo setup`) 후 프리뷰 URL 진단, 우선순위 항목 반영. Lighthouse 모바일 Perf>=90, A11y>=95, BP>=95, SEO>=95 확인(미달 시 원인별 수정 커밋).
- [ ] Step 6: 커밋/푸시.

### Task 10: PR과 운영 반영 준비
- [ ] Step 1: 엣지 캐시 무효화 방법, 네이버 서치어드바이저 인증/사이트맵·RSS 제출 안내, `llms.txt`(선택)를 `docs/dev.md`/`docs/seo.md`에 정리.
- [ ] Step 2: `CLAUDE.md`, `README.md`, `docs/api.md`, `SKILLS.lock.md`, `blog-platform` 스킬 최신화(Phase 4 변경 반영).
- [ ] Step 3: `renewal -> main` PR 생성(본문: 변경 요약, 프리뷰 URL, 스크린샷, 테스트 결과, 남은 과제, 롤백 방법(Pages 대시보드 이전 배포로 롤백 또는 머지 커밋 revert), 머지 후 체크리스트(주요 URL, 환경변수, sitemap 제출, OG 미리보기, 404)). **머지는 사용자.**

## 의존성
Task 1 -> 2 -> (3, 4 병렬 가능하나 3의 토큰이 4보다 먼저) -> 5 -> 6a~6d(병렬) -> 7 -> 8 -> 9 -> 10. Task 2의 `related_slug` 컬럼은 이미 DB에 존재(2026-11-27 확인). 실제 새 콘텐츠가 DB에 없어도 모든 테스트는 모의 응답으로 통과해야 한다.
