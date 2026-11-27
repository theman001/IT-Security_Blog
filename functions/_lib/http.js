const CACHE = {
  ok: 'public, max-age=60, s-maxage=600, stale-while-revalidate=86400',
  err: 'public, max-age=0, s-maxage=60',
};

export const json = (data, { status = 200, cache = 'ok' } = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': CACHE[cache] },
  });

export const fail = (status, code, message) =>
  json({ error: { code, message } }, { status, cache: 'err' });
