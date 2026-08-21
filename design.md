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
- 접이식 카테고리 트리 탐색기
- 캐시 리셋 아이콘 180도 회전 마이크로인터랙션
- `/hidden` Windows XP 이스터에그 — 디자인 시스템 완전 제외, 기능 그대로

## 6. 페이지 타입별 매크로구조

- **Home**: `main.md` 개인 인트로(글래스 미적용, 순수 타이포) + 최근 게시글 티저 렉(3~5 카드, flat)
- **Categories**: 외곽 컨테이너만 glass(`tree` 파라미터), 트리 행은 flat, 필터 입력창 추가
- **Post detail**: 리딩 프로그레스 pill(glass-lite) + TOC + flat 본문
- **Static (About/Architecture)**: 타이포만 토큰화, 글래스 없음
- **Error**: `renderErrorState()` 공용 컴포넌트로 통일

## 7. 변경 이력

- v1 (Phase 0.1): 초기 작성. 사용자 결정으로 "1개 Theme 확정" 대신 "3개 Theme 전부 구현 + 런타임 전환"으로 스코프 확장.
