# System Architecture

This blog is built with a focus on **simplicity**, **performance**, and **security**.

## Tech Stack
- **Frontend**: Vanilla HTML/CSS/JS (No Frameworks)
- **Routing**: Client-side History API
- **Rendering**: Browser-based Markdown Rendering
- **Data Source**: Neon DB API (External)
- **Hosting**: Static Hosting (Zero Config)

## Design Principles
1. **No Build Step**: The source code is the distribution code.
2. **Theme-First**: Built-in support for Light and Dark modes.
3. **Speed**: Minimal JavaScript payload and efficient caching.

\`\`\`mermaid
graph TD
    Client[Browser] -->|Index HTML| CDN
    Client -->|Fetch JS/CSS| CDN
    Client -->|API Request| database[(Neon DB)]
    Client -->|Render| DOM
\`\`\`
