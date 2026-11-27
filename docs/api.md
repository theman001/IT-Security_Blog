# `/api/*` 계약

`renewal` 구현 기준(`functions/_lib/handlers.js`, `queries.js`). 모든 `/api/*` 응답은 JSON(UTF-8). 읽기 전용(GET)만 존재한다. 비API 경로는 맨 아래 "엣지 라우트" 절.

## 공통
- **슬러그**: 글 `slug`와 카테고리 `slug`는 **전체 경로**다 (예: `tech/security/reversing/01-kakao-auth`; 새 Blog_Contents 구조에서는 영소문자-하이픈). 조회는 대소문자 구분이며 공백·`&`·`:`·한글이 들어 있어도 동작한다. URL에서는 세그먼트별로 `encodeURIComponent` 한다. 서버는 `decodeURIComponent` 후 **정확히 일치**하는 값만 조회한다 (부분·마지막 세그먼트 대체 매칭 없음).
- **날짜**: `created_at`은 `timestamp without time zone`이고 값은 전부 `00:00:00`(날짜 정보만 있음)이다. 드라이버가 JS `Date`로 바꾸면 서버 타임존에 따라 하루가 밀리므로, SQL에서 `to_char(created_at, 'YYYY-MM-DD')`로 문자열을 받아 그대로 쓴다. 응답의 `date`는 항상 `YYYY-MM-DD`.
- **정렬 안정성**: 같은 날짜에 글이 여러 개이므로 모든 정렬에 `id`를 보조 키로 쓴다.
- **쿼리**: 값은 항상 파라미터 바인딩(`sql.query(text, [params])`). 문자열 연결 금지. 본문(`content_md`)은 상세 조회에서만 SELECT 한다.
- **섹션**: 슬러그의 **첫 세그먼트**가 섹션이다(`tech` | `trends` | `essays`). 글 URL은 모두 `/posts/<slug>`. 레이아웃은 섹션이 `essays`인지로 정한다.
- **캐시** (`functions/_lib/http.js`): 성공 `Cache-Control: public, max-age=60, s-maxage=600, stale-while-revalidate=60`. 4xx는 `public, max-age=0, s-maxage=60`, 500은 `no-store`. 이 헤더는 브라우저/다운스트림용 힌트이고, **엣지 캐시는 `s-maxage`가 아니라 `functions/_lib/cache.js`(Workers Cache API)가 만든다**: 아래 "엣지 캐시" 절.

## 오류 형식
```json
{ "error": { "code": "not_found", "message": "Post not found" } }
```
| status | code | 상황 |
|---|---|---|
| 400 | `bad_request` | 잘못된 `limit`(1–50 밖)/`cursor`/`section`(`tech`·`trends`·`essays` 외)/`category`, 슬러그 디코딩 실패 |
| 404 | `not_found` | 글·카테고리 없음, 위 외 `/api/...` 경로(예: `/api/nope`), 맨 `/api`, `/api/categories/<경로>`에 `/posts` 접미사가 없는 경우 |
| 405 | `method_not_allowed` | GET 외 (HEAD 포함). `/api/posts*`, `/api/categories*`는 응답 헤더 `Allow: GET`. 라우트가 없는 `/api`, `/api/<미등록>`은 엣지 catch-all이 처리하므로 GET/HEAD 외 메서드에 405 + `Allow: GET, HEAD` |
| 500 | `internal` | DB 오류 등. 내부 메시지·접속 정보는 응답에 넣지 않는다 |

## 타입
```ts
PostSummary = {
  id: number, title: string, slug: string,
  date: string,            // "YYYY-MM-DD"
  section: string,         // slug 첫 세그먼트 ("tech" | "trends" | "essays")
  readingMinutes: number,  // max(1, ceil(length(content_md) / 500)), SQL에서 계산
  excerpt: string,         // description 우선, 없으면 본문에서 만든 180자 + "..."
  categoryId: number|null, categoryName: string|null, categoryPath: string|null,
  tags: string[],          // DB text[] (항상 배열, 없으면 [])
  authorType: string|null  // 현재 값은 전부 "admin"
}
Category = {
  id: number, name: string, path: string,   // path = DB slug (전체 경로)
  section: string,          // path 첫 세그먼트 (최상위 3개가 섹션)
  parentId: number|null, depth: number,
  postCount: number,        // 직속 글 수
  totalPostCount: number,   // 하위 포함 전체 글 수
  subCategoryCount: number  // 직속 하위 카테고리 수
}
```

