// Thin client for /api/* (contract: docs/api.md). Read-only GETs.
export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

const seg = (path) => String(path).split('/').map(encodeURIComponent).join('/');

async function get(url) {
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) {
    const e = (await res.json().catch(() => null))?.error;
    throw new ApiError(res.status, e?.code ?? 'http_error', e?.message ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export function getPosts(params = {}) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') q.set(k, v);
  const qs = q.toString();
  return get(`/api/posts${qs ? `?${qs}` : ''}`);
}
export const getPost = (slug) => get(`/api/posts/${seg(slug)}`);
export const getCategories = () => get('/api/categories');
export const getCategoryPosts = (path) => get(`/api/categories/${seg(path)}/posts`);
