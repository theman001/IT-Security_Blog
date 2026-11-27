// parts: array of (possibly percent-encoded) segments, or one '/'-joined string.
export function decodeSlug(parts) {
  const segs = typeof parts === 'string' ? parts.split('/') : parts;
  if (!Array.isArray(segs) || !segs.length) return null;
  const out = [];
  for (const s of segs) {
    if (typeof s !== 'string') return null;
    let d;
    try { d = decodeURIComponent(s); } catch { return null; }
    if (!d || d === '.' || d === '..' || d.includes('/') || /[\u0000-\u001f]/.test(d)) return null;
    out.push(d);
  }
  return out.join('/');
}

export const sectionOf = (slug) => slug.split('/')[0];
