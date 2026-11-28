# SEO 전략과 구현 지도

이 블로그가 검색엔진(네이버, 구글)에 잘 읽히고 색인되도록 **무엇을, 왜, 어떻게, 어느 파일에** 구현했는지 정리한 문서다. 검색엔진 등록 절차, 캐시 퍼지, Lighthouse 측정값은 [seo.md](seo.md), 라우트별 응답은 [api.md](api.md) 엣지 라우트 절, 글 쓰는 규칙은 [contents-repo.md](contents-repo.md)에 있다. 이 문서는 그 위에서 전체 그림을 보여 준다.

> 작성 기준: `renewal` 브랜치 `091592e` 이후 코드, 프리뷰(`renewal.it-security-blog.pages.dev`)에서 글 페이지의 `<head>`와 prerender를 직접 확인했다. 네이버·구글 쪽 화면과 동작(색인 속도, 검색 노출)은 이 환경에서 확인하지 못했다.

## 1. 전략 요약

| 문제 | 전략 | 핵심 구현 |
|---|---|---|
| SPA라서 첫 HTML이 비어 있으면 색인이 약하다 | **엣지에서 첫 HTML을 채운다.** 모든 HTML 경로가 Pages Functions를 거쳐 `index.html` 셸의 `<head>`를 페이지별로 바꾸고, 글은 헤더까지 프리렌더한다. 본문은 첫 HTML에 JSON으로 인라인한다 | `functions/_lib/shell.js`, `edge-handlers.js` |
| 같은 내용이 여러 주소로 색인되면 신호가 갈린다 | **URL 하나에 페이지 하나.** canonical은 `SITE_URL` 기준, 끝 슬래시는 무시, 섹션 루트 카테고리는 301 | `functions/_lib/seo.js`, `edge-handlers.js` |
| 없는 페이지가 200으로 색인된다(soft 404) | **진짜 404 + noindex**, 없는 정적 파일도 404로 바꿈 | `edge-handlers.js` (`notFound`, `isAssetPath`) |
| 검색엔진이 새 글을 늦게 발견한다 | **sitemap.xml, RSS, robots.txt를 DB에서 생성**한다. 글을 올리면(재빌드 없이) 10분 안에 반영 | `functions/{sitemap.xml,rss.xml,robots.txt}.js` |
| 검색 결과와 공유 미리보기를 제어하고 싶다 | 페이지마다 고유한 `title`, `description`, OG, Twitter 카드, 글은 `BlogPosting` JSON-LD | `seo.js` (`metaTags`, `pageMeta`, `headTagsHtml`) |
| 속도·레이아웃 흔들림은 순위와 체감 품질에 영향 | 폰트 지연 로드, 헤더 프리렌더, 엣지 캐시, 레이아웃 흔들림 방지 | `src/main.js`, `functions/_lib/cache.js`, CSS |
| 네이버·구글에 등록해야 한다 | 네이버 인증 메타를 환경변수로 주입, 구글은 DNS TXT | `shell.js` (`headExtras`), [seo.md](seo.md) |

## 2. 렌더링 전략: 엣지에서 채우고 브라우저에서 이어받기

```
요청 ──> Cloudflare Pages Function (functions/)
          ├─ DB 조회 (읽기 전용 app_reader)
          ├─ env.ASSETS 로 dist/index.html 셸 가져오기
          └─ HTMLRewriter 로 셸 변환
               ├─ <head>: 기본 title/description/canonical/og/twitter 제거 후 페이지별 태그 삽입
               │          (+ JSON-LD, + noindex(404/500), + naver-site-verification)
               └─ <main id="main">: 글 헤더 프리렌더 + <script id="post-data"> 인라인
        ──> 브라우저: JS가 같은 데이터를 한 번만 읽어 이어서 렌더 (추가 API 요청 없음)
```

