// Scaffold smoke test: proves Functions run and the env var is bound (never returns its value).
export const onRequestGet = ({ env }) =>
  Response.json({ ok: true, hasDatabaseUrl: Boolean(env.DATABASE_URL) });
