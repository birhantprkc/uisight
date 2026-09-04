const vscode = require('vscode');
const { spawn } = require('node:child_process');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

let serverProcess = null;
let panel = null;
let statusItem = null;

const config = () => vscode.workspace.getConfiguration('uisight');
const port = () => config().get('port', 5055);
const toolPath = () => config().get('toolPath', 'c:\\dev\\uisight');

// --- Sunucu ile konusma ---
/**
 * The panel refuses a POST without its token, so every command has to carry it.
 * The server writes the token to ~/.uisight/live/token-<port> on startup; it is
 * read per request because restarting the panel mints a new one.
 *
 * Reading it fresh each time also means a stale token never silently turns every
 * command into a 403 — the failure people describe as "the buttons do nothing".
 */
function token() {
  try {
    return fs.readFileSync(path.join(os.homedir(), '.uisight', 'live', `token-${port()}`), 'utf8').trim();
  } catch { return ''; }
}

function request(route, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = data
      ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data), 'x-uisight-token': token() }
      : {};
    const r = http.request(
      { host: '127.0.0.1', port: port(), path: route, method: data ? 'POST' : 'GET', headers, timeout: 120000 },
      (res) => {
        let s = '';
        res.on('data', (d) => (s += d));
        res.on('end', () => {
          if (res.statusCode === 403) return reject(new Error('the panel rejected the token — restart it from the side panel'));
          try { resolve(JSON.parse(s)); } catch { resolve(null); }
        });
      }
    );
    r.on('error', reject);
    r.on('timeout', () => { r.destroy(); reject(new Error('timed out')); });
    if (data) r.write(data);
    r.end();
  });
}

const isServerUp = () => request('/state').then((d) => !!d).catch(() => false);

async function startServer(output) {
  if (await isServerUp()) return true; // baska bir oturum zaten calisiyor

  const root = toolPath();
  const entry = path.join(root, 'src', 'server.mjs');
  if (!fs.existsSync(entry)) {
    vscode.window.showErrorMessage(`uisight: src/server.mjs not found — set "uisight.toolPath" in settings (currently: ${root})`);
    return false;
  }

  const a = config();
  const nodeCommand = a.get('nodeYolu', 'node');
  const args = [`"${entry}"`, `"${a.get('url', 'http://localhost:3000')}"`, '--port', String(port()),
    '--device', a.get('device', 'pixel'), '--theme', a.get('theme', 'light'), '--acma'];

  output.appendLine(`[baslatiliyor] ${nodeCommand} ${args.join(' ')}  (cwd: ${root})`);
  let spawnError = null;
  try {
    // shell:true -> Windows'ta "node" PATH uzerinden cozulur (spawn tek basina cozemeyebiliyor).
    serverProcess = spawn(nodeCommand, args, { cwd: root, windowsHide: true, shell: true });
  } catch (e) {
    spawnError = e.message;
  }

  if (serverProcess) {
    serverProcess.on('error', (e) => { spawnError = e.message; output.appendLine(`[spawn hatasi] ${e.message}`); });
    serverProcess.stdout?.on('data', (d) => output.append(String(d)));
    serverProcess.stderr?.on('data', (d) => output.append(String(d)));
    serverProcess.on('exit', (code) => { output.appendLine(`\n[panel sunucusu kapandi — code ${code}]`); serverProcess = null; refreshStatus(); });
  }

  // Playwright acilisi birkac saniye surer.
  for (let i = 0; i < 60; i++) {
    if (await isServerUp()) return true;
    if (spawnError) break;
    await new Promise((r) => setTimeout(r, 500));
  }

  const reason = spawnError
    ? `node calistirilamadi: ${spawnError} — ayarlardan "uisight.nodeYolu" degerine node.exe'nin tam yolunu yaz.`
    : 'sunucu 30 sn icinde response vermedi.';
  output.appendLine(`[HATA] ${reason}`);
  output.show(true);
  vscode.window.showErrorMessage(`uisight: panel baslamadi — ${reason}`);
  return false;
}

// --- Webview ---
/** Panel sunucusunu gomen iframe. Ayni HTML hem editor sekmesinde hem yan panelde. */
function gomuluHtml(p, dar) {
  return `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; frame-src http://localhost:${p} http://127.0.0.1:${p}; style-src 'unsafe-inline';">
<style>html,body,iframe{margin:0;padding:0;border:0;width:100%;height:100vh;display:block;background:#1e1f22;}</style>
</head><body><iframe src="http://localhost:${p}${dar ? '?narrow=1' : ''}" allow="clipboard-read; clipboard-write"></iframe></body></html>`;
}

