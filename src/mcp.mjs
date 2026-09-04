#!/usr/bin/env node
/**
 * uisight — MCP server (the AI's doorway).
 *
 * Lets Claude Code / Cursor / Antigravity SEE the live sessions (see_screen),
 * MEASURE them (inspect: contrast, touch targets, overflow — returned as text),
 * DRIVE them (goto/tap/type_text/scroll) and READ the user's pinned marks
 * from the panel (marks — the human→AI channel).
 *
 * Starts the panel server (server.mjs) automatically if it is not running.
 *
 * Register (Claude Code):
 *   claude mcp add --scope user uisight -- npx -y uisight-mcp
 *
 * Env: UISIGHT_PORT (default 5055) · UISIGHT_URL (initial target, default http://localhost:3000)
 *      UISIGHT_LANG=tr → tool names/descriptions in Turkish (ekrani_gor, denetle, ...)
 *
 * NOTE: stdio transport — stdout belongs to JSON-RPC; all logging goes to stderr.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)));
const PORT = Number(process.env.UISIGHT_PORT || process.env.MOBILQA_PORT || 5055);
const BASE = `http://127.0.0.1:${PORT}`;
const TR = (process.env.UISIGHT_LANG || '').toLowerCase() === 'tr';
const log = (...a) => console.error('[uisight-mcp]', ...a);

// Public session names → server-internal ids.
const SESSION_MAP = { desktop: 'web', mobile: 'mobile', web: 'web' };
const sid = (s) => SESSION_MAP[s] || 'mobile';

// --- HTTP helpers ---
async function req(path, opts = {}, timeoutMs = 15000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(BASE + path, { ...opts, signal: ctrl.signal });
  } finally { clearTimeout(t); }
}
const getStatus = async (ms = 2000) => (await req('/state', {}, ms)).json();

// The panel demands a token on mutating endpoints (CSRF guard). It lives in a per-port
// local file and is re-read on every call (it changes when the panel restarts).
const tokenOku = () => {
  try { return readFileSync(join(homedir(), '.uisight', 'live', `token-${PORT}`), 'utf8').trim(); } catch { return ''; }
};
async function action(body) {
  const r = await req('/action', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-uisight-token': tokenOku() },
    body: JSON.stringify(body),
  }, 30000);
  return r.json();
}

// --- Engine lifecycle: ready = server responds AND at least one session is up ---
const isReady = async (ms) => {
  const d = await getStatus(ms);
  return !!d?.sessions?.length;
};
let child = null;
async function ensureEngine() {
  try { if (await isReady(1500)) return; } catch {}
  // Restart the panel if it went away: a one-shot flag used to leave the tool permanently
  // dead after a crash. No shell:true — the argv array is passed through safely by Node
  // (a shell would turn UISIGHT_URL into an injection surface).
  if (!child || child.exitCode !== null || child.killed) {
    const url = process.env.UISIGHT_URL || process.env.MOBILQA_URL || 'http://localhost:3000';
    log(`panel not running on ${PORT} — starting (${url})`);
    child = spawn(process.execPath, [join(ROOT, 'server.mjs'), url, '--no-open'], {
      cwd: ROOT, windowsHide: true, detached: true, stdio: 'ignore',
    });
    child.on('error', (e) => log(`spawn failed: ${e.message}`));
    child.unref();
  }
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    try { if (await isReady(1500)) return; } catch {}
  }
  throw new Error(`panel server did not start on port ${PORT} — try manually: node ${join(ROOT, 'server.mjs')} <url>`);
}

const text = (s) => ({ type: 'text', text: typeof s === 'string' ? s : JSON.stringify(s, null, 1) });
const image = (b64) => ({ type: 'image', data: b64, mimeType: 'image/jpeg' });

/** Compact text rendering of inspection results — the heart of token savings. */
function inspectionText(results) {
  const out = [];
  for (const s of results) {
    if (s.error) { out.push(`[${s.session}] INSPECTION ERROR: ${s.error}`); continue; }
    const d = s.inspection || {};
    out.push(`\n[${s.session} · ${s.label} · ${s.theme}] ${s.url}`);
    if (d.horizontalOverflow) {
      out.push(`  HORIZONTAL OVERFLOW: page ${d.horizontalOverflow.pageWidth}px / viewport ${d.horizontalOverflow.viewportWidth}px`);
      for (const x of (d.horizontalOverflow.overflowing || []).slice(0, 4)) out.push(`    <${x.label} class="${x.className}"> right edge ${x.right}px`);
    }
    for (const x of d.invisibleText || []) out.push(`  INVISIBLE TEXT ${x.ratio}:1 — ${x.sel} "${x.text}" (text ${x.color} / bg ${x.bg})`);
    for (const x of d.lowContrast || []) out.push(`  low contrast ${x.ratio}:1 (threshold ${x.threshold}) ${x.fontSize} — "${x.text}"`);
    for (const x of d.buttonIssues || []) out.push(`  BUTTON ${x.sel} "${x.text}" → ${x.issues.join(' · ')}`);
    for (const x of d.coveredControls || []) out.push(`  COVERED ${x.sel} "${x.text}" ${x.size} — ${x.percent}% under ${x.coveredBy} "${x.coveredByText}"`);
    for (const x of d.coveredByFixed || []) out.push(`  UNDER FIXED BAR ${x.sel} "${x.text}" — ${x.percent}% behind ${x.bar}`);
    for (const x of d.clippedText || []) out.push(`  CLIPPED ${x.sel} "${x.text}" — ${x.hiddenPx}px hidden (${x.axis})`);
    for (const x of (d.smallTargets || []).slice(0, 8)) out.push(`  touch target below 44px ${x.size} — "${x.text}"`);
    if (d.tinyText?.length) out.push(`  text below 12px (${d.tinyText.length}): ` + d.tinyText.map((m) => `${m.fontSize} "${m.text}"`).join(' · '));
    if (d.imagesWithoutAlt) out.push(`  images without alt: ${d.imagesWithoutAlt}`);
    // A "clean" claim must cover EVERY finding type. When a new check is added and
    // this list is not, the tool prints "clean" directly under its own findings.
    const clean = !d.horizontalOverflow && !d.invisibleText?.length && !d.lowContrast?.length
      && !d.buttonIssues?.length && !d.smallTargets?.length && !d.tinyText?.length
      && !d.coveredControls?.length && !d.clippedText?.length && !d.coveredByFixed?.length;
    if (clean) out.push('  automated checks clean (use see_screen for design issues the numbers cannot catch)');
  }
  return out.join('\n');
}

