import { Client } from "pg";

export async function handler(event) {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();

  const category = event.queryStringParameters?.category;

  let query = `
    SELECT r.slug, r.title, r.created_at, c.slug AS category
    FROM reports r
    JOIN categories c ON r.category_id = c.id
  `;

  const params = [];

  if (category) {
    query += ` WHERE c.slug = $1`;
    params.push(category);
  }

  query += ` ORDER BY r.created_at DESC`;

  const res = await client.query(query, params);

  await client.end();

  return {
    statusCode: 200,
    body: JSON.stringify(res.rows)
  };
}
