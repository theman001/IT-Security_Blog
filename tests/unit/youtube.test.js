import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseYouTube, isVideoId } from '../../src/lib/youtube.js';

const ID = 'dQw4w9WgXcQ';
test('parseYouTube: watch / youtu.be / shorts / embed / live / bare id', () => {
  for (const u of [`https://www.youtube.com/watch?v=${ID}`, `https://youtube.com/watch?v=${ID}&list=x`, `https://m.youtube.com/watch?v=${ID}`,
    `https://music.youtube.com/watch?v=${ID}`, `https://youtu.be/${ID}`, `https://youtu.be/${ID}?si=abc`, `https://www.youtube.com/shorts/${ID}`,
    `https://www.youtube.com/embed/${ID}`, `https://www.youtube-nocookie.com/embed/${ID}`, `https://www.youtube.com/live/${ID}`, `http://youtube.com/watch?v=${ID}`, ID]) {
    assert.deepEqual(parseYouTube(u), { id: ID, start: 0 }, u);
  }
});
test('parseYouTube: start time from t / start (seconds or 1h2m3s)', () => {
  assert.equal(parseYouTube(`https://youtu.be/${ID}?t=43`).start, 43);
  assert.equal(parseYouTube(`https://youtu.be/${ID}?t=1h2m3s`).start, 3723);
  assert.equal(parseYouTube(`https://youtu.be/${ID}?t=90s`).start, 90);
  assert.equal(parseYouTube(`https://www.youtube.com/watch?v=${ID}&start=7`).start, 7);
  for (const bad of ['abc', '-5', '1x', '99999999999']) assert.equal(parseYouTube(`https://youtu.be/${ID}?t=${bad}`).start, 0, bad);
});
test('parseYouTube: anything else is null (other hosts, lookalikes, bad ids, schemes)', () => {
  for (const bad of ['', null, undefined, 'https://vimeo.com/123456789', `https://evil.example/watch?v=${ID}`, `https://youtube.com.evil.example/watch?v=${ID}`,
    `https://notyoutube.com/watch?v=${ID}`, 'https://www.youtube.com/watch?v=short', 'https://www.youtube.com/watch', `https://youtu.be/${ID}x`, `javascript:alert(1)//youtu.be/${ID}`,
    `ftp://youtu.be/${ID}`, 'https://www.youtube.com/', 'dQw4w9WgXc', 'dQw4w9WgXcQQ']) assert.equal(parseYouTube(bad), null, String(bad));
  assert.ok(isVideoId(ID));
  assert.ok(!isVideoId('x'.repeat(12)) && !isVideoId('a b c d e f') && !isVideoId('<script>aaa'));
});
