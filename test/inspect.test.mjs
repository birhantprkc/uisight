/**
 * Inspection-engine regression tests.
 *
 * These run the REAL `INSPECTION_SCRIPT` in a REAL browser. The function is
 * serialized and shipped to the page by Playwright, so it cannot close over
 * anything outside itself — meaning the color math can't be extracted into a
 * module without duplicating it. A duplicate would drift: we'd be testing a
 * copy while the shipped engine rots. So the fixtures below are hand-computed
 * known answers, and every case is one we actually got wrong at some point.
 *
 * Run: node --test test/
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { INSPECTION_SCRIPT, PROFILES, deviceSettings } from '../src/cli.mjs';

let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser?.close(); });

/** Loads an HTML fixture in the given device profile and returns the findings. */
async function inspect(html, { profile = 'pixel', theme = 'light' } = {}) {
  const p = PROFILES[profile];
  const ctx = await browser.newContext({ ...deviceSettings(p.pw), colorScheme: theme });
  const page = await ctx.newPage();
  try {
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    return await page.evaluate(INSPECTION_SCRIPT, { mobile: p.mobile !== false, theme });
  } finally {
    await ctx.close();
  }
}

const body = (icerik, stil = '') =>
  `<!doctype html><html><head><meta name="viewport" content="width=device-width"><style>
     body{margin:0;background:#fff;font-family:sans-serif}${stil}
   </style></head><body>${icerik}</body></html>`;

const bulunanMetinler = (list) => (list || []).map((x) => x.text);

test('white text on white background is reported as invisible (1:1)', async () => {
  const d = await inspect(body('<p style="color:#fff;background:#fff">ghost text</p>'));
  const finding = (d.invisibleText || []).find((x) => x.text === 'ghost text');
  assert.ok(finding, 'expected an invisible-text finding');
  assert.equal(finding.ratio, 1, 'contrast of identical colors must be exactly 1:1');
});

test('black on white is clean — the engine does not cry wolf', async () => {
  const d = await inspect(body('<p style="color:#000;background:#fff">readable copy</p>'));
  assert.equal((d.invisibleText || []).length, 0);
  assert.equal((d.lowContrast || []).length, 0);
});

test('WCAG AA boundary: 4.3:1 fails, 4.6:1 passes', async () => {
  // #767676 on white = 4.54:1 (passes AA) · #808080 on white = 3.95:1 (fails)
  const d = await inspect(body(
    '<p style="color:#767676;background:#fff">passes AA</p>' +
    '<p style="color:#808080;background:#fff">fails AA</p>'
  ));
  const low = bulunanMetinler(d.lowContrast);
  assert.ok(low.includes('fails AA'), '3.95:1 must be flagged');
  assert.ok(!low.includes('passes AA'), '4.54:1 must not be flagged');
});

test('semi-transparent layers are alpha-composited, not taken at face value', async () => {
  // The bug this locks in: a 15%-white overlay was read as solid white, so dark
  // text on it looked "invisible" and produced a false positive (hesapla case).
  const d = await inspect(body(
    '<div style="background:#1a1a1a"><div style="background:rgba(255,255,255,.15)">' +
    '<span style="color:#eaeaea">on a translucent layer</span></div></div>'
  ));
  const falseAlarm = bulunanMetinler(d.invisibleText).includes('on a translucent layer');
  assert.equal(falseAlarm, false, 'light text over a dark-ish composite must not be flagged');
});

test('gradient text is measured through its color stops, not skipped', async () => {
  // Tailwind v4 emits oklab() stops; a plain rgb regex missed them entirely and
  // the engine stayed silent on a genuinely invisible headline (NFC case).
  const d = await inspect(body(
    '<h1><span style="background-image:linear-gradient(to right,' +
    ' oklab(0.999994 0.0000455678 0.0000200868 / 0.5) 0%,' +
    ' oklab(0.999994 0.0000455678 0.0000200868 / 0.6) 100%);' +
    ' -webkit-background-clip:text;background-clip:text;color:transparent">washed out heading</span></h1>'
  ));
  const finding = (d.invisibleText || []).find((x) => x.text === 'washed out heading');
  assert.ok(finding, 'near-white gradient text on white must be reported');
  assert.ok(finding.sel.includes('gradient'), 'finding should say it came from gradient text');
});

