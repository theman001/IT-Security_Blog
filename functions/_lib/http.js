const CACHE = {
  ok: 'public, max-age=60, s-maxage=600, stale-while-revalidate=86400',
  err: 'public, max-age=0, s-maxage=60',
  none: 'no-store',
};

export const json = (data, { status = 200, cache = 'ok', headers } = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': CACHE[cache], ...headers },
  });

export const fail = (status, code, message, { cache = 'err', headers } = {}) =>
  json({ error: { code, message } }, { status, cache, headers });
