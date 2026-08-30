/**
 * Inspection-engine regression tests.
 *
 * These run the REAL `DENETIM_KODU` in a REAL browser. The function is
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
import { DENETIM_KODU, PROFILLER, cihazAyari } from '../src/cli.mjs';

let tarayici;
before(async () => { tarayici = await chromium.launch(); });
after(async () => { await tarayici?.close(); });

/** Loads an HTML fixture in the given device profile and returns the findings. */
async function denetle(html, { profil = 'pixel', tema = 'light' } = {}) {
  const p = PROFILLER[profil];
  const ctx = await tarayici.newContext({ ...cihazAyari(p.pw), colorScheme: tema });
  const sayfa = await ctx.newPage();
  try {
    await sayfa.setContent(html, { waitUntil: 'domcontentloaded' });
    return await sayfa.evaluate(DENETIM_KODU, { mobil: p.mobil !== false });
  } finally {
    await ctx.close();
  }
}

const govde = (icerik, stil = '') =>
  `<!doctype html><html><head><meta name="viewport" content="width=device-width"><style>
     body{margin:0;background:#fff;font-family:sans-serif}${stil}
   </style></head><body>${icerik}</body></html>`;

const bulunanMetinler = (liste) => (liste || []).map((x) => x.metin);

test('white text on white background is reported as invisible (1:1)', async () => {
  const d = await denetle(govde('<p style="color:#fff;background:#fff">ghost text</p>'));
  const bulgu = (d.gorunmezMetin || []).find((x) => x.metin === 'ghost text');
  assert.ok(bulgu, 'expected an invisible-text finding');
  assert.equal(bulgu.oran, 1, 'contrast of identical colors must be exactly 1:1');
});

test('black on white is clean — the engine does not cry wolf', async () => {
  const d = await denetle(govde('<p style="color:#000;background:#fff">readable copy</p>'));
  assert.equal((d.gorunmezMetin || []).length, 0);
  assert.equal((d.dusukKontrast || []).length, 0);
});

test('WCAG AA boundary: 4.3:1 fails, 4.6:1 passes', async () => {
  // #767676 on white = 4.54:1 (passes AA) · #808080 on white = 3.95:1 (fails)
  const d = await denetle(govde(
    '<p style="color:#767676;background:#fff">passes AA</p>' +
    '<p style="color:#808080;background:#fff">fails AA</p>'
  ));
  const dusuk = bulunanMetinler(d.dusukKontrast);
  assert.ok(dusuk.includes('fails AA'), '3.95:1 must be flagged');
  assert.ok(!dusuk.includes('passes AA'), '4.54:1 must not be flagged');
});

test('semi-transparent layers are alpha-composited, not taken at face value', async () => {
  // The bug this locks in: a 15%-white overlay was read as solid white, so dark
  // text on it looked "invisible" and produced a false positive (hesapla case).
  const d = await denetle(govde(
    '<div style="background:#1a1a1a"><div style="background:rgba(255,255,255,.15)">' +
    '<span style="color:#eaeaea">on a translucent layer</span></div></div>'
  ));
  const yanlisAlarm = bulunanMetinler(d.gorunmezMetin).includes('on a translucent layer');
  assert.equal(yanlisAlarm, false, 'light text over a dark-ish composite must not be flagged');
});

test('gradient text is measured through its color stops, not skipped', async () => {
  // Tailwind v4 emits oklab() stops; a plain rgb regex missed them entirely and
  // the engine stayed silent on a genuinely invisible headline (NFC case).
  const d = await denetle(govde(
    '<h1><span style="background-image:linear-gradient(to right,' +
    ' oklab(0.999994 0.0000455678 0.0000200868 / 0.5) 0%,' +
    ' oklab(0.999994 0.0000455678 0.0000200868 / 0.6) 100%);' +
    ' -webkit-background-clip:text;background-clip:text;color:transparent">washed out heading</span></h1>'
  ));
  const bulgu = (d.gorunmezMetin || []).find((x) => x.metin === 'washed out heading');
  assert.ok(bulgu, 'near-white gradient text on white must be reported');
  assert.ok(bulgu.sec.includes('gradient'), 'finding should say it came from gradient text');
});

