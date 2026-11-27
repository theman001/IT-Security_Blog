# `/api/*` 계약

`renewal` 구현 기준(`functions/_lib/handlers.js`, `queries.js`). 모든 `/api/*` 응답은 JSON(UTF-8). 읽기 전용(GET)만 존재한다. 비API 경로는 맨 아래 "엣지 라우트" 절.

## 공통
- **슬러그**: 글 `slug`와 카테고리 `slug`는 **전체 경로**다 (예: `tech/security/reversing/01-kakao-auth`; 새 Blog_Contents 구조에서는 영소문자-하이픈). 조회는 대소문자 구분이며 공백·`&`·`:`·한글이 들어 있어도 동작한다. URL에서는 세그먼트별로 `encodeURIComponent` 한다. 서버는 `decodeURIComponent` 후 **정확히 일치**하는 값만 조회한다 (부분·마지막 세그먼트 대체 매칭 없음).
- **날짜**: `created_at`은 `timestamp without time zone`이고 값은 전부 `00:00:00`(날짜 정보만 있음)이다. 드라이버가 JS `Date`로 바꾸면 서버 타임존에 따라 하루가 밀리므로, SQL에서 `to_char(created_at, 'YYYY-MM-DD')`로 문자열을 받아 그대로 쓴다. 응답의 `date`는 항상 `YYYY-MM-DD`.
- **정렬 안정성**: 같은 날짜에 글이 여러 개이므로 모든 정렬에 `id`를 보조 키로 쓴다.
- **쿼리**: 값은 항상 파라미터 바인딩(`sql.query(text, [params])`). 문자열 연결 금지. 본문(`content_md`)은 상세 조회에서만 SELECT 한다.
- **섹션**: 슬러그의 **첫 세그먼트**가 섹션이다(`tech` | `trends` | `essays`). 글 URL은 모두 `/posts/<slug>`. 레이아웃은 섹션이 `essays`인지로 정한다.
- **캐시** (`functions/_lib/http.js`): 성공 `Cache-Control: public, max-age=60, s-maxage=600, stale-while-revalidate=86400`. 4xx와 `/api` 500은 `public, max-age=0, s-maxage=60`(엣지에서 60초만 보관). HTML/피드의 500은 `no-store`(아래 엣지 라우트).

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
최신 글 목록, 본문 제외. `created_at DESC, id DESC`. `limit` 1–50(기본 20). `cursor`는 이전 응답의 `nextCursor`(불투명 문자열, `YYYY-MM-DD`+id를 담음).
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

## 엣지 캐시 무효화
글이 DB에 반영된 뒤 최대 10분(`s-maxage=600`) 안에 보인다. 즉시 갱신은 Cloudflare Purge Cache. 절차: [seo.md](seo.md#2-캐시-퍼지).

## 엣지 라우트 (비API)
`public/_routes.json`이 `/assets/*`, `/fonts/*`, `/favicon.ico`를 Functions에서 제외하고(정적 파일 직접 서빙; `/assets/*`는 `_headers`로 `immutable` 1년), 나머지는 Functions가 처리한다. HTML 응답은 모두 `index.html` 셸에 `HTMLRewriter`로 head를 바꿔 넣은 것이다. `NAVER_SITE_VERIFICATION`이 있으면 모든 HTML에 `naver-site-verification` meta가 들어간다. origin은 `SITE_URL`(없으면 요청 host).

| 경로 | 응답 |
|---|---|
| `/posts/<slug…>` (`functions/posts/[[slug]].js`) | 글이 있으면 200: title, description, canonical, OG/Twitter, JSON-LD `BlogPosting` + 글 헤더 프리렌더(`src/lib/post-header.js`, SPA와 공유) + 같은 내용의 `/api/posts/<slug>` 페이로드를 `<script type="application/json" id="post-data">`로 인라인(`<`는 `\u003c`로 이스케이프). 슬러그가 잘못됐거나 글이 없으면 404 |
| `/`, `/about`, `/tech`, `/trends`, `/essays`, DB에 있는 `/categories/<섹션>/<하위…>` | 200, 해당 페이지 메타(JSON-LD 없음). 끝 슬래시는 무시(`/about/` = `/about`) |
| `/categories/<섹션>` (섹션 루트) | **301** `Location: /<섹션>` (URL 하나당 페이지 하나). 섹션 목록과 같은 화면이므로 sitemap에도 `/<섹션>`만 들어간다 |
| `/sitemap.xml` | `application/xml`. `/`, `/about`, 섹션 3개, 섹션 하위 카테고리, 모든 글(`<lastmod>`=글 날짜) |
| `/rss.xml` | `application/rss+xml`. 최신 20개(제목, 링크, 요약) |
| `/robots.txt` | `User-agent: *`, `Allow: /`, `Sitemap: <origin>/sitemap.xml` |
| 그 외 모든 경로 (`/nope`, `/posts/없는글`, `/posts`, `/tech/없는카테고리`) | **404** + SPA 셸 + `<meta name="robots" content="noindex">` (SPA가 not-found 화면을 그린다) |
| `/api`, `/api/` 및 미등록 `/api/*` | JSON 404 (`{"error":{"code":"not_found",...}}`) |
| 없는 정적 파일 (`/assets/x.js`, 확장자가 있는 경로) | 404. Pages가 `index.html`을 200으로 돌려주면(soft 404) 404 셸로 바꾼다. `_routes.json` 제외 경로는 `public/404.html`(noindex) |

- 캐시 헤더: HTML 200 `public, max-age=0, s-maxage=600, stale-while-revalidate=86400`; HTML 404 `public, max-age=0, s-maxage=60`; HTML/피드 500 `no-store`(본문은 셸 + noindex, 피드는 JSON 오류); 301 `public, max-age=0, s-maxage=600`; sitemap/rss/robots `public, max-age=60, s-maxage=600, stale-while-revalidate=86400`.
- GET/HEAD 외 메서드는 405 + `Allow: GET, HEAD`(JSON 오류 본문). 단 `/api/posts*`와 `/api/categories*`는 자체 핸들러라 `Allow: GET`(HEAD도 405)이다.
- DB 오류나 `DATABASE_URL` 누락은 응답에 메시지를 싣지 않고 500만 돌려준다. 로그에는 오류 이름과 코드만 남긴다.
