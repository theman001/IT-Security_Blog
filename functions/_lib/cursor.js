// base64url JSON; Buffer-free so it runs on Workers.
export function encodeCursor({ date, id }) {
  const bin = String.fromCharCode(...new TextEncoder().encode(JSON.stringify({ date, id })));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeCursor(s) {
  try {
    const bin = atob(String(s).replace(/-/g, '+').replace(/_/g, '/'));
    const o = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
    return o && typeof o.date === 'string' && Number.isInteger(o.id) ? { date: o.date, id: o.id } : null;
  } catch {
    return null;
  }
}
