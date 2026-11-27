# SEO, 검색 등록, 캐시 퍼지

모든 HTML 경로는 엣지(Pages Functions + `HTMLRewriter`)가 `index.html` 셸의 head를 바꿔 내보낸다. 동작은 `functions/_lib/{seo,shell,edge-handlers}.js`, 라우트별 응답은 [api.md](api.md#엣지-라우트-비api).

## 1. 검색엔진 등록

### 네이버 서치어드바이저
1. Cloudflare Pages -> Settings -> Environment variables에 `NAVER_SITE_VERIFICATION`을 **Production과 Preview 모두** 추가한다. 값은 아래 3단계에서 받는 토큰(`content="..."`의 값만, 따옴표·태그 제외). 다음 배포부터 적용되므로 저장 후 재배포한다.
2. 동작 방식: 값이 비어 있지 않으면 엣지가 모든 HTML 응답(404/500 포함)의 `</head>` 앞에 `<meta name="naver-site-verification" content="<값>">`을 넣는다(값은 속성 이스케이프, 앞뒤 공백 제거). 비어 있으면 아무것도 넣지 않는다.
3. https://searchadvisor.naver.com 로그인 -> 웹마스터 도구 -> 사이트 등록 -> 운영 URL(`SITE_URL`과 같은 주소) 입력 -> 소유확인에서 **HTML 태그**를 고르고 표시되는 `content` 값을 1단계에 넣는다.
4. 재배포 후 `curl -s https://<운영 도메인>/ | grep naver-site-verification`로 태그를 확인하고, 서치어드바이저에서 "소유확인"을 누른다.
5. 요청 -> 사이트맵 제출에 `https://<운영 도메인>/sitemap.xml`, 요청 -> RSS 제출에 `https://<운영 도메인>/rss.xml`을 제출한다. (`robots.txt`에도 sitemap 위치가 있다.) 새 글 색인을 빨리 받으려면 요청 -> 웹 페이지 수집에서 URL을 넣는다.

### Google Search Console
1. https://search.google.com/search-console -> 속성 추가. 소유 확인은 **도메인 속성 + DNS TXT 레코드**가 가장 간단하다(Cloudflare DNS에 TXT 추가). HTML 태그 방식은 이 레포에 주입 코드가 없다.
2. 소유 확인 후 Sitemaps에 `sitemap.xml`을 제출한다. `rss.xml`은 별도 제출 없이 `<link rel="alternate">`로 노출된다.

## 2. 캐시 퍼지
HTML과 API는 `s-maxage=600`(엣지 10분) + `stale-while-revalidate=86400`이라, 글을 sync한 뒤 최대 10분 동안(만료 직후에는 갱신 중 오래된 응답) 옛 내용이 보일 수 있다. 정적 `/assets/*`는 해시 파일명 + `immutable`이라 퍼지할 필요가 없다.

대시보드: Cloudflare -> 해당 도메인(Zone) -> Caching -> Configuration -> Purge Cache -> **Custom Purge**(URL 목록) 또는 **Purge Everything**. 글 하나를 고쳤다면 `/posts/<slug>`(퍼센트 인코딩된 전체 URL), `/`, 해당 섹션(`/tech` 등), `/sitemap.xml`, `/rss.xml`, `/api/posts?...`가 대상이다. 다 모르겠으면 Purge Everything.

API (placeholder를 직접 채운다. 토큰은 Zone > Cache Purge 권한만, 저장소·로그에 남기지 않는다):
```bash
curl -X POST "https://api.cloudflare.com/client/v4/zones/<ZONE_ID>/purge_cache" \
  -H "Authorization: Bearer <API_TOKEN>" -H "Content-Type: application/json" \
  --data '{"files":["https://<운영 도메인>/","https://<운영 도메인>/sitemap.xml"]}'   # 전체는 '{"purge_everything":true}'
```
`*.pages.dev` 주소는 내 Zone이 아니라 퍼지할 수 없으니 10분을 기다린다(커스텀 도메인을 쓰는 경우 그 Zone에서 퍼지).

## 3. 페이지 종류별 엣지 주입
공통: `<title>`, `meta description`, `link rel=canonical`, `og:*`, `twitter:*`를 셸의 기본값 대신 넣는다(기존 태그는 제거). 모든 값은 이스케이프되며 origin은 `SITE_URL`이다. `og:image`는 없고 `twitter:card`는 `summary`다(링크 미리보기에 이미지 없음).

| 페이지 | title | description | og:type | JSON-LD |
|---|---|---|---|---|
| `/` | `IT Security Blog` | 사이트 기본 설명 | website | 없음 |
| `/about` | `About - IT Security Blog` | 소개 문구 | website | 없음 |
| `/tech` `/trends` `/essays` | `<섹션 제목> - IT Security Blog` | 섹션 설명(`functions/_lib/sections.js`) | website | 없음 |
| `/categories/<섹션>/<하위>` | `<카테고리명> - IT Security Blog` | 사이트 기본 설명 | website | 없음 |
| `/posts/<slug>` | `<글 제목> - IT Security Blog` | 글 `description`, 없으면 본문 앞부분 요약 | article (+`article:published_time`) | `BlogPosting`: headline, datePublished, dateModified(=글 날짜), description, url, mainEntityOfPage, author(Person, 사이트명), keywords(태그), articleSection |
| 404 / 500 | 셸 기본값 | 셸 기본값 | - | 없음. `<meta name="robots" content="noindex">` 추가 |

글 페이지는 추가로 글 헤더를 프리렌더하고 API 페이로드를 인라인한다(LCP와 요청 수 개선). JSON-LD의 `<`는 `<`로 이스케이프된다.

## 4. llms.txt (선택, 미구현)
LLM 크롤러용 안내 파일은 아직 없다. 추가하려면 `public/llms.txt`에 사이트 설명과 주요 URL(`/sitemap.xml`, `/rss.xml`, 섹션 3개)을 적으면 된다. 확장자가 있는 경로는 catch-all이 정적 파일로 서빙하므로(HTML이 아니면 그대로 반환) 다른 설정은 필요 없다. 글 목록까지 자동으로 넣으려면 `functions/robots.txt.js`처럼 `functions/llms.txt.js`를 만들어 `listPosts`로 생성한다. 검색 노출에 직접적인 효과는 확인되지 않았으니 필요할 때만 한다.

## 5. SITE_URL
- **Production에서 필수**: canonical, sitemap, RSS, og:url, robots의 Sitemap 주소가 모두 이 값을 쓴다. 형식 `https://<운영 도메인>` (끝 슬래시는 제거됨).
- 비어 있으면 요청 host를 쓴다. 그러면 `<프로젝트>.pages.dev`, 브랜치 프리뷰, 커스텀 도메인이 같은 글을 각자의 canonical로 내보내 **중복 색인** 위험이 있다. 운영 값을 설정하면 어느 호스트로 접근해도 canonical은 운영 주소를 가리킨다.
- Preview에는 비워도 된다(프리뷰는 자기 host 기준). 값을 바꾸면 다음 배포부터 적용된다.

## 6. Lighthouse (프리뷰, 2026-11-27, 모바일 기본 설정)
| 카테고리 | 점수 |
|---|---|
| Performance | 99-100 |
| Accessibility | 100 |
| Best Practices | 96 |
| SEO | 92-100 |

범위는 측정한 페이지(홈, 섹션, 글 등) 사이의 최저-최고다. SEO 92 페이지가 있으므로 재측정 시 감점 항목을 확인한다(프리뷰 호스트 기준 값이라 운영에서는 달라질 수 있다). 목표: Perf >= 90, A11y >= 95, BP >= 95, SEO >= 95.

재측정 (Lighthouse 기본값이 모바일 에뮬레이션 + 스로틀링):
```bash
npx lighthouse "https://<URL>/" --only-categories=performance,accessibility,best-practices,seo \
  --output=html --output-path=./lh-home.html --chrome-flags="--headless=new"
```
URL을 홈, `/tech`, 실제 글(`/posts/...`)로 바꿔 각각 측정한다. 한 번의 점수는 편차가 있으니 3회 정도 보고 중앙값을 쓴다.
