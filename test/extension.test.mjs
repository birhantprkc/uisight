/**
 * The extension talks to the panel over HTTP, and nothing type-checks that
 * conversation. It drifted badly once: the extension was still calling `/act`
 * with `{tip}` and reading `d.dusukKontrast`, while the server had moved to
 * `/action` with `{type}` and English keys. Nothing threw — the commands just
 * quietly did nothing, and Inspect reported "no findings" on pages full of them.
 *
 * These tests read both sides and compare them, so the next rename fails here
 * instead of in front of a user.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ext = readFileSync(join(root, 'extension', 'extension.js'), 'utf8');
const server = readFileSync(join(root, 'src', 'server.mjs'), 'utf8');
const manifest = JSON.parse(readFileSync(join(root, 'extension', 'package.json'), 'utf8'));

const uniq = (re, s) => [...new Set([...s.matchAll(re)].map((m) => m[1]))];

test('every action the extension sends is one the panel handles', () => {
  const sent = uniq(/act\('([a-z-]+)'/g, ext);
  const handled = uniq(/case '([a-z-]+)':/g, server);
  assert.ok(sent.length, 'the extension must send at least one action');
  const unknown = sent.filter((a) => !handled.includes(a));
  assert.deepEqual(unknown, [], `the panel does not handle: ${unknown.join(', ')}`);
});

test('every route the extension calls is one the panel serves', () => {
  const called = uniq(/request\('(\/[a-z]*)'/g, ext);
  const served = uniq(/u\.pathname === '(\/[a-z]*)'/g, server);
  const unknown = called.filter((r) => !served.includes(r));
  assert.deepEqual(unknown, [], `the panel does not serve: ${unknown.join(', ')}`);
});

test('the extension sends the token, or every command it makes is a 403', () => {
  assert.match(ext, /'x-uisight-token'/, 'POSTs must carry the panel token');
  assert.match(ext, /token-\$\{port\(\)\}/, 'the token is read per port, since a restart mints a new one');
});

test('the result fields the extension renders are fields the engine produces', () => {
  const cli = readFileSync(join(root, 'src', 'cli.mjs'), 'utf8');
  // `d.` reads in the inspect renderer, minus the per-finding sub-fields.
  const read = uniq(/\bd\.([a-zA-Z]+)\b/g, ext).filter((k) => k !== 'totals');
  const produced = uniq(/result\.([a-zA-Z]+)(?:\.push|\s*=)/g, cli)
    .concat(uniq(/([a-zA-Z]+): (?:\[\]|0|null)[,\n]/g, cli));
  const missing = read.filter((k) => !produced.includes(k));
  assert.deepEqual(missing, [], `the engine never produces: ${missing.join(', ')}`);
});

test('every command in the manifest is registered, and nothing extra is', () => {
  const declared = manifest.contributes.commands.map((c) => c.command).sort();
  const registered = uniq(/register\('(uisight\.[a-zA-Z]+)'/g, ext).sort();
  assert.deepEqual(registered, declared);
});

test('the webview id the manifest declares is the one the extension provides', () => {
  const id = manifest.contributes.views.uisight[0].id;
  assert.ok(ext.includes(`'${id}'`), `${id} is declared but never provided`);
  assert.deepEqual(manifest.activationEvents, [`onView:${id}`]);
});

const slashes = (s) => s.split(String.fromCharCode(92)).join('/');

test('the default tool path points at a folder that really holds the server', () => {
  const p = manifest.contributes.configuration.properties['uisight.toolPath'].default;
  assert.equal(slashes(p).toLowerCase(), slashes(root).toLowerCase());
});