test('text over a photo background is skipped rather than guessed', async () => {
  const d = await inspect(body(
    '<div style="background-image:url(data:image/gif;base64,R0lGODlhAQABAAAAACw=)">' +
    '<span style="color:#fff">caption over photo</span></div>'
  ));
  const allText = [...bulunanMetinler(d.invisibleText), ...bulunanMetinler(d.lowContrast)];
  assert.equal(allText.includes('caption over photo'), false, 'CSS cannot know the pixel behind an image');
});

test('icon-font ligatures are not treated as text', async () => {
  const d = await inspect(body(
    '<span style="font-family:\'Material Symbols Outlined\';color:#fdfdfd;background:#fff">restaurant</span>'
  ));
  const allText = [...bulunanMetinler(d.invisibleText), ...bulunanMetinler(d.lowContrast)];
  assert.equal(allText.includes('restaurant'), false, 'ligature name is not user-facing copy');
});

test('touch targets: flagged on mobile, ignored on desktop', async () => {
  const button = '<button style="width:30px;height:30px">x</button>';
  const mobile = await inspect(body(button), { profile: 'pixel' });
  const masaustu = await inspect(body(button), { profile: 'desktop' });
  assert.ok((mobile.smallTargets || []).length >= 1, '30x30 is below 44px on a phone');
  assert.equal((masaustu.smallTargets || []).length, 0, 'pointer devices have no 44px rule');
});

test('a wide text link is not flagged for being short', async () => {
  // Width follows the text on inline links; only height should be judged.
  const d = await inspect(body(
    '<p><a href="#" style="display:inline-block;height:48px;line-height:48px">a very long inline text link</a></p>'
  ));
  const dar = bulunanMetinler(d.smallTargets);
  assert.equal(dar.includes('a very long inline text link'), false);
});

test('horizontal overflow is detected with the offending element', async () => {
  const d = await inspect(body('<div style="width:2000px;height:20px">too wide</div>'));
  assert.ok(d.horizontalOverflow, 'expected an overflow finding');
  assert.ok(d.horizontalOverflow.pageWidth > d.horizontalOverflow.viewportWidth);
  assert.ok(d.horizontalOverflow.overflowing.length >= 1, 'should name what overflows');
});

test('theme signature differs between light and dark when the page responds', async () => {
  // Note the element: the signature samples structural/interactive elements
  // (body, header, nav, main, footer, button, a, input, card/panel/modal/menu),
  // not every <p>. That keeps the sample small and representative; if a page's
  // drift lives only in body copy, the light↔dark comparison won't see it.
  const html = body('<button class="t">themed</button>',
    '.t{color:#111;background:#fff}@media (prefers-color-scheme: dark){.t{color:#eee;background:#111}}');
  const light = await inspect(html, { theme: 'light' });
  const dark = await inspect(html, { theme: 'dark' });
  const find = (d) => (d.themeSignature || []).find((x) => x.sel === 'button.t');
  assert.ok(find(light) && find(dark), 'the button should appear in both signatures');
  assert.notEqual(find(light).color, find(dark).color, 'a theme-aware element must change color');
});

test('theme signature stays identical when colors are hard-coded', async () => {
  // This is the drift the engine exists to catch: same color in both themes.
  const html = body('<button class="t">frozen</button>', '.t{color:#111;background:#fff}');
  const light = await inspect(html, { theme: 'light' });
  const dark = await inspect(html, { theme: 'dark' });
  const find = (d) => (d.themeSignature || []).find((x) => x.sel === 'button.t');
  assert.equal(find(light).color, find(dark).color);
  assert.equal(find(light).bg, find(dark).bg);
});

test('device profiles expose a usable viewport and touch flag', () => {
  for (const [name, p] of Object.entries(PROFILES)) {
    const settings = deviceSettings(p.pw);
    assert.ok(settings?.viewport?.width > 0, `${name}: viewport width missing`);
    if (p.mobile === false) assert.notEqual(settings.hasTouch, true, `${name}: desktop must not claim touch`);
  }
});

