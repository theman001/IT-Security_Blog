# IT Security Blog 리뉴얼: 설계 문서

작성: 2026-11-27 / 상태: 승인 대기 / 브랜치: `renewal`
구현 기준 문서: 이 문서 -> `DESIGN.md`(토큰) -> `docs/PLAN.md`(작업 분할). 기술·아키텍처 제약은 `CLAUDE.md`, API 세부는 `docs/api.md`(이 문서의 변경점을 반영해 갱신 예정).

## 1. 의도와 이유
- 독자: IT·AI·보안의 기술과 동향, 그리고 **블로거 개인의 사유**가 궁금한 사람들.
- 목표: 블로거의 사유가 가진 가치를 키우고 다양한 사람과 나눈다. 옛 블로그는 "독자가 읽기 좋은가"가 아니라 "만들고 싶은 구성"을 따랐다. 이번에는 독자 관점이 기준이다.
- 콘텐츠는 기존 29개를 폐기하고 새로 채운다: 기술, 동향(역사), 사유.

## 2. 목표 / 비목표 / 안티 목표
- 목표: (1) 사유가 블로그의 얼굴이 되는 홈. (2) 긴 기술 문서의 가독성(목차, 코드, 표). (3) 라이트/다크. (4) 글 발행은 DB INSERT만으로 반영(재빌드 없음). (5) 엣지 SEO, 진짜 404.
- 비목표: 카테고리 그래프, 다중 팔레트, 댓글, 검색, 외부 링크 미리보기, 이스터에그, Architecture 페이지, 다국어.
- 안티 목표(기술적으로 동작해도 실패): 사유가 기술 글 사이에 묻히는 것. 현재 콘텐츠 11개 카테고리에 맞춰진 UI(콘텐츠가 바뀌면 무너지는 것). 토큰 밖의 하드코딩 값.

## 3. 제약
Vanilla JS + Vite, History API, Cloudflare Pages + Functions, Neon(읽기 전용 `app_reader`), marked -> DOMPurify -> Prism. 상세는 `CLAUDE.md`와 `blog-platform` 스킬. 모든 비마크다운 필드는 escapeHtml.

## 4. 결정 사항 (사용자가 정한 것)
| 항목 | 결정 |
|---|---|
| 섹션 | 기술 `tech`, 동향 `trends`, 사유 `essays` (3개로 구분해 보여줌) |
| 데이터 | **`reports` 테이블 하나.** 섹션 = 최상위 폴더(= 최상위 카테고리). 태그는 주제 분류용 |
| 연결 | `reports.related_slug`(nullable) 추가. 사유가 기술·동향 글을 가리키면 사유 상단에 미리보기 카드, 반대쪽 글 하단에는 "이 글에서 이어진 사유" 자동 표시. 글 하나에 연결 1개, 대상 삭제 시 카드 생략 |
| 분위기 | 에디토리얼(잡지형): 큰 세리프 제목, 비대칭 그리드, 인용문 강조 |
| 테마 | 라이트 + 다크 2종. 기본 OS 설정, 헤더 토글, 저장, 첫 화면 깜빡임 방지 |
| 폰트 | 제목 Noto Serif KR 굵게. 본문: 기술·동향 = Pretendard, 사유 = Noto Serif KR. 코드 = JetBrains Mono |
| 카테고리 탐색 | 섹션 목록 + 하위 카테고리 칩. 기술 섹션이 3단계 이상 깊어지면 접이식 트리 사이드바 추가. 그래프는 제외 |
| 페이지 | 홈, 기술·동향 글, 사유 글, 섹션 목록(`/tech` `/trends` `/essays`), 카테고리, About, 404 |
| 제외 | 이스터에그, Architecture |
| 이름 규칙 | 폴더·파일은 영소문자+하이픈. 화면 표시 이름은 `_category.md`(폴더별)에서 읽음 |

### 읽기 사양
| | 기술·동향 | 사유 |
|---|---|---|
| 본문 폭 | ~72자(≈760px) | ~60자(≈660px) |
| 글자/줄간격 | 16px / 1.75 | 18px / 1.9 |
| 목차 | >=1200px 오른쪽 고정(소제목 3개 이상), 모바일은 상단 접이식 | 없음, 얇은 읽기 진행선 |
| 코드 | 본문보다 약간 넓게, 언어 라벨+복사, 테마별 코드 색 | 기본 |
| 표 | 가로 스크롤 래퍼, 위아래 가는 선 | 동일 |
| 인용 | 조용한 콜아웃 | 큰 세리프 pull quote |

### 홈 위계
마스트헤드(Tech·Trends·Essays·About + 테마 토글) -> **대표 사유(최신 사유 글)** + 최근 글 열 -> 섹션별 3개(Tech, Trends, Essays는 인용 형태) -> 푸터(RSS).