## `GET /api/posts?section=&category=&limit=20&cursor=`
최신 글 목록, 본문 제외. `created_at DESC, id DESC`. `limit` 1–50(기본 20). `cursor`는 이전 응답의 `nextCursor`(불투명 문자열, 날짜 `YYYY-MM-DD`와 id만 담음). 커서에 시각이 없으므로 **`created_at`은 항상 자정(날짜만)이어야** 페이지 경계가 정확하다. sync는 front matter `date`(날짜만)로 `created_at`을 채워야 하며 시각을 넣지 않는다(2026-11-27 운영 DB 확인: `created_at`이 자정이 아닌 행 0개 / 전체 5행, 읽기 전용 조회).
- `section`: `tech` | `trends` | `essays`. 그 외 값은 400. 슬러그 첫 세그먼트와 정확히 일치하는 글만.
- `category`: 카테고리 전체 경로(`path`). 그 카테고리와 하위 카테고리의 글. 정확히 일치(부분 일치 없음). 둘 다 주면 AND.
```json
{ "items": [PostSummary], "nextCursor": "…" | null }
```

## `GET /api/posts/<slug…>`
글 상세. 슬러그에 `/`가 들어 있으므로 Functions는 `functions/api/posts/[[slug]].js` (catch-all)로 받는다.
```json
{
  "post": PostSummary & { "contentMd": string, "description": string },
  "prev": { "slug": string, "title": string } | null,
  "next": { "slug": string, "title": string } | null,
  "related": { "slug": string, "title": string, "excerpt": string, "date": string, "section": string } | null,
  "relatedBy": [PostSummary]
}
```
- `related`: 이 글의 `related_slug`가 가리키는 글(`LEFT JOIN`). `related_slug`가 없거나 대상 글이 없으면 `null`.
- `relatedBy`: `related_slug`가 이 글의 `slug`인 글들의 요약, `created_at DESC, id DESC`, 최대 10개. 없으면 `[]`.
`prev`/`next`는 **같은 카테고리** 안에서 `created_at ASC, id ASC` 기준(SQL `LAG`/`LEAD`). 카테고리가 없는 글은 둘 다 `null`. 글이 없으면 404.

## `GET /api/categories`
카테고리 전체를 평면 배열로(`path` 오름차순). 클라이언트가 `parentId`로 트리를 만든다.
```json
{ "items": [Category] }
```
`path`는 `categories.slug` 컬럼을 그대로 쓴다(이미 전체 경로이므로 부모 경로를 다시 붙이면 중복된다). `totalPostCount`는 `slug`가 같거나 `path || '/'`로 시작하는 카테고리의 글 수 합이다.

## `GET /api/categories/<path…>/posts`
카테고리 하나의 글(`created_at ASC, id ASC`)과 직속 하위 카테고리.
```json
{ "category": Category, "children": [Category], "posts": [PostSummary] }
```
`<path…>`는 전체 경로와 정확히 일치해야 한다. 없으면 404. (끝의 `/posts`는 라우팅용 접미사다. 카테고리 이름이 `posts`인 경우만 모호하므로 그런 카테고리는 만들지 않는다. 접미사가 없으면 404.)

## 엣지 캐시
Cloudflare는 Pages Function이 만든 응답을 `Cache-Control: s-maxage`만으로는 캐시하지 않는다(Cache API를 직접 써야 한다). 그래서 `functions/_lib/cache.js`의 `withEdgeCache`가 각 라우트(`/api/posts*`, `/api/categories*`, `/posts/*`, catch-all의 HTML 응답, `/sitemap.xml`, `/rss.xml`, `/robots.txt`)의 `onRequest`를 감싼다.
- GET만 캐시한다(HEAD 등은 통과, `X-Edge-Cache: BYPASS`). 키는 요청 URL 전체(쿼리 포함). catch-all의 정적 파일 통과(`env.ASSETS`)는 감싸지 않는다.
- 저장 대상은 200, 301, 404뿐이다. 400, 405, 5xx, `Cache-Control: no-store` 응답은 절대 저장하지 않는다.
- TTL: 200/301 600초(10분), 404 60초. 저장본에만 `public, max-age=<TTL>`을 붙이고, 클라이언트에는 핸들러가 정한 원래 `Cache-Control`을 돌려준다.
- 요청에 `Cache-Control: no-cache`/`Pragma: no-cache`(브라우저 강력 새로고침)가 있으면 조회를 건너뛰고 새로 만들어 저장본도 갱신한다(`BYPASS`).
- 디버깅 헤더 `X-Edge-Cache: HIT|MISS|BYPASS`. Cache API를 쓸 수 없는 환경이면 헤더 없이 그대로 응답한다.
- 확인: `curl -sI <url> | grep -i -E 'x-edge-cache|cf-cache-status|age'` (두 번 연속 실행: `MISS` 다음 `HIT`). 로컬 `wrangler pages dev`는 Cache API를 에뮬레이트한다. `*.pages.dev`에서도 동작하는지는 확인 필요(동작하지 않으면 항상 `MISS`).