/**
 * Overlap, clipping, and fixed-bar coverage.
 *
 * These three came from four screenshots a person took by hand. The engine
 * measured those same pages and called them clean, because contrast and size
 * rules cannot see one element sitting on top of another.
 *
 * The first version of the overlap check sampled only the element's centre and
 * missed the very case that prompted it — a floating button on the corner of a
 * wide CTA. That is why the grid case below exists: it is the bug, not a
 * hypothetical.
 */
test('a floating button covering the corner of a CTA is caught, not just the centre', async () => {
  const d = await inspect(body(`
    <div style="position:relative;height:100vh">
      <button style="position:absolute;bottom:40px;left:20px;right:20px;height:64px">Devam Et</button>
      <button aria-label="chat" style="position:absolute;bottom:28px;right:24px;width:64px;height:64px;border-radius:50%;z-index:9">C</button>
    </div>`));
  const hit = (d.coveredControls || []).find((x) => x.text.includes('Devam'));
  assert.ok(hit, 'the covered CTA must be reported');
  assert.ok(hit.percent >= 10, `coverage should be measured, got ${hit?.percent}`);
});

test('buttons that merely sit next to each other are not reported as covered', async () => {
  const d = await inspect(body(`
    <div style="padding:20px">
      <button style="display:block;width:200px;height:48px;margin-bottom:16px">Kaydet</button>
      <button style="display:block;width:200px;height:48px">Iptal</button>
    </div>`));
  assert.equal((d.coveredControls || []).length, 0, 'adjacent buttons must not be flagged');
});

test('text cut off by its own box is reported', async () => {
  const d = await inspect(body(`<div style="width:160px;height:24px;overflow:hidden">Bu metin kutusuna kesinlikle sigmiyor ve alt satira tasip kirpiliyor</div>`));
  const hit = (d.clippedText || []).find((x) => x.text.includes('sigmiyor'));
  assert.ok(hit, 'clipped text must be reported');
  assert.equal(hit.axis, 'vertical');
  assert.ok(hit.hiddenPx > 3, 'it should say how much is hidden');
});

test('a deliberate ellipsis is not treated as a bug', async () => {
  const d = await inspect(body(`<div style="width:120px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Cok uzun bir baslik burada kesilecek</div>`));
  assert.equal((d.clippedText || []).length, 0, 'text-overflow:ellipsis is a choice, not a defect');
});

test('a sticky header covering page text is reported', async () => {
  const d = await inspect(body(`
    <header style="position:fixed;top:0;left:0;right:0;height:90px;background:#fff;z-index:5">Kokart</header>
    <main style="padding-top:20px"><p style="margin:0 16px">ekle, genel rehberseniz bos birakabilirsiniz)</p></main>`));
  const hit = (d.coveredByFixed || []).find((x) => x.text.includes('rehberseniz'));
  assert.ok(hit, 'text under the fixed header must be reported');
  assert.ok(hit.percent >= 40, `coverage percent should be meaningful, got ${hit?.percent}`);
});

test('a normal page with a header and spaced content stays clean on all three', async () => {
  const d = await inspect(body(`
    <header style="position:fixed;top:0;left:0;right:0;height:60px;background:#fff;z-index:5">Baslik</header>
    <main style="padding-top:80px">
      <h1>Hos geldiniz</h1>
      <p>Normal bir paragraf, hicbir sey ustune binmiyor.</p>
      <button style="width:200px;height:48px">Devam</button>
    </main>`));
  assert.equal((d.coveredControls || []).length, 0, 'no false overlap');
  assert.equal((d.clippedText || []).length, 0, 'no false clipping');
  assert.equal((d.coveredByFixed || []).length, 0, 'no false fixed-bar coverage');
});

test('a modal covering the page beneath it is not reported — that is what a modal does', async () => {
  const d = await inspect(body(`
    <main>
      <button style="width:200px;height:48px">Kaydet</button>
      <button style="width:200px;height:48px">Iptal</button>
    </main>
    <div style="position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:50;display:flex;align-items:center;justify-content:center">
      <div style="background:#fff;padding:24px;border-radius:12px">Hos geldin</div>
    </div>`));
  assert.equal((d.coveredControls || []).length, 0,
    'a full-screen overlay is a modal, not a layout bug');
});

