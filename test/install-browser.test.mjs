/**
 * The one property that matters here is negative: this must never ask a
 * question, and never start a 150 MB download, where there is nobody to answer.
 * The panel and the MCP server are normally launched by an editor or an agent
 * host with no terminal attached — a prompt there is indistinguishable from a
 * hang, and a download there is somebody's CI bill.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canAsk, missingEngines, installCommand, offerInstall } from '../src/install-browser.mjs';

const TTY = { isTTY: true };
const DUZ = { isTTY: false };

test('it only offers where there is someone to answer', () => {
  assert.equal(canAsk({}, TTY, TTY), true, 'a real terminal');
  assert.equal(canAsk({}, DUZ, TTY), false, 'no stdin to read a yes from');
  assert.equal(canAsk({}, TTY, DUZ), false, 'output is being piped somewhere');
  assert.equal(canAsk({ CI: 'true' }, TTY, TTY), false, 'nobody asked for this in a build');
  assert.equal(canAsk({ UISIGHT_NO_INSTALL: '1' }, TTY, TTY), false, 'an explicit no stays no');
});

test('what is missing is decided by what is on disk', () => {
  const sahte = (yollar) => Object.fromEntries(
    Object.entries(yollar).map(([ad, p]) => [ad, { executablePath: () => p }]),
  );
  // A path that cannot exist stands in for a browser that was never downloaded.
  const yok = 'C:/uisight-test/definitely-not-here/chrome.exe';
  assert.deepEqual(missingEngines(['chromium'], sahte({ chromium: yok })), ['chromium']);
  assert.deepEqual(missingEngines(['chromium'], sahte({ chromium: process.execPath })), []);
  // An engine Playwright will not even name is missing, not a crash.
  assert.deepEqual(missingEngines(['webkit'], {}), ['webkit']);
});

test('nothing is asked and nothing is fetched when the browser is already there', async () => {
  let soruldu = false;
  const sonuc = await offerInstall(['chromium'], { chromium: { executablePath: () => process.execPath } },
    { ask: async () => { soruldu = true; return true; } });
  assert.equal(sonuc, true);
  assert.equal(soruldu, false, 'it must not ask about a browser that is present');
});

test('a missing browser in a non-interactive session is reported, not downloaded', async () => {
  // canAsk() reads the real process here, and the test runner has no TTY —
  // which is exactly the shape of an MCP host and of CI.
  let soruldu = false;
  const sonuc = await offerInstall(['chromium'], { chromium: { executablePath: () => 'C:/uisight-test/nope.exe' } },
    { ask: async () => { soruldu = true; return true; } });
  assert.equal(sonuc, false, 'the caller must fall back to explaining');
  assert.equal(soruldu, false, 'a prompt here is a hang');
});

test('the install command is resolved from the installed Playwright, not guessed', () => {
  const k = installCommand(['chromium']);
  assert.equal(k.cmd, process.execPath);
  assert.match(k.version, /^\d+\.\d+\.\d+/);
  assert.deepEqual(k.args.slice(1), ['install', 'chromium']);
  assert.match(k.args[0], /playwright/, 'it must point inside the playwright package');
});
