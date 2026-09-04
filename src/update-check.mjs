/**
 * Telling people a newer version exists.
 *
 * Someone still running 0.1.4 has no way to find out that 0.9.0 fixed the thing
 * biting them — npm installs a version and then never mentions it again. Every
 * improvement shipped since is invisible to the person who most needs it.
 *
 * Three rules this follows, because an update notice is easy to make worse than
 * the problem:
 *
 *   1. **stdout is untouchable.** The MCP server speaks JSON-RPC over stdout;
 *      one stray line corrupts the protocol and the tool dies in a way nobody
 *      can debug. Notices go to stderr, always.
 *   2. **Never block, never fail loudly.** A 2s timeout, and any error at all
 *      means silence. A version check must not be able to break the run.
 *   3. **Ask rarely.** Once a day, cached on disk. Nothing is sent anywhere —
 *      it is a plain GET to the public registry, the same request `npm view`
 *      makes. No identifiers, no telemetry.
 *
 * Off with `NO_UPDATE_NOTIFIER=1`, and off in CI without being asked.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const STATE = join(homedir(), '.uisight', 'update-check.json');
const DAY = 24 * 60 * 60 * 1000;

/** This package's own version, read from its package.json. */
export function currentVersion() {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    return JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8')).version || null;
  } catch { return null; }
}

/** -1 a<b · 0 equal · 1 a>b. Pre-release tags lose to the plain version. */
export function compareVersions(a, b) {
  const part = (v) => String(v).split('-')[0].split('.').map((n) => parseInt(n, 10) || 0);
  const [x, y] = [part(a), part(b)];
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] || 0) - (y[i] || 0);
    if (d) return d > 0 ? 1 : -1;
  }
  const pre = (v) => String(v).includes('-');
  if (pre(a) && !pre(b)) return -1;
  if (!pre(a) && pre(b)) return 1;
  return 0;
}

const readState = () => {
  try { return JSON.parse(readFileSync(STATE, 'utf8')); } catch { return {}; }
};

const writeState = (s) => {
  try {
    mkdirSync(dirname(STATE), { recursive: true });
    writeFileSync(STATE, JSON.stringify(s), 'utf8');
  } catch { /* a cache that cannot be written is not worth an error */ }
};

/**
 * Returns the newer version, or null. Never throws.
 * `force` skips the once-a-day cache (used by the tests).
 */
export async function latestVersion({ force = false, timeoutMs = 2000 } = {}) {
  const now = Date.now();
  const state = readState();
  if (!force && state.checkedAt && now - state.checkedAt < DAY) return state.latest || null;

  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeoutMs);
  try {
    // The abbreviated metadata document: a few KB instead of every version's
    // full manifest, which for a package with many releases is megabytes.
    const r = await fetch('https://registry.npmjs.org/uisight', {
      headers: { accept: 'application/vnd.npm.install-v1+json' },
      signal: c.signal,
    });
    if (!r.ok) return null;
    const body = await r.json();
    const latest = body?.['dist-tags']?.latest || null;
    writeState({ checkedAt: now, latest });
    return latest;
  } catch {
    // Offline, blocked, slow, rate-limited — all the same answer: say nothing.
    writeState({ ...state, checkedAt: now });
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** The notice text, or null when there is nothing to say. Pure — easy to test. */
export function updateNotice(current, latest) {
  if (!current || !latest) return null;
  if (compareVersions(latest, current) <= 0) return null;
  return `uisight ${latest} is out (you have ${current}) — npx uisight@latest, `
    + `or npm i -g uisight@latest. Silence this with NO_UPDATE_NOTIFIER=1.`;
}

/**
 * The same news, written for the assistant instead of the terminal.
 *
 * stderr is the right channel for a CLI run, where a person is watching. Under
 * MCP it is the wrong one: the client sends server stderr to a log file, so the
 * model never sees it and cannot offer to update anything. This text goes into
 * the `status` tool's output, which the model does read.
 *
 * It carries the fix as well as the fact, including the part that silently
 * fails: updating the package does not restart the server already running.
 */
export function agentUpdateNotice(current, latest) {
  if (!updateNotice(current, latest)) return null;
  return [
    '',
    `NOTE: uisight ${latest} is available (this server is ${current}).`,
    '  Tell the person, and offer to run it for them:',
    '    npx:    npx uisight@latest            (or nothing — npx already resolves latest)',
    '    global: npm i -g uisight@latest',
    '  Then RESTART the editor or MCP session. Updating the package does not',
    '  restart the server already running, so the old one keeps answering.',
  ].join('\n');
}

/**
 * Checks in the background and writes one line to STDERR if there is news.
 * Callers do not await it: the run should not wait on the network.
 */
export function checkForUpdate() {
  if (process.env.NO_UPDATE_NOTIFIER || process.env.CI) return;
  const current = currentVersion();
  if (!current) return;
  latestVersion()
    .then((latest) => {
      const note = updateNotice(current, latest);
      if (note) process.stderr.write(`\n${note}\n`);   // stdout belongs to JSON-RPC
    })
    .catch(() => {});
}
