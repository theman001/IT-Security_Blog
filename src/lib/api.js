// Thin client for /api/* (contract: docs/api.md). Read-only GETs.
export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

// fetch() normalises `.`/`..` out of URLs, which would turn them into other endpoints.
const seg = (path) =>
  String(path)
    .split('/')
    .map((s) => {
      if (s === '.' || s === '..') throw new ApiError(404, 'not_found', 'Not found');
      return encodeURIComponent(s);
    })
    .join('/');

async function get(url) {
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) {
    const e = (await res.json().catch(() => null))?.error;
    throw new ApiError(res.status, e?.code ?? 'http_error', e?.message ?? `HTTP ${res.status}`);
  }
  try {
    return await res.json();
  } catch {
    throw new ApiError(res.status, 'bad_response', 'Invalid response');
  }
}

export function getPosts(params = {}) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') q.set(k, v);
  const qs = q.toString();
  return get(`/api/posts${qs ? `?${qs}` : ''}`);
}
// The edge inlines the /api/posts/<slug> payload in the first HTML (functions/posts/[[slug]].js): use it once, skip the round trip.
// Captured at boot and only for the first getPost: a post body that contains an element with this id must never be read as a payload.
let inline = typeof document === 'undefined' ? null : document.getElementById('post-data');
function takeInlinePost(slug) {
  const el = inline;
  inline = null;
  el?.remove();
  try {
    const data = el && JSON.parse(el.textContent);
    return data?.post?.slug === slug ? data : null;
  } catch {
    return null;
  }
}
export const getPost = async (slug) => takeInlinePost(slug) ?? get(`/api/posts/${seg(slug)}`);
export const getCategories = () => get('/api/categories');
export const getNav = () => get('/api/nav');
export const getCategoryPosts = async (path) => get(`/api/categories/${seg(path)}/posts`);