글이 DB에 반영된 뒤 최대 10분 안에 보인다. 즉시 갱신은 Cloudflare Purge Cache(Cache API 항목도 존재와 URL 단위로 지워진다; 커스텀 도메인/Zone 기준, `*.pages.dev`는 확인 필요). 절차: [seo.md](seo.md#2-캐시-퍼지).

## 엣지 라우트 (비API)
`public/_routes.json`이 `/assets/*`, `/favicon.ico`를 Functions에서 제외하고(정적 파일 직접 서빙; `/assets/*`는 `_headers`로 `immutable` 1년), 나머지는 Functions가 처리한다. HTML 응답은 모두 `index.html` 셸에 `HTMLRewriter`로 head를 바꿔 넣은 것이다. `NAVER_SITE_VERIFICATION`이 있으면 모든 HTML에 `naver-site-verification` meta가 들어간다. origin은 `SITE_URL`(없으면 요청 host).

| 경로 | 응답 |
|---|---|
| `/posts/<slug…>` (`functions/posts/[[slug]].js`) | 글이 있으면 200: title, description, canonical, OG/Twitter, JSON-LD `BlogPosting` + 글 헤더 프리렌더(`src/lib/post-header.js`, SPA와 공유) + 같은 내용의 `/api/posts/<slug>` 페이로드를 `<script type="application/json" id="post-data">`로 인라인(`<`는 `\u003c`로 이스케이프). 슬러그가 잘못됐거나 글이 없으면 404 |
| `/`, `/about`, `/privacy`, `/tech`, `/trends`, `/essays`, DB에 있는 `/categories/<섹션>/<하위…>` | 200, 해당 페이지 메타(JSON-LD 없음). 끝 슬래시는 무시(`/about/` = `/about`) |
| `/categories/<섹션>` (섹션 루트) | **301** `Location: /<섹션>` (URL 하나당 페이지 하나). 섹션 목록과 같은 화면이므로 sitemap에도 `/<섹션>`만 들어간다 |
| `/sitemap.xml` | `application/xml`. `/`, `/about`, `/privacy`, 섹션 3개, 섹션 하위 카테고리, 모든 글(`<lastmod>`=글 날짜) |
| `/rss.xml` | `application/rss+xml`. 최신 20개(제목, 링크, 요약) |
| `/robots.txt` | `User-agent: *`, `Allow: /`, `Sitemap: <origin>/sitemap.xml` |
| 그 외 모든 경로 (`/nope`, `/posts/없는글`, `/posts`, `/tech/없는카테고리`) | **404** + SPA 셸 + `<meta name="robots" content="noindex">` (SPA가 not-found 화면을 그린다) |
| `/api`, `/api/` 및 미등록 `/api/*` | JSON 404 (`{"error":{"code":"not_found",...}}`) |
| 없는 정적 파일 (`/assets/x.js`, 확장자가 있는 경로) | 404. Pages가 `index.html`을 200으로 돌려주면(soft 404) 404 셸로 바꾼다. `_routes.json` 제외 경로는 `public/404.html`(noindex) |

- 클라이언트용 캐시 헤더: HTML 200 `public, max-age=0, s-maxage=600, stale-while-revalidate=60`; HTML 404 `public, max-age=0, s-maxage=60`; HTML/피드 500 `no-store`(본문은 셸 + noindex, 피드는 JSON 오류); 301 `public, max-age=0, s-maxage=600`; sitemap/rss/robots `public, max-age=60, s-maxage=600, stale-while-revalidate=60`. 엣지 보관은 위 "엣지 캐시" 절의 Cache API 래퍼가 한다.
- GET/HEAD 외 메서드는 405 + `Allow: GET, HEAD`(JSON 오류 본문). 단 `/api/posts*`와 `/api/categories*`는 자체 핸들러라 `Allow: GET`(HEAD도 405)이다.
- DB 오류나 `DATABASE_URL` 누락은 응답에 메시지를 싣지 않고 500만 돌려준다. 로그에는 오류 이름과 코드만 남긴다.