test('text over a photo background is skipped rather than guessed', async () => {
  const d = await denetle(govde(
    '<div style="background-image:url(data:image/gif;base64,R0lGODlhAQABAAAAACw=)">' +
    '<span style="color:#fff">caption over photo</span></div>'
  ));
  const hepsi = [...bulunanMetinler(d.gorunmezMetin), ...bulunanMetinler(d.dusukKontrast)];
  assert.equal(hepsi.includes('caption over photo'), false, 'CSS cannot know the pixel behind an image');
});

test('icon-font ligatures are not treated as text', async () => {
  const d = await denetle(govde(
    '<span style="font-family:\'Material Symbols Outlined\';color:#fdfdfd;background:#fff">restaurant</span>'
  ));
  const hepsi = [...bulunanMetinler(d.gorunmezMetin), ...bulunanMetinler(d.dusukKontrast)];
  assert.equal(hepsi.includes('restaurant'), false, 'ligature name is not user-facing copy');
});

test('touch targets: flagged on mobile, ignored on desktop', async () => {
  const dugme = '<button style="width:30px;height:30px">x</button>';
  const mobil = await denetle(govde(dugme), { profil: 'pixel' });
  const masaustu = await denetle(govde(dugme), { profil: 'desktop' });
  assert.ok((mobil.kucukHedefler || []).length >= 1, '30x30 is below 44px on a phone');
  assert.equal((masaustu.kucukHedefler || []).length, 0, 'pointer devices have no 44px rule');
});

test('a wide text link is not flagged for being short', async () => {
  // Width follows the text on inline links; only height should be judged.
  const d = await denetle(govde(
    '<p><a href="#" style="display:inline-block;height:48px;line-height:48px">a very long inline text link</a></p>'
  ));
  const dar = bulunanMetinler(d.kucukHedefler);
  assert.equal(dar.includes('a very long inline text link'), false);
});

test('horizontal overflow is detected with the offending element', async () => {
  const d = await denetle(govde('<div style="width:2000px;height:20px">too wide</div>'));
  assert.ok(d.yatayTasma, 'expected an overflow finding');
  assert.ok(d.yatayTasma.sayfaGenislik > d.yatayTasma.ekranGenislik);
  assert.ok(d.yatayTasma.tasan.length >= 1, 'should name what overflows');
});

test('theme signature differs between light and dark when the page responds', async () => {
  // Note the element: the signature samples structural/interactive elements
  // (body, header, nav, main, footer, button, a, input, card/panel/modal/menu),
  // not every <p>. That keeps the sample small and representative; if a page's
  // drift lives only in body copy, the light↔dark comparison won't see it.
  const html = govde('<button class="t">themed</button>',
    '.t{color:#111;background:#fff}@media (prefers-color-scheme: dark){.t{color:#eee;background:#111}}');
  const acik = await denetle(html, { tema: 'light' });
  const koyu = await denetle(html, { tema: 'dark' });
  const bul = (d) => (d.temaImza || []).find((x) => x.sec === 'button.t');
  assert.ok(bul(acik) && bul(koyu), 'the button should appear in both signatures');
  assert.notEqual(bul(acik).renk, bul(koyu).renk, 'a theme-aware element must change color');
});

test('theme signature stays identical when colors are hard-coded', async () => {
  // This is the drift the engine exists to catch: same color in both themes.
  const html = govde('<button class="t">frozen</button>', '.t{color:#111;background:#fff}');
  const acik = await denetle(html, { tema: 'light' });
  const koyu = await denetle(html, { tema: 'dark' });
  const bul = (d) => (d.temaImza || []).find((x) => x.sec === 'button.t');
  assert.equal(bul(acik).renk, bul(koyu).renk);
  assert.equal(bul(acik).zemin, bul(koyu).zemin);
});

test('device profiles expose a usable viewport and touch flag', () => {
  for (const [ad, p] of Object.entries(PROFILLER)) {
    const ayar = cihazAyari(p.pw);
    assert.ok(ayar?.viewport?.width > 0, `${ad}: viewport width missing`);
    if (p.mobil === false) assert.notEqual(ayar.hasTouch, true, `${ad}: desktop must not claim touch`);
  }
});