const bilgiHtml = (m) => `<!doctype html><meta charset="utf-8">
<style>body{font:13px var(--vscode-font-family);color:var(--vscode-foreground);padding:18px;line-height:1.6}</style>
<body>${m}`;

/**
 * Sol etkinlik cubugundaki gorunum.
 *
 * Editor sekmesinden tek farki gorunurluk, ama asil mesele o: araci kullanacak
 * kisi komut paletinde "Mobil Panel: Ac" yazmayi hatirlamak zorunda kalmasin.
 * Ikona basinca eklenti uyanir ve sunucuyu gerekiyorsa kendisi baslatir.
 */
class SidePanelProvider {
  constructor(ctx, output) { this.ctx = ctx; this.output = output; }

  async resolveWebviewView(view) {
    const p = port();
    view.webview.options = { enableScripts: true, portMapping: [{ webviewPort: p, extensionHostPort: p }] };
    view.webview.html = bilgiHtml('Panel baslatiliyor...');
    try {
      const ok = await startServer(this.output);
      view.webview.html = ok
        ? gomuluHtml(p, true)
        : bilgiHtml('Panel sunucusu baslamadi.<br><br>Cikti panelinde <b>Mobil QA</b> kanalina bak.');
    } catch (e) {
      view.webview.html = bilgiHtml(`Panel acilamadi: ${String(e.message || e)}`);
    }
  }
}

function showPanel(ctx) {
  const p = port();
  if (panel) { panel.reveal(vscode.ViewColumn.Beside); return; }

  panel = vscode.window.createWebviewPanel('uisightPanel', 'uisight', vscode.ViewColumn.Beside, {
    enableScripts: true,
    retainContextWhenHidden: true,
    portMapping: [{ webviewPort: p, extensionHostPort: p }],
  });
  panel.onDidDispose(() => { panel = null; refreshStatus(); }, null, ctx.subscriptions);

  panel.webview.html = gomuluHtml(p, false);

  refreshStatus();
}

function refreshStatus() {
  if (!statusItem) return;
  const isOpen = !!panel;
  statusItem.text = isOpen ? '$(device-mobile) uisight — open' : '$(device-mobile) uisight';
  statusItem.tooltip = isOpen ? 'Bring the panel forward / manage it' : 'Open the live mobile panel';
}

// --- Komutlar ---
async function act(type, extra) {
  try { return await request('/action', { type, ...extra }); }
  catch { vscode.window.showWarningMessage('uisight: the panel server is not answering — run "uisight: Open panel".'); return null; }
}