// --- Server + bilingual tool registration ---
// Read the version from package.json — a hard-coded value went stale on every release.
const SURUM = (() => {
  try { return JSON.parse(readFileSync(join(ROOT, '..', 'package.json'), 'utf8')).version; } catch { return '0.0.0'; }
})();
const server = new McpServer({ name: 'uisight', version: SURUM });

// Bu aciklama DOKUZ araca da kopyalanir; kisa olmasi dokuz kat kazandirir.
const SESSION = z.enum(['desktop', 'mobile']).optional().describe('Default: mobile');

/** Registers a tool under its EN name, or TR name when UISIGHT_LANG=tr. */
function tool(enName, trName, enDesc, trDesc, schema, handler) {
  server.registerTool(TR ? trName : enName, { description: TR ? trDesc : enDesc, inputSchema: schema }, handler);
}

tool('see_screen', 'ekrani_gor',
  'Screenshot of the live session (~460 tokens). Prefer inspect for measurable problems.',
  'Canli oturumun ekran goruntusu (~460 token). Olculebilir sorunlar icin inspect.',
  { session: SESSION, full: z.boolean().optional().describe('Full page, costlier') },
  async ({ session, full }) => {
    await ensureEngine();
    const r = await req(`/frame?session=${sid(session)}${full ? '&full=1' : ''}`, {}, 30000);
    if (!r.ok) return { content: [text(`could not capture frame: HTTP ${r.status}`)], isError: true };
    const b64 = Buffer.from(await r.arrayBuffer()).toString('base64');
    const d = await getStatus().catch(() => null);
    const o = d?.sessions?.find((x) => x.id === sid(session));
    return { content: [image(b64), text(`${o?.label || session || 'mobile'} · ${d?.theme} · ${d?.url}`)] };
  });

tool('inspect', 'denetle',
  'Runs color/contrast/theme/button/overflow checks on the open page; returns MEASURED findings as text (cheaper and more precise than images). Without session, inspects ALL sessions.',
  'Acik sayfada color/contrast/theme/buton/tasma denetimi kosar; OLCULMUS bulgulari text olarak dondurur. session verilmezse TUM sessions denetlenir.',
  { session: SESSION },
  async ({ session }) => {
    await ensureEngine();
    const r = await action({ type: 'inspect', ...(session ? { session: sid(session) } : {}) });
    if (!r.ok) return { content: [text(`inspection failed: ${r.message}`)], isError: true };
    return { content: [text(inspectionText(r.results))] };
  });

tool('goto', 'git',
  'Navigates ALL sessions to the given URL (URL-synced). localhost included.',
  'TUM oturumlari verilen adrese goturur (URL-senkron). localhost dahil.',
  { url: z.string().describe('URL to open') },
  async ({ url }) => {
    await ensureEngine();
    const r = await action({ type: 'goto', url });
    const d = await getStatus().catch(() => null);
    return { content: [text(r.ok ? `navigated: ${d?.url || url}` : `error: ${r.message}`)], ...(r.ok ? {} : { isError: true }) };
  });

