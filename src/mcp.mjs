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
const SESSION_MAP = { desktop: 'web', mobile: 'mobil', web: 'web', mobil: 'mobil' };
const sid = (s) => SESSION_MAP[s] || 'mobil';

// --- HTTP helpers ---
async function req(path, opts = {}, timeoutMs = 15000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    return await fetch(BASE + path, { ...opts, signal: ac.signal });
  } finally { clearTimeout(t); }
}
const getStatus = async (ms = 2000) => (await req('/durum', {}, ms)).json();

// Panel, mutasyon uclari icin token ister (CSRF kesici). Token port basina yerel
// dosyada; her cagride taze okunur (panel yeniden basladiginda token degisir).
const tokenOku = () => {
  try { return readFileSync(join(homedir(), '.uisight', 'live', `token-${PORT}`), 'utf8').trim(); } catch { return ''; }
};
async function action(body) {
  const r = await req('/eylem', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-uisight-token': tokenOku() },
    body: JSON.stringify(body),
  }, 30000);
  return r.json();
}

// --- Engine lifecycle: ready = server responds AND at least one session is up ---
const isReady = async (ms) => {
  const d = await getStatus(ms);
  return !!d?.oturumlar?.length;
};
let child = null;
async function ensureEngine() {
  try { if (await isReady(1500)) return; } catch {}
  // Panel kapandiysa YENIDEN baslat: tek-seferlik bayrak, cokme sonrasi araci
  // kalici olarak olu birakiyordu. shell:true YOK — argv dizisi Node tarafindan
  // guvenli gecirilir (shell'de UISIGHT_URL enjeksiyon yuzeyi acardi).
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
    if (s.hata) { out.push(`[${s.oturum}] INSPECTION ERROR: ${s.hata}`); continue; }
    const d = s.denetim || {};
    out.push(`\n[${s.oturum} · ${s.etiket} · ${s.tema}] ${s.url}`);
    if (d.yatayTasma) {
      out.push(`  HORIZONTAL OVERFLOW: page ${d.yatayTasma.sayfaGenislik}px / viewport ${d.yatayTasma.ekranGenislik}px`);
      for (const x of (d.yatayTasma.tasan || []).slice(0, 4)) out.push(`    <${x.etiket} class="${x.sinif}"> right edge ${x.sag}px`);
    }
    for (const x of d.gorunmezMetin || []) out.push(`  INVISIBLE TEXT ${x.oran}:1 — ${x.sec} "${x.metin}" (text ${x.renk} / bg ${x.arka})`);
    for (const x of d.dusukKontrast || []) out.push(`  low contrast ${x.oran}:1 (threshold ${x.esik}) ${x.boyut} — "${x.metin}"`);
    for (const x of d.butonSorun || []) out.push(`  BUTTON ${x.sec} "${x.metin}" → ${x.sorunlar.join(' · ')}`);
    for (const x of (d.kucukHedefler || []).slice(0, 8)) out.push(`  touch target below 44px ${x.olcu} — "${x.metin}"`);
    if (d.minikYazi?.length) out.push(`  text below 12px (${d.minikYazi.length}): ` + d.minikYazi.map((m) => `${m.boyut} "${m.metin}"`).join(' · '));
    if (d.gorselAltsiz) out.push(`  images without alt: ${d.gorselAltsiz}`);
    const clean = !d.yatayTasma && !d.gorunmezMetin?.length && !d.dusukKontrast?.length && !d.butonSorun?.length && !d.kucukHedefler?.length && !d.minikYazi?.length;
    if (clean) out.push('  automated checks clean (use see_screen for design issues the numbers cannot catch)');
  }
  return out.join('\n');
}

// --- Server + bilingual tool registration ---
// Surumu package.json'dan oku — sabit-kodlu deger her yayinda bayatliyordu.
const SURUM = (() => {
  try { return JSON.parse(readFileSync(join(ROOT, '..', 'package.json'), 'utf8')).version; } catch { return '0.0.0'; }
})();
const server = new McpServer({ name: 'uisight', version: SURUM });

