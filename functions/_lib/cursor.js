// base64url JSON; Buffer-free so it runs on Workers.
export function encodeCursor({ date, id }) {
  const bin = String.fromCharCode(...new TextEncoder().encode(JSON.stringify({ date, id })));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeCursor(s) {
  try {
    const bin = atob(String(s).replace(/-/g, '+').replace(/_/g, '/'));
    const o = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
    const ok = o && typeof o.date === 'string' && /^(?!0000)\d{4}-\d{2}-\d{2}$/.test(o.date) && // year >= 0001 (Postgres has no year 0)
      new Date(o.date + 'T00:00:00Z').toISOString().slice(0, 10) === o.date && // rejects 2026-02-30
      Number.isInteger(o.id) && o.id >= 0 && o.id <= 2147483647; // fits Postgres int4
    return ok ? { date: o.date, id: o.id } : null;
  } catch {
    return null;
  }
}
