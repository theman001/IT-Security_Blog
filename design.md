# IT-Security Blog — Design System Contract

이 문서는 리뉴얼의 잠금 계약이다. 이후 모든 페이지/컴포넌트 작업은 여기 정의된 토큰만 참조한다 — 임의의 색상/간격 값을 인라인으로 쓰지 않는다.

## 1. 두 개의 독립 축: Theme × Mode

- **Theme** (팔레트, 3종): `noir`(Terminal Noir) / `signal`(Frosted Signal) / `prism`(Prism Circuit). 색상·radius 스케일·모션 이징·리퀴드글라스 강도가 통째로 바뀌는 "스킨". 기본값 `noir`.
- **Mode** (명암, 2종): `dark` / `light`. Theme과 독립적 — Theme을 바꿔도 사용자가 고른 Mode는 유지된다. 기본값은 각 Theme의 자연스러운 기본(noir→dark, signal→light, prism→dark)이되, 사용자가 명시적으로 고르면 그 뒤로는 전 Theme에 걸쳐 그 선택이 우선한다.
- DOM: `<html data-palette="noir|signal|prism" data-mode="dark|light">`
- 저장: `localStorage['theme']`(palette), `localStorage['mode']`(명암). 구버전은 `localStorage['theme']`에 light/dark 값을 저장했으므로, 최초 로드 시 그 값이 있으면 `mode`로 1회 마이그레이션 후 구 키는 지운다.
- UI: 헤더에 Theme 선택 컨트롤(3개 세그먼트 버튼) + 기존 위치의 Mode 토글 버튼(해·달 아이콘, 그대로 유지). 모바일에서는 헤더가 컴팩트해지므로 Theme 컨트롤은 아이콘만 또는 About 유사 위치로 축소 — Phase 3/4에서 구체화.

## 2. 구조 시스템 (3 Theme 공통 — 여기는 스킨이 아니라 뼈대)

```
--font-heading: 'Montserrat', sans-serif;
--font-body: 'Inter', sans-serif;
--font-code: 'JetBrains Mono', monospace;

--space-1: 4px;  --space-2: 8px;  --space-3: 12px; --space-4: 16px;
--space-5: 24px; --space-6: 32px; --space-7: 48px; --space-8: 64px;

--text-xs: .8rem; --text-sm: .9rem; --text-base: 1rem; --text-lg: 1.25rem;
--text-xl: 1.5rem; --text-2xl: 1.875rem; --text-3xl: 2.25rem; --text-4xl: 2.75rem;
```

기존 사이트의 폰트 3종(Montserrat/Inter/JetBrains Mono)은 변경하지 않는다 — 이미 보안/기술 블로그에 적합하고 개성 있는 선택이었음.

## 3. Theme별 색상 — OKLCH, 라이트/다크 대칭

키셋은 세 Theme 모두 동일: `bg`, `surface`, `text`, `text-muted`, `border`, `accent`, `accent-2`, `danger`. (기존 사이트의 `--primary-rgb` 미정의, light/dark 키 비대칭 버그를 여기서 근본 해결.)

### 3.1 Terminal Noir (기본 Theme)
> Dieter Rams식 절제 + 터미널 UI 정밀함. 시안 단색 절제, 앰버는 경고 전용.

| 토큰 | dark (기본 Mode) | light |
|---|---|---|
| `--bg` | `oklch(16% 0.01 260)` | `oklch(98% 0.004 260)` |
| `--surface` | `oklch(20% 0.012 260)` | `oklch(96% 0.006 260)` |
| `--text` | `oklch(92% 0.005 260)` | `oklch(20% 0.01 260)` |
| `--text-muted` | `oklch(65% 0.01 260)` | `oklch(45% 0.01 260)` |
| `--border` | `oklch(30% 0.015 260)` | `oklch(85% 0.01 260)` |
| `--accent` | `oklch(78% 0.16 175)` | `oklch(52% 0.14 175)` |
| `--accent-2` | `oklch(72% 0.18 45)` | `oklch(55% 0.16 45)` |
| `--danger` | `oklch(62% 0.19 25)` | `oklch(50% 0.18 25)` |

Radius: `sm 6px / md 12px / lg 20px` (각진 편). Motion: `ease cubic-bezier(0.22,1,0.36,1)`, `fast 120ms / base 220ms / slow 420ms`.

### 3.2 Frosted Signal
> 에디토리얼 보안 리포트 미학. "기밀 도장" 레드는 포인트로만, 크로매틱 애버레이션 최소.

