/**
 * The multi-path run, and a bug that quietly multiplied its own numbers.
 *
 * Listeners were attached inside the path loop and never removed. Each one
 * closed over its own record, so loading page N fired N listeners and wrote the
 * same event into every earlier record. The signature in the field was a perfect
 * descending staircase — twelve pages with two real errors each reported as
 * `22, 20, 18 … 2`. The first page looked eleven times worse than it was, and
 * whoever read the report went looking for a crisis on the home page.
 *
 * It cannot be caught by reading the output, because every number is plausible.
 * So it is pinned here structurally.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cli = readFileSync(join(root, 'src', 'cli.mjs'), 'utf8');

/** The body of the `for (const path of o.path)` loop. */
function pathLoop() {
  const start = cli.indexOf('for (const path of o.path) {');
  assert.ok(start > 0, 'the path loop must exist');
  let depth = 0;
  let i = cli.indexOf('{', start);
  const from = i;
  for (; i < cli.length; i++) {
    if (cli[i] === '{') depth++;
    else if (cli[i] === '}') { depth--; if (depth === 0) break; }
  }
  return cli.slice(from, i + 1);
}

test('every listener attached inside the path loop is removed inside it', () => {
  const loop = pathLoop();
  const attached = [...loop.matchAll(/page\.on\(|\bon\((['"])(pageerror|console|response)\1/g)].length;
  if (!attached) return;                       // hiç eklenmiyorsa sorun yok
  assert.match(loop, /page\.off\(/, 'a listener added per path must be removed per path');
});

test('the removal runs even when the page fails to load', () => {
  const loop = pathLoop();
  const off = loop.indexOf('page.off(');
  assert.ok(off > 0, 'removal must exist');
  const finallyAt = loop.lastIndexOf('finally', off);
  const catchAt = loop.lastIndexOf('catch', off);
  assert.ok(finallyAt > catchAt,
    'removal must sit in finally — a page that throws would otherwise leak its listener');
});

test('listeners are named, not inline, so they CAN be removed', () => {
  const loop = pathLoop();
  // page.on('x', () => …) with no reference kept is unremovable by definition.
  const anonim = [...loop.matchAll(/page\.on\((['"])[a-z]+\1,\s*(\(|async)/g)].length;
  assert.equal(anonim, 0, 'an inline handler cannot be passed to page.off later');
});

test('a Windows path that Git Bash rewrote is refused, not scanned as a URL', () => {
  // MSYS turns a bare "/" inside --path into C:/Program Files/Git. The tool used
  // to treat that as a path, produce C-Program-Files-Git__pixel__dark.png, and
  // never scan the home page — silently.
  assert.match(cli, /looks like a Windows file path/, 'the rewrite must be named');
  assert.match(cli, /MSYS_NO_PATHCONV/, 'and the way out must be given');
});
