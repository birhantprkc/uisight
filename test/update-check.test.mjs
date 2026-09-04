/**
 * The update notice, and the one way it could do real damage.
 *
 * The MCP server speaks JSON-RPC over stdout. A single stray line there corrupts
 * the stream and the tool dies in a way that looks like nothing — no error, no
 * output, just a client that gives up. So the last test here starts the real
 * server with a version check that always has news, and proves stdout stayed
 * clean.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'node:fs';
import { homedir } from 'node:os';
import { compareVersions, updateNotice, currentVersion, latestVersion } from '../src/update-check.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('versions compare by number, not by string', () => {
  // "0.9.0" > "0.10.0" as strings, which would tell everyone on 0.10 to downgrade.
  assert.equal(compareVersions('0.10.0', '0.9.0'), 1);
  assert.equal(compareVersions('0.9.0', '0.10.0'), -1);
  assert.equal(compareVersions('1.0.0', '1.0.0'), 0);
  assert.equal(compareVersions('0.9.1', '0.9.0'), 1);
  assert.equal(compareVersions('1.0.0-beta.1', '1.0.0'), -1, 'a pre-release loses to the release');
});

test('a notice appears only when there is genuinely something newer', () => {
  assert.match(updateNotice('0.1.4', '0.9.0'), /0\.9\.0 is out \(you have 0\.1\.4\)/);
  assert.equal(updateNotice('0.9.0', '0.9.0'), null, 'up to date says nothing');
  assert.equal(updateNotice('0.9.1', '0.9.0'), null, 'ahead of the registry says nothing');
  assert.equal(updateNotice('0.9.0', null), null, 'a failed lookup says nothing');
  assert.equal(updateNotice(null, '0.9.0'), null);
});

test('the notice names both versions and how to fix it', () => {
  const n = updateNotice('0.1.4', '0.9.0');
  assert.match(n, /npx uisight@latest/, 'a version number alone leaves people stuck');
  assert.match(n, /NO_UPDATE_NOTIFIER/, 'and a way to turn it off');
});

test('the package knows its own version', () => {
  const v = currentVersion();
  assert.match(v, /^\d+\.\d+\.\d+/);
});

test('a lookup that fails resolves to null instead of throwing', async () => {
  // A 1ms budget guarantees the abort path. A version check must never be able
  // to break the run it is attached to.
  const v = await latestVersion({ force: true, timeoutMs: 1 });
  assert.ok(v === null || typeof v === 'string');
});

test('the MCP server keeps stdout clean even when the notice fires', async () => {
  // Seed the real cache with a version nobody has, so the notice is guaranteed
  // to fire — then put back whatever was there. No test hooks in the shipped
  // code: this exercises the same path a user's install takes.
  const cache = join(homedir(), '.uisight', 'update-check.json');
  let saved = null;
  try { saved = readFileSync(cache, 'utf8'); } catch { /* nothing cached yet */ }
  mkdirSync(dirname(cache), { recursive: true });
  writeFileSync(cache, JSON.stringify({ checkedAt: Date.now(), latest: '99.0.0' }), 'utf8');

  try {
    const out = await new Promise((resolve) => {
      const p = spawn(process.execPath, [join(root, 'src', 'mcp.mjs')], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, CI: '', NO_UPDATE_NOTIFIER: '' },
      });
      let stdout = '';
      let stderr = '';
      p.stdout.on('data', (d) => { stdout += d; });
      p.stderr.on('data', (d) => { stderr += d; });
      p.stdin.write(JSON.stringify({
        jsonrpc: '2.0', id: 1, method: 'initialize',
        params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 't', version: '1' } },
      }) + '\n');
      setTimeout(() => { p.kill(); resolve({ stdout, stderr }); }, 6000);
    });

    const lines = out.stdout.split('\n').filter((l) => l.trim());
    assert.ok(lines.length, 'the server must answer initialize');
    for (const line of lines) {
      assert.doesNotThrow(() => JSON.parse(line),
        `stdout carried something that is not JSON-RPC: ${line.slice(0, 120)}`);
    }
    assert.ok(!out.stdout.includes('is out (you have'), 'the notice must never reach stdout');
    assert.match(out.stderr, /99\.0\.0 is out/, 'and it must actually have fired, or this proves nothing');
  } finally {
    if (saved === null) { try { unlinkSync(cache); } catch {} }
    else writeFileSync(cache, saved, 'utf8');
  }
});