## 5. 접근 방식 (검토한 안)
1. 데이터 구조: (a) 섹션별 테이블 + API 분리, (b) 개별 분리 + `/api/feed`(UNION ALL), (c) DB 뷰, (d) **단일 `reports` + 최상위 폴더 구분(채택)**. 이유: 합치는 로직과 DB 작업이 사라지고 기존 sync 방식이 그대로 동작. 태그 구분은 오타로 글이 누락될 수 있어 제외.
2. 카테고리 탐색: 그래프(제외), 트리, **칩 + 조건부 트리(채택)**.
3. 폰트/분위기: 에디토리얼 / 종이 저널 / 기술 노트 중 에디토리얼. 본문 폰트는 섹션별 혼합(채택).

## 6. 데이터와 contents 레포 변경
### 6.1 DB (사용자 작업)
`ALTER TABLE reports ADD COLUMN related_slug text;` (nullable). 새 테이블·새 GRANT 없음. 기존 29개 글과 카테고리는 새 구조로 sync하면 삭제·교체됨.
### 6.2 contents 레포 새 구조 (Blog_Contents)
```
contents/
  tech/
    _category.md              # name: "기술"
    security/_category.md     # name: "보안"
    security/reversing/01-kakao-auth.md
  trends/ ...
  essays/
    _category.md
    why-security-learns-late.md
```
- front matter 추가: `related`(경로 또는 글 URL, 사유 글에서 선택), `description` 권장.
- `_category.md`: `name`(표시 이름). 없으면 폴더명을 표시. (`categories` 테이블에 `order`/`description` 컬럼이 없으므로 정렬은 이름순.)
### 6.3 sync 스크립트 수정안 (적용은 사용자)
- `_category.md`는 글로 취급하지 않고 카테고리 `name`에만 반영한다(확인함: `categories`에는 `description` 컬럼이 없음). 섹션 설명 문구는 프론트의 정적 설정(`src/content/sections.js`)에 둔다.
- `related`가 URL이면 `/posts/` 뒤 경로로 정규화해 `related_slug`에 저장.
- 파일 삭제 시 DB 삭제 동작은 유지(미러 동기화).
- 이 변경은 문서(`docs/contents-repo.md`)로 제공. 우리는 Blog_Contents에 직접 push하지 않는다.

## 7. API 변경점 (docs/api.md 갱신 대상)
- `GET /api/posts?section=essays|tech|trends&category=<path>&limit=&cursor=`: 섹션/카테고리 필터. 항목에 `section`(= slug 첫 세그먼트), `readingMinutes`(본문 글자수/500, SQL의 `length(content_md)`) 추가.
- `GET /api/posts/<slug>`: 응답에 `related`(`{slug,title,excerpt,date,section}` 또는 null)와 `relatedBy`(이 글을 가리키는 글 목록) 추가.
- `GET /api/categories`: 항목에 `section`, 표시 이름. 섹션 3개가 최상위.
- URL: 글은 모두 `/posts/<slug>`(slug 첫 세그먼트가 섹션). 레이아웃은 섹션이 `essays`인지로 결정.
- 오류 형식, 캐시, 바인딩 규칙은 기존 `docs/api.md`와 동일.

## 8. 빌더에게 맡기는 것
토큰 값(OKLCH 색, 간격, 타입 스케일, 반경, 모션), 컴포넌트 세부, 폰트 로딩 방식(Pretendard 동적 서브셋, Noto Serif KR 서브셋, JetBrains Mono 자체 호스팅 여부와 `font-display`), 홈 그리드의 정확한 비율, 트리 사이드바 동작, 접근성 세부, 테스트 시나리오.

## 9. 내가 정한 것 (사용자 확인 필요)
- 홈의 대표 사유 = 가장 최근 사유 글(고정 지정 기능 없음, YAGNI).
- About은 DB가 아니라 레포 안 정적 마크다운(`src/content/about.md`)으로 관리.
- 글 URL을 `/posts/…`로 통일(섹션별 `/essays/…` 짧은 URL은 카테고리 경로와 모호해져 제외).
- 읽는 시간은 글자수/500분(한국어 기준 근사).
- 이미지는 기존대로 R2(`asset.taeuk.site`)에서 로드하므로 CSP/sanitize에서 허용 대상으로 고려.
- 검색, 댓글은 이번 범위 밖.

## 10. 사용자 작업 목록
1. DB: `related_slug` 컬럼 추가.
2. Blog_Contents: 새 폴더 구조와 front matter 적용, sync 스크립트 수정안 반영, 옛 파일 삭제(= DB에서도 삭제됨).
3. Cloudflare: 변경 없음(`DATABASE_URL`은 이미 설정됨).
4. 새 콘텐츠 작성(최소 각 섹션 1~2개가 있어야 홈 검증 가능. 테스트용은 모의 응답 사용).
