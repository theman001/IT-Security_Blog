import { isVideoId } from '../lib/youtube.js';

// ```youtube blocks render as a plain link ("click to play"); nothing from YouTube is loaded until the visitor
// clicks. Then the link is swapped for a youtube-nocookie iframe built here (never from markdown).
// Modified clicks (new tab etc.) and no-JS keep the normal link to youtube.com. Returns a cleanup.
export function enableVideoEmbeds(root) {
  const onClick = (ev) => {
    const a = ev.target.closest?.('a.video-embed__play');
    if (!a || ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
    const box = a.closest('.video-embed');
    const id = box?.dataset.video;
    if (!isVideoId(id)) return;
    ev.preventDefault();
    const start = /^\d{1,6}$/.test(box.dataset.start ?? '') ? Number(box.dataset.start) : 0;
    const f = document.createElement('iframe');
    f.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0${start ? `&start=${start}` : ''}`;
    f.title = a.querySelector('.video-embed__label')?.textContent || 'YouTube 영상';
    f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    f.allowFullscreen = true;
    f.referrerPolicy = 'strict-origin-when-cross-origin';
    box.replaceChildren(f);
    f.focus();
  };
  root.addEventListener('click', onClick);
  return () => root.removeEventListener('click', onClick);
}
