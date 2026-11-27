# 병합 후 체크리스트 (`renewal` -> `main`)

병합은 사용자가 한다. `main`에 병합되면 Cloudflare Pages가 프로덕션을 자동 배포한다. `<도메인>`은 운영 주소(`SITE_URL`).

> 외부 서비스의 화면·메뉴 이름과 URL(Cloudflare 대시보드, 카카오 디버거 등)은 일반 지식으로 적은 것이라 이 환경에서 확인하지 못했다. 서비스 개편으로 달라질 수 있으니 실제 화면에서 확인한다.

> **중요: 콘텐츠 DB는 이미 바뀌어 있다.** Blog_Contents sync가 운영 DB의 내용을 새 샘플 글(`sample-*`)로 교체했다. **옛(live) 프론트도 같은 DB를 읽는다.** 병합 전부터 옛 사이트에는 새 샘플 글이 보일 수 있다. 샘플 글 제거는 Blog_Contents에서 해당 파일을 삭제해 병합하면 sync가 행을 삭제한다. 런칭 전에 지울지 후에 지울지는 사용자가 결정한다. 이 레포에서 DB를 직접 고치지 않는다.

## 1. 배포 전 환경변수 (Cloudflare Pages -> Settings -> Environment variables)
- [ ] Production: `DATABASE_URL`(읽기 전용 `app_reader`), `NODE_VERSION=22`
- [ ] Production: `SITE_URL=https://<도메인>` (끝 슬래시 없이. 없으면 pages.dev와 중복 색인 위험)
- [ ] 네이버를 쓸 때만 `NAVER_SITE_VERIFICATION` (Production, 필요하면 Preview도)
- [ ] 변수는 **다음 배포부터** 적용된다. 병합 전에 설정하거나, 설정 후 Deployments에서 재배포한다.

## 2. 병합 후 핵심 URL 확인
`curl -sI` 로 상태 코드와 헤더를, 브라우저로 화면을 본다.
- [ ] `/` 200, 홈이 렌더되고 최근 글이 보인다
- [ ] `/tech`, `/trends`, `/essays` 200
- [ ] 실제 글 하나(`/posts/<slug>`) 200, 본문·코드블록·목차, 글 소스 보기에 title/description/canonical/`og:*`/JSON-LD가 들어 있다
- [ ] `/nope` 은 **404** (`curl -I https://<도메인>/nope` -> `HTTP/2 404`), 화면은 404 안내. `/posts/없는글`, `/tech/없는카테고리`도 404
- [ ] `/categories/tech` 는 `301` -> `/tech` (`curl -I`)
- [ ] `/sitemap.xml` 200 `application/xml`, `<loc>`이 `https://<도메인>/...` (pages.dev가 아님)
- [ ] `/rss.xml` 200 `application/rss+xml`, 링크가 운영 도메인
- [ ] `/robots.txt` 200, `Sitemap: https://<도메인>/sitemap.xml`
- [ ] `/api/posts?limit=1` 200 JSON, `/api` 404 JSON

```bash
for p in / /tech /essays /nope /categories/tech /sitemap.xml /rss.xml /robots.txt /api; do
  printf '%s ' "$p"; curl -s -o /dev/null -w '%{http_code}\n' "https://<도메인>$p"; done
```

