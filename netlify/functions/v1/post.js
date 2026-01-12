import { Client } from "pg";

export async function handler(event) {
  const slug = event.queryStringParameters?.slug;

  if (!slug) {
    return { statusCode: 400, body: "slug required" };
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();

  const res = await client.query(
    `
    SELECT r.slug, r.title, r.content_md, r.created_at,
           c.slug AS category
    FROM reports r
    JOIN categories c ON r.category_id = c.id
    WHERE r.slug = $1
    `,
    [slug]
  );

  await client.end();

  if (res.rows.length === 0) {
    return { statusCode: 404, body: "Not found" };
  }

  return {
    statusCode: 200,
    body: JSON.stringify(res.rows[0])
  };
}
