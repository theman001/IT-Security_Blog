import '../styles/article.css';
import '../styles/static.css';

export default {
  async load() {
    // dynamic: markdown/DOMPurify stay out of the main chunk; the text is repo-static
    const [{ default: md }, { renderMarkdown }] = await Promise.all([import('../content/privacy.md?raw'), import('../render/markdown.js')]);
    return renderMarkdown(md);
  },
  render: (bodyHtml) => ({ title: '개인정보처리방침', html: `<article class="article static-page">${bodyHtml}</article>` }),
};