| 토큰 | light (기본 Mode) | dark |
|---|---|---|
| `--bg` | `oklch(97% 0.006 90)` | `oklch(18% 0.008 90)` |
| `--surface` | `oklch(94% 0.008 90)` | `oklch(22% 0.01 90)` |
| `--text` | `oklch(22% 0.01 90)` | `oklch(90% 0.006 90)` |
| `--text-muted` | `oklch(48% 0.01 90)` | `oklch(62% 0.01 90)` |
| `--border` | `oklch(82% 0.012 90)` | `oklch(32% 0.012 90)` |
| `--accent` | `oklch(48% 0.15 25)` | `oklch(62% 0.17 25)` |
| `--accent-2` | `oklch(55% 0.12 230)` | `oklch(68% 0.12 230)` |
| `--danger` | `oklch(50% 0.18 25)` | `oklch(62% 0.19 25)` |

Radius: `sm 4px / md 8px / lg 14px` (가장 각지고 문서적). Motion: `ease cubic-bezier(0.4,0,0.2,1)`, `fast 100ms / base 200ms / slow 360ms`.

### 3.3 Prism Circuit
> 크로매틱 애버레이션을 시그니처로 사용. 시안+마젠타 2톤 대비. 본문/코드에는 절대 적용 금지(가독성).

| 토큰 | dark (기본 Mode) | light |
|---|---|---|
| `--bg` | `oklch(14% 0.02 280)` | `oklch(98% 0.006 280)` |
| `--surface` | `oklch(19% 0.025 280)` | `oklch(95% 0.01 280)` |
| `--text` | `oklch(93% 0.01 280)` | `oklch(18% 0.02 280)` |
| `--text-muted` | `oklch(68% 0.015 280)` | `oklch(46% 0.015 280)` |
| `--border` | `oklch(32% 0.03 280)` | `oklch(84% 0.015 280)` |
| `--accent` | `oklch(75% 0.19 200)` | `oklch(55% 0.17 200)` |
| `--accent-2` | `oklch(70% 0.20 330)` | `oklch(52% 0.19 330)` |
| `--danger` | `oklch(63% 0.20 20)` | `oklch(52% 0.19 20)` |

Radius: `sm 8px / md 16px / lg 28px` (가장 둥글고 유기적). Motion: `ease cubic-bezier(0.16,1,0.3,1)`, `fast 140ms / base 260ms / slow 480ms`.

## 4. 리퀴드글라스 파라미터 (Theme별, Mode 공통 — tint만 Mode에 따라 전환)

