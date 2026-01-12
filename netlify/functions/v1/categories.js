import { Client } from "pg";

export async function handler() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();

  const res = await client.query(`
    SELECT id, slug, name, parent_id, depth
    FROM categories
    ORDER BY depth, name
  `);

  await client.end();

  return {
    statusCode: 200,
    body: JSON.stringify(res.rows)
  };
}
