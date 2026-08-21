# 새 세션 인수인계 프롬프트

아래 내용을 새 Claude Code 세션 시작 시 그대로 붙여넣으세요.

---

이 프로젝트(`IT-Security_Blog`)는 개인 블로그를 리퀴드글라스 중심 디자인으로 전면 리뉴얼하는 작업 중이다. 새 세션이라 이전 대화 맥락이 없으니, 아래 순서로 먼저 현재 상태를 파악한 뒤 이어서 진행해라.

## 1. 먼저 읽을 것
1. `/home/taeuk/.claude/plans/luminous-coalescing-lerdorf.md` — 전체 계획 (Context, Section A~E, Phase 0~5). 이게 유일한 진실의 원천이다.
2. `design.md` (루트) — Phase 0에서 확정된 디자인 시스템 잠금 계약 (3-Theme × 2-Mode 토큰 스펙).
3. `git log --oneline -10` — 최근 커밋으로 무엇이 이미 반영됐는지 확인.
4. `git status` / `git diff` — 계획과 실제 코드가 100% 일치한다고 가정하지 말고, 파일을 직접 열어서 실제 구현 상태를 검증할 것.

## 2. 알아야 할 핵심 배경
- 백엔드 없는 정적 프론트엔드. 원래 zero-build(vanilla JS, `public/` 폴더 구조)였으나, 작업 도중 **Vite 빌드 툴링으로 전환**하기로 결정해 `public/*`를 프로젝트 루트(`assets/`, `pages/`, `index.html`)로 이동했다. `public/static/*.md`(정적 콘텐츠)와 `public/assets/xp/`(이스터에그 리소스)는 Vite의 `publicDir` 컨벤션에 따라 `public/` 안에 그대로 남아있다.
- 배포 대상은 **Cloudflare Pages** 확정 (빌드 커맨드 `npm run build`, 출력 디렉터리 `dist`).
- 콘텐츠는 Neon Postgres(브라우저 직접 접속) + 정적 마크다운 파일 두 소스. DB 비밀번호 노출 이슈는 **의도적으로 스코프 제외**됨(사용자가 리스크 낮다고 판단, 재론하지 말 것).
- 스킬 4개가 `.claude/skills/`에 프로젝트 레벨로 설치됨: `claude-design`(비주얼 시스템 탐색 전용, Phase 0에서만), `ux-designer`(구조/접근성 자문), `hallmark`(실제 파일을 쓰는 유일한 스킬 — component-scope/`redesign`/`audit` 모드), `find-skills`(보완 도구 필요시만). 계획 Section B에 스킬 선택 원칙이 명시되어 있으니 페이지마다 즉흥적으로 고르지 말고 그 원칙을 따를 것.
- Node.js v22.22.1 / npm 9.2.0 설치됨, `npm install` 이미 완료(`node_modules` 존재).

## 3. Playwright MCP로 실제 확인하며 작업할 것 (중요, 신규 요구사항)
Playwright MCP가 설치·연결 확인됨. **코드만 작성하고 끝내지 말고, 매 단계 실제 브라우저에서 눈으로 확인**해라:

1. `npm run dev`로 Vite 개발 서버를 백그라운드로 띄운다.
2. Playwright MCP 도구(`browser_navigate`, `browser_snapshot`, `browser_take_screenshot`, `browser_resize` 등)로 실제 로컬 서버(`http://localhost:5173` 등, 실제 포트는 `npm run dev` 출력에서 확인)에 접속해 결과를 확인한다.
3. 최소한 아래 항목은 스크린샷/스냅샷으로 직접 검증할 것:
   - 라이트/다크 Mode × 3개 Theme(Terminal Noir/Frosted Signal/Prism Circuit) 전환 시 실제로 토큰이 반영되는지, 깜빡임(FOUC) 없는지
   - 리퀴드글라스 효과가 의도한 표면(헤더, 카테고리 트리 컨테이너 등)에만 적용되고 반복 리스트(포스트 카드, 트리 행)에는 적용 안 됐는지 — 계획 Section D 적용 맵 참고
   - 데스크톱(1200px+)과 모바일(375px 등) 뷰포트에서 `browser_resize`로 반응형 확인 — 특히 포스트 그리드가 데스크톱에서 실제로 다열로 바뀌는지(기존 버그였음)
   - `/hidden` 이스터에그가 새 전역 CSS/JS로 인해 깨지지 않았는지
   - 콘솔 에러(`browser_console_messages` 등)가 없는지
4. Chrome 계열에서 실제 `feDisplacementMap` SVG 필터가 적용되고, 지원 안 되는 환경(Firefox 등, MCP가 지원하는 브라우저 범위 내에서)에서 폴백(blur)이 정상 동작하는지도 가능한 만큼 교차 확인할 것.
5. 이 과정에서 발견한 실제 문제(레이아웃 깨짐, 접근성 이슈, 성능 문제 등)는 계획을 맹신하지 말고 즉시 보고하고 수정할 것.

## 4. 진행 방식
계획 파일(`luminous-coalescing-lerdorf.md`)의 Phase 순서를 그대로 따르되, 현재 어느 Phase까지 실제로 완료됐는지는 위 1번 단계에서 직접 확인한 뒤 판단해라. 각 Phase 완료 시 "완료 기준"을 Playwright로 실제 검증하고 나서 다음 Phase로 넘어가라.
