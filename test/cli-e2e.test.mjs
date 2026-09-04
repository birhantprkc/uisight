/**
 * The CLI against a real server, because one bug here could not be seen any
 * other way.
 *
 * Listeners were attached inside the per-path loop and never removed, so loading
 * page N fired N of them and wrote the same event into every earlier record. In
 * the field a site logging exactly one warning per page came back as 5, 4, 3, 2,
 * 1 — the last page correct, everything before it inflated. No individual number
 * looked wrong, which is why it survived a long time.
 *
 * A structural test (does the loop call page.off) can be satisfied while the
 * behaviour is still broken. This one serves three pages that each log exactly
 * one error and asserts the report says 1, 1, 1.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
import { readFileSync, rmSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtempSync } from 'node:fs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let server;
let port;
let outRoot;

const SAYFA = (ad) => `<!doctype html><html><head><meta name="viewport" content="width=device-width">
<title>${ad}</title></head><body style="background:#fff;color:#111;font:16px sans-serif">
<h1>${ad}</h1><p>Bu sayfa tam olarak bir konsol hatasi basar.</p>
<script>console.error('tek-hata-${ad}');</script>
</body></html>`;

before(async () => {
  server = createServer((req, res) => {
    const ad = (req.url || '/').replace(/[^a-z]/gi, '') || 'kok';
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(SAYFA(ad));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  port = server.address().port;
  outRoot = mkdtempSync(join(tmpdir(), 'uisight-e2e-'));
});

after(async () => {
  await new Promise((r) => server.close(r));
  try { rmSync(outRoot, { recursive: true, force: true }); } catch { /* windows tutuyor olabilir */ }
});

test('each page reports its own console errors, not the ones before it', async () => {
  // execFileSync would block this process's event loop, and the server being
  // measured lives in it — the CLI would wait forever for a reply that cannot
  // be sent. (Cost: one 180s timeout to notice.)
  await run(process.execPath, [
    join(root, 'src', 'cli.mjs'),
    `http://127.0.0.1:${port}/`,
    '--path', '/bir,/iki,/uc',
    '--device', 'pixel',
    '--theme', 'light',
    '--no-open',
  ], { cwd: outRoot, env: { ...process.env, NO_UPDATE_NOTIFIER: '1' }, timeout: 180000 });

  const dizin = readdirSync(join(outRoot, 'uisight-outputs'))[0];
  const rapor = JSON.parse(readFileSync(join(outRoot, 'uisight-outputs', dizin, 'report.json'), 'utf8'));

  assert.equal(rapor.length, 3, 'three paths, three records');
  const sayilar = rapor.map((r) => (r.console || []).length);

  // Bozukken bu [3,2,1] (ya da tersi) olur — merdiven imzasi.
  assert.deepEqual(sayilar, [1, 1, 1],
    `each page logs exactly one error; got ${JSON.stringify(sayilar)} — listeners are accumulating`);

  // Ve her kayit KENDI hatasini tasimali, oncekinin degil.
  for (const r of rapor) {
    const beklenen = 'tek-hata-' + r.path.replace(/[^a-z]/gi, '');
    assert.ok((r.console || []).some((c) => c.message.includes(beklenen)),
      `${r.path} should carry its own error, has ${JSON.stringify(r.console)}`);
  }
});