test('a bottom cookie bar covering a floating button IS reported', async () => {
  const d = await inspect(body(`
    <div style="position:relative;height:100vh">
      <button aria-label="whatsapp" style="position:fixed;bottom:24px;right:20px;width:56px;height:56px;border-radius:50%">W</button>
      <div style="position:fixed;bottom:0;left:0;right:0;height:120px;background:#fff;z-index:9;padding:16px">
        <button style="width:160px;height:44px">Hepsini Kabul Et</button>
      </div>
    </div>`));
  const hit = (d.coveredControls || []).find((x) => x.size === '56x56');
  assert.ok(hit, 'a partial cover must still be reported — this is the redios case');
  assert.ok(hit.percent >= 50, `the bar sits right over it, got ${hit?.percent}%`);
});

test('the dialog box inside a modal is exempt too, not just the scrim', async () => {
  // songa: exempting only the scrim left the dialog's own content box reported
  // as the cover — 10 false findings became 8, all still the same modal.
  const d = await inspect(body(`
    <main><button style="width:200px;height:48px">Kaydet</button></main>
    <div style="position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:50">
      <div style="position:absolute;top:20px;left:10px;right:10px;background:#fff;padding:24px">
        <h2>Hos geldin</h2><p>Uzun bir karsilama metni burada duruyor.</p>
      </div>
    </div>`));
  assert.equal((d.coveredControls || []).length, 0, 'the dialog content box is part of the modal');
});

test('line-clamped card text is deliberate truncation, not a clipping bug', async () => {
  // Across 14 live sites, 17 of 18 "clipped text" findings were line-clamp:
  // recipe cards, quote cards, product blurbs. All of them by design.
  const d = await inspect(body(`
    <div style="width:280px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">
      Havucla yapilan bu pratik tarator, Akdeniz mutfaginin en sevilen mezelerinden biridir
      ve sofralarda hep ilk biten tabak olur.
    </div>`));
  assert.equal((d.clippedText || []).length, 0, 'line-clamp is a design choice');
});

test('a fixed element that overlaps but sits BEHIND is not reported', async () => {
  // app.redios.com.tr: a floating button geometrically covered the cookie
  // banner's buttons while rendering behind it, perfectly readable. Geometry
  // alone lies; the browser has to say what is actually on top.
  const d = await inspect(body(`
    <div style="position:fixed;bottom:24px;right:20px;width:56px;height:56px;z-index:1;background:#25d366">W</div>
    <div style="position:fixed;bottom:0;left:0;right:0;background:#fff;z-index:40;padding:20px">
      <button style="width:160px;height:44px">Hepsini Kabul Et</button>
    </div>`));
  assert.equal((d.coveredByFixed || []).length, 0, 'the button is on top, nothing hides it');
});

test('content genuinely hidden behind a bottom nav IS reported', async () => {
  const d = await inspect(body(`
    <main style="height:200vh"><p style="position:absolute;bottom:10px;left:16px;width:200px">WELCOME PAKET</p></main>
    <nav style="position:fixed;bottom:0;left:0;right:0;height:64px;background:#fff;z-index:40">nav</nav>`));
  const hit = (d.coveredByFixed || []).find((x) => x.text.includes('WELCOME'));
  assert.ok(hit, 'text under the bottom nav must be reported');
});

test('a round floating button is not reported as covered by what shows through its corners', async () => {
  // A circle inside a 56x56 box leaves ~21% of the box unpainted at the corners.
  // Sampling those corners returns the text behind and read as "the button is
  // covered" — a chat FAB over body copy reported 27% covered on four pages.
  const d = await inspect(body(`
    <p style="position:absolute;bottom:30px;left:16px;width:340px">
      Turk Hukuku uygulanir; uyusmazliklarda Istanbul mahkemeleri yetkilidir.
    </p>
    <button aria-label="Sohbetler" style="position:fixed;bottom:20px;right:20px;width:56px;height:56px;border-radius:50%;background:#cf4709;color:#fff;border:0;z-index:50">S</button>`));
  const hit = (d.coveredControls || []).find((x) => x.text.includes('Sohbet') || x.size === '56x56');
  assert.equal(hit, undefined, 'the FAB paints over the text, it is not covered by it');
});

/**
 * UX checks — the failures a person names in a sentence, not a stack trace.
 *
 * Each of these came from a list of real complaints. They are only worth having
 * if they stay quiet on correct pages, so every one has a false-alarm test too.
 */