const SESSION = z.enum(['desktop', 'mobile', 'web', 'mobil']).optional()
  .describe(TR ? "Hedef oturum: 'desktop' (masaustu) | 'mobile' (telefon). Varsayilan: mobile" : "Target session: 'desktop' | 'mobile'. Default: mobile");

/** Registers a tool under its EN name, or TR name when UISIGHT_LANG=tr. */
function tool(enName, trName, enDesc, trDesc, schema, handler) {
  server.registerTool(TR ? trName : enName, { description: TR ? trDesc : enDesc, inputSchema: schema }, handler);
}

tool('see_screen', 'ekrani_gor',
  'Returns the current screen of the live session as an image — the EXACT same screen the user sees in the panel. full=true for full page.',
  'Canli oturumun o anki ekranini goruntu olarak dondurur. Kullanicinin panelde gordugu ekranin AYNISI. tam=true ile tam sayfa.',
  { session: SESSION, full: z.boolean().optional().describe(TR ? 'Tam sayfa (uzun, daha pahali)' : 'Full-page capture (longer, more expensive)') },
  async ({ session, full }) => {
    await ensureEngine();
    const r = await req(`/kare?oturum=${sid(session)}${full ? '&tam=1' : ''}`, {}, 30000);
    if (!r.ok) return { content: [text(`could not capture frame: HTTP ${r.status}`)], isError: true };
    const b64 = Buffer.from(await r.arrayBuffer()).toString('base64');
    const d = await getStatus().catch(() => null);
    const o = d?.oturumlar?.find((x) => x.id === sid(session));
    return { content: [image(b64), text(`${o?.etiket || session || 'mobile'} · ${d?.tema} · ${d?.url}`)] };
  });

tool('inspect', 'denetle',
  'Runs color/contrast/theme/button/overflow checks on the open page; returns MEASURED findings as text (cheaper and more precise than images). Without session, inspects ALL sessions.',
  'Acik sayfada renk/kontrast/tema/buton/tasma denetimi kosar; OLCULMUS bulgulari metin olarak dondurur. oturum verilmezse TUM oturumlar denetlenir.',
  { session: SESSION },
  async ({ session }) => {
    await ensureEngine();
    const r = await action({ tip: 'denetle', ...(session ? { oturum: sid(session) } : {}) });
    if (!r.ok) return { content: [text(`inspection failed: ${r.mesaj}`)], isError: true };
    return { content: [text(inspectionText(r.sonuclar))] };
  });

tool('goto', 'git',
  'Navigates ALL sessions to the given URL (URL-synced). localhost included.',
  'TUM oturumlari verilen adrese goturur (URL-senkron). localhost dahil.',
  { url: z.string().describe('URL to open') },
  async ({ url }) => {
    await ensureEngine();
    const r = await action({ tip: 'git', url });
    const d = await getStatus().catch(() => null);
    return { content: [text(r.ok ? `navigated: ${d?.url || url}` : `error: ${r.mesaj}`)], ...(r.ok ? {} : { isError: true }) };
  });

tool('tap', 'tikla',
  'Clicks via CSS selector or coordinates. With a selector, coordinates are not needed. The user sees it happen live in the panel.',
  'Secici (CSS) veya koordinatla tiklar. Kullanici paneli aninda gorur.',
  { session: SESSION, selector: z.string().optional().describe("CSS selector, e.g. 'a[href*=\"/login\"]' — more robust than coordinates"), x: z.number().optional(), y: z.number().optional() },
  async ({ session, selector, x, y }) => {
    await ensureEngine();
    const r = await action({ tip: 'tikla', oturum: session ? sid(session) : undefined, secici: selector, x, y });
    return { content: [text(r.ok ? `tapped (${r.oturum})` : `error: ${r.mesaj}`)], ...(r.ok ? {} : { isError: true }) };
  });

tool('type_text', 'yaz',
  'Types text into the focused field, or presses a special key (Enter, Tab, Escape, Backspace, ArrowDown...).',
  'Odaklanmis alana metin yazar veya ozel tus basar.',
  { session: SESSION, text: z.string().optional(), key: z.string().optional().describe('Special key name') },
  async ({ session, text: t, key }) => {
    await ensureEngine();
    const r = await action({ tip: 'tus', oturum: session ? sid(session) : undefined, text: t, key });
    return { content: [text(r.ok ? 'typed' : `error: ${r.mesaj}`)], ...(r.ok ? {} : { isError: true }) };
  });

