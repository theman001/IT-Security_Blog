// Real-HTTP edge check: build, run `wrangler pages dev dist`, assert 404s, meta injection, feeds.
// Needs DATABASE_URL in .dev.vars (else skips, exit 0). Never prints DATABASE_URL or post bodies.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

const PORT = 8799;
const BASE = `http://localhost:${PORT}`;
const root = new URL('..', import.meta.url).pathname;
process.chdir(root);

if (!existsSync('.dev.vars') || !/^DATABASE_URL=\S+/m.test(readFileSync('.dev.vars', 'utf8'))) {
  console.log('SKIP test:edge: .dev.vars has no DATABASE_URL');
  process.exit(0);
}

const build = spawnSync('npm', ['run', 'build'], { stdio: 'pipe', encoding: 'utf8' });
if (build.status !== 0) { console.error(build.stdout + build.stderr); process.exit(1); }

const dev = spawn('npx', ['wrangler', 'pages', 'dev', 'dist', '--port', String(PORT), '--compatibility-date=2026-11-01'],
  { stdio: 'ignore', detached: true });
const stop = () => { try { process.kill(-dev.pid, 'SIGKILL'); } catch {} };
process.on('exit', stop);
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => { stop(); process.exit(1); });

let failed = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ' ' + extra}`); if (!ok) failed++; };
const get = async (p) => { const r = await fetch(BASE + p, { redirect: 'manual' }); return { r, t: await r.text() }; };
// h1 (post-header.js) escapes & < > " '; <title> (seo.js escapeText) only & < >
const escText = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

try {
  for (let i = 0; ; i++) {
    try { if ((await fetch(BASE + '/robots.txt')).ok) break; } catch {}
    if (i > 120) throw new Error('wrangler did not become ready');
    await new Promise((r) => setTimeout(r, 500));
  }

  for (const p of ['/nope', '/deep/unknown/path', '/posts/does-not-exist', '/posts/', '/posts', '/categories/tech/does-not-exist', '/assets/nope.js', '/api', '/api/', '/api/nope']) {
    const { r } = await get(p);
    check(`${p} -> 404`, r.status === 404, String(r.status));
  }
  const nf = await get('/nope');
  check('/nope is the SPA shell with noindex', nf.t.includes('id="main"') && nf.t.includes('name="robots" content="noindex"'));

  const list = await get('/api/posts?limit=1');
  const post = JSON.parse(list.t).items?.[0];
  check('/api/posts?limit=1 returns a post', !!post);
  if (post) {
    const path = '/posts/' + post.slug.split('/').map(encodeURIComponent).join('/');
    const { r, t } = await get(path);
    check(`${path} -> 200`, r.status === 200, String(r.status));
    check('post has og:title', t.includes('property="og:title"'));
    check('post has JSON-LD', t.includes('application/ld+json'));
    const main = t.slice(t.indexOf('<main'), t.indexOf('</main>'));
    check('post <main> has the prerendered <h1> with the title', main.includes(`<h1 class="post-title">${escHtml(post.title)}</h1>`), main.slice(0, 200));
    check('post <main> has the empty article container', /<article class="article( essay)?"><\/article>/.test(main));
    check('post has canonical', /<link rel="canonical" href="[^"]+"/.test(t));
    check('post title escaped in <title>', t.includes(`<title>${escText(post.title)} - IT Security Blog</title>`));
    check('post has no raw <script> from data', (t.match(/<script/g) ?? []).length === (nf.t.match(/<script/g) ?? []).length + 2); // JSON-LD + inlined payload
    check('inlined post payload is JSON with no raw "<"', (() => { try { const j = /<script type="application\/json" id="post-data">(.*?)<\/script>/s.exec(t)[1]; return !j.includes('<') && JSON.parse(j).post.slug === post.slug; } catch { return false; } })());
    check('single <title>', (t.match(/<title>/g) ?? []).length === 1);
    const sm = await get('/sitemap.xml');
    check('sitemap lists the post url', sm.t.includes(path.replace(/&/g, '&amp;')));
  }
  const redirect = await get('/categories/tech');
  check('/categories/tech -> 301 /tech', redirect.r.status === 301 && redirect.r.headers.get('location') === '/tech', `${redirect.r.status} ${redirect.r.headers.get('location')}`);
  const post405 = await fetch(BASE + '/about', { method: 'POST' });
  check('POST /about -> 405 with Allow: GET, HEAD', post405.status === 405 && post405.headers.get('allow') === 'GET, HEAD', `${post405.status} ${post405.headers.get('allow')}`);
  for (const p of ['/', '/about', '/about/', '/tech', '/trends', '/essays']) check(`${p} -> 200`, (await get(p)).r.status === 200);

  const sm = await get('/sitemap.xml');
  check('/sitemap.xml 200 application/xml', sm.r.status === 200 && sm.r.headers.get('content-type').startsWith('application/xml'));
  const rss = await get('/rss.xml');
  check('/rss.xml 200 application/rss+xml', rss.r.status === 200 && rss.r.headers.get('content-type').startsWith('application/rss+xml'));
  const xml = spawnSync('xmllint', ['--noout', '-'], { input: sm.t + '', encoding: 'utf8' });
  const xml2 = spawnSync('xmllint', ['--noout', '-'], { input: rss.t, encoding: 'utf8' });
  if (xml.error) {
    check('xml well-formed (basic)', sm.t.startsWith('<?xml') && sm.t.trimEnd().endsWith('</urlset>') && rss.t.trimEnd().endsWith('</rss>'));
  } else {
    check('xmllint sitemap', xml.status === 0, xml.stderr.slice(0, 200));
    check('xmllint rss', xml2.status === 0, xml2.stderr.slice(0, 200));
  }
  check('robots has Sitemap:', (await get('/robots.txt')).t.includes(`Sitemap: ${BASE}/sitemap.xml`));

  const js = readdirSync('dist/assets').find((f) => f.endsWith('.js'));
  const a = await get('/assets/' + js);
  check(`/assets/${js} -> 200 js (not shell)`, a.r.status === 200 && /javascript/.test(a.r.headers.get('content-type')) && !a.t.includes('<html'));
  check('/assets/* served with immutable Cache-Control', /immutable/.test(a.r.headers.get('cache-control') ?? ''), String(a.r.headers.get('cache-control')));
  const leaked = readdirSync('dist/assets').filter((f) => f.endsWith('.js')).some((f) => /postgres(ql)?:\/\//.test(readFileSync('dist/assets/' + f, 'utf8')));
  check('dist JS has no postgresql://', !leaked);
  check('dist/_routes.json present', existsSync('dist/_routes.json'));
  check('dist/_headers has the immutable /assets/* rule', existsSync('dist/_headers') && /^\/assets\/\*\n\s+Cache-Control: .*immutable/m.test(readFileSync('dist/_headers', 'utf8')));
} catch (e) {
  console.error('test:edge error:', e.message);
  failed++;
} finally {
  stop();
}
console.log(failed ? `\n${failed} FAILED` : '\nall edge checks passed');
process.exit(failed ? 1 : 0);
