import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, getPosts, getPost, getCategories, getCategoryPosts } from '../../src/lib/api.js';

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
function stub(res) {
  const calls = [];
  globalThis.fetch = async (url) => (calls.push(String(url)), res.clone());
  return calls;
}

test('getPost encodes each slug segment, keeps slashes', async () => {
  const calls = stub(json({ post: {} }));
  await getPost('Security/Hack & 한글/a:b');
  assert.equal(calls[0], `/api/posts/Security/${encodeURIComponent('Hack & 한글')}/${encodeURIComponent('a:b')}`);
});
test('getCategoryPosts encodes segments and appends /posts', async () => {
  const calls = stub(json({}));
  await getCategoryPosts('tech/a b');
  assert.equal(calls[0], '/api/categories/tech/a%20b/posts');
});
test('getPosts skips empty/undefined params', async () => {
  const calls = stub(json({ items: [] }));
  await getPosts({ section: 'tech', category: '', cursor: undefined, limit: 20 });
  assert.equal(calls[0], '/api/posts?section=tech&limit=20');
  await getPosts();
  assert.equal(calls[1], '/api/posts');
});
test('getCategories hits /api/categories', async () => {
  const calls = stub(json({ items: [] }));
  assert.deepEqual(await getCategories(), { items: [] });
  assert.equal(calls[0], '/api/categories');
});
test('non-2xx -> ApiError with server code/message', async () => {
  stub(json({ error: { code: 'not_found', message: 'Post not found' } }, 404));
  await assert.rejects(getPost('x'), (e) => e instanceof ApiError && e.status === 404 && e.code === 'not_found' && e.message === 'Post not found');
});
test('non-2xx without JSON body -> ApiError with fallback', async () => {
  stub(new Response('<html>bad gateway</html>', { status: 502 }));
  await assert.rejects(getCategories(), (e) => e instanceof ApiError && e.status === 502 && e.code === 'http_error' && e.message === 'HTTP 502');
});
test('. and .. segments -> 404 ApiError without a network request', async () => {
  const calls = stub(json({}));
  for (const fn of [() => getPost('tech/../x'), () => getPost('..'), () => getPost('./a'), () => getCategoryPosts('tech/..')]) {
    await assert.rejects(fn(), (e) => e instanceof ApiError && e.status === 404 && e.code === 'not_found');
  }
  assert.deepEqual(calls, []);
  await getPost('a/..b/c.d'); // dots inside a segment are fine
  assert.equal(calls.length, 1);
});
test('200 with non-JSON body -> ApiError bad_response', async () => {
  stub(new Response('<html>captive portal</html>', { status: 200 }));
  await assert.rejects(getCategories(), (e) => e instanceof ApiError && e.status === 200 && e.code === 'bad_response' && e.message === 'Invalid response');
});