- **`<head>` 교체** (`functions/_lib/shell.js` `renderShell`): `title`, `meta[name=description]`, `link[rel=canonical]`, `meta[property^=og:]`, `meta[name^=twitter:]`를 지우고 페이지별 태그를 `</head>` 앞에 넣는다. 모든 값은 이스케이프된다(`seo.js` `escapeText`/`escapeAttr`, JSON-LD의 `<`는 `<`).
- **글 헤더 프리렌더**: `src/lib/post-header.js`의 `postLayoutHtml`(브라우저와 엣지가 공유하는 순수 모듈)이 브레드크럼, `<h1>` 제목, 날짜·읽는 시간, 태그, 설명을 첫 HTML에 넣는다. 사유 글은 연결 카드도 포함한다.
- **인라인 데이터**: `/api/posts/<slug>`와 같은 JSON을 `<script type="application/json" id="post-data">`에 넣고(`edge-handlers.js` `inlineData`), 브라우저(`src/lib/api.js` `takeInlinePost`)가 한 번만 읽는다. 그래서 첫 화면에 API 왕복이 없다. 본문 텍스트는 이 JSON 안에 들어 있다.
- **한계(중요)**: 본문은 첫 HTML의 **렌더된 태그가 아니라 JSON**이다. JS를 실행하는 크롤러(구글)는 문제없지만, JS를 실행하지 않는 크롤러는 제목, 설명, 헤더만 안정적으로 본다. 5절 로드맵 1번.

## 3. URL(경로)별 SEO 동작

모든 경로는 `public/_routes.json`에 따라 Functions로 들어가고(`/assets/*`, 아이콘 3개 제외), 아래 파일이 처리한다.

| 경로 | 처리 파일 | 색인 | title | canonical | 비고 |
|---|---|---|---|---|---|
| `/` | `functions/[[path]].js` → `handleCatchAll` | O | `IT Security Blog` | `<origin>/` | 첫 HTML에 `<h1>`은 없고 SPA가 시각적으로 숨긴 `h1`을 그린다 |
| `/tech` `/trends` `/essays` | 〃 | O | `<섹션 제목> - IT Security Blog` | `<origin>/<섹션>` | 설명은 `functions/_lib/sections.js`(= `src/content/sections.js`, 유닛 테스트가 동일성 검사) |
| `/categories/<섹션>/<하위…>` | 〃 | O | `<카테고리명> - IT Security Blog` | `<origin>/categories/<경로>` | DB에 있는 카테고리만. 없으면 404 |
| `/categories/<섹션>` (루트) | 〃 | 301 | - | → `/<섹션>` | 같은 화면이므로 중복 제거(`Location: /<섹션>`) |
| `/posts/<slug…>` | `functions/posts/[[slug]].js` → `handlePost` | O | `<글 제목> - IT Security Blog` | `<origin>/posts/<인코딩된 slug>` | 글 헤더 프리렌더, JSON-LD, 인라인 데이터. 슬러그 오류/없음은 404 |
| `/about` `/privacy` `/contact` | `handleCatchAll` | O | `About` / `개인정보처리방침` / `문의하기` + ` - IT Security Blog` | 각자 | `/contact`는 내용이 얇다(5절) |
| `/sitemap.xml` `/rss.xml` `/robots.txt` | `functions/sitemap.xml.js` `rss.xml.js` `robots.txt.js` | - | - | - | 4절 |
| 그 밖의 모든 경로 | `handleCatchAll` → `notFound` | **noindex** | 셸 기본값 | - | **HTTP 404** + SPA 셸 + `<meta name="robots" content="noindex">` |
| 없는 정적 파일(확장자 있는 경로) | `handleCatchAll` (`isAssetPath`) | noindex | - | - | Pages가 `index.html`을 200으로 돌려주면(soft 404) 404 셸로 바꾼다. `_routes.json` 제외 경로는 `public/404.html`(noindex) |
| `/api/*` | `functions/api/**`, 미등록은 JSON 404 | - | - | - | JSON 응답. robots로 막지는 않았다(5절) |
| 500 | `shell500` | noindex | - | - | `no-store` |

