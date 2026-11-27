import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scanText } from '../../scripts/lib/check-bundle.js';

test('clean text matches nothing', () => {
  assert.deepEqual(scanText('const a = fetch("/api/posts"); // postgres is great'), []);
});

test('each forbidden pattern is reported by name, once', () => {
  const t = 'x postgresql://u:p@h/db y postgres://z DATABASE_URL neon.tech @neondatabase/serverless neondb_owner app_reader DATABASE_URL';
  assert.deepEqual(scanText(t), ['postgresql://', 'postgres://', 'DATABASE_URL', 'neon.tech', '@neondatabase', 'neondb_owner', 'app_reader']);
});

test('result never contains the surrounding secret', () => {
  assert.deepEqual(scanText('postgresql://user:hunter2@host/db'), ['postgresql://']);
});
