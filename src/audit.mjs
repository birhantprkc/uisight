#!/usr/bin/env node
/**
 * uisight-audit — sign in, walk every role, measure every page.
 *
 * Auditing the public pages only means never looking at the half of the app
 * people actually live in. Of four real bugs a person found by hand, three were
 * behind a login, and one of those showed up only for a single role.
 *
 * Drives the live panel over HTTP, so the frame stream and the MCP tools keep
 * seeing the same session while this runs.
 *
 * Usage:
 *   uisight-audit                            # port 5055, all configured roles
 *   uisight-audit --pages 12                 # cap per role (default 10)
 *   uisight-audit --roles guide,agency       # only these
 *   uisight-audit --port 5061
 *
 * Accounts and roles live in ~/.uisight/accounts.json — see login.mjs.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { checkPort } from './login.mjs';

const argv = process.argv.slice(2);

// Without this, `uisight-audit --help` silently ignored the flag and started a
// real sign-in against whatever panel happened to be on 5055.
if (argv.includes('--help') || argv.includes('-h')) {
  console.log(`uisight-audit - sign in, walk every role, measure every page.

  uisight-audit                      every configured role, 10 pages each
  uisight-audit --pages 12           pages per role
  uisight-audit --roles guide,agency only these roles
  uisight-audit --port 5061          panel to drive (default 5055)

Accounts and roles live in ~/.uisight/accounts.json.
A panel must be running: npx -y -p uisight uisight-panel <url>`);
  process.exit(0);
}
if (argv.includes('--version') || argv.includes('-v')) {
  const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  console.log(version);
  process.exit(0);
}

const arg = (name, fallback) => { const i = argv.indexOf(name); return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback; };
const PORT = Number(arg('--port', 5055));
const MAX_PAGES = Number(arg('--pages', 10));
const ROLES = arg('--roles', '').split(',').map((s) => s.trim()).filter(Boolean);
checkPort(PORT);
const BASE = `http://127.0.0.1:${PORT}`;

const token = () => {
  try { return readFileSync(join(homedir(), '.uisight', 'live', `token-${PORT}`), 'utf8').trim(); } catch { return ''; }
};

async function act(body, ms = 120000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(`${BASE}/action`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-uisight-token': token() },
      body: JSON.stringify(body),
      signal: c.signal,
    });
    return await r.json();
  } finally { clearTimeout(t); }
}
const state = async () => (await fetch(`${BASE}/state`)).json();

const n = (a) => (a || []).length;
/** Every finding type counts. A new check that is not added here makes the total lie. */
const summarise = (d) => ({
  invisible: n(d.invisibleText), contrast: n(d.lowContrast), buttons: n(d.buttonIssues),
  touch44: n(d.smallTargets), tiny: n(d.tinyText), noAlt: d.imagesWithoutAlt || 0,
  covered: n(d.coveredControls), clipped: n(d.clippedText), underBar: n(d.coveredByFixed),
  sameLook: n(d.sameLookingActions), darkPatch: n(d.darkModeLightPatches),
  mixedLang: n(d.mixedLanguage), usDate: n(d.usDates), notch: n(d.unsafeArea),
  vagueError: n(d.genericErrors), noConfirm: n(d.destructiveWithoutConfirm),
  clippedBox: n(d.clippedContainer), emptyLoading: n(d.loadingButEmpty),
  textHidden: n(d.textUnderControl),
  eagerPerm: n(d.eagerPermissions),
  overflow: d.horizontalOverflow ? 1 : 0,
});
const total = (o) => Object.values(o).reduce((a, b) => a + b, 0);

/**
 * Paths already measured under an earlier role.
 *
 * A second role re-crawling the same public pages spends its whole page budget
 * on ground already covered: the first run gave 6 pages per role and 4 of them
 * were the same public pages twice. Unseen paths go first, so the budget buys
 * new screens. Shared pages are still measured (a page CAN render differently
 * per role) — just last.
 */
const seenPaths = new Set();

