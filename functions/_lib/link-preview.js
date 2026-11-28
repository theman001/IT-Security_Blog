import { json, fail } from './http.js';
import { isUrlReferenced } from './queries.js';

// GET /api/link-preview?url=<absolute http(s) url> -> { title, description } from the page's own metadata.
// SSRF/abuse guards: the URL must literally appear in a published post; public hostnames only (no IP literals,
// userinfo, ports, localhost-ish names); redirects re-validated (max 3, manual); 5s timeout; first 256KB of HTML only.
const MAX_URL = 2048;
const MAX_BYTES = 256 * 1024;
const MAX_HOPS = 3;
const TIMEOUT_MS = 5000;
const BAD_HOST = /(^|\.)(localhost|local|internal|localdomain|lan|home\.arpa)\.?$/i;

export function parseTarget(raw) {
  if (typeof raw !== 'string' || !raw || raw.length > MAX_URL) return null;
  let u;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(u.protocol) || u.username || u.password || u.port) return null;
  const h = u.hostname.toLowerCase();
  if (!h.includes('.') || h.startsWith('[') || /^[\d.]+$/.test(h) || BAD_HOST.test(h)) return null;
  return u;
}

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decode = (s) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, g) => {
    if (g[0] !== '#') return ENT[g.toLowerCase()] ?? m;
    const n = g[1].toLowerCase() === 'x' ? parseInt(g.slice(2), 16) : parseInt(g.slice(1), 10);
    return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '';
  });
const clean = (s, max) => {
  const t = [...decode(s ?? '').replace(/\s+/g, ' ').trim()];
  return t.length > max ? `${t.slice(0, max - 1).join('').trimEnd()}…` : t.join('');
};

export function parseMeta(html) {
  const end = html.search(/<\/head\s*>/i);
  const head = end < 0 ? html : html.slice(0, end);
  const meta = {};
  for (const m of head.matchAll(/<meta\s+([^>]*?)\/?>/gi)) {
    const a = {};
    for (const [, k, , dq, sq, bare] of m[1].matchAll(/([a-zA-Z:_-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g)) a[k.toLowerCase()] ??= dq ?? sq ?? bare;
    const key = (a.property ?? a.name ?? '').toLowerCase();
    if (key && a.content !== undefined) meta[key] ??= a.content;
  }
  const t = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  return {
    title: clean(meta['og:title'] || meta['twitter:title'] || t, 120),
    description: clean(meta['og:description'] || meta['twitter:description'] || meta.description, 200),
  };
}

async function readCapped(res) {
  const reader = res.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks = [];
  let n = 0;
  while (n < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    n += value.length;
  }
  reader.cancel().catch(() => {});
  const out = new Uint8Array(Math.min(n, MAX_BYTES));
  let o = 0;
  for (const c of chunks) {
    const part = c.subarray(0, Math.min(c.length, out.length - o));
    out.set(part, o);
    o += part.length;
  }
  return out;
}

const decodeBody = (bytes, contentType) => {
  let label = /charset=["']?([\w-]+)/i.exec(contentType)?.[1];
  label ??= /<meta[^>]+charset=["']?([\w-]+)/i.exec(new TextDecoder('latin1').decode(bytes.subarray(0, 2048)))?.[1];
  try {
    return new TextDecoder(label || 'utf-8').decode(bytes);
  } catch {
    return new TextDecoder().decode(bytes);
  }
};

const upstream = () => fail(502, 'upstream_failed', 'Preview unavailable');

export async function handleLinkPreview({ request, env }, { getDb, fetchImpl = fetch }) {
  if (request.method !== 'GET') return fail(405, 'method_not_allowed', 'Only GET is supported', { headers: { Allow: 'GET' } });
  const raw = new URL(request.url).searchParams.get('url');
  const target = parseTarget(raw);
  if (!target) return fail(400, 'bad_request', 'Invalid url');
  try {
    if (!(await isUrlReferenced(getDb(env), raw))) return fail(404, 'not_found', 'Not found');
  } catch (e) {
    console.error('link-preview db error', e?.name, e?.code);
    return fail(500, 'internal', 'Internal error', { cache: 'none' });
  }
  try {
    let u = target;
    let res;
    for (let hop = 0; ; hop++) {
      res = await fetchImpl(u.href, {
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LinkPreviewBot/1.0)', Accept: 'text/html,application/xhtml+xml' },
      });
      const loc = res.status >= 300 && res.status < 400 ? res.headers.get('location') : null;
      if (!loc) break;
      u = hop < MAX_HOPS ? parseTarget(new URL(loc, u).href) : null;
      if (!u) return upstream();
    }
    const type = res.headers.get('content-type') ?? '';
    if (!res.ok || !/text\/html|application\/xhtml\+xml/i.test(type)) return upstream();
    return json(parseMeta(decodeBody(await readCapped(res), type)));
  } catch (e) {
    console.error('link-preview upstream error', e?.name);
    return upstream();
  }
}