tool('tap', 'tikla',
  'Tap by CSS selector (preferred) or x/y CSS pixels.',
  'CSS secici (tercih) ya da x/y CSS pikseliyle dokunur.',
  { session: SESSION, selector: z.string().optional().describe('CSS selector'),
    x: z.number().optional().describe('CSS px, only without selector'),
    y: z.number().optional().describe('CSS px, only without selector') },
  async ({ session, selector, x, y }) => {
    await ensureEngine();
    const r = await action({ type: 'click', session: session ? sid(session) : undefined, selector: selector, x, y });
    return { content: [text(r.ok ? `tapped (${r.session})` : `error: ${r.message}`)], ...(r.ok ? {} : { isError: true }) };
  });

tool('type_text', 'yaz',
  'Type into the focused field, or press one key.',
  'Odaklanmis alana yazar ya da tek tusa basar.',
  { session: SESSION, text: z.string().optional().describe('Text to type'),
    key: z.string().optional().describe('Enter | Tab | Escape | Backspace | ArrowDown') },
  async ({ session, text: t, key }) => {
    await ensureEngine();
    const r = await action({ type: 'press', session: session ? sid(session) : undefined, text: t, key });
    return { content: [text(r.ok ? 'typed' : `error: ${r.message}`)], ...(r.ok ? {} : { isError: true }) };
  });

tool('scroll', 'kaydir',
  'Scrolls the page vertically. dy>0 down, dy<0 up (pixels).',
  'Sayfayi dikey kaydirir. dy>0 asagi, dy<0 yukari (piksel).',
  { session: SESSION, dy: z.number().describe('Scroll amount in px') },
  async ({ session, dy }) => {
    await ensureEngine();
    const r = await action({ type: 'scroll', session: session ? sid(session) : undefined, dy });
    return { content: [text(r.ok ? `scrolled ${dy}px (${r.session})` : `error: ${r.message}`)], ...(r.ok ? {} : { isError: true }) };
  });

tool('set_device', 'cihaz_degistir',
  "Changes a session's device profile and/or the color theme. Profiles: iphone-15, iphone-se, pixel, galaxy, ipad, desktop, laptop. theme: light|dark (without session, theme applies to ALL sessions).",
  'Oturumun cihaz profilini ve/veya temayi degistirir.',
  { session: SESSION,
    device: z.string().optional().describe('iphone-15|iphone-se|pixel|galaxy|ipad|desktop|laptop'),
    theme: z.enum(['light', 'dark']).optional().describe('Without session: all') },
  async ({ session, device, theme }) => {
    await ensureEngine();
    const r = await action({ type: 'device', session: session ? sid(session) : undefined, device: device, theme: theme });
    const d = await getStatus().catch(() => null);
    return { content: [text(r.ok ? `done — sessions: ${d?.sessions?.map((o) => `${o.id}=${o.device}`).join(', ')} · theme=${d?.theme}` : `error: ${r.message}`)], ...(r.ok ? {} : { isError: true }) };
  });

tool('status', 'durum',
  'Returns the open URL, sessions (device+viewport) and recent console/network/mark records. FIRST tool to reach for when hunting a bug.',
  'Acik adresi, oturumlari ve son konsol/ag/isaret kayitlarini dondurur.',
  {},
  async () => {
    await ensureEngine();
    const d = await getStatus();
    const out = [`url: ${d.url}`, `theme: ${d.theme}${d.error ? `\nPAGE ERROR: ${d.error}` : ''}`];
    for (const o of d.sessions) out.push(`session ${o.id}: ${o.label} (${o.viewport.width}x${o.viewport.height})`);
    const recs = (d.records || []).slice(-20);
    if (recs.length) {
      out.push('\nrecent records (console/network/marks):');
      for (const k of recs) out.push(`  [${k.session}] ${k.type}: ${k.message}`);
    } else out.push('no records (console/network clean)');
    return { content: [text(out.join('\n'))] };
  });

tool('marks', 'isaretler',
  'Notes the user pinned in the panel, with the frame at that moment.',
  'Kullanicinin panelde biraktigi notlar + o anki kare.',
  { clear: z.boolean().optional().describe('Drop returned marks from the queue (default true)') },
  async ({ clear }) => {
    await ensureEngine();
    const r = await req(`/marks${clear === false ? '' : '?clear=1'}`, {}, 10000);
    const { marks } = await r.json();
    if (!marks.length) return { content: [text('no pending marks')] };
    const content = [];
    const lines = [`${marks.length} mark(s):`];
    for (const i of marks) lines.push(`- [${i.time}] ${i.session}/${i.device} ${i.theme} ${i.url}\n  note: ${i.note || '(empty)'}`);
    content.push(text(lines.join('\n')));
    try {
      const last = marks[marks.length - 1];
      content.push(image(readFileSync(last.imagePath).toString('base64')));
    } catch {}
    return { content };
  });

// --- Start ---
const transport = new StdioServerTransport();
await server.connect(transport);
log(`ready — panel: ${BASE}${TR ? ' (lang=tr)' : ''}`);
