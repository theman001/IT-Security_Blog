# DESIGN.md — 디자인 토큰 계약

에디토리얼(잡지형) · 라이트/다크 · 한글 우선. `src/styles/tokens.css`는 이 문서의 값을 그대로 옮긴다. 색/간격/반경/폰트/모션은 **여기 정의된 CSS 변수만** 쓴다(인라인 하드코딩 금지, `npm run lint:tokens`가 검사). 새 값이 필요하면 이 문서를 먼저 고친다. 디자인 시스템의 주인은 UI UX Pro Max(Editorial Grid / Magazine, Swiss Modernism 계열 후보에서 선택)이고, Impeccable은 검수만 한다.

## 1. 색상 (OKLCH)
대비는 WCAG AA 이상으로 계산 검증했다(일반 텍스트 4.5:1).
라이트와 다크는 **같은 키**를 가진다(대칭).

| 토큰 | 용도 | 라이트 | 다크 | 대비(라이트/다크) |
|---|---|---|---|---|
| `--color-bg` | 페이지 배경 | `oklch(0.98 0.006 80)` | `oklch(0.19 0.008 60)` | |
| `--color-surface` | 카드/박스/코드 배경 | `oklch(0.95 0.008 80)` | `oklch(0.23 0.01 60)` | |
| `--color-fg` | 본문·제목 | `oklch(0.22 0.008 60)` | `oklch(0.94 0.006 80)` | 16.4 / 15.5 (on bg) |
| `--color-fg-muted` | 보조 텍스트(날짜, 메타) | `oklch(0.48 0.012 60)` | `oklch(0.72 0.012 70)` | 6.2 / 7.4 |
| `--color-border` | 구분선 | `oklch(0.87 0.008 75)` | `oklch(0.32 0.01 60)` | |
| `--color-accent` | 링크·강조·사유 포인트 | `oklch(0.52 0.13 55)` | `oklch(0.78 0.12 65)` | 5.4 / 9.0 |
| `--color-on-accent` | accent 위 글자 | `oklch(0.98 0.006 80)` | `oklch(0.19 0.008 60)` | 5.4 / 9.0 |
| `--color-danger` | 오류 | `oklch(0.5 0.17 25)` | `oklch(0.72 0.15 25)` | 6.2 / 7.0 |
| `--color-focus` | 포커스 링 | `var(--color-accent)` | `var(--color-accent)` | |
| `--code-bg` | 코드 블록 배경 | `oklch(0.95 0.008 80)` | `oklch(0.16 0.008 60)` | |
| `--code-fg` | 코드 기본 | `oklch(0.28 0.01 60)` | `oklch(0.9 0.006 80)` | 12.6 / 14.4 |
| `--code-keyword` | 키워드 | `oklch(0.45 0.16 300)` | `oklch(0.78 0.12 300)` | 6.9 / 9.4 |
| `--code-string` | 문자열 | `oklch(0.42 0.11 150)` | `oklch(0.8 0.12 150)` | 7.0 / 10.9 |
| `--code-number` | 숫자·상수 | `oklch(0.46 0.13 50)` | `oklch(0.8 0.12 60)` | 6.5 / 10.1 |
| `--code-function` | 함수·속성 | `oklch(0.45 0.12 245)` | `oklch(0.78 0.11 240)` | 6.3 / 9.9 |
| `--code-tag` | 태그·삭제 | `oklch(0.45 0.15 20)` | `oklch(0.78 0.12 20)` | 7.0 / 9.2 |
| `--code-comment` | 주석 | `oklch(0.5 0.01 70)` | `oklch(0.68 0.012 70)` | 5.2 / 6.7 |
| `--code-punct` | 구두점 | `oklch(0.42 0.01 60)` | `oklch(0.78 0.01 70)` | 7.3 / 9.7 |

선택자: 라이트는 `:root`, 다크는 `:root[data-theme="dark"]`. `data-theme`가 없으면 `@media (prefers-color-scheme: dark)`가 다크 값을 적용한다. 색은 의미 토큰으로만 참조하고, 섹션 구분 색은 쓰지 않는다(섹션은 라벨/위치로 구분; 포인트 색은 accent 하나).

