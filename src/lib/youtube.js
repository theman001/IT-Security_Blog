// YouTube url / bare id -> { id, start } (start in seconds) or null. Pure, shared by the markdown renderer.
const ID = /^[\w-]{11}$/;
export const isVideoId = (s) => ID.test(String(s ?? ''));

function seconds(t) {
  if (/^\d{1,6}$/.test(t)) return Number(t);
  const m = /^(?:(\d{1,3})h)?(?:(\d{1,4})m)?(?:(\d{1,6})s)?$/.exec(t);
  return m && t ? Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0) : 0;
}

export function parseYouTube(raw) {
  const s = String(raw ?? '').trim();
  if (isVideoId(s)) return { id: s, start: 0 };
  let u;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(u.protocol)) return null;
  const host = u.hostname.toLowerCase().replace(/^(www|m|music)\./, '');
  let id = null;
  if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const m = /^\/(?:embed|shorts|live|v)\/([^/]+)/.exec(u.pathname);
    id = m ? m[1] : u.pathname === '/watch' ? u.searchParams.get('v') : null;
  }
  if (!isVideoId(id)) return null;
  return { id, start: seconds(u.searchParams.get('t') ?? u.searchParams.get('start') ?? '') };
}