세부 규칙:
- **끝 슬래시**: `/about/` = `/about`(200, canonical은 슬래시 없는 주소). SPA 라우터도 같은 규칙.
- **인코딩**: slug 안의 공백, `&`, `:`, 한글은 세그먼트별로 퍼센트 인코딩해 canonical, sitemap, RSS에 쓴다(`seo.js` `encodePath`). 디코드 규칙은 `functions/_lib/slug.js`(대소문자 구분, 마지막 세그먼트 폴백 없음).
- **origin**: 환경변수 `SITE_URL`(`seo.js` `siteOrigin`). **Production에서 필수.** 비어 있으면 요청 host로 대신해서 `*.pages.dev`와 커스텀 도메인이 각자 canonical을 내보내 중복 색인될 수 있다([seo.md](seo.md) 5절).
- **`index.html`의 기본값**(`index.html`): `lang="ko"`, viewport, 기본 description, `og:site_name`, RSS `<link rel="alternate" type="application/rss+xml">`, 파비콘(`favicon.svg`, `favicon.ico`, `apple-touch-icon.png`).
- **클라이언트 이동 시**: `src/router.js`가 `document.title`을 같은 형식(`<제목> - IT Security Blog`)으로 갱신한다. 검색엔진은 첫 HTML(엣지 값)을 기준으로 본다.

## 4. 메타데이터, 구조화 데이터, 발견(sitemap/RSS/robots)

### 4.1 메타 태그 (`functions/_lib/seo.js`)
| 태그 | 글(`metaTags`) | 일반 페이지(`pageMeta`) |
|---|---|---|
| `<title>` | `<제목> - IT Security Blog` | 홈은 사이트명, 나머지는 `<제목> - IT Security Blog` |
| `meta description` | 글 `description`, 없으면 본문 앞 180자 요약(`functions/_lib/excerpt.js` `makeExcerpt`: 마크다운 기호 제거) | 페이지별 고정 문구 / 섹션 설명 / 기본 설명 |
| `link canonical` | `<origin>/posts/<slug>` | `<origin><경로>` |
| Open Graph | `og:type=article`, `og:title`, `og:description`, `og:url`, `og:site_name`, `article:published_time` | `og:type=website` + 같은 필드 |
| Twitter | `twitter:card=summary`, `twitter:title`, `twitter:description` | 같음 |
| 기타 | 네이버 인증(`NAVER_SITE_VERIFICATION`), 404/500은 `robots noindex` (`shell.js` `headExtras`) | 〃 |

`og:image`는 없다(링크 미리보기에 이미지가 없다).

### 4.2 구조화 데이터
글 페이지에만 JSON-LD `BlogPosting`(`seo.js` `metaTags`): `headline`, `datePublished`, `dateModified`(= 글 날짜), `description`, `url`, `mainEntityOfPage`, `author`(Person, 이름은 사이트명), `keywords`(태그), `articleSection`(카테고리명). `BreadcrumbList`, `WebSite`, `Organization`은 없다.

### 4.3 sitemap, RSS, robots
| 파일 | 내용 | 코드 |
|---|---|---|
| `/sitemap.xml` | `/`, `/about`, `/privacy`, `/contact`, 섹션 3개, 섹션 하위 카테고리, 모든 글(`<lastmod>` = 글 날짜). 섹션 루트 카테고리 URL은 넣지 않는다(301이므로). 한 파일 5만 URL 상한 | `handleSitemap`, `seo.js` `buildSitemap` |
| `/rss.xml` | 최신 20개(제목, 링크, 요약, pubDate는 KST 00:00 기준), `<guid isPermaLink>` | `handleRss`, `buildRss` |
| `/robots.txt` | `User-agent: *` `Allow: /` + `Sitemap: <origin>/sitemap.xml` | `handleRobots` |

**운영 도메인의 robots.txt에는 위 내용 앞에 Cloudflare가 자동으로 붙인 관리형 규칙이 있다**(`Content-Signal: search=yes,ai-train=no,...`와 GPTBot, ClaudeBot, Google-Extended, CCBot, Baiduspider 등 `Disallow: /`). 이 부분은 코드가 아니라 Cloudflare 대시보드 설정이고, 검색 봇(`User-agent: *`)은 막지 않는다. 모두 허용하려면 [seo.md](seo.md) 7절.