`docs/references/liquid-glass/liquidGlass.ts` 포팅 기준 (`depth`/`strength`/`chromaticAberration`/`blur`/`brightness`/`saturate`). 적용 표면은 3개뿐: 헤더/내비, 모바일 하단 네비, 카테고리 트리 외곽 컨테이너. 본문/코드/포스트카드 기본 상태는 글래스 미적용 ([Section D 적용 맵](#) 그대로 유지, 계획 파일 참조).

| Theme | 표면 | depth | strength | chromaticAberration | blur | brightness | saturate |
|---|---|---|---|---|---|---|---|
| Noir | header | 14 | 90 | 6 | 4 | 1.08 | 1.35 |
| Noir | mobileNav | 10 | 70 | 3 | 6 | 1.05 | 1.30 |
| Noir | tree | 18 | 110 | 8 | 3 | 1.10 | 1.40 |
| Signal | header | 12 | 70 | 2 | 6 | 1.05 | 1.15 |
| Signal | mobileNav | 8 | 55 | 1 | 8 | 1.03 | 1.10 |
| Signal | tree | 14 | 80 | 3 | 5 | 1.06 | 1.20 |
| Prism | header | 16 | 100 | 14 | 3 | 1.12 | 1.50 |
| Prism | mobileNav | 10 | 75 | 8 | 5 | 1.08 | 1.40 |
| Prism | tree | 20 | 120 | 16 | 2 | 1.15 | 1.55 |

비-Chrome(Safari/Firefox) 폴백: 실제 굴절 대신 `backdrop-filter: blur(width/10 px) saturate(180%)`, 배경은 Mode에 따라 반투명 흰색(light) / 반투명 검정(dark). `prefers-reduced-transparency` 또는 `prefers-reduced-motion` 시 Chrome 여부와 무관하게 이 폴백으로 강제 전환.

## 5. 유지되는 기존 개성 요소 (시각만 재도장, 상호작용 의도 보존)

- macOS 트래픽라이트 스타일 코드블록 상단바 (`.dot.r/.y/.g`)
- JetBrains Mono 기반 카테고리/태그 필배지
- 스크롤 반응형 모바일 하단 네비 + 액티브 필 인디케이터
- 캐시 리셋 아이콘 180도 회전 마이크로인터랙션
- `/hidden` Windows XP 이스터에그 — 디자인 시스템 완전 제외, 기능 그대로

> ~~접이식 카테고리 트리 탐색기~~ — v3에서 폐기. 아래 8절 참조.

## 6. 페이지 타입별 매크로구조

- **Home**: 벤토 그리드 대시보드 (8절 참조) — 선형 인트로+리스트 구조를 완전히 대체.
- **Categories**: force-directed 카테고리 그래프 (8절 참조) — 접이식 트리를 완전히 대체. 외곽 컨테이너는 계속 glass(`tree` 파라미터), 필터 입력창 유지(노드 하이라이트 방식으로 동작 변경).
- **Post detail**: 리딩 프로그레스 pill(glass-lite) + TOC + flat 본문. `--measure-reading` 760px 유지 — 이 페이지 타입은 8절의 실험 대상에서 제외(가독성 최우선, 사용자 확정 사항).
- **Static (About/Architecture)**: 타이포만 토큰화, 글래스 없음. 마찬가지로 실험 대상에서 제외.
- **Error**: `renderErrorState()` 공용 컴포넌트로 통일.

## 7. 변경 이력

- v1 (Phase 0.1): 초기 작성. 사용자 결정으로 "1개 Theme 확정" 대신 "3개 Theme 전부 구현 + 런타임 전환"으로 스코프 확장.
- v2 (Phase 1-3): `liquid-glass.ts`/`components.js`/`code-enhance.js` 구현 완료. 신규 구조 토큰 `--measure-reading`(760px) 추가 — `.markdown-body`/`.post-content`가 `main`의 그리드 폭(1200px)과 별개로 이 값을 읽어 읽기 전용 콘텐츠의 measure를 제한한다(그리드 페이지는 그대로 1200px 유지). `hallmark redesign` 멀티페이지 경로로 페이지별 타이포/컴포넌트 폴리시 진행, 이 프로젝트의 design.md가 카탈로그 매크로구조를 완전히 대체.
- **v3 (방향 전환)**: 사용자 판단 — "리퀴드글라스 재도장만으로는 이전 블로그와 체감 차이가 없다. 콘텐츠 조회 파이프라인(Neon 쿼리 함수, marked/DOMPurify 렌더링)은 그대로 이해·유지하되, 그 외 IA·내비게이션·레이아웃은 완전히 갈아엎는다. 새 UI 기술을 지속적으로 실험하는 '랩'으로 운영." 이에 따라 v1/v2의 "기존 IA 보존" 원칙을 폐기하고 8절을 신설. 상세는 8절.
- **v3.1**: 첫 구현 후 사용자 피드백 4건 반영 — (1) 코드서버 프록시 bare-base(트레일링 슬래시 없는 URL) 404 수정, (2) 그래프에 랜덤 초기 배치·경계 clamp(라벨 폭 포함)·포인터 반발력·드래그 추가, (3) 전역 footer(`/hidden` 위장 링크) 완전 폐지, (4) "여전히 AI 슬롭/진부한 대시보드"라는 지적에 따라 홈을 대칭 벤토에서 비대칭 콜라주로 재작업(대문자 킥커·빅넘버 스탯 카드 제거, 타일 회전/오버랩/clip-path, 포스트 리스트는 박스 해제). 8.1/8.3 갱신.

## 8. Bento Signal Lab — 실험적 구조 (v3)

콘텐츠 조회 함수(`assets/js/api.js`의 `fetchCategories`/`fetchPosts`/`fetchPostsByCategory`/`fetchPostBySlug`)와 렌더링 파이프라인(marked+DOMPurify, Prism)은 **변경하지 않는다** — 이번 전환은 오직 "그 데이터를 어떻게 보여주는가"에 대한 것.

### 8.1 홈 — 비대칭 콜라주 (대시보드 아님)
`pages/home.js`(루트 진입 시). **의도적으로 대칭 벤토 대시보드가 아니다** — 대문자 트래킹 킥커, 빅넘버 스탯 타일, 전부 동일한 둥근 사각 카드처럼 보이는 균일함은 전부 AI 생성 사이트의 대표적 시그널이라 걷어냈다(사용자 피드백 반영, v3.1).
- **Hero**: WebGL2 셰이더 배경(`assets/js/hero-shader.js`, 원시 WebGL, 라이브러리 없음) + 그라디언트 타이틀. `clip-path`로 우하단 모서리를 사선으로 잘라 "둥근 사각형 카드"에서 벗어남. `prefers-reduced-motion` 시 셰이더 자체를 마운트하지 않음.
- **통계는 별도 타일이 아니라 히어로 태그라인 문장 안에 자연스럽게 녹여 넣는다** ("지금까지 N개의 분석과 M개의 갈래로…") — 빅넘버 스탯 카드 패턴을 명시적으로 피함.
- **Category Graph**: 8.2의 그래프를 홈에도 재사용하되, 살짝 회전(`rotate(0.8deg)`)시키고 히어로 타일 위로 겹치도록 음수 마진으로 배치 — "그리드 셀에 나란히 놓인 카드"가 아니라 핀으로 고정한 메모지 느낌.
- **Interview**: `main.md` 전체를 스크롤 가능한 타일 안에 그대로 렌더(콘텐츠 손실 없음, ASCII 아트 포함). 모서리 반경을 타일마다 다르게(`var(--radius-lg) var(--space-2) var(--radius-lg) var(--space-2)`) 줘서 위 두 타일과도 시각적으로 다르게. main.md 자체의 H1은 히어로 타일과 중복되므로 CSS로 숨김.
- **Recent Posts**: 위 3개 타일과 달리 **박스 처리하지 않음** — 배경/테두리 없이 페이지에 그대로 얹힌 섹션 제목 + 카드 그리드. "모든 게 카드"인 상태를 깨기 위한 의도적 비일관성.
- **Hidden egg 진입로**: 배너가 아니라 점선 상단 테두리 하나로 구분되는 조용한 텍스트 줄 (전역 footer는 폐지 — 8.3 참조).
- 900px 이하에서 히어로+그래프+인터뷰만 1열 스택, 회전/오프셋/clip-path는 모바일에서 해제(가독성 우선).

### 8.2 카테고리 — Force-directed 그래프
`assets/js/graph.js`. `fetchCategories()`가 반환하는 동일한 평탄화 카테고리 배열을 그대로 사용 — **단, 그 응답의 `path` 필드는 재귀 CTE 버그로 이미 깨져 있었음(구 트리 UI는 원래 leaf `slug`만 써서 이 버그를 우회하고 있었을 뿐)**. 그래프도 동일하게 `slug` 기반 내비게이션을 쓴다 (`n.path`는 절대 참조하지 말 것 — DB 쿼리 자체는 수정하지 않기로 함, api.js 그대로 유지).
- 물리 시뮬레이션: `d3-force`(신규 의존성, physics만 — DOM 바인딩은 쓰지 않음).
- **매 방문마다 다른 레이아웃**: 노드 초기 위치를 `Math.random()`으로 직접 시딩 — d3-force 기본값은 고정 시드 PRNG라 그대로 두면 새로고침해도 항상 같은 모양이 나온다(사용자가 지적한 버그, 수정됨).
- **경계 제한**: 매 tick마다 노드 위치를 컨테이너 안으로 clamp — 원의 반지름뿐 아니라 라벨 텍스트의 실측 폭(`ctx.measureText`)까지 감안해서, 라벨을 포함한 노드 전체가 박스 밖으로 나가지 않는다(사용자가 지적한 버그, 수정됨).
- **포인터 상호작용**: 마우스/터치가 근처에 오면 노드가 밀려나는 반발력 커스텀 force, 호버 중엔 시뮬레이션을 살짝 재가열(`alphaTarget`)해서 계속 살아있게. 노드는 드래그로 직접 옮길 수 있고(`fx`/`fy` 고정), 드래그 거리가 임계값 이하면 클릭으로 간주해 내비게이션.
- 렌더링: Canvas2D(노드/엣지) + HTML 오버레이(라벨, 크리스프 텍스트) — 직접 구현.
- **접근성 폴백 필수**: 캔버스는 포인터 전용 장식층. 동일 데이터의 진짜 `<nav><ul><a>` 목록을 시각적으로만 숨김(`clip-path` 방식, `display:none` 아님) 상태로 항상 함께 렌더 — 스크린리더/키보드 사용자의 실제 내비게이션 경로.
- 필터 입력: 텍스트 매치 노드는 강조, 나머지는 opacity 0.15로 dim(트리의 "숨기기" 대신 그래프에 맞는 "디밍" 방식으로 변경).
- 노드 클릭 시 `navigateTo(/categories/{slug})` — 기존 `/categories/:slug` 라우트·`home.js`의 category-view 로직 변경 없이 그대로 재사용.

### 8.3 전역 footer 폐지
모든 페이지 하단의 "© 2026 IT Security Blog" 링크(위장된 `/hidden` 진입로)를 완전히 제거했다 — 가장 흔한 템플릿형 AI 사이트의 시그널 중 하나(Hallmark Ft3 패턴)였고, `/hidden` 자체는 이미 홈의 egg 줄로 더 눈에 띄게 노출되어 있어 도달성 손실 없음. `index.html`의 `<footer>` 요소와 관련 CSS(`footer{}`, `.footer-copyright-link`) 전부 삭제.

### 8.3 라이브 랩 원칙
"새 UI 기술이 나오면 반영해보고 실험적으로 운영" — 이 절은 고정된 최종안이 아니라 현재 실험 스냅샷이다. 향후 WebGL 신도 다른 셰이더/기법으로 교체될 수 있고, 그래프 레이아웃도 다른 실험으로 대체될 수 있다. 콘텐츠 조회·post/static/error 페이지의 가독성 우선 원칙(1~7절)은 이 랩 실험과 무관하게 계속 고정 계약으로 유지.
