const MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escape text for use in HTML text/attribute context. null/undefined -> ''. */
export function escapeHtml(value) {
  return value == null ? '' : String(value).replace(/[&<>"']/g, (c) => MAP[c]);
}
