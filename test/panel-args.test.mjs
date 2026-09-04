/**
 * The panel used to accept any string as a target. `about:blank` became
 * `http://about:blank` -- a URL that parses nowhere -- and the panel started
 * anyway: it served its HTML, so it looked alive, while /state threw and
 * destroyed the socket. To the extension's discovery scan, to uisight-audit and
 * to the MCP tools, that panel simply did not exist.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { normalizeTarget } from '../src/target-url.mjs';

test('what the panel will and will not open', () => {
  const kabul = {
    'localhost:3000': 'http://localhost:3000',   // the most common way anyone starts this
    'example.com': 'http://example.com',
    'localhost': 'http://localhost',
    'http://a.b/x': 'http://a.b/x',
    'https://a.b/x': 'https://a.b/x',
    '': 'http://localhost:3000',
  };
  for (const [girdi, beklenen] of Object.entries(kabul)) {
    assert.deepEqual(normalizeTarget(girdi), { url: beklenen }, `input ${JSON.stringify(girdi)}`);
  }

  // A first attempt at telling schemes from hosts treated `localhost:3000` as
  // the scheme `localhost:` and refused it -- the single most common input.
  for (const girdi of ['about:blank', 'data:text/html,hi', 'file:///c:/x.html', 'ftp://a.b']) {
    assert.ok(normalizeTarget(girdi).error, `${girdi} must be refused, not carried forward`);
  }
});

test('the panel exits instead of starting on something it cannot measure', async () => {
  const calistir = promisify(execFile);
  const PANEL = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'server.mjs');
  let hata = null;
  try {
    await calistir(process.execPath, [PANEL, 'about:blank', '--port', '5176', '--no-open'], { timeout: 25000 });
  } catch (e) { hata = e; }
  assert.ok(hata, 'it must not start');
  assert.equal(hata.code, 2);
  assert.match(hata.stderr, /not a page this can measure/);
  assert.match(hata.stderr, /http\(s\) address/, 'say what to give instead');
});
