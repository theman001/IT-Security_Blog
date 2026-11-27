// Row 1: About | 문의하기 | 개인정보처리방침 (small, quiet). Row 2: copyright (larger, bold). The "|" separators are CSS, not text.
export function mountFooter(el) {
  el.className = 'site-footer';
  el.innerHTML = `<div class="site-footer__inner">
  <nav class="site-footer__links" aria-label="사이트 정보"><a href="/about" data-link>About</a><a href="/contact" data-link>문의하기</a><a class="site-footer__privacy" href="/privacy" data-link>개인정보처리방침</a></nav>
  <p class="site-footer__copy">ⓒtheman</p>
</div>`;
}
