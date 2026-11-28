// Click (or Enter/Space) on a body image opens it large in a native <dialog> (modal: focus trap, Esc, backdrop).
// Skips images that are links and the YouTube thumbnail. The dialog is built here, never from markdown.
// Returns a cleanup (also closes/removes an open dialog).
const ZOOMABLE = 'img:not(.video-embed__thumb)';
const zoomable = (img, root) => img.matches(ZOOMABLE) && root.contains(img) && !img.closest('a');

export function enableImageZoom(root) {
  let dlg = null;
  for (const img of root.querySelectorAll(ZOOMABLE)) {
    if (!zoomable(img, root)) continue;
    img.classList.add('zoomable');
    img.tabIndex = 0;
    img.setAttribute('role', 'button');
    img.setAttribute('aria-label', `이미지 크게 보기${img.alt ? `: ${img.alt}` : ''}`);
  }

  const close = () => {
    const d = dlg;
    dlg = null;
    d?.close();
    d?.remove();
  };
  const open = (img) => {
    close();
    const d = (dlg = document.createElement('dialog'));
    d.className = 'image-zoom';
    d.setAttribute('aria-label', img.alt || '이미지');
    const big = document.createElement('img');
    big.src = img.currentSrc || img.src;
    big.alt = img.alt;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'image-zoom__close';
    btn.textContent = '닫기';
    d.append(big, btn);
    // any click closes (image, backdrop, button); Esc closes natively
    d.addEventListener('click', close);
    d.addEventListener('close', () => {
      d.remove();
      if (dlg === d) dlg = null;
      if (img.isConnected) img.focus({ preventScroll: true });
    });
    document.body.append(d);
    d.showModal();
  };

  const onClick = (ev) => {
    const img = ev.target.closest?.('img');
    if (img && zoomable(img, root) && !ev.defaultPrevented && ev.button === 0 && !(ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey)) open(img);
  };
  const onKey = (ev) => {
    const img = ev.target.closest?.('img.zoomable');
    if (img && (ev.key === 'Enter' || ev.key === ' ')) {
      ev.preventDefault();
      open(img);
    }
  };
  root.addEventListener('click', onClick);
  root.addEventListener('keydown', onKey);
  return () => {
    root.removeEventListener('click', onClick);
    root.removeEventListener('keydown', onKey);
    close();
  };
}
