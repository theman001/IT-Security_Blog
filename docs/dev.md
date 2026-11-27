# 로컬 개발과 Cloudflare Pages 설정

## 로컬 실행 (터미널 2개)
```bash
cp .dev.vars.example .dev.vars   # DATABASE_URL(app_reader, SELECT 전용) 입력. gitignore 대상
npm install

# 터미널 1: Functions + DB (정적 파일은 dist/ 에서 서빙)
npm run pages:dev                # vite build 후 wrangler pages dev dist  → http://localhost:8788

# 터미널 2: 프론트 HMR (/api/* 는 8788로 프록시)
npm run dev                      # http://localhost:5173
```
- 프론트만 고칠 때는 터미널 2만 쓰고(Functions는 8788에 떠 있어야 `/api` 동작), Functions나 SEO 주입(`/posts/*`)을 확인할 때는 8788을 직접 연다.
- `functions/` 변경은 wrangler가 자동 재로드한다. `dist/` 는 프론트를 바꿀 때마다 `vite build`가 필요하다.

## Cloudflare Pages 설정 (대시보드에서 확인할 것)
| 항목 | 값 |
|---|---|
| Framework preset | None (또는 Vite) |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Functions | 레포 루트 `/functions` 자동 인식 (설정 불필요) |
| 환경변수 `DATABASE_URL` | Production, Preview 둘 다 (app_reader 접속 문자열) |
| 환경변수 `NODE_VERSION` | `22` (Vite 8은 Node 20.19+ / 22.12+ 필요) |
| 프로덕션 브랜치 | `main` (그대로). `renewal` push → 프리뷰 URL |

- 이 레포에는 `wrangler.toml`을 두지 않는다. 있으면 Pages가 대시보드 설정(환경변수 등)을 읽기 전용으로 바꾼다. 로컬에서 필요한 값은 `package.json` 스크립트의 플래그로 준다.
- 옛 `public/_redirects`(SPA 폴백 `/* /index.html 200`)는 삭제했다. 이 규칙이 있으면 없는 경로도 200이 된다. 새 구조에서는 Functions가 알려진 경로에만 `index.html`을 주고 나머지는 404를 돌려준다.

## 엣지 동작
- `/posts/*`: Functions가 글을 조회해 `<title>`, description, canonical, OG/Twitter, JSON-LD를 셸(`/`의 `index.html`)에 주입한다. 없는 글 404, DB 오류 500(`no-store`).
- 404 정책: 알려진 SPA 경로(`/`, `/about`, `/tech|/trends|/essays`, DB에 있는 `/categories/<섹션 하위>`)만 200. 나머지는 SPA 셸 + HTTP 404 + `noindex`(SPA가 not-found 화면을 그린다). `/api/*` 미등록은 JSON 404. `/assets/*`, `/fonts/*`, `/favicon.ico`는 `public/_routes.json`으로 Functions를 건너뛰고, 없는 파일은 `public/404.html`(404)이 응답한다.
- 끝 슬래시: `/about/` 는 `/about` 과 같이 200 (canonical은 슬래시 없는 주소).
- `/sitemap.xml`, `/robots.txt`, `/rss.xml` 은 각자의 Function이 만든다 (파일 라우트가 `[[path]]`보다 우선).
- 필수(Production): `SITE_URL` (예: `https://<운영 도메인>`) — canonical, sitemap, RSS, OG의 origin이다. 없으면 요청 host를 쓰므로 `*.pages.dev` 별칭과 프리뷰 호스트가 같은 글의 중복 색인 대상이 될 수 있다. Preview는 비워도 되지만 Production/Preview 변수는 따로이고 다음 배포부터 적용된다.
- 301 정책: `/categories/<섹션>`(`/categories/tech` 등 섹션 루트)는 섹션 목록과 같은 화면이므로 `/<섹션>`으로 301 영구 이동한다 (URL 하나당 페이지 하나). sitemap에도 섹션 루트만 `/<섹션>`으로 들어간다. 허용되지 않는 메서드는 405 + `Allow: GET, HEAD`.
- 선택 환경변수 (Production/Preview 따로, 다음 배포부터 적용): `NAVER_SITE_VERIFICATION`(있으면 모든 HTML 셸에 `naver-site-verification` meta 주입).
- 검증: `npm run test:edge` — 빌드 후 `wrangler pages dev dist --port 8799`를 띄워 실제 DB로 404, 메타 주입, sitemap/rss/robots, 자산 서빙을 확인하고 서버를 종료한다 (`.dev.vars`에 `DATABASE_URL`이 없으면 건너뜀).
- 캐시 즉시 갱신(Purge Cache) 절차와 SEO 전체 문서는 Task 10에서 정리한다. 임시: 대시보드 Caching > Purge Cache에서 URL 또는 전체 삭제.