test('buttons in a row that all look identical hide which one is the primary action', async () => {
  const d = await inspect(body(`
    <div style="display:flex;gap:8px;padding:16px">
      <button style="background:#e5e5e5;border:1px solid #ccc;padding:10px 18px">Kaydet</button>
      <button style="background:#e5e5e5;border:1px solid #ccc;padding:10px 18px">Iptal</button>
      <button style="background:#e5e5e5;border:1px solid #ccc;padding:10px 18px">Sil</button>
    </div>`));
  const hit = (d.sameLookingActions || [])[0];
  assert.ok(hit, 'three identical buttons must be reported');
  assert.equal(hit.count, 3);
  assert.ok(hit.labels.includes('Kaydet'));
});

test('a row where the primary action stands out is not reported', async () => {
  const d = await inspect(body(`
    <div style="display:flex;gap:8px;padding:16px">
      <button style="background:#cf4709;color:#fff;border:0;padding:10px 18px">Kaydet</button>
      <button style="background:#e5e5e5;border:1px solid #ccc;padding:10px 18px">Iptal</button>
    </div>`));
  assert.equal((d.sameLookingActions || []).length, 0, 'a distinct primary action is the point');
});

test('a light panel left behind in dark mode is reported', async () => {
  const d = await inspect(
    body(`<main style="background:#111;min-height:100vh">
            <section style="background:#ffffff;height:60vh">Ayarlar</section>
          </main>`),
    { theme: 'dark' });
  const hit = (d.darkModeLightPatches || [])[0];
  assert.ok(hit, 'a white panel in dark mode must be reported');
  assert.ok(hit.share >= 20, `it should say how much of the screen, got ${hit?.share}`);
});

test('a properly dark page in dark mode is not reported', async () => {
  const d = await inspect(
    body(`<main style="background:#111;min-height:100vh;color:#eee">
            <section style="background:#1c1c1c;height:60vh">Ayarlar</section>
          </main>`),
    { theme: 'dark' });
  assert.equal((d.darkModeLightPatches || []).length, 0, 'dark on dark is correct');
});

test('a light page in LIGHT mode is never reported as a dark-mode problem', async () => {
  const d = await inspect(body(`<main style="background:#fff;min-height:100vh">Ayarlar</main>`), { theme: 'light' });
  assert.equal((d.darkModeLightPatches || []).length, 0, 'the check only applies to dark mode');
});

test('American date format is reported, and an unambiguous day-first date is not', async () => {
  const d = await inspect(body(`<p>Rezervasyon: 09/28/2026 tarihinde baslar ve bir hafta surer.</p>`));
  const hit = (d.usDates || []).find((x) => x.text === '09/28/2026');
  assert.ok(hit, 'MM/DD/YYYY must be reported');
  assert.match(hit.note, /AA\/GG/);

  const temiz = await inspect(body(`<p>Rezervasyon 28.09.2026 tarihinde baslar ve bir hafta surer.</p>`));
  assert.equal((temiz.usDates || []).length, 0, 'dotted Turkish dates are fine');
});

test('a page mixing Turkish and English UI words is reported', async () => {
  const d = await inspect(body(`
    <nav><a href="#">Ana sayfa</a> <a href="#">Ayarlar</a> <a href="#">Settings</a></nav>
    <p>Rehberinizi bölgeye göre bulun ve rezervasyon yapın. Please continue with your account to save changes.</p>
    <button>Kaydet</button><button>Cancel</button><button>Delete</button>`));
  const hit = (d.mixedLanguage || [])[0];
  assert.ok(hit, 'mixed UI language must be reported');
  assert.ok(hit.englishWords.length > 0, 'it should name the English words found');
});

test('a page entirely in Turkish is not reported as mixed', async () => {
  const d = await inspect(body(`
    <nav><a href="#">Ana sayfa</a> <a href="#">Ayarlar</a> <a href="#">Profil</a></nav>
    <p>Rehberinizi bölgeye göre bulun ve rezervasyon yapın. Hesabınızla devam ederek değişiklikleri kaydedin.</p>
    <button>Kaydet</button><button>İptal</button><button>Sil</button>`));
  assert.equal((d.mixedLanguage || []).length, 0, 'a single-language page is consistent');
});
