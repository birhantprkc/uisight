/**
 * Getting a browser onto the machine, the first time.
 *
 * Playwright's npm package carries no install hook, so a fresh `npx uisight`
 * arrives with the driver and nothing to drive. Telling people to run one
 * command works, but it is a wall in front of the first thing they ever try.
 *
 * So: ask, then fetch. Only where asking makes sense — a real terminal, not
 * CI, not a server a host started for an agent. Nobody's build should pull
 * 150 MB because a config file mentioned this tool.
 */
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline';

/** Which of these engines are not on disk. */
export function missingEngines(engines, playwright) {
  const eksik = [];
  for (const ad of new Set(engines)) {
    try {
      const yol = playwright[ad]?.executablePath?.();
      if (!yol || !existsSync(yol)) eksik.push(ad);
    } catch { eksik.push(ad); }
  }
  return eksik;
}

/**
 * Is there a person here to ask?
 *
 * `CI` covers the usual runners. The panel and the MCP server are usually
 * started by an editor or an agent host with no terminal attached, and that is
 * exactly where a 150 MB download with a question nobody sees would hang.
 */
export function canAsk(env = process.env, stdin = process.stdin, stdout = process.stdout) {
  if (env.CI || env.UISIGHT_NO_INSTALL) return false;
  return Boolean(stdin?.isTTY && stdout?.isTTY);
}

/** The `playwright install` command, resolved rather than guessed. */
export function installCommand(engines, require_ = createRequire(import.meta.url)) {
  const pkgYolu = require_.resolve('playwright/package.json');
  const pkg = require_(pkgYolu);
  const bin = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin.playwright;
  return { cmd: process.execPath, args: [join(dirname(pkgYolu), bin), 'install', ...engines], version: pkg.version };
}

async function sor(soru) {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  try {
    const cevap = await new Promise((c) => rl.question(soru, c));
    return !/^n/i.test(cevap.trim());
  } finally { rl.close(); }
}

/**
 * Offer to download what is missing. Returns true if the engines are there
 * afterwards; false means the caller should fall back to explaining.
 *
 * Playwright's own output is inherited rather than captured: a download this
 * long must show its own progress, or the first run looks like a hang.
 */
export async function offerInstall(engines, playwright, { ask = sor } = {}) {
  const eksik = missingEngines(engines, playwright);
  if (!eksik.length) return true;
  if (!canAsk()) return false;

  let komut;
  try { komut = installCommand(eksik); } catch { return false; }

  const boyut = eksik.length > 1 ? '~300 MB' : '~150 MB';
  const evet = await ask(`  ${eksik.join(' and ')} ${eksik.length > 1 ? 'are' : 'is'} not downloaded yet (${boyut}, once). Fetch now? [Y/n] `);
  if (!evet) return false;

  process.stderr.write(`\n  playwright ${komut.version} install ${eksik.join(' ')}\n\n`);
  const kod = await new Promise((c) => {
    const p = spawn(komut.cmd, komut.args, { stdio: ['ignore', 'inherit', 'inherit'] });
    p.on('error', () => c(1));
    p.on('close', c);
  });
  if (kod !== 0) return false;
  return missingEngines(eksik, playwright).length === 0;
}