async function walkRole(role) {
  if (role) {
    const r = await act({ type: 'role', session: 'mobile', role });
    if (!r.ok) { console.log(`  could not switch to ${role}: ${r.message}`); return []; }
    console.log(`\n=== role: ${role} ===`);
  }
  const s0 = await state();
  const root = new URL(s0.url).origin;
  const queue = [s0.url];
  const seen = new Set();
  const rows = [];

  while (queue.length && rows.length < MAX_PAGES) {
    const fresh = queue.findIndex((u) => !seenPaths.has(new URL(u).pathname));
    const url = queue.splice(fresh >= 0 ? fresh : 0, 1)[0];
    if (seen.has(url)) continue;
    seen.add(url);

    const go = await act({ type: 'goto', url });
    if (!go.ok) { console.log(`  !!  ${url}: ${go.message}`); continue; }
    await new Promise((r) => setTimeout(r, 2200));

    const ins = await act({ type: 'inspect', session: 'mobile' });
    const first = (ins.results || [])[0];
    if (!first?.inspection) { console.log(`  !!  ${url}: no measurement`); continue; }

    const o = summarise(first.inspection);
    const path = new URL(url).pathname;
    seenPaths.add(path);
    rows.push({ role: role || '(anonymous)', path, url, ...o, total: total(o),
      coveredList: (first.inspection.coveredControls || []).map((x) => `"${x.text}" ${x.percent}% under "${x.coveredByText}"`),
      underBarList: (first.inspection.coveredByFixed || []).map((x) => `"${x.text}" ${x.percent}%`),
      sameLookList: (first.inspection.sameLookingActions || []).map((x) => x.labels.join(' / ')) });
    console.log(`  ok  ${path.padEnd(28)} ${String(total(o)).padStart(3)} findings`
      + (o.covered ? `  COVERED:${o.covered}` : '') + (o.sameLook ? `  SAMELOOK:${o.sameLook}` : ''));

    const links = await act({ type: 'links', session: 'mobile', root }, 30000).catch(() => null);
    for (const l of links?.links || []) if (!seen.has(l) && !queue.includes(l)) queue.push(l);
  }

  // Form screens differ per role, so the keyboard audit runs per role too.
  const kb = await act({ type: 'keyboard-audit', session: 'mobile' });
  const found = (kb.results || [])[0]?.findings || [];
  if (found.length) console.log(`  keyboard: ${found.length} under the keyboard`);

  // These two cannot be measured by looking at a page: the network has to
  // actually drop, and the back button has to actually be pressed. Once per
  // role, not per page — the behaviour is the app's, not the screen's.
  const off = await act({ type: 'offline-audit', session: 'mobile' });
  // A page with no service worker cannot answer offline, and saying so would be
  // noise. `expected` marks that case.
  const offline = ((off.results || [])[0]?.findings || []).filter((f) => !f.expected);
  for (const f of offline) console.log(`  offline: ${f.note}`);

  const bk = await act({ type: 'back-audit', session: 'mobile' });
  const back = (bk.results || [])[0]?.findings || [];
  for (const f of back) console.log(`  back button: ${f.note}`);

  return rows.map((r) => ({
    ...r, keyboard: found.length,
    offline: offline.map((f) => f.note),
    back: back.map((f) => f.note),
  }));
}

// --- run ---
const login = await act({ type: 'login', session: 'mobile' });
if (!login.ok) {
  console.error('sign-in failed:', JSON.stringify(login.result || login));
  console.error('check ~/.uisight/accounts.json');
  process.exit(1);
}
console.log(`signed in (${login.result.route}) -> ${login.result.message}`);
if (login.result.matched) console.log(`  account entry: ${login.result.matched}${login.result.label ? ' (' + login.result.label + ')' : ''}`);

const s = await state();
const roles = ROLES.length ? ROLES : (s.accounts?.length ? s.accounts : [null]);
const all = [];
for (const role of roles) all.push(...await walkRole(role));

const out = join(process.cwd(), 'uisight-outputs', 'audit-' + new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16));
mkdirSync(out, { recursive: true });

const md = ['# uisight audit — signed in, by role', '',
  `- ${new Date().toISOString().slice(0, 19)} UTC`,
  `- roles: ${roles.map((r) => r || 'anonymous').join(', ')} · pages: ${all.length}`, '',
  '| role | page | findings | contrast | buttons | 44px | covered | under bar | same look |',
  '|---|---|---|---|---|---|---|---|---|'];
for (const r of all) {
  md.push(`| ${r.role} | ${r.path} | **${r.total}** | ${r.contrast} | ${r.buttons} | ${r.touch44} | ${r.covered} | ${r.underBar} | ${r.sameLook} |`);
}
for (const r of all) {
  if (!r.coveredList.length && !r.underBarList.length && !r.sameLookList.length) continue;
  md.push('', `## ${r.role} · ${r.path}`);
  for (const x of r.coveredList) md.push(`- COVERED: ${x}`);
  for (const x of r.underBarList) md.push(`- UNDER A FIXED BAR: ${x}`);
  for (const x of r.sameLookList) md.push(`- NO PRIMARY ACTION: ${x}`);
}
// Davranis ROL basina bir kez olculuyor ama her sayfa satirina kopyalaniyor.
// Satirlar uzerinden donmek tek bulguyu sayfa sayisi kadar cogaltiyordu: alti
// sayfalik bir kosumda tek bir cevrimdisi bulgusu bes kez yazildi. Bugun aracin
// KENDI sayilarini sisiren bir hatayi duzelttik; ayni sey rapor yazicisinda
// duruyormus. Rol basina TEK satir.
const gorulen = new Set();
const davranis = [];
for (const r of all) {
  for (const x of r.offline || []) {
    const k = `${r.role}|OFFLINE|${x}`;
    if (!gorulen.has(k)) { gorulen.add(k); davranis.push(`- ${r.role} · OFFLINE: ${x}`); }
  }
  for (const x of r.back || []) {
    const k = `${r.role}|BACK|${x}`;
    if (!gorulen.has(k)) { gorulen.add(k); davranis.push(`- ${r.role} · BACK BUTTON: ${x}`); }
  }
}
if (davranis.length) {
  md.push('', '## Behaviour (measured once per role, not per page)');
  md.push(...davranis);
}

md.push('', '> Automated checks cannot see design mistakes — look at the panel too.');
writeFileSync(join(out, 'REPORT.md'), md.join('\n'), 'utf8');
writeFileSync(join(out, 'report.json'), JSON.stringify(all, null, 2), 'utf8');
console.log(`\nReport: ${join(out, 'REPORT.md')}`);