tool('scroll', 'kaydir',
  'Scrolls the page vertically. dy>0 down, dy<0 up (pixels).',
  'Sayfayi dikey kaydirir. dy>0 asagi, dy<0 yukari (piksel).',
  { session: SESSION, dy: z.number().describe('Scroll amount in px') },
  async ({ session, dy }) => {
    await ensureEngine();
    const r = await action({ tip: 'kaydir', oturum: session ? sid(session) : undefined, dy });
    return { content: [text(r.ok ? `scrolled ${dy}px (${r.oturum})` : `error: ${r.mesaj}`)], ...(r.ok ? {} : { isError: true }) };
  });

tool('set_device', 'cihaz_degistir',
  "Changes a session's device profile and/or the color theme. Profiles: iphone-15, iphone-se, pixel, galaxy, ipad, desktop, laptop. theme: light|dark (without session, theme applies to ALL sessions).",
  'Oturumun cihaz profilini ve/veya temayi degistirir.',
  { session: SESSION, device: z.string().optional().describe('Profile key'), theme: z.enum(['light', 'dark']).optional() },
  async ({ session, device, theme }) => {
    await ensureEngine();
    const r = await action({ tip: 'cihaz', oturum: session ? sid(session) : undefined, cihaz: device, tema: theme });
    const d = await getStatus().catch(() => null);
    return { content: [text(r.ok ? `done — sessions: ${d?.oturumlar?.map((o) => `${o.id}=${o.cihaz}`).join(', ')} · theme=${d?.tema}` : `error: ${r.mesaj}`)], ...(r.ok ? {} : { isError: true }) };
  });

tool('status', 'durum',
  'Returns the open URL, sessions (device+viewport) and recent console/network/mark records. FIRST tool to reach for when hunting a bug.',
  'Acik adres, oturumlar ve son konsol/ag/isaret kayitlarini dondurur.',
  {},
  async () => {
    await ensureEngine();
    const d = await getStatus();
    const out = [`url: ${d.url}`, `theme: ${d.tema}${d.hata ? `\nPAGE ERROR: ${d.hata}` : ''}`];
    for (const o of d.oturumlar) out.push(`session ${o.id}: ${o.etiket} (${o.viewport.width}x${o.viewport.height})`);
    const recs = (d.kayitlar || []).slice(-20);
    if (recs.length) {
      out.push('\nrecent records (console/network/marks):');
      for (const k of recs) out.push(`  [${k.oturum}] ${k.tip}: ${k.mesaj}`);
    } else out.push('no records (console/network clean)');
    return { content: [text(out.join('\n'))] };
  });

tool('marks', 'isaretler',
  "Returns the notes the user pinned in the panel (📌) together with the screen frame at that moment — the human→AI channel. clear=true marks them read (default true).",
  'Kullanicinin panelde 📌 ile biraktigi notlari + o anki kareyi dondurur.',
  { clear: z.boolean().optional().describe('Drop returned marks from the queue (default true)') },
  async ({ clear }) => {
    await ensureEngine();
    const r = await req(`/isaretler${clear === false ? '' : '?temizle=1'}`, {}, 10000);
    const { isaretler } = await r.json();
    if (!isaretler.length) return { content: [text('no pending marks')] };
    const content = [];
    const lines = [`${isaretler.length} mark(s):`];
    for (const i of isaretler) lines.push(`- [${i.zaman}] ${i.oturum}/${i.cihaz} ${i.tema} ${i.url}\n  note: ${i.not || '(empty)'}`);
    content.push(text(lines.join('\n')));
    try {
      const last = isaretler[isaretler.length - 1];
      content.push(image(readFileSync(last.gorselYol).toString('base64')));
    } catch {}
    return { content };
  });

// --- Start ---
const transport = new StdioServerTransport();
await server.connect(transport);
log(`ready — panel: ${BASE}${TR ? ' (lang=tr)' : ''}`);
