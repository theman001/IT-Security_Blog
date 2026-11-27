# Blog_Contents 개편 요약 (설계 문서 6절)

> 한 페이지 요약이다. Blog_Contents 개편과 sync(GitHub Actions)는 적용되어 운영 DB에는 새 구조의 샘플 글(`sample-*`)이 들어 있다. 이 레포에서 Blog_Contents로 push하지 않는다. 병합 후 절차: [post-merge-checklist.md](post-merge-checklist.md).

## 1. 새 폴더 구조
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
- 최상위 섹션은 `tech` / `trends` / `essays` 세 개.
- 폴더·파일 이름은 영소문자-하이픈(`why-security-learns-late.md`). 표시 이름은 `_category.md`의 `name`에서 가져온다.
- `_category.md`의 `name`이 없으면 폴더명을 표시한다. `categories` 테이블에는 `order`/`description` 컬럼이 없어 정렬은 이름순이다.

## 2. front matter
- 새 필드 `related`: 경로 또는 글 URL(사유 글에서 선택). `description`은 권장(홈의 사유 인용에 쓰임).
- DB의 `reports.related_slug`(nullable text)는 이미 있는 컬럼이다(`ALTER TABLE reports ADD COLUMN related_slug text;` 적용 완료). 새 테이블/GRANT는 없다.

## 3. sync 스크립트(`sync_to_db.js`) 수정 지점 (적용은 사용자)
1. `_category.md`는 글로 취급하지 않고 해당 카테고리의 `name`에만 반영한다. 섹션 설명 문구는 프론트 정적 설정(`src/content/sections.js`)에 둔다.
2. `related`가 URL이면 `/posts/` 뒤 경로로 정규화해 `related_slug`에 저장한다. 경로면 그대로 저장한다.
3. 파일 삭제 시 DB 삭제 동작은 기존 그대로 유지한다(미러 동기화).

## 4. 주의
- **Blog_Contents `main`에 병합하면 운영 DB가 바뀐다**(샘플 글 제거도 파일 삭제 후 병합). 옛(live) 블로그도 같은 DB를 읽으므로 병합 즉시 옛 블로그에도 영향이 간다.
- 첫 sync에서 새 구조에 없는 **옛 파일(기존 29개 글과 카테고리)은 DB에서 삭제·교체**된다. 병합 전에 새 구조로 옮긴 파일 목록과 slug 변경을 확인하고, 필요하면 DB 백업을 먼저 한다.
- 개편 작업은 별도 세션에서 Blog_Contents의 브랜치/PR로 진행한다.
