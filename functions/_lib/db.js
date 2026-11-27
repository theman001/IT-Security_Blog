import { neon } from '@neondatabase/serverless';

export function getDb(env) {
  if (!env?.DATABASE_URL) throw new Error('DATABASE_URL is not set');
  const sql = neon(env.DATABASE_URL);
  return { query: (text, params) => sql.query(text, params) };
}