function activate(ctx) {
  const output = vscode.window.createOutputChannel('Mobil QA');
  ctx.subscriptions.push(output);

  ctx.subscriptions.push(vscode.window.registerWebviewViewProvider(
    'uisight.sidePanel',
    new SidePanelProvider(ctx, output),
    { webviewOptions: { retainContextWhenHidden: true } },
  ));

  statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusItem.command = 'uisight.open';
  refreshStatus();
  statusItem.show();
  ctx.subscriptions.push(statusItem);

  const register = (ad, fn) => ctx.subscriptions.push(vscode.commands.registerCommand(ad, fn));

  register('uisight.open', async () => {
    await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'Starting uisight…' },
      async () => { if (await startServer(output)) showPanel(ctx); });
  });

  register('uisight.stop', async () => {
    if (panel) { panel.dispose(); panel = null; }
    if (serverProcess) { serverProcess.kill(); serverProcess = null; }
    refreshStatus();
    vscode.window.showInformationMessage('Mobil panel durduruldu.');
  });

  register('uisight.device', async () => {
    const choice = await vscode.window.showQuickPick([
      { label: 'pixel', description: 'Pixel 7 — Android Chrome' },
      { label: 'iphone-15', description: 'iPhone 15 Pro' },
      { label: 'iphone-se', description: 'iPhone SE — 320px, the narrowest break point' },
      { label: 'galaxy', description: 'Galaxy S9+' },
      { label: 'ipad', description: 'iPad — tablet' },
    ], { placeHolder: 'Cihaz profili' });
    if (choice) { await act('device', { device: choice.label }); await config().update('device', choice.label, true); }
  });

  register('uisight.theme', async () => {
    const choice = await vscode.window.showQuickPick(['light', 'dark'], { placeHolder: 'Colour theme' });
    if (choice) { await act('device', { theme: choice }); await config().update('theme', choice, true); }
  });

  register('uisight.goto', async () => {
    const d = await request('/state').catch(() => null);
    const url = await vscode.window.showInputBox({ prompt: 'Address for the panel to open', value: d?.url || config().get('url') });
    if (url) { await act('goto', { url }); await config().update('url', url, true); }
  });

  register('uisight.inspect', async () => {
    const s = await act('inspect');
    // The engine answers { results: [ { inspection } ] } — one entry per session.
    const d = s?.results?.[0]?.inspection;
    if (!d) { vscode.window.showWarningMessage('uisight: the panel returned no measurement.'); return; }

    // Every category the engine reports. A check missing from this list is a
    // check whose findings never reach the person reading the panel — which is
    // how the old build showed "no findings" while the engine had plenty.
    const lines = [];
    const n = (a) => (a || []).length;
    if (d.horizontalOverflow) {
      lines.push(`SIDEWAYS SCROLL: page ${d.horizontalOverflow.pageWidth}px / screen ${d.horizontalOverflow.viewportWidth}px`);
    }
    for (const x of d.invisibleText || []) lines.push(`INVISIBLE TEXT ${x.ratio}:1 — ${x.sel} "${x.text}"`);
    for (const x of d.coveredControls || []) lines.push(`COVERED ${x.percent}% — "${x.text}" under "${x.coveredByText}"`);
    for (const x of d.coveredByFixed || []) lines.push(`UNDER A FIXED BAR ${x.percent}% — "${x.text}"`);
    for (const x of d.buttonIssues || []) lines.push(`BUTTON ${x.sel} "${x.text}" -> ${x.issues.join(' · ')}`);
    for (const x of d.sameLookingActions || []) lines.push(`NO PRIMARY ACTION — ${x.labels.join(' / ')}`);
    for (const x of d.lowContrast || []) lines.push(`contrast ${x.ratio}:1 (needs ${x.threshold}) — "${x.text}"`);
    for (const x of d.smallTargets || []) lines.push(`under 44px ${x.size} — "${x.text}"`);
    for (const x of d.tinyText || []) lines.push(`text below 12px (${x.fontSize}) — "${x.text}"`);
    for (const x of d.clippedText || []) lines.push(`CLIPPED — "${x.text}"`);
    for (const x of d.darkModeLightPatches || []) lines.push(`LIGHT PATCH IN DARK MODE ${x.size} (${x.share}% of the screen) — ${x.sel}`);
    for (const x of d.mixedLanguage || []) lines.push(`MIXED LANGUAGE — "${x.text}"`);
    for (const x of d.usDates || []) lines.push(`US DATE FORMAT — "${x.text}"`);
    for (const x of d.unsafeArea || []) lines.push(`UNDER THE NOTCH (${x.edge}) — "${x.text}"`);
    if (d.imagesWithoutAlt) lines.push(`${d.imagesWithoutAlt} image(s) with no alt text`);

    // A capped list hides how much was left out; say both numbers.
    const capped = Object.entries(d.totals || {})
      .filter(([k, v]) => v > n(d[k]))
      .map(([k, v]) => `${k} ${n(d[k])}/${v}`);

    output.clear();
    output.appendLine(`uisight — ${new Date().toLocaleString()}`);
    output.appendLine(lines.length ? lines.join('\n') : 'No findings from the automated checks — still look at the screen.');
    if (capped.length) output.appendLine(`\n(showing part of: ${capped.join(', ')})`);
    output.show(true);
    vscode.window.showInformationMessage(`uisight: ${lines.length} finding(s) — details in the Output panel.`);
  });

  register('uisight.send', async () => {
    const s = await act('save');
    const first = s?.paths && Object.values(s.paths)[0];
    if (first) vscode.window.showInformationMessage(`Screen saved: ${first} — your AI can read this file.`);
  });
}

function deactivate() {
  if (serverProcess) { try { serverProcess.kill(); } catch {} serverProcess = null; }
}

module.exports = { activate, deactivate };
