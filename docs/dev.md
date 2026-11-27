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
