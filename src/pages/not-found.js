// Not-found page + reusable view for pages that detect "missing" themselves (post, section).
//   notFoundView() -> { title, html }; mountNotFound(root) -> cleanup (loads up to 3 recent posts).
import '../styles/static.css';
import { getPosts } from '../lib/api.js';
import { postRowHtml } from '../components/post-card.js';

const TITLE = '페이지를 찾을 수 없습니다';

export const notFoundView = () => ({
  title: TITLE,
  html: `<div class="nf"><h1>${TITLE}</h1><p>주소가 바뀌었거나 삭제된 글일 수 있습니다.</p><p><a data-link href="/">홈으로</a></p></div>`,
});

export function mountNotFound(root) {
  let dead = false; // guards a response that arrives after leaving the page
  getPosts({ limit: 3 })
    .then(({ items }) => {
      if (dead || !items.length) return;
      root.querySelector('.nf')?.insertAdjacentHTML('beforeend', `<section class="nf-recent"><h2>최근 글</h2>${items.map(postRowHtml).join('')}</section>`);
    })
    .catch(() => {}); // the extra list is optional
  return () => {
    dead = true;
  };
}

let cleanup = null;
export const notFoundPage = {
  render: notFoundView,
  mount(root) {
    cleanup = mountNotFound(root);
  },
  unmount() {
    cleanup?.();
    cleanup = null;
  },
};
export default notFoundPage;
