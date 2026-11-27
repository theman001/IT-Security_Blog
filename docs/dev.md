# 로컬 개발과 Cloudflare Pages 설정

## 로컬 실행 (터미널 2개)
```bash
cp .dev.vars.example .dev.vars   # DATABASE_URL(app_reader, SELECT 전용) 입력. gitignore 대상
                                 # 선택: SITE_URL, NAVER_SITE_VERIFICATION 줄을 직접 추가 (없으면 요청 host 사용 / 주입 안 함)
npm ci

# 터미널 1: Functions + DB (정적 파일은 dist/ 에서 서빙)
npm run pages:dev                # vite build 후 wrangler pages dev dist  → http://localhost:8788

# 터미널 2: 프론트 HMR (/api/* 는 8788로 프록시)
npm run dev                      # http://localhost:5173
```
- 프론트만 고칠 때는 터미널 2만 쓰고(Functions는 8788에 떠 있어야 `/api` 동작), Functions나 SEO 주입(`/posts/*`)을 확인할 때는 8788을 직접 연다.
- `functions/` 변경은 wrangler가 자동 재로드한다. `dist/` 는 프론트를 바꿀 때마다 `vite build`가 필요하다(`pages:dev`를 다시 실행).
- Playwright E2E(`npm test`)는 모든 `/api/*`를 목으로 대체하고 Vite(:5173)만 쓰므로 DB와 `.dev.vars`가 필요 없다. 실제 DB로 엣지를 검증하려면 `npm run test:edge`.
- `npm run check:bundle`은 항상 `vite build`를 먼저 실행해 새 `dist/`를 검사한다(방금 빌드했다면 `SKIP_BUILD=1 npm run check:bundle`로 빌드 생략).

## Cloudflare Pages 설정 (대시보드에서 확인할 것)
| 항목 | 값 |
|---|---|
| Framework preset | None (또는 Vite) |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Functions | 레포 루트 `/functions` 자동 인식 (설정 불필요) |
| 환경변수 `DATABASE_URL` | Production, Preview 둘 다 (app_reader 접속 문자열) |
| 환경변수 `SITE_URL` | Production 필수 (예 `https://<운영 도메인>`, 끝 슬래시 없이). Preview는 비워도 됨 |
| 환경변수 `NAVER_SITE_VERIFICATION` | 선택. 네이버 서치어드바이저 인증 토큰 (절차: [seo.md](seo.md)) |
| 환경변수 `NODE_VERSION` | `22` (Vite 8은 Node 20.19+ / 22.12+ 필요) |
| 프로덕션 브랜치 | `main` (그대로). `renewal` push → 프리뷰 URL |

- 이 레포에는 `wrangler.toml`을 두지 않는다. 있으면 Pages가 대시보드 설정(환경변수 등)을 읽기 전용으로 바꾼다. 로컬에서 필요한 값은 `package.json` 스크립트의 플래그로 준다.
- 옛 `public/_redirects`(SPA 폴백 `/* /index.html 200`)는 삭제했다. 이 규칙이 있으면 없는 경로도 200이 된다. 새 구조에서는 Functions가 알려진 경로에만 `index.html`을 주고 나머지는 404를 돌려준다.