세 파일 모두 DB에서 요청 때 만들어지므로 글을 올려도 재빌드가 필요 없다. Workers Cache API로 10분 엣지 캐시([api.md](api.md) 엣지 캐시 절, `functions/_lib/cache.js`).

## 5. 정보 구조와 내부 링크

검색엔진이 따라갈 수 있도록 모든 이동은 실제 `href`가 있는 `<a>`다(`data-link`는 SPA가 클릭을 가로채는 표시일 뿐이고 JS 없이도 링크가 동작한다).

| 요소 | 위치 | 설명 |
|---|---|---|
| 헤더 메뉴 | `src/components/header.js` | Home / Tech / Trends / Essays / About, `aria-current` |
| 브레드크럼 | `src/lib/post-header.js` | `TECH / SECURITY` 각각 카테고리 링크. 프리렌더되어 첫 HTML에 있다 |
| 섹션/카테고리 목록 | `src/pages/section.js` | `<h1>` + 글 목록, 하위 카테고리 칩 |
| 이전/다음 글, 연결 카드("이 생각의 계기가 된 글", "이 글에서 이어진 사유") | `src/pages/post.js`, `src/components/related-card.js` | 글끼리 서로 연결 |
| 푸터 | `src/components/footer.js` | About, 문의하기, 개인정보처리방침 |
| 글 상세 사이드바(전 섹션 트리) | `src/components/sidenav.js`, `GET /api/nav` | **브라우저에서만 생긴다**(첫 HTML에는 빈 자리). 크롤러가 의존하는 링크 구조가 아니다 |
| 제목 위계 | 각 페이지 | 페이지당 `<h1>` 하나(글 제목, 섹션 제목, About 등). 홈은 시각적으로 숨긴 `h1`. 본문은 `h2`부터 |

외부 링크는 새 탭 + `rel="noopener noreferrer"`가 자동으로 붙는다(`src/render/markdown.js`). `nofollow`/`ugc`는 붙이지 않는다.

## 6. 콘텐츠를 쓸 때 SEO 규칙

글은 Blog_Contents의 마크다운이므로 SEO 품질의 상당 부분은 쓰는 쪽에서 정해진다([contents-repo.md](contents-repo.md)).
- **front matter `title`과 `description`은 필수**다(sync lint). description이 곧 검색 결과 설명, OG 설명, RSS 요약이다. 120~160자 안팎으로 글의 핵심을 쓴다. 필수라 sync 단계에서 비어 있으면 막히고, 코드(`makeExcerpt`)에는 비었을 때 본문 앞 180자를 쓰는 폴백이 있다.
- **slug는 영소문자-하이픈**(폴더, 파일 이름이 그대로 URL이 된다). 한 번 정한 slug는 바꾸지 않는다(바꾸면 옛 URL이 404이고 리다이렉트는 없다).
- **링크 텍스트는 설명적으로** 쓴다. "링크", "여기" 같은 일반어는 Lighthouse SEO 감점 원인이다(샘플 글에서 92점이 나온 이유).
- **이미지는 `alt`를 구체적으로** 쓴다. 이미지는 지연 로딩되고, 크기 힌트(`"1600x900"` title)가 있으면 `width/height`가 붙어 레이아웃이 흔들리지 않는다.
- 취소선 마크다운은 지원하지 않는다(`~`가 글자 그대로 나온다).
- 유튜브는 클릭 전까지 영상을 불러오지 않는다(썸네일만). 외부 링크 카드의 제목과 설명은 서버가 가져온다. 이 둘은 첫 HTML이 아니라 브라우저에서 채워진다.
- 섹션 설명은 코드(`src/content/sections.js`와 `functions/_lib/sections.js`)에 있다. 바꿀 때 두 파일을 같이 고친다.

## 7. 성능과 Core Web Vitals