## 2. 타이포그래피
| 토큰 | 값 |
|---|---|
| `--font-display` | `"Noto Serif KR Variable", "Noto Serif KR", "Noto Serif", Georgia, serif` (제목, 사유 본문, 인용) |
| `--font-support` | `"Cafe24 Syongsyong", var(--font-body-tech)` (후원 위젯 글자만; 16KB 서브셋, `src/assets/fonts/`, OFL 1.1) |
| `--font-body-tech` | `"Pretendard Variable", Pretendard, system-ui, sans-serif` (기술·동향 본문, UI) |
| `--font-body-essay` | `var(--font-display)` |
| `--font-mono` | `"JetBrains Mono", ui-monospace, "SFMono-Regular", Menlo, monospace` |

영문 전용 폰트는 본문에 쓰지 않는다(한글 글리프 필요). 세 폰트 모두 같은 출처에서 npm 패키지로 자체 호스팅한다(`pretendard` 동적 서브셋 가변, `@fontsource-variable/noto-serif-kr` wght, `@fontsource/jetbrains-mono` latin 400/600; `src/styles/fonts.css`를 첫 렌더 뒤에 지연 로드: 첫 페인트는 대체 글꼴이고 로드되면 swap). 한글은 `unicode-range` 서브셋이라 쓰인 글자의 조각만 내려받고, 세 폰트 모두 `font-display: swap`.

타입 스케일(modular, 1.2 비율 기반; `rem`, 루트 16px):
| 토큰 | 값 | 용도 |
|---|---|---|
| `--text-xs` | `0.75rem` | 라벨, 메타 |
| `--text-sm` | `0.875rem` | 보조 텍스트, 코드(인라인) |
| `--text-base` | `1rem` | 기술·동향 본문 |
| `--text-lg` | `1.125rem` | 사유 본문 |
| `--text-xl` | `1.375rem` | 소제목(h3) |
| `--text-2xl` | `1.75rem` | h2, 카드 제목 |
| `--text-3xl` | `2.25rem` | 글 제목 |
| `--text-4xl` | `3rem` | 홈 대표 사유 제목 |
줄간격: `--leading-tight: 1.25`(제목), `--leading-support: 1.125`(후원 버튼 두 줄 라벨), `--leading-body-tech: 1.75`, `--leading-body-essay: 1.9`, `--leading-code: 1.6`. 굵기: `--weight-regular: 400`, `--weight-medium: 500`, `--weight-bold: 700`. 자간: 제목만 `--tracking-title: -0.01em`, 라벨 `--tracking-label: 0.08em`(대문자 라벨).
줄바꿈: 본문 기본값은 `word-break: keep-all; overflow-wrap: break-word`(한글은 어절 단위로 줄바꿈, 긴 URL·토큰만 강제 줄바꿈).

## 3. 간격 · 폭 · 반경 · 모션
- 간격(4px 기반): `--space-1: 0.25rem`, `--space-2: 0.5rem`, `--space-3: 0.75rem`, `--space-4: 1rem`, `--space-6: 1.5rem`, `--space-8: 2rem`, `--space-12: 3rem`, `--space-16: 4rem`, `--space-24: 6rem`.
- 본문 폭: `--measure-tech: 90ch`, `--measure-essay: 60ch`(읽기 폭은 유지), `--container: 120rem`(전체 레이아웃 최대폭; 1920px 모니터까지 좌우를 채운다), `--gutter: clamp(--space-4, 5vw, --space-16)`(좌우 여백, 헤더·본문·푸터 공통), `--toc-width: 14rem`. 글 상세는 본문 폭을 제한하고 목차를 본문 바로 옆에 둔다.
- 반경: `--radius-sm: 0.25rem`, `--radius-md: 0.5rem`, `--radius-pill: 999px`(칩/태그만).
- 선: `--border: 1px solid var(--color-border)`, 강조 선 `--rule-strong: 2px solid var(--color-fg)`(마스트헤드).
- 모션: `--duration-fast: 120ms`, `--duration-base: 200ms`, `--ease: cubic-bezier(0.2, 0, 0, 1)`. `prefers-reduced-motion: reduce`에서는 모든 transition/animation을 0으로(읽기 진행선 포함).
- 브레이크포인트(미디어쿼리 값은 변수 불가이므로 문서화): 모바일 `<640px`, 태블릿 `<1024px`, 목차 고정은 `>=1200px`.
- 공용 선/포커스 토큰: `--rule: 1px solid var(--color-border)`, `--focus-ring: 2px solid var(--color-focus)`.
- 그림자는 쓰지 않는다(선과 면으로 위계). 터치 대상 최소 44x44px.

