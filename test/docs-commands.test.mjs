/**
 * `uisight-mcp`, `uisight-panel` and `uisight-audit` are bin names inside the
 * `uisight` package — they are not packages. `npx -y uisight-mcp` therefore
 * fails with E404, and the README told every new user to run exactly that as
 * the way to register the MCP server.
 *
 * It is also a supply-chain trap: the docs point at a name nobody owns, so
 * whoever publishes it runs code on the machine of anyone following them.
 *
 * This reads the commands out of the docs and checks each one names a package
 * that actually exists.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const BINS = Object.keys(pkg.bin);          // uisight, uisight-panel, uisight-mcp, uisight-audit
const PAKET = pkg.name;                      // the only one npm can resolve
const ALT_BINLER = BINS.filter((b) => b !== PAKET);

const DOSYALAR = ['README.md', 'README.tr.md', 'smithery.yaml', 'src/mcp.mjs', 'extension/README.md'];

test('no doc tells anyone to npx a package that does not exist', () => {
  for (const d of DOSYALAR) {
    const metin = readFileSync(join(root, d), 'utf8');
    for (const [, satir] of metin.matchAll(/(npx [^\n`"]*)/g)) {
      const parcalar = satir.trim().split(/\s+/).slice(1);
      // Which token is the package? The first one that is not a flag or a
      // flag's value; `-p <name>` names it outright.
      const p = parcalar.indexOf('-p') >= 0 ? parcalar[parcalar.indexOf('-p') + 1]
              : parcalar.find((x) => !x.startsWith('-'));
      if (!p) continue;
      const ad = p.replace(/@[^@/]*$/, '');   // uisight@latest -> uisight
      assert.ok(
        !ALT_BINLER.includes(ad),
        `${d}: "${satir.trim()}" names the bin ${ad}, which is not a package — use "npx -y -p ${PAKET} ${ad}"`,
      );
    }
  }
});

test('the Smithery listing starts the server the same way the docs do', () => {
  const y = readFileSync(join(root, 'smithery.yaml'), 'utf8');
  const args = /args:\s*\[([^\]]+)\]/.exec(y)?.[1] || '';
  const parcalar = args.split(',').map((s) => s.trim().replace(/^'|'$/g, ''));
  const p = parcalar[parcalar.indexOf('-p') + 1];
  assert.equal(p, PAKET, `Smithery would run "npx ${parcalar.join(' ')}" — that package does not exist`);
});