| 항목 | 방법 | 위치 |
|---|---|---|
| 첫 렌더 | 첫 HTML에 헤더 프리렌더, 인라인 데이터로 API 왕복 제거, 엣지 캐시 | `post-header.js`, `edge-handlers.js`, `cache.js` |
| 폰트 | 모두 자체 호스팅(npm), 첫 렌더 뒤 지연 로드, `font-display: swap`, 한글은 `unicode-range` 서브셋 | `src/main.js`, `src/styles/fonts.css` |
| 정적 자산 | 해시 파일명 + `Cache-Control: public, max-age=31536000, immutable` | `public/_headers` |
| 번들 | 마크다운/DOMPurify/Prism과 글 전용 모듈은 동적 import로 메인 청크에서 분리 | `src/pages/post.js` |
| CLS 방지 | `#main`의 최소 높이, 글 상세의 사이드바/목차 열 자리 고정, 이미지 `width/height`, 링크 카드와 유튜브 박스 자리 확보 | `src/styles/*.css`, `src/render/markdown.js` |
| 지연 로딩 | 본문 이미지 `loading="lazy"`, 유튜브는 클릭 전 iframe 없음 | `markdown.js`, `video-embeds.js` |

측정(프리뷰, 모바일, 2026-11-27): Perf 99~100, A11y 100, Best Practices 96, SEO 100(샘플 기술 글 한 페이지만 92, 위 6절의 링크 텍스트 때문), LCP 0.8~1.4s, CLS 0~0.003. 표와 재측정 명령은 [seo.md](seo.md) 6절. 그 이후 추가된 기능(사이드바, 이미지 확대, 유튜브 썸네일 등)은 아직 재측정하지 않았다.

## 8. 신선도와 캐시

엣지에 10분 보관한다(404는 60초). 그래서 글을 올린 뒤 최대 10분 동안 옛 내용이 보일 수 있다. 즉시 갱신은 Cloudflare Purge Cache([seo.md](seo.md) 2절). 브라우저에는 `stale-while-revalidate=60`만 나간다. 링크 미리보기 API는 성공 결과를 24시간 보관한다.

## 9. 등록과 환경변수

| 항목 | 방법 | 문서 |
|---|---|---|
| `SITE_URL` | Cloudflare Pages Production 환경변수(필수), 예 `https://<도메인>` | [seo.md](seo.md) 5절 |
| 네이버 서치어드바이저 | 인증 메타는 `index.html`에 직접 들어 있다(환경변수 `NAVER_SITE_VERIFICATION` 방식도 지원하지만 중복되므로 쓰지 않는다). 사이트맵과 RSS 제출 | [seo.md](seo.md) 1절 |
| Google Search Console | 도메인 속성 + DNS TXT. sitemap 제출 | 〃 |
| 머지 후 체크 | sitemap의 `<loc>`이 운영 도메인인지, canonical, 404 상태코드 등 | [post-merge-checklist.md](post-merge-checklist.md) |

## 10. 검증 방법

| 무엇을 | 어떻게 |
|---|---|
| 메타/JSON-LD/sitemap/RSS 생성 로직(이스케이프, 인코딩, 형식) | `npm run test:unit` → `tests/unit/seo.test.js`, `edge.test.js`, `excerpt.test.js`, `slug.test.js` |
| 엣지 라우트(404, 301, soft 404, 메타 주입, 인라인 데이터) | `tests/unit/edge.test.js`, 실제 wrangler + 실제 DB로 `npm run test:edge`(`scripts/test-edge.mjs`) |
| 렌더 결과와 접근성 | `npm test`(Playwright `tests/e2e`) |
| 배포된 곳의 head | `curl -s <URL> \| grep -E '<title>\|canonical\|og:\|ld\+json'` |
| 상태코드/noindex | `curl -sI <없는 주소>` → 404, 본문에 `noindex` |
| 점수 | Lighthouse(명령은 [seo.md](seo.md) 6절) |

## 11. 알려진 한계와 로드맵 (우선순위 순)

