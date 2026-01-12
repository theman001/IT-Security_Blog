# IT-Security Blog

IT 보안과 개발 지식을 공유하기 위해 구축된 **싱글 페이지 애플리케이션(SPA) 블로그**입니다.
가벼운 Vanilla JavaScript와 Neon DB를 활용하여 빠른 성능과 직관적인 사용자 경험을 제공합니다.

## 🛠 Tech Stack

- **Frontend**: HTML5, CSS3 (Variables), Vanilla JavaScript (ES6+)
- **Database**: [Neon](https://neon.tech) (Serverless PostgreSQL)
- **Library**: 
  - `marked.js` (Markdown Rendering)
  - `DOMPurify` (XSS Protection)
  - `Prism.js` (Syntax Highlighting)

## ✨ Key Features

### 1. Dynamic Content Rendering
- 작성된 글은 **Markdown** 형식으로 DB에 저장되며, 클라이언트에서 즉시 렌더링됩니다.
- 코드 블록 하이라이팅 및 보안을 위한 HTML Sanitizing이 적용되어 있습니다.

### 2. Category Explorer (Tree View)
- 복잡한 지식 체계를 효과적으로 탐색할 수 있는 **계층형 트리(Tree) UI**를 제공합니다.
- 폴더 접기/펼치기 기능과 직관적인 아이콘(Chevron/Folder)을 지원합니다.

### 3. Dark Mode Support
- 사용자 시스템 설정에 따른 자동 테마 감지 및 수동 토글 기능을 지원합니다.
- CSS 변수(Variables)를 활용하여 부드러운 전환과 일관된 색상 테마를 제공합니다.

### 4. SPA Routing
- 별도의 프레임워크 없이 자체 구현된 **Hash-based Router**를 통해 페이지 새로고침 없는 빠른 탐색이 가능합니다.

## � Project Structure

```bash
public/
├── assets/
│   ├── css/       # Global styles & Theme variables
│   └── js/        # Core logic (Router, API, Renderer)
├── pages/         # Page components (Home, Post, Categories)
├── static/        # Static markdown files (About, Architecture)
└── themes/        # Dark/Light theme definitions
```

---
*Developed for IT Security & Development Knowledge Archive.*
