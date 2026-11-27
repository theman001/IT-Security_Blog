# `/api/*` 계약

실제 DB(2026-11-27 확인)와 `renewal` 설계 기준. 모든 응답은 JSON(UTF-8). 읽기 전용(GET)만 존재한다.

## 공통
- **슬러그**: 글 `slug`와 카테고리 `slug`는 **전체 경로**다 (예: `Security/Hack/Reversing/10_KakaoTalk_Auth_Crypto_Cheat_Sheet`). 대소문자 구분, 공백·`&`·`:`·한글을 포함할 수 있다. URL에서는 세그먼트별로 `encodeURIComponent` 한다. 서버는 `decodeURIComponent` 후 **정확히 일치**하는 값만 조회한다 (부분·마지막 세그먼트 대체 매칭 없음).
- **날짜**: `created_at`은 `timestamp without time zone`이고 값은 전부 `00:00:00`(날짜 정보만 있음)이다. 드라이버가 JS `Date`로 바꾸면 서버 타임존에 따라 하루가 밀리므로, SQL에서 `to_char(created_at, 'YYYY-MM-DD')`로 문자열을 받아 그대로 쓴다. 응답의 `date`는 항상 `YYYY-MM-DD`.
- **정렬 안정성**: 같은 날짜에 글이 여러 개이므로 모든 정렬에 `id`를 보조 키로 쓴다.
- **쿼리**: 값은 항상 파라미터 바인딩(`sql.query(text, [params])`). 문자열 연결 금지. 본문(`content_md`)은 상세 조회에서만 SELECT 한다.
- **섹션**: 슬러그의 **첫 세그먼트**가 섹션이다(`tech` | `trends` | `essays`). 글 URL은 모두 `/posts/<slug>`. 레이아웃은 섹션이 `essays`인지로 정한다.
- **캐시**: 성공 응답에 `Cache-Control: public, max-age=60, s-maxage=600, stale-while-revalidate=86400`. 404·에러는 `no-store`에 가깝게 짧게(`max-age=0, s-maxage=60`).

## 오류 형식
```json
{ "error": { "code": "not_found", "message": "Post not found" } }
```
| status | code | 상황 |
|---|---|---|
| 400 | `bad_request` | 잘못된 `limit`(1–50 밖)/`cursor`/`section`(`tech`·`trends`·`essays` 외)/`category`, 슬러그 디코딩 실패 |
| 404 | `not_found` | 글·카테고리 없음 |
| 405 | `method_not_allowed` | GET 외 |
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
`prev`/`next`는 **같은 카테고리** 안에서 `created_at ASC, id ASC` 기준 (부록 A의 LAG/LEAD). 없으면 404.

## `GET /api/categories`
카테고리 전체를 평면 배열로(`path` 오름차순). 클라이언트가 `parentId`로 트리를 만든다.
```json
{ "items": [Category] }
```
옛 CTE는 `parent.path || '/' || slug`로 경로를 만들었지만, 지금 DB의 `slug`가 이미 전체 경로라 **그대로 쓰면 경로가 중복된다.** `path`는 `slug` 컬럼을 그대로 쓴다. 하위 포함 글 수는 `slug`가 `path || '/'`로 시작하는 카테고리 합산, 또는 재귀 CTE로 계산한다.

## `GET /api/categories/<path…>/posts`
카테고리 하나의 글(`created_at ASC, id ASC`)과 직속 하위 카테고리.
```json
{ "category": Category, "children": [Category], "posts": [PostSummary] }
```
`<path…>`는 전체 경로와 정확히 일치해야 한다. 없으면 404. (끝의 `/posts`는 라우팅용 접미사다. 카테고리 이름이 `posts`인 경우만 모호하므로 그런 카테고리는 만들지 않는다.)

## 엣지 캐시 무효화
글을 DB에 INSERT한 뒤 최대 10분(`s-maxage=600`) 안에 반영된다. 즉시 반영이 필요하면 Cloudflare 대시보드의 Caching → Purge Cache(URL 또는 전체), 또는 API `POST /zones/<zone>/purge_cache`. 자세한 절차는 Phase 5에서 `docs/`에 추가한다.

## 비API 경로 (참고, Phase 5)
`/posts/*`(메타 주입), `/sitemap.xml`, `/robots.txt`, `/rss.xml`.
