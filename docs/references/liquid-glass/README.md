# Liquid Glass 참고 코드

리뉴얼 시 사용할 SVG filter 기반 "liquid glass" 효과의 참고 구현체.
Claude skill이 아니라 순수 참고용 소스 코드입니다.

- 원본: https://github.com/nikdelvin/liquid-glass (MIT License, `LICENSE-nikdelvin` 참고)
- 원리 설명: https://kube.io/blog/liquid-glass-css-svg/
- 원본은 Astro + Tailwind + Anime.js 기반. 이 프로젝트는 vanilla JS/CSS이므로
  `liquidGlass.ts`의 변위 맵(displacement map) 계산 로직만 가져다가
  `feDisplacementMap` SVG filter를 직접 생성하는 방식으로 이식이 필요합니다.
  (`LiquidGlass.astro`는 이식 시 마크업/사용 흐름 참고용)
- `backdrop-filter: url(...)`로 SVG filter를 배경에 적용하는 기능은 **Chrome 계열만 지원**.
  Safari/Firefox 대응을 위해 폴백(단순 blur 등)을 함께 설계할 것.