1. **본문 서버 프리렌더**: 지금은 본문이 JSON으로만 첫 HTML에 있다. JS를 실행하지 않는 크롤러(네이버 일부 포함 가능)를 위해 엣지에서 마크다운을 HTML로 바꿔 `<article>`에 넣는 것이 가장 큰 개선점이다. 마크다운 변환기(`marked`+`DOMPurify`)를 Workers에서 쓸 수 있는지, 코드 하이라이트·링크 카드 등 브라우저 전용 기능과의 이중 렌더를 어떻게 맞출지 검토가 필요하다.
2. **`og:image`와 `twitter:card=summary_large_image`**: 공유 미리보기에 이미지가 없다. 글의 첫 이미지나 기본 이미지를 쓰는 방식을 정해야 한다.
3. **`dateModified`**: 글 날짜와 같다. 수정일을 따로 저장하지 않는다(DB에 컬럼 없음).
4. **구조화 데이터 확장**: `BreadcrumbList`(브레드크럼은 이미 있음), `WebSite`/`Organization`, 저자 정보(지금은 사이트명).
5. **`robots.txt`에 `Disallow: /api/`**: API JSON이 색인 후보가 될 수 있다. 위험은 낮지만 막아 두는 편이 낫다.
6. **얇은 페이지**: `/contact`는 내용이 채워지기 전까지 색인되면 품질 신호가 낮다(색인은 사용자가 허용함, 내용을 채우거나 임시로 noindex).
7. **글 단위 태그 페이지/검색 없음**: 태그는 글 헤더에 텍스트로만 있고 링크가 아니다.
8. **사이드바와 링크 카드, 유튜브 박스는 JS 전용**: 크롤러에게는 첫 HTML 기준의 링크 구조만 보인다.
9. **`llms.txt` 미구현**: 필요하면 `public/llms.txt` 또는 `functions/llms.txt.js`([seo.md](seo.md) 4절).
10. **샘플 글**: 운영 DB의 `sample-*` 글은 머지 후 Blog_Contents에서 지운다(색인되기 전에).
11. **재측정**: 기능이 많이 추가되어 Lighthouse를 다시 잰다.

## 12. 파일 지도

| 경로 | 역할 |
|---|---|
| `index.html` | 셸(기본 head, lang, RSS 링크, 파비콘, 테마 선적용 스크립트) |
| `functions/[[path]].js` | catch-all: `/`, 정적 페이지, 섹션, 카테고리, 404, 정적 파일 통과 |
| `functions/posts/[[slug]].js` | 글 HTML(메타, JSON-LD, 헤더 프리렌더, 인라인 데이터) |
| `functions/sitemap.xml.js`, `rss.xml.js`, `robots.txt.js` | 발견용 파일 |
| `functions/_lib/edge-handlers.js` | 위 라우트의 실제 로직(404, 301, 가드, 메타 선택) |
| `functions/_lib/seo.js` | 메타 태그, JSON-LD, sitemap, RSS 빌더(순수 함수), `siteOrigin` |
| `functions/_lib/shell.js` | `HTMLRewriter`로 셸 변환, noindex와 네이버 메타 주입 |
| `functions/_lib/sections.js` | 섹션 제목/설명(`src/content/sections.js`와 동일해야 함) |
| `functions/_lib/excerpt.js` | description이 없을 때 본문 요약 |
| `functions/_lib/cache.js` | Workers Cache API 래퍼(10분, 404 60초) |
| `functions/_lib/queries.js` | 글/카테고리/sitemap 쿼리(본문은 상세에서만) |
| `src/lib/post-header.js` | 글 헤더 마크업(엣지와 브라우저 공유) |
| `src/router.js` | 클라이언트 이동 시 제목 갱신, 끝 슬래시 무시 |
| `public/_routes.json`, `public/_headers`, `public/404.html` | Functions 제외 경로, 불변 캐시, 정적 404(noindex) |
| `docs/seo.md`, `docs/post-merge-checklist.md` | 등록/퍼지/Lighthouse, 머지 후 체크 |
