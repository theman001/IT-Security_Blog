# IT Security Blog

보안 취약점 분석, 보안 동향, 보안을 바라보는 생각을 기록하는 블로그. 세 섹션(`tech` 기술, `trends` 동향·사건사고, `essays` 사유)을 가진 에디토리얼 스타일 SPA다. 글은 마크다운으로 Neon Postgres에 저장되고 Cloudflare Pages Functions가 읽기 전용으로 제공한다.

## Stack
- Frontend: Vanilla JS (ES modules), CSS variables(`DESIGN.md` 토큰), Vite 8. History API 라우터. 폰트는 npm 패키지 셀프 호스팅(Pretendard, Noto Serif KR, JetBrains Mono).
- Backend: Cloudflare Pages Functions (`functions/`), `@neondatabase/serverless`, SELECT 전용 DB 역할(`app_reader`). 브라우저에는 `/api/*` JSON만 노출된다.
- Rendering: `marked` -> `DOMPurify` -> `Prism.js` (클라이언트). 글 상단(헤더)은 엣지에서 먼저 그려 첫 HTML에 포함한다.
- SEO: 엣지에서 title/description/canonical/OG/Twitter/JSON-LD 주입, `sitemap.xml`, `robots.txt`, `rss.xml`, 진짜 404.

## Local development
```bash
cp .dev.vars.example .dev.vars    # DATABASE_URL(읽기 전용 역할) 입력. 절대 커밋하지 않는다
npm ci
npm run pages:dev                 # 빌드 + Functions + DB: http://localhost:8788
npm run dev                       # Vite HMR: http://localhost:5173 (/api 는 8788로 프록시)
```
자세한 내용: [docs/dev.md](docs/dev.md).

## Tests
```bash
npm run test:unit     # node --test (네트워크/DB 불필요)
npm test              # 단위 + Playwright E2E (API는 목)
npm run test:edge     # 빌드 후 wrangler로 실제 DB 대상 404/메타/sitemap/rss 확인 (.dev.vars 필요, 없으면 건너뜀)
npm run lint:tokens   # 색/간격/반경/폰트 하드코딩 검사
npm run check:bundle  # dist/ 에 DB 접속 정보·드라이버 문자열이 없는지 검사
```

## Deployment (Cloudflare Pages)
- Build `npm run build`, output `dist`, Functions는 `/functions` 자동 인식, `NODE_VERSION=22`.
- 환경변수(Production과 Preview는 별개 목록, 다음 배포부터 적용): `DATABASE_URL`(필수), `SITE_URL`(Production 필수, 예 `https://<운영 도메인>`), `NAVER_SITE_VERIFICATION`(선택).
- `main` = 프로덕션(push 시 자동 배포). 그 외 브랜치(`renewal` 등) = 프리뷰 URL. 흐름: 브랜치 작업 -> 프리뷰 확인 -> PR -> 관리자가 병합. `main`에는 직접 push하지 않는다.
- **롤백**: Cloudflare Pages 대시보드 -> Deployments -> 이전 배포에서 "Rollback to this deployment". 또는 병합 커밋을 `git revert -m 1 <merge>` 후 PR.
- 병합 후 점검 목록: [docs/post-merge-checklist.md](docs/post-merge-checklist.md).

## Publishing content
글은 이 레포가 아니라 Blog_Contents 레포의 마크다운이다.
1. Blog_Contents `contents/<section>/…`에 `.md` 추가·수정·삭제(구조와 front matter: [docs/contents-repo.md](docs/contents-repo.md)).
2. `main`에 병합하면 GitHub Actions의 sync 스크립트가 Neon의 `reports`/`categories`에 반영한다(파일 삭제는 행 삭제). 이 레포는 다시 빌드·배포하지 않는다.
3. 엣지 캐시(Workers Cache API 래퍼, TTL 600초) 때문에 반영까지 최대 10분. 즉시 보려면 Cloudflare Purge Cache([docs/seo.md](docs/seo.md)).

## Docs
- [docs/api.md](docs/api.md): `/api/*` 계약, 엣지 라우트(`/posts/*`, sitemap, robots, rss), 404/301 정책
- [docs/dev.md](docs/dev.md): 로컬 개발, Pages 설정, 엣지 동작
- [docs/seo.md](docs/seo.md): 네이버/구글 등록, 캐시 퍼지, 메타 주입, Lighthouse
- [docs/post-merge-checklist.md](docs/post-merge-checklist.md): 병합 후 체크리스트와 롤백
- [docs/contents-repo.md](docs/contents-repo.md): Blog_Contents 구조 요약
- [DESIGN.md](DESIGN.md): 디자인 토큰 계약. [docs/PLAN.md](docs/PLAN.md): 구현 계획. 설계 문서: `docs/superpowers/specs/`

## Working with Claude Code
See [CLAUDE.md](CLAUDE.md). Skills and their provenance: [.claude/SKILLS.lock.md](.claude/SKILLS.lock.md).