## 4. 컴포넌트 규칙
- **마스트헤드**: 위쪽 `--rule-strong` 선, 좌측 사이트명(display 폰트), 우측 `Tech · Trends · Essays · About`(대문자 라벨 스타일) + 테마 토글. 모바일은 햄버거가 아니라 한 줄 가로 스크롤 링크(항목 4개). 현재 섹션 링크는 `aria-current="page"` + 밑줄.
- **글 카드/목록 행**: 날짜(`--color-fg-muted`, mono 아님), 카테고리 경로, 제목(display), 요약 2줄 말줄임. 카드 배경은 면이 아니라 상단 가는 선.
- **사유(Essays) 표현**: 홈에서는 `description`을 큰 세리프 인용(pull quote)으로, 왼쪽에 accent 선(너비 `--space-1`). 사유 글 상세는 `--measure-essay`, 목차 없음, 상단 `--color-accent` 읽기 진행선(`--space-1` 높이).
- **연결 카드(related)**: `--border`, `--radius-md`, 라벨 "이 생각의 계기가 된 글" / "이 글에서 이어진 사유"(대문자 라벨 스타일, accent 색), 제목 + 요약 1~2줄.
- **칩(하위 카테고리)**: `--radius-pill`, `--border`, 활성은 `--color-fg` 배경 + `--color-bg` 글자. 최소 높이 44px(터치).
- **목차**: 오른쪽 sticky, 현재 위치 항목에 accent 선, h3는 한 단계 들여쓰기, 모바일은 `<details>`.
- **코드 블록**: `--code-*` 토큰, `--radius-md`, 상단 바(언어 라벨 + 복사 버튼), 가로 스크롤(줄바꿈 없음), 데스크톱에서 `--measure-tech`보다 최대 `--space-12` 넓게. 인라인 코드는 `--color-surface` 배경, `--radius-sm`.
- **표**: 세로선 없음, 머리글 아래/표 위아래 `--border`, 짝수 행 배경 없음. 좁은 화면은 래퍼 가로 스크롤.
- **인용(기술·동향)**: 조용한 콜아웃. `--color-surface` 배경, `--color-fg-muted` 글자, 선 없음(accent 선은 사유 인용 전용).
- **링크**: 본문 링크는 accent + 밑줄, 호버 시 밑줄 두께 증가. 포커스는 `outline: 2px solid var(--color-focus); outline-offset: var(--space-1)`(제거 금지).
- **빈 상태/오류**: 한 문장 안내 + 홈 또는 최근 글 링크. 아이콘 일러스트 없음.

## 5. 금지 패턴
- 하드코딩된 색(hex, rgb, hsl, 직접 oklch), 하드코딩 간격/폰트 크기/반경/폰트 패밀리.
- 그라데이션 배경·텍스트, 글로우/네온, 블러 유리 효과, 큰 그림자, 이모지 아이콘.
- 섹션별 별도 색상 체계(포인트 색은 accent 하나), 카테고리 그래프, 자동 재생 모션.
- 포커스 링 제거, 색만으로 정보 전달, 11px 미만 글자, 영문 전용 폰트를 한글 본문에 사용.
- `prefers-reduced-motion`을 무시하는 애니메이션.
- 라이트/다크 한쪽에만 있는 토큰 키.
