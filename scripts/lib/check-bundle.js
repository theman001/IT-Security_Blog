// Forbidden strings in the built client bundle (DB credentials/driver must stay server-side).
export const FORBIDDEN = ['postgresql://', 'postgres://', 'DATABASE_URL', 'neon.tech', '@neondatabase', 'neondb_owner', 'app_reader'];

/** Names of the forbidden patterns found in `text` (never the matched text itself). */
export const scanText = (text) => FORBIDDEN.filter((p) => text.includes(p));
