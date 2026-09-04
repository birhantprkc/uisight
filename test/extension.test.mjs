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

test('the default tool path is empty, so a fresh install runs the published package', () => {
  // It used to default to c:/dev/uisight — this machine's checkout, which meant
  // the extension could not work on anyone else's computer. Empty means "use
  // npx uisight@latest", which is both portable and self-updating.
  const p = slashes(manifest.contributes.configuration.properties['uisight.toolPath'].default);
  assert.equal(p, '', 'a machine-specific default makes the extension unpublishable');
  assert.match(ext, /'uisight@latest'/, 'the fallback must pin @latest, or installs freeze');
  assert.doesNotMatch(ext, /mobil-qa/, 'the fork is retired');
});

test('the narrow-mode flag the extension sends is one the panel reads', () => {
  // The extension opens the panel in a ~300px side bar, where the default
  // two-column layout is unreadable. It asked for `?dar=1` for a while after the
  // server had stopped reading any such flag — so the side panel quietly showed
  // the wide layout, which is the thing narrow mode exists to prevent.
  const sent = [...ext.matchAll(/\?([a-z]+)=1/g)].map((m) => m[1]);
  assert.ok(sent.length, 'the extension must ask for narrow mode');
  for (const flag of sent) {
    assert.ok(
      server.includes(`q.has('${flag}')`),
      `the panel never reads ?${flag}=1`,
    );
  }
});

test('narrow mode hides the desktop session and caps the card at the viewport', () => {
  // Both halves matter: hiding one column is pointless if the remaining card
  // still sizes itself to its own image and overflows the side bar.
  assert.match(server, /body\.narrow \.tel\[data-session="web"\] \{ display:none/);
  assert.match(server, /body\.narrow \.tel \{[^}]*max-width:100%/);
});

/**
 * A check nobody displays is a check that does not exist.
 *
 * This has now happened twice. Four UX checks shipped in 0.4.0 were measured on
 * every page and printed in none of them: the CLI report enumerated ten finding
 * types and the engine produced fifteen. Nothing failed — the report was simply
 * shorter than the truth, which is the hardest kind of bug to notice, because a
 * clean report is exactly what you hope to see.
 *
 * So the engine's output is the contract, and every consumer has to cover it.
 */
const FINDING_TYPES = () => {
  const cli = readFileSync(join(root, 'src', 'cli.mjs'), 'utf8');
  const init = cli.match(/const result = \{[\s\S]*?\n  \};/);
  assert.ok(init, 'could not find the result initialiser');
  // Arrays are findings; scalars and the theme baseline are not.
  return [...init[0].matchAll(/([a-zA-Z]+): \[\]/g)]
    .map((m) => m[1])
    .filter((k) => k !== 'themeSignature');
};

test('the CLI report prints every finding type the engine produces', () => {
  const cli = readFileSync(join(root, 'src', 'cli.mjs'), 'utf8');
  const report = cli.slice(cli.indexOf('// --- Report ---'));
  const missing = FINDING_TYPES().filter((k) => !report.includes(`d.${k}`));
  assert.deepEqual(missing, [], `measured but never written to REPORT.md: ${missing.join(', ')}`);
});

test('the extension prints every finding type the engine produces', () => {
  const missing = FINDING_TYPES().filter((k) => !ext.includes(`d.${k}`));
  assert.deepEqual(missing, [], `measured but never shown in the editor: ${missing.join(', ')}`);
});

test('the audit summary counts every finding type, or its totals lie', () => {
  const audit = readFileSync(join(root, 'src', 'audit.mjs'), 'utf8');
  const summary = audit.slice(audit.indexOf('const summarise'), audit.indexOf('const total'));
  const missing = FINDING_TYPES().filter((k) => !summary.includes(`d.${k}`));
  assert.deepEqual(missing, [], `not counted in the audit total: ${missing.join(', ')}`);
});