## 3. 검색·공유
- [ ] 네이버 서치어드바이저 등록, `sitemap.xml`과 `rss.xml` 제출, Google Search Console도 동일 ([seo.md](seo.md))
- [ ] OG 미리보기: 카카오톡 공유 디버거(주소 확인 필요: https://developers.kakao.com/tool/debugger/sharing), Slack에 링크 붙여넣기, 필요하면 Facebook 공유 디버거. 글 URL로 제목·설명이 보이는지 확인. 현재 `og:image`가 없어 이미지는 나오지 않는다. 이전 미리보기가 캐시돼 있으면 디버거에서 "캐시 초기화"를 한다.

## 4. 캐시
- [ ] 엣지 캐시는 Workers Cache API 래퍼(`functions/_lib/cache.js`)다. `s-maxage`만으로는 Function 응답이 캐시되지 않는다. TTL은 200/301 600초, 404 60초, 5xx/405/400/`no-store`는 저장하지 않는다.
- [ ] 동작 확인: 같은 URL을 두 번 요청해 첫 응답 `X-Edge-Cache: MISS`, 둘째 `HIT`인지 본다. `curl -sI https://<도메인>/tech | grep -i -E 'x-edge-cache|cf-cache-status|age'` (프리뷰 `*.pages.dev`에서 항상 `MISS`면 그 호스트에서는 Cache API가 동작하지 않는 것이다. 운영 도메인에서 확인 필요).
- [ ] 옛 내용이 남아 보이면 Cloudflare Purge Cache(전체 또는 URL) ([seo.md](seo.md#2-캐시-퍼지)). Cache API 항목이 Zone 퍼지로 지워지는지는 확인 필요. 자연 만료는 최대 10분.

## 5. 롤백
- 가장 빠른 방법: Cloudflare Pages -> 프로젝트 -> Deployments -> 이전의 정상 프로덕션 배포 -> "Rollback to this deployment"(버튼 이름은 확인 필요).
- 코드로 되돌리기: `git revert -m 1 <병합 커밋 SHA>` 후 PR로 `main`에 반영(다시 배포됨). 환경변수는 롤백되지 않는다.
- 롤백해도 DB 내용은 그대로다. 옛 프론트가 새 DB 구조(섹션 슬러그, 새 샘플 글)에서 어떻게 보이는지는 별도로 확인한다.

## 6. 알려진 사항
- 파비콘은 펜촉(사유를 적는다) 아이콘이다: `public/favicon.svg`(OS 다크 모드에 따라 색이 바뀜), `favicon.ico`(32px), `apple-touch-icon.png`(180px). 색은 `DESIGN.md`의 accent 값을 SVG에 직접 적었다(SVG는 CSS 변수를 쓸 수 없음). accent를 바꾸면 SVG를 고치고 ico/png를 다시 만든다(`docs/dev.md` 파비콘 절). 홈 화면 추가용 192/512 PNG와 manifest는 만들지 않았다.
- 기술 샘플 글(`sample-android-auth`)의 일반 링크 텍스트 "링크"는 Lighthouse SEO 감점 원인이다(콘텐츠 문제, [seo.md](seo.md) 6절). 샘플 글을 지우면 사라진다.

## 7. 권장(사용자 결정): `app_reader` 비밀번호 교체
**병합과 새 프로덕션 배포 확인이 끝난 뒤에** 한다(그 전에 교체하면 옛 live 사이트가 깨진다).
- 이유: `app_reader` 접속 문자열이 옛 `main`의 브라우저 번들(`main:assets/js/api.js`)과 git 히스토리(origin/main, `renewal`의 이전 커밋)에 공개돼 있다. 병합 후 번들은 깨끗하지만 옛 문자열을 가진 사람은 Neon에 직접 접속해 `app_reader`가 읽을 수 있는 것을 조회(SELECT)하고 컴퓨트를 소모시킬 수 있다.
- 범위: SELECT 전용 계정이다. 앞서 사용자는 **소유자(OWNER) 계정** 비밀번호는 교체하지 않기로 했다. 이것은 별개의 계정이고, 교체 여부는 사용자가 결정한다.
- [ ] Neon에서 `app_reader` 비밀번호 재설정(Reset password)
- [ ] 새 접속 문자열을 Cloudflare Pages의 `DATABASE_URL`에 **Production과 Preview 둘 다** 반영하고, 로컬 `.dev.vars`도 갱신
- [ ] 환경변수는 다음 배포부터 적용되므로 **재배포**
- [ ] `curl -s "https://<도메인>/api/posts?limit=1"`가 200 JSON인지 다시 확인
- 비밀번호를 교체하면 히스토리에 남은 옛 문자열은 무효이므로 git 히스토리를 다시 고쳐 쓸 필요가 없다.