## 엣지 동작
- `/posts/*`: Functions가 글을 조회해 `<title>`, description, canonical, OG/Twitter, JSON-LD를 셸(`/`의 `index.html`)에 주입하고, 글 헤더를 프리렌더하며 API 페이로드를 `#post-data`로 인라인한다(SPA가 첫 요청을 생략). 없는 글 404, DB 오류 500(`no-store`). 라우트 전체 표와 캐시 헤더는 [api.md](api.md#엣지-라우트-비api).
- `public/_routes.json`: `/assets/*`, `/favicon.ico`, `/favicon.svg`, `/apple-touch-icon.png`는 Functions를 거치지 않고 정적 서빙. `public/_headers`: `/assets/*`에 `Cache-Control: public, max-age=31536000, immutable`(파일명에 해시). 이 경로의 없는 파일은 `public/404.html`(404, noindex)이 응답한다.
- 404 정책: 알려진 SPA 경로(`/`, `/about`, `/privacy`, `/contact`(내용은 추후 채움, sitemap 포함), `/tech|/trends|/essays`, DB에 있는 `/categories/<섹션 하위>`)만 200. 나머지는 SPA 셸 + HTTP 404 + `noindex`(SPA가 not-found 화면을 그린다). `/api/*` 미등록은 JSON 404. `/assets/*`, `/favicon.ico`는 `public/_routes.json`으로 Functions를 건너뛰고, 없는 파일은 `public/404.html`(404)이 응답한다.
- 엣지 캐시: `functions/_lib/cache.js`(Workers Cache API)가 라우트를 감싼다. 200/301 600초, 404 60초, 5xx/405/400/`no-store`는 저장 안 함, GET만. `s-maxage`는 힌트일 뿐 Function 응답을 스스로 캐시하지 않는다. 확인: `curl -sI <url> | grep -i -E 'x-edge-cache|cf-cache-status|age'`를 두 번(MISS -> HIT). `wrangler pages dev`는 Cache API를 에뮬레이트하며 `npm run test:edge`가 이를 검사한다. 성공 응답의 `stale-while-revalidate`는 60초다. 자세한 규칙은 [api.md](api.md#엣지-캐시).
- 끝 슬래시: `/about/` 는 `/about` 과 같이 200 (canonical은 슬래시 없는 주소).
- `/sitemap.xml`, `/robots.txt`, `/rss.xml` 은 각자의 Function이 만든다 (파일 라우트가 `[[path]]`보다 우선).
- 필수(Production): `SITE_URL` (예: `https://<운영 도메인>`) — canonical, sitemap, RSS, OG의 origin이다. 없으면 요청 host를 쓰므로 `*.pages.dev` 별칭과 프리뷰 호스트가 같은 글의 중복 색인 대상이 될 수 있다. Preview는 비워도 되지만 Production/Preview 변수는 따로이고 다음 배포부터 적용된다.
- 301 정책: `/categories/<섹션>`(`/categories/tech` 등 섹션 루트)는 섹션 목록과 같은 화면이므로 `/<섹션>`으로 301 영구 이동한다 (URL 하나당 페이지 하나). sitemap에도 섹션 루트만 `/<섹션>`으로 들어간다. HTML/피드 라우트에서 허용되지 않는 메서드는 405 + `Allow: GET, HEAD` (`/api/posts*`, `/api/categories*`는 `Allow: GET`; 라우트 없는 `/api`, `/api/<미등록>`은 catch-all이라 `Allow: GET, HEAD`).
- 선택 환경변수 (Production/Preview 따로, 다음 배포부터 적용): `NAVER_SITE_VERIFICATION`(있으면 모든 HTML 셸에 `naver-site-verification` meta 주입).
- 검증: `npm run test:edge` — 빌드 후 `wrangler pages dev dist --port 8799`를 띄워 실제 DB로 404, 메타 주입, sitemap/rss/robots, 자산 서빙을 확인하고 서버를 종료한다 (`.dev.vars`에 `DATABASE_URL`이 없으면 건너뜀).
- 캐시 즉시 갱신(Purge Cache)과 네이버/구글 등록은 [seo.md](seo.md), 병합 후 점검과 롤백은 [post-merge-checklist.md](post-merge-checklist.md).

## 파비콘
펜촉 도형(32x32 viewBox, 원형 accent 배경)이다. `public/favicon.svg`가 원본이고 `<style>`의 `prefers-color-scheme: dark`로 탭 색이 OS 테마를 따른다(사이트 토글과는 무관). 색은 `DESIGN.md`의 accent/bg 값을 그대로 옮긴 것(SVG는 토큰 변수를 못 쓴다). `favicon.ico`(32px PNG 한 장짜리 ICO)와 `apple-touch-icon.png`(180px, 투명 없이 꽉 찬 사각형, iOS가 모서리를 깎음)는 SVG에서 `sharp`(이미 node_modules에 있음)로 렌더해 만든 고정 파일이다. 도형이나 색을 바꾸면 세 파일을 같이 고친다.
