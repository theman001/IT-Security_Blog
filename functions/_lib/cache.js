// Edge cache for Function responses via the Workers Cache API. `s-maxage` alone does NOT cache a
// Function's own output on Cloudflare; this wrapper is what does. GET only; wrap at the onRequest
// boundary so the handlers stay pure. X-Edge-Cache (HIT|MISS|BYPASS) is a debugging header.
const STORABLE = new Set([200, 301, 404]);
const ORIG = 'X-Orig-Cache-Control'; // client-facing header, parked on the stored copy and restored on HIT

const tag = (res, state, headers = res.headers) => {
  const h = new Headers(headers);
  h.set('X-Edge-Cache', state);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
};

const noCache = (req) => /(^|,)\s*no-cache\b/i.test(req.headers.get('Cache-Control') ?? '') || /no-cache/i.test(req.headers.get('Pragma') ?? '');

export async function withEdgeCache(request, ctx, handler, { ttl = 600, cache } = {}) {
  cache = cache === undefined ? globalThis.caches?.default : cache;
  if (!cache) return handler();
  if (request.method !== 'GET') return tag(await handler(), 'BYPASS');

  const key = new Request(request.url); // origin + path + query as sent
  const skipLookup = noCache(request); // hard reload: refetch, but still refresh the stored entry
  if (!skipLookup) {
    let hit;
    try { hit = await cache.match(key); } catch { /* lookup failure = miss */ }
    if (hit) {
      const h = new Headers(hit.headers);
      const orig = h.get(ORIG);
      h.delete(ORIG);
      if (orig === null) h.delete('Cache-Control'); else h.set('Cache-Control', orig);
      return tag(hit, 'HIT', h);
    }
  }

  const res = await handler();
  if (STORABLE.has(res.status) && !/no-store/i.test(res.headers.get('Cache-Control') ?? '')) {
    const h = new Headers(res.headers);
    const orig = h.get('Cache-Control');
    if (orig !== null) h.set(ORIG, orig);
    h.set('Cache-Control', `public, max-age=${res.status === 404 ? Math.min(60, ttl) : ttl}`);
    const copy = res.clone();
    const put = cache.put(key, new Response(copy.body, { status: res.status, statusText: res.statusText, headers: h })).catch(() => {});
    ctx?.waitUntil ? ctx.waitUntil(put) : await put;
  }
  return tag(res, skipLookup ? 'BYPASS' : 'MISS');
}

// onRequest adapter: export const onRequest = edgeCached((ctx) => handler(ctx, deps))
export const edgeCached = (fn, opts) => (ctx) => withEdgeCache(ctx.request, ctx, () => fn(ctx), opts);
