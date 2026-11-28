// Fill external link cards (`a.link-card[data-preview]`) with the target page's title/description via
// GET /api/link-preview (the edge fetches the page; the browser never contacts the other site).
// Failure leaves the card as is (domain + link). Returns a cleanup that aborts pending requests.
export function hydrateLinkCards(root) {
  const ctl = new AbortController();
  for (const a of root.querySelectorAll('a.link-card[data-preview]')) {
    fetch(`/api/link-preview?url=${encodeURIComponent(a.getAttribute('href'))}`, { signal: ctl.signal, headers: { accept: 'application/json' } })
      .then((res) => (res.ok ? res.json() : null))
      .then((meta) => {
        if (!meta) return;
        // textContent only: the values come from a third-party page
        if (typeof meta.title === 'string' && meta.title) a.querySelector('.link-card__title').textContent = meta.title;
        if (typeof meta.description === 'string' && meta.description && !a.querySelector('.link-card__desc')) {
          const d = document.createElement('span');
          d.className = 'link-card__desc';
          d.textContent = meta.description;
          a.append(d);
        }
        a.removeAttribute('data-preview');
      })
      .catch(() => {});
  }
  return () => ctl.abort();
}
