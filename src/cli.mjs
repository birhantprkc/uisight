#!/usr/bin/env node
/**
 * uisight CLI — one-shot mobile & responsive UI audits from your desktop.
 *
 * Usage:
 *   uisight <url> [options]
 *   uisight https://example.com --path /,/pricing --theme both --full
 *   uisight http://localhost:3000 --device iphone-15,pixel
 *   uisight https://example.com --live iphone-15    # opens a real window to browse by hand
 *
 * Output: outputs/<host>-<time>/  with PNGs + gallery.html + REPORT.md + report.json
 */

import { chromium, webkit, devices } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { exec } from 'node:child_process';
import { platform } from 'node:os';

// --- Cihaz profilleri -------------------------------------------------------
// webkit = iOS Safari'nin gercek render motoru (Windows'ta calisir).
// chromium = Android Chrome / WebView.
// mobil:false profiller masaustu — dokunma-hedefi gibi mobil kurallari onlarda kosulmaz.
export const PROFILLER = {
  'iphone-15': { motor: 'webkit', pw: 'iPhone 15 Pro', etiket: 'iPhone 15 Pro — iOS Safari engine', mobil: true },
  'iphone-se': { motor: 'webkit', pw: 'iPhone SE', etiket: 'iPhone SE — small screen (375px)', mobil: true },
  'pixel': { motor: 'chromium', pw: 'Pixel 7', etiket: 'Pixel 7 — Android Chrome', mobil: true },
  'galaxy': { motor: 'chromium', pw: 'Galaxy S9+', etiket: 'Galaxy S9+ — Android', mobil: true },
  'ipad': { motor: 'webkit', pw: 'iPad (gen 7)', etiket: 'iPad — tablet breakpoint', mobil: true },
  'desktop': { motor: 'chromium', pw: 'Desktop 1440', etiket: 'Desktop — 1440px', mobil: false },
  'laptop': { motor: 'chromium', pw: 'Laptop 1366', etiket: 'Laptop — 1366px', mobil: false },
};

// Playwright surumu cihaz adini tanimazsa devreye giren yedek tanimlar.
// isMobile/hasTouch burada tasinir; masaustu profillerinde touch KAPALI olmali
// (touchscreen.tap hasTouch olmayan baglamda patlar).
const YEDEK = {
  'iPhone 15 Pro': { viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  'iPhone SE': { viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  'Pixel 7': { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.6, isMobile: true, hasTouch: true },
  'Galaxy S9+': { viewport: { width: 320, height: 658 }, deviceScaleFactor: 4.5, isMobile: true, hasTouch: true },
  'iPad (gen 7)': { viewport: { width: 810, height: 1080 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  'Desktop 1440': { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
  'Laptop 1366': { viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
};

const VARSAYILAN_CIHAZ = ['iphone-15', 'pixel'];

// --- Argumanlar -------------------------------------------------------------
function argAyristir(argv) {
  const o = { url: null, cihaz: VARSAYILAN_CIHAZ, yol: ['/'], tema: ['light'], tam: false, canli: null, bekle: 1200, izle: 0, ac: true };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--device' || a === '-d') o.cihaz = argv[++i].split(',').map((s) => s.trim());
    else if (a === '--path' || a === '-p') o.yol = argv[++i].split(',').map((s) => s.trim());
    else if (a === '--theme' || a === '-t') o.tema = argv[++i] === 'both' ? ['light', 'dark'] : [argv[i]];
    else if (a === '--full') o.tam = true;
    else if (a === '--live') o.canli = argv[++i] || 'iphone-15';
    else if (a === '--wait') o.bekle = Number(argv[++i]);
    else if (a === '--watch') o.izle = Number(argv[++i] || 10);
    else if (a === '--no-open') o.ac = false;
    else if (a === '--help' || a === '-h') o.yardim = true;
    else rest.push(a);
  }
  o.url = rest[0] || null;
  return o;
}

function yardim() {
  console.log(`
uisight — mobile & responsive UI audits from your desktop

  uisight <url> [options]

Options
  --device, -d   comma-separated: ${Object.keys(PROFILLER).join(', ')}   (default: iphone-15,pixel)
  --path,   -p   comma-separated routes, e.g. /,/pricing,/cart          (default: /)
  --theme,  -t   light | dark | both                                    (default: light)
  --full         full-page screenshots (not just the viewport)
  --wait <ms>    settle time after page load                            (default: 1200)
  --watch <s>    continuous mode: re-captures every <s> seconds, gallery auto-refreshes
  --no-open      do not auto-open the gallery in the browser
  --live <device>  opens a real window you can browse by hand (no automation)

Examples
  uisight https://example.com --path /,/pricing --theme both --full
  uisight http://localhost:3000 --device iphone-se,galaxy
  uisight https://example.com --live pixel

Live panel (human + AI watching the same session):  uisight-panel <url>
MCP server for Claude Code / Cursor / Antigravity:  uisight-mcp
`);
}

// --- Yardimcilar ------------------------------------------------------------
const slug = (s) => (s.replace(/^\//, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '') || 'anasayfa');

export function cihazAyari(pwAd) {
  const d = devices[pwAd];
  if (d) return d;
  return { ...YEDEK[pwAd] };
}

/** Sayfa icinde calisan kontroller (renk/tema/buton).
 *  ayar.mobil=false ise dokunma-hedefi (44px) kurallari atlanir — masaustu denetimi. */
export const DENETIM_KODU = (ayar) => {
  const mobilMi = !ayar || ayar.mobil !== false;
  const sonuc = {
    yatayTasma: null, kucukHedefler: [], minikYazi: [], gorselAltsiz: 0,
    gorunmezMetin: [], dusukKontrast: [], butonSorun: [], temaImza: [],
  };

  // --- renk yardimcilari (WCAG) ---
  // Renk cozumlemesi tarayiciya birakilir: oklab/oklch/lab/color-mix hepsi calisir.
  // (Tailwind v4 gradient duraklarini oklab() olarak uretiyor — duz regex bunlari kaciriyordu.)
  let _tuval = null;
  const renkCoz = (metin) => {
    if (!_tuval) { _tuval = document.createElement('canvas'); _tuval.width = 1; _tuval.height = 1; }
    const c = _tuval.getContext('2d', { willReadFrequently: true });
    c.clearRect(0, 0, 1, 1);
    c.fillStyle = 'rgba(0,0,0,0)';
    c.fillStyle = metin;                 // gecersizse onceki deger kalir -> saydam
    c.fillRect(0, 0, 1, 1);
    const d = c.getImageData(0, 0, 1, 1).data;
    return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 };
  };
  const rgb = (s) => {
    if (!s) return null;
    const t = String(s).trim();
    if (t === 'none' || t === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
    const m = t.match(/^rgba?\(([^)]+)\)$/);
    if (m) {
      const p = m[1].split(/[,\s/]+/).filter(Boolean).map((x) => parseFloat(x));
      return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
    }
    try { return renkCoz(t); } catch { return null; }
  };
  const kanal = (c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
  const parlaklik = (c) => 0.2126 * kanal(c.r) + 0.7152 * kanal(c.g) + 0.0722 * kanal(c.b);
  const kontrast = (a, b) => {
    const l1 = parlaklik(a), l2 = parlaklik(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };
  const karistir = (on, alt) => ({ // yari saydam metni arka planla harmanla
    r: on.r * on.a + alt.r * (1 - on.a), g: on.g * on.a + alt.g * (1 - on.a), b: on.b * on.a + alt.b * (1 - on.a), a: 1,
  });
  /** Elementin GERCEK arka plani: saydam olmayan ilk ata. */
  const gradientRenkleri = (bi) =>
    [...String(bi).matchAll(/(?:rgba?|oklab|oklch|lab|lch|hsla?|hwb|color)\([^()]*\)/g)]
      .map((m) => rgb(m[0])).filter(Boolean);

  /** Elementin GERCEK zemini: yari saydam katmanlari (bg-white/15 gibi) alta dogru
   *  toplar ve alfa-HARMANLAR — %15 beyazi duz beyaz sanmak yanlis alarm uretir.
   *  Foto zemin (url) -> null: CSS'ten olculemez, "gorunmez" deme (hesapla vakasi). */
  const efektifArka = (el) => {
    const katmanlar = []; // ustten alta
    let taban = null;
    let n = el;
    while (n && n !== document.documentElement) {
      const s = getComputedStyle(n);
      const bi = s.backgroundImage;
      if (bi && bi !== 'none') {
        if (bi.includes('url(')) return null; // gercek gorsel zemin — olculemez
        if (bi.includes('gradient')) {
          const d = gradientRenkleri(bi);
          if (d.length) {
            const t = d.reduce((a, c) => ({ r: a.r + c.r, g: a.g + c.g, b: a.b + c.b, a: a.a + c.a }), { r: 0, g: 0, b: 0, a: 0 });
            katmanlar.push({ r: t.r / d.length, g: t.g / d.length, b: t.b / d.length, a: t.a / d.length });
          }
        }
      }
      const bg = rgb(s.backgroundColor);
      if (bg && bg.a > 0.01) {
        if (bg.a >= 0.99) { taban = bg; break; }
        katmanlar.push(bg);
      }
      n = n.parentElement;
    }
    if (!taban) {
      const kok = rgb(getComputedStyle(document.body).backgroundColor);
      taban = kok && kok.a >= 0.99 ? kok : { r: 255, g: 255, b: 255, a: 1 };
    }
    let sonuc = taban;
    for (let i = katmanlar.length - 1; i >= 0; i--) sonuc = karistir(katmanlar[i], sonuc);
    return sonuc;
  };
  const gorunurMu = (el) => {
    const r = el.getBoundingClientRect();
    const st = getComputedStyle(el);
    return r.width > 1 && r.height > 1 && st.visibility !== 'hidden' && st.display !== 'none' && parseFloat(st.opacity) > 0.05;
  };
  const kimlik = (el) => {
    const sinif = (typeof el.className === 'string' ? el.className : '').trim().split(/\s+/).slice(0, 2).join('.');
    return `${el.tagName.toLowerCase()}${sinif ? '.' + sinif : ''}`;
  };
  const kisaMetin = (el) => (el.innerText || el.value || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 45);

  // --- 5) Renk denetimi: gorunmez metin + dusuk kontrast ---
  // Bu, "temayi degistirdim, yazi kayboldu" vakasini yakalar (NFC dersi).
  // Etiket listesiyle sinirlama YAPMA: metin cogu zaman <div> icinde durur ve
  // sabit liste onu sessizce atlar (nfc-card-3d vakasi). Tum elemanlari tara,
  // "kendi metin dugumu var mi" filtresi kapsayicilari zaten eliyor.
  const ATLA = /^(script|style|svg|path|noscript|template|br|iframe|canvas|video|audio|source)$/i;
  const metinElemanlari = [...document.querySelectorAll('body *')].filter((el) => !ATLA.test(el.tagName));
  for (const el of metinElemanlari) {
    if (!gorunurMu(el)) continue;
    const metin = kisaMetin(el);
    if (!metin) continue;
    // yalniz kendi metni olan elemanlar (kapsayicilar cift saymasin)
    const kendiMetni = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!kendiMetni && el.tagName !== 'INPUT') continue;

    // Ikon fontlari: icerik ligature adidir ("restaurant"), gercek metin degil — metin-kontrast kurali uygulanmaz.
    if (/material symbols|material icons|font ?awesome|icomoon|glyphicon|bootstrap-icons|remixicon|lucide|feather/i.test(getComputedStyle(el).fontFamily || '')) continue;

    // range/checkbox gibi girdilerde .value ekranda metin olarak cizilmez — kontrol widget'idir.
    if (el.tagName === 'INPUT' && /^(range|checkbox|radio|color|file|hidden|submit|button|image)$/i.test(el.type || '')) continue;

    // Kontur-yazi (text-stroke): dolgu saydam olsa da cizgiyle gorunur (filigran deseni).
    const kontur = parseFloat(getComputedStyle(el).webkitTextStrokeWidth) || 0;
    if (kontur > 0) continue;

    const st = getComputedStyle(el);
    // Gradient yazi: element rengi saydam, gercek renk background-image'da.
    // Atlamak YANLIS — acik temada gradient zeminle kaynasip okunmaz olabilir.
    // Bunun yerine gradient duraklarinin renklerini olc, EN KOTUSUNU raporla.
    const gradientTasiyan = (n) => {
      let c = n;
      for (let i = 0; c && i < 3; i++, c = c.parentElement) {
        const s = getComputedStyle(c);
        if ((s.webkitBackgroundClip === 'text' || s.backgroundClip === 'text') && s.backgroundImage !== 'none') return c;
      }
      return null;
    };
    const fsG = parseFloat(st.fontSize) || 16;
    const kalinG = parseInt(st.fontWeight, 10) >= 700;
    const esikG = (fsG >= 24 || (fsG >= 18.66 && kalinG)) ? 3 : 4.5;

    const gt = gradientTasiyan(el);
    if (gt) {
      const duraklar = [...getComputedStyle(gt).backgroundImage.matchAll(/(?:rgba?|oklab|oklch|lab|lch|hsla?|hwb|color)\([^()]*\)/g)]
        .map((m) => rgb(m[0])).filter((r) => r && r.a > 0.02);
      if (!duraklar.length) continue;
      const altG = efektifArka(gt.parentElement || gt);
      if (!altG) continue; // foto zemin — olculemez
      let enDusuk = Infinity, kotu = null;
      for (const r of duraklar) {
        const k = kontrast(r.a < 1 ? karistir(r, altG) : r, altG);
        if (k < enDusuk) { enDusuk = k; kotu = r; }
      }
      const kayitG = {
        sec: kimlik(el) + ' (gradient yazı)', metin, oran: Math.round(enDusuk * 100) / 100,
        renk: `rgba(${Math.round(kotu.r)}, ${Math.round(kotu.g)}, ${Math.round(kotu.b)}, ${kotu.a})`,
        arka: `rgb(${Math.round(altG.r)}, ${Math.round(altG.g)}, ${Math.round(altG.b)})`, boyut: `${Math.round(fsG)}px`,
      };
      if (enDusuk < 1.6) sonuc.gorunmezMetin.push(kayitG);
      else if (enDusuk < esikG) sonuc.dusukKontrast.push({ ...kayitG, esik: esikG });
      continue;
    }

    const on = rgb(st.color);
    if (!on) continue;
    const alt = efektifArka(el);
    if (!alt) continue; // foto zemin — olculemez, yanlis alarm uretme
    const onKarisik = on.a < 1 ? karistir(on, alt) : on;
    const k = kontrast(onKarisik, alt);
    const fs = parseFloat(st.fontSize) || 16;
    const kalin = parseInt(st.fontWeight, 10) >= 700;
    const buyukYazi = fs >= 24 || (fs >= 18.66 && kalin);
    const esik = buyukYazi ? 3 : 4.5;
    const kayit = { sec: kimlik(el), metin, oran: Math.round(k * 100) / 100, renk: st.color, arka: `rgb(${Math.round(alt.r)}, ${Math.round(alt.g)}, ${Math.round(alt.b)})`, boyut: `${Math.round(fs)}px` };
    if (k < 1.6) sonuc.gorunmezMetin.push(kayit);        // pratikte okunmuyor
    else if (k < esik) sonuc.dusukKontrast.push({ ...kayit, esik });
  }

  // --- 6) Buton denetimi: kontrast + olcu + ayirt edilebilirlik ---
  for (const el of document.querySelectorAll('button,[role="button"],a.btn,input[type="submit"],input[type="button"]')) {
    if (!gorunurMu(el)) continue;
    const r = el.getBoundingClientRect();
    const st = getComputedStyle(el);
    const on = rgb(st.color), alt = efektifArka(el);
    const sorunlar = [];
    if (on && alt) { // alt=null: foto zemin, kontrast olculemez
      const k = kontrast(on.a < 1 ? karistir(on, alt) : on, alt);
      if (k < 3) sorunlar.push(`metin/zemin kontrasti ${Math.round(k * 100) / 100}:1`);
    }
    if (mobilMi && (r.height < 44 || r.width < 44)) sorunlar.push(`olcu ${Math.round(r.width)}x${Math.round(r.height)} (<44px)`);
    const kenar = rgb(st.borderTopColor);
    const zeminYok = !rgb(st.backgroundColor) || rgb(st.backgroundColor).a < 0.05;
    if (zeminYok && (!kenar || kenar.a < 0.05) && el.tagName === 'BUTTON') sorunlar.push('zemin ve kenarlik yok — buton gibi gorunmuyor');
    if (el.disabled && parseFloat(st.opacity) > 0.85) sorunlar.push('disabled ama gorsel olarak ayirt edilemiyor');
    if (sorunlar.length) sonuc.butonSorun.push({ sec: kimlik(el), metin: kisaMetin(el) || '(metinsiz)', sorunlar });
  }

  // --- 7) Tema imzasi: iki tema arasinda karsilastirmak icin ---
  const imzaHedef = [...document.querySelectorAll('body,header,nav,main,footer,button,a,input,[class*="card"],[class*="panel"],[class*="modal"],[class*="menu"]')].filter(gorunurMu).slice(0, 60);
  for (const el of imzaHedef) {
    const st = getComputedStyle(el);
    sonuc.temaImza.push({ sec: kimlik(el), metin: kisaMetin(el).slice(0, 24), renk: st.color, zemin: st.backgroundColor, kenar: st.borderTopColor });
  }

  sonuc.gorunmezMetin = sonuc.gorunmezMetin.slice(0, 12);
  sonuc.dusukKontrast = sonuc.dusukKontrast.slice(0, 12);
  sonuc.butonSorun = sonuc.butonSorun.slice(0, 12);

  // 1) Yatay tasma — mobilde en sik bug.
  const bel = document.documentElement.scrollWidth;
  const gorunur = window.innerWidth;
  if (bel > gorunur + 2) {
    const suclular = [];
    document.querySelectorAll('body *').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.right > gorunur + 2) {
        suclular.push({
          etiket: el.tagName.toLowerCase(),
          sinif: (el.className && String(el.className).slice(0, 60)) || '',
          sag: Math.round(r.right),
        });
      }
    });
    sonuc.yatayTasma = { sayfaGenislik: bel, ekranGenislik: gorunur, tasan: suclular.slice(0, 8) };
  }

  // 2) Dokunma hedefi < 44px (Apple HIG / WCAG 2.5.5) — yalniz mobil profillerde.
  // Satir-ici METIN linkinde genislik metne baglidir; 44 genislik dayatilmaz (yalniz yukseklik).
  // Metinsiz/ikon hedeflerde iki boyut da aranir. 0.5px yuvarlama toleransi (43.6 -> "44" vakasi).
  if (mobilMi) document.querySelectorAll('a, button, [role="button"], input, select, textarea').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    const metinVar = !!(el.innerText || el.value || '').trim();
    const dar = !metinVar && r.width < 43.5;
    const kisa = r.height < 43.5;
    if (dar || kisa) {
      sonuc.kucukHedefler.push({
        etiket: el.tagName.toLowerCase(),
        metin: (el.innerText || el.value || el.getAttribute('aria-label') || '').trim().slice(0, 40),
        olcu: `${Math.round(r.width)}x${Math.round(r.height)}`,
      });
    }
  });

  // 3) 12px altı yazi — telefonda okunmaz.
  document.querySelectorAll('p, span, li, a, button, label, td').forEach((el) => {
    if (!el.innerText || !el.innerText.trim()) return;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs && fs < 12) sonuc.minikYazi.push({ boyut: `${fs}px`, metin: el.innerText.trim().slice(0, 40) });
  });

  // 4) alt'siz gorseller.
  document.querySelectorAll('img').forEach((el) => {
    if (!el.getAttribute('alt')) sonuc.gorselAltsiz++;
  });

  sonuc.kucukHedefler = sonuc.kucukHedefler.slice(0, 12);
  sonuc.minikYazi = sonuc.minikYazi.slice(0, 8);
  return sonuc;
};

// --- Canli mod --------------------------------------------------------------
async function canliAc(url, cihazAnahtar) {
  const p = PROFILLER[cihazAnahtar];
  if (!p) throw new Error(`Bilinmeyen cihaz: ${cihazAnahtar}`);
  const motor = p.motor === 'webkit' ? webkit : chromium;
  const tarayici = await motor.launch({ headless: false });
  const ctx = await tarayici.newContext({ ...cihazAyari(p.pw) });
  const sayfa = await ctx.newPage();
  await sayfa.goto(url, { waitUntil: 'domcontentloaded' });
  console.log(`\n  ${p.etiket} penceresi acildi: ${url}`);
  console.log('  Fareyle gez. Kapatmak icin pencereyi kapat veya Ctrl+C.\n');
  await sayfa.waitForEvent('close', { timeout: 0 }).catch(() => {});
  await tarayici.close();
}

// --- Ana akis ---------------------------------------------------------------
async function main() {
  const o = argAyristir(process.argv.slice(2));
  if (o.yardim || !o.url) { yardim(); process.exit(o.url ? 0 : 1); }
  if (!/^https?:\/\//.test(o.url)) o.url = 'https://' + o.url;

  if (o.canli) return canliAc(o.url, o.canli);

  do {
    await tur(o);
    if (o.izle) {
      console.log(`  ... ${o.izle}s sonra yeniden cekilecek (Ctrl+C ile cik)\n`);
      await new Promise((r) => setTimeout(r, o.izle * 1000));
    }
  } while (o.izle);
}

async function tur(o) {
  const host = new URL(o.url).host.replace(/[^a-z0-9.-]/gi, '_');
  const zaman = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  // Izle modunda sabit klasor: tarayici sayfasi ayni adreste kalsin, kendi kendine yenilensin.
  // Outputs go to the USER's cwd — never into the package dir (npx installs land in node_modules).
  const ciktiKok = join(process.cwd(), 'uisight-outputs');
  const ciktiDir = o.izle ? join(ciktiKok, `_watch-${host}`) : join(ciktiKok, `${host}-${zaman}`);
  mkdirSync(ciktiDir, { recursive: true });

  const kayitlar = [];
  const motorOnbellek = {};

  for (const anahtar of o.cihaz) {
    const p = PROFILLER[anahtar];
    if (!p) { console.log(`  ! bilinmeyen cihaz atlandi: ${anahtar}`); continue; }

    // WebKit bu makinede acilmazsa (Windows'ta eksik DLL vakasi) Chromium'a dus;
    // duzen/renk denetimi calismaya devam etsin, raporda motor acikca yazsin.
    let kullanilanMotor = p.motor;
    if (!motorOnbellek[kullanilanMotor]) {
      try {
        motorOnbellek[kullanilanMotor] = await (kullanilanMotor === 'webkit' ? webkit : chromium).launch();
      } catch (e) {
        if (kullanilanMotor !== 'webkit') throw e;
        console.log(`  ! webkit acilmadi (${String(e).split('\n')[0].slice(0, 60)}) -> chromium'a dusuluyor`);
        kullanilanMotor = 'chromium-yedek';
        if (!motorOnbellek[kullanilanMotor]) motorOnbellek[kullanilanMotor] = await chromium.launch();
      }
    }
    const tarayici = motorOnbellek[kullanilanMotor];
    const motorAdi = kullanilanMotor === 'chromium-yedek' ? 'chromium (webkit yok — iOS-ozel hatalari GORMEZ)' : kullanilanMotor;

    for (const tema of o.tema) {
      const ctx = await tarayici.newContext({ ...cihazAyari(p.pw), colorScheme: tema, locale: 'tr-TR' });
      const sayfa = await ctx.newPage();

      for (const yol of o.yol) {
        const hedef = new URL(yol, o.url).toString();
        const kayit = { cihaz: anahtar, etiket: p.etiket, motor: motorAdi, tema, yol, url: hedef, konsol: [], ag: [], hata: null };

        sayfa.on('pageerror', (e) => kayit.konsol.push({ tip: 'js-hata', mesaj: String(e).slice(0, 200) }));
        sayfa.on('console', (m) => { if (m.type() === 'error') kayit.konsol.push({ tip: 'konsol', mesaj: m.text().slice(0, 200) }); });
        sayfa.on('response', (r) => { if (r.status() >= 400) kayit.ag.push({ kod: r.status(), url: r.url().slice(0, 120) }); });

        try {
          // One retry: edge networks intermittently stall a single request in a burst run.
          let yanit;
          try {
            yanit = await sayfa.goto(hedef, { waitUntil: 'domcontentloaded', timeout: 30000 });
          } catch {
            yanit = await sayfa.goto(hedef, { waitUntil: 'domcontentloaded', timeout: 30000 });
          }
          kayit.durum = yanit ? yanit.status() : null;
          await sayfa.waitForTimeout(o.bekle);
          kayit.baslik = await sayfa.title();
          kayit.denetim = await sayfa.evaluate(DENETIM_KODU, { mobil: p.mobil !== false });

          const ad = `${slug(yol)}__${anahtar}__${tema}.png`;
          const png = join(ciktiDir, ad);
          // scale:'css' -> CSS pikselinde kaydeder; dosya kucuk, okumasi kolay.
          await sayfa.screenshot({ path: png, fullPage: o.tam, scale: 'css' });
          kayit.gorsel = png;
          console.log(`  ok  ${anahtar}/${tema}  ${yol}  -> ${ad}`);
        } catch (e) {
          kayit.hata = String(e).slice(0, 300);
          console.log(`  HATA ${anahtar}/${tema} ${yol}: ${kayit.hata.split('\n')[0]}`);
        }
        kayitlar.push(kayit);
      }
      await ctx.close();
    }
  }

  for (const t of Object.values(motorOnbellek)) await t.close();

  // --- Rapor ---
  const satirlar = [];
  satirlar.push(`# uisight report — ${o.url}`);
  satirlar.push('');
  satirlar.push(`- Date: ${new Date().toLocaleString('tr-TR')}`);
  satirlar.push(`- Devices: ${o.cihaz.join(', ')} | Themes: ${o.tema.join(', ')} | Paths: ${o.yol.join(', ')}`);
  satirlar.push(`- Output: ${ciktiDir}`);
  satirlar.push('');

  let bulguSayisi = 0;
  for (const k of kayitlar) {
    satirlar.push(`## ${k.etiket} · ${k.tema} · ${k.yol}`);
    if (k.hata) { satirlar.push(`- **PAGE FAILED TO LOAD:** ${k.hata}`); bulguSayisi++; satirlar.push(''); continue; }
    satirlar.push(`- Image: \`${k.gorsel}\``);
    satirlar.push(`- HTTP ${k.durum} · title: ${k.baslik}`);

    const d = k.denetim || {};
    if (d.yatayTasma) {
      bulguSayisi++;
      satirlar.push(`- 🔴 **HORIZONTAL OVERFLOW**: page ${d.yatayTasma.sayfaGenislik}px / viewport ${d.yatayTasma.ekranGenislik}px`);
      for (const s of d.yatayTasma.tasan) satirlar.push(`  - \`<${s.etiket} class="${s.sinif}">\` right edge ${s.sag}px`);
    }
    if (d.kucukHedefler?.length) {
      bulguSayisi++;
      satirlar.push(`- 🟡 **touch targets below 44px** (${d.kucukHedefler.length}):`);
      for (const s of d.kucukHedefler) satirlar.push(`  - \`${s.etiket}\` ${s.olcu} — "${s.metin}"`);
    }
    if (d.minikYazi?.length) {
      bulguSayisi++;
      satirlar.push(`- 🟡 **text below 12px** (${d.minikYazi.length}): ` + d.minikYazi.map((m) => `${m.boyut} "${m.metin}"`).join(' · '));
    }
    if (d.gorunmezMetin?.length) {
      bulguSayisi++;
      satirlar.push(`- 🔴 **INVISIBLE TEXT** (contrast <1.6:1 — practically unreadable, ${d.gorunmezMetin.length}):`);
      for (const s of d.gorunmezMetin) satirlar.push(`  - \`${s.sec}\` ${s.oran}:1 — text ${s.renk} / bg ${s.arka} — "${s.metin}"`);
    }
    if (d.dusukKontrast?.length) {
      bulguSayisi++;
      satirlar.push(`- 🟡 **Low contrast** (below WCAG AA, ${d.dusukKontrast.length}):`);
      for (const s of d.dusukKontrast) satirlar.push(`  - \`${s.sec}\` ${s.oran}:1 (threshold ${s.esik}) ${s.boyut} — "${s.metin}"`);
    }
    if (d.butonSorun?.length) {
      bulguSayisi++;
      satirlar.push(`- 🟠 **Button issues** (${d.butonSorun.length}):`);
      for (const s of d.butonSorun) satirlar.push(`  - \`${s.sec}\` "${s.metin}" → ${s.sorunlar.join(' · ')}`);
    }
    if (d.gorselAltsiz) satirlar.push(`- ⚪ images without alt: ${d.gorselAltsiz}`);
    if (k.konsol.length) { bulguSayisi++; satirlar.push(`- 🔴 **Console/JS errors** (${k.konsol.length}):`); for (const c of k.konsol.slice(0, 5)) satirlar.push(`  - ${c.tip}: ${c.mesaj}`); }
    if (k.ag.length) { bulguSayisi++; satirlar.push(`- 🔴 **Failed requests** (${k.ag.length}):`); for (const a of k.ag.slice(0, 5)) satirlar.push(`  - ${a.kod} ${a.url}`); }
    // "Temiz" iddiasi TUM bulgu tiplerini kapsamali: gorunmez metin/kontrast/buton
    // atlaninca rapor kendi bulgusunun altina "clean" yaziyordu (celiski).
    const bulguVar = d.yatayTasma || d.kucukHedefler?.length || d.minikYazi?.length
      || d.gorunmezMetin?.length || d.dusukKontrast?.length || d.butonSorun?.length
      || k.konsol.length || k.ag.length;
    if (!bulguVar) satirlar.push('- ✅ automated checks clean (still eyeball the image)');
    satirlar.push('');
  }
  // --- Tema karsilastirmasi: light vs dark ayni renkse tema toggle'a cevap vermiyor demektir ---
  if (o.tema.length > 1) {
    satirlar.push('## Theme comparison (light ↔ dark)');
    let temaBulgu = 0;
    for (const cihaz of o.cihaz) {
      for (const yol of o.yol) {
        const l = kayitlar.find((k) => k.cihaz === cihaz && k.tema === 'light' && k.yol === yol);
        const d = kayitlar.find((k) => k.cihaz === cihaz && k.tema === 'dark' && k.yol === yol);
        if (!l?.denetim?.temaImza || !d?.denetim?.temaImza) continue;

        const dHarita = new Map(d.denetim.temaImza.map((x, i) => [`${i}|${x.sec}`, x]));
        const sabitler = [];
        l.denetim.temaImza.forEach((x, i) => {
          const es = dHarita.get(`${i}|${x.sec}`);
          if (!es) return;
          const zeminSaydam = /rgba\([^)]*,\s*0\)/.test(x.zemin);
          if (x.renk === es.renk && x.zemin === es.zemin && !zeminSaydam) {
            sabitler.push({ sec: x.sec, metin: x.metin, renk: x.renk, zemin: x.zemin });
          }
        });

        if (sabitler.length) {
          temaBulgu++;
          satirlar.push(`- **${cihaz} · ${yol}** — ${sabitler.length} elements IDENTICAL in both themes (likely hard-coded colors):`);
          for (const s of sabitler.slice(0, 10)) satirlar.push(`  - \`${s.sec}\` "${s.metin}" — text ${s.renk} / bg ${s.zemin}`);
        }
      }
    }
    if (!temaBulgu) satirlar.push('- No theme-frozen elements found.');
    satirlar.push('');
  }

  satirlar.push('---');
  satirlar.push(`Records with automated findings: ${bulguSayisi}/${kayitlar.length}. Automated checks CANNOT see design mistakes — eyeball the PNGs.`);

  const raporYol = join(ciktiDir, 'REPORT.md');
  writeFileSync(raporYol, satirlar.join('\n'), 'utf8');
  writeFileSync(join(ciktiDir, 'report.json'), JSON.stringify(kayitlar, null, 2), 'utf8');

  const galeriYol = join(ciktiDir, 'gallery.html');
  writeFileSync(galeriYol, galeriUret(kayitlar, o), 'utf8');

  console.log(`\n  Panel : ${galeriYol}`);
  console.log(`  Rapor : ${raporYol}\n`);

  if (o.ac && !global.__acildi) {
    global.__acildi = true; // izle modunda her turda yeni sekme acma
    // Platforma gore ac: `start` yalniz Windows'ta var (macOS: open, Linux: xdg-open).
    const p = platform();
    const komut = p === 'win32' ? `start "" "${galeriYol}"` : p === 'darwin' ? `open "${galeriYol}"` : `xdg-open "${galeriYol}"`;
    exec(komut, p === 'win32' ? { shell: 'cmd.exe' } : {}, (e) => {
      if (e) console.error(`  ! could not open gallery (${p}) — open manually: ${galeriYol}`);
    });
  }
}

/** Android Studio preview paneli gibi tek sayfa: numarali kartlar, yan yana. */
function galeriUret(kayitlar, o) {
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const kartlar = kayitlar.map((k, i) => {
    const no = i + 1;
    const d = k.denetim || {};
    const rozet = [];
    if (k.hata) rozet.push(['kritik', 'PAGE FAILED']);
    if (d.yatayTasma) rozet.push(['kritik', 'overflow']);
    if (d.gorunmezMetin?.length) rozet.push(['kritik', `invisible text ${d.gorunmezMetin.length}`]);
    if (k.konsol?.length) rozet.push(['kritik', `JS errors ${k.konsol.length}`]);
    if (k.ag?.length) rozet.push(['kritik', `failed requests ${k.ag.length}`]);
    if (d.butonSorun?.length) rozet.push(['uyari', `buttons ${d.butonSorun.length}`]);
    if (d.dusukKontrast?.length) rozet.push(['uyari', `contrast ${d.dusukKontrast.length}`]);
    if (d.kucukHedefler?.length) rozet.push(['uyari', `under 44px ${d.kucukHedefler.length}`]);
    if (d.minikYazi?.length) rozet.push(['bilgi', `under 12px ${d.minikYazi.length}`]);
    if (!rozet.length) rozet.push(['ok', 'automated checks clean']);

    const detay = [];
    for (const s of (d.gorunmezMetin || [])) detay.push(`<li class="k">INVISIBLE ${s.oran}:1 — <code>${esc(s.sec)}</code> "${esc(s.metin)}"</li>`);
    for (const s of (d.butonSorun || [])) detay.push(`<li class="u">BUTTON <code>${esc(s.sec)}</code> "${esc(s.metin)}" → ${esc(s.sorunlar.join(' · '))}</li>`);
    for (const s of (d.dusukKontrast || []).slice(0, 6)) detay.push(`<li class="u">contrast ${s.oran}:1 (threshold ${s.esik}) — "${esc(s.metin)}"</li>`);
    for (const s of (d.kucukHedefler || []).slice(0, 6)) detay.push(`<li class="u">${esc(s.olcu)} — "${esc(s.metin)}"</li>`);
    if (d.yatayTasma) detay.push(`<li class="k">overflow: page ${d.yatayTasma.sayfaGenislik}px / viewport ${d.yatayTasma.ekranGenislik}px</li>`);
    for (const c of (k.konsol || []).slice(0, 3)) detay.push(`<li class="k">${esc(c.tip)}: ${esc(c.mesaj)}</li>`);
    for (const a of (k.ag || []).slice(0, 3)) detay.push(`<li class="k">HTTP ${a.kod} — ${esc(a.url)}</li>`);

    const gorsel = k.gorsel
      ? `<img src="${esc(basename(k.gorsel))}" alt="${esc(k.etiket)}" loading="lazy">`
      : `<div class="yok">no image<br><small>${esc(k.hata || '')}</small></div>`;

    return `<article class="kart">
  <header><span class="no">${no}</span><div><b>${esc(k.etiket)}</b><br><small>${esc(k.tema)} · ${esc(k.yol)} · ${esc(k.motor)}</small></div></header>
  <div class="ekran">${gorsel}</div>
  <div class="rozetler">${rozet.map(([t, m]) => `<span class="rz ${t}">${esc(m)}</span>`).join('')}</div>
  ${detay.length ? `<ul class="detay">${detay.join('')}</ul>` : ''}
</article>`;
  }).join('\n');

  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>uisight — ${esc(o.url)}</title>
${o.izle ? `<meta http-equiv="refresh" content="${o.izle}">` : ''}
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin:0; background:#1e1f22; color:#dfe1e5; font:14px/1.5 "Segoe UI",system-ui,sans-serif; }
  .ust { position:sticky; top:0; z-index:5; background:#2b2d30; border-bottom:1px solid #393b40; padding:12px 20px; display:flex; gap:16px; align-items:center; flex-wrap:wrap; }
  .ust h1 { font-size:15px; margin:0; font-weight:600; }
  .ust a { color:#6ea8fe; text-decoration:none; }
  .ust .bilgi { color:#9da0a8; font-size:12px; }
  .canli { background:#2e7d32; color:#fff; padding:2px 8px; border-radius:10px; font-size:11px; }
  .izgara { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:20px; padding:20px; align-items:start; }
  .kart { background:#2b2d30; border:1px solid #393b40; border-radius:10px; overflow:hidden; }
  .kart header { display:flex; gap:10px; align-items:center; padding:10px 12px; border-bottom:1px solid #393b40; }
  .kart header small { color:#9da0a8; font-size:11px; }
  .no { display:grid; place-items:center; min-width:26px; height:26px; border-radius:50%; background:#4c6fd6; color:#fff; font-weight:700; font-size:13px; }
  .ekran { background:#111214; display:grid; place-items:center; padding:12px; }
  .ekran img { max-width:100%; border-radius:6px; border:1px solid #45474d; display:block; cursor:zoom-in; }
  .yok { color:#f28b82; padding:40px 12px; text-align:center; }
  .rozetler { display:flex; flex-wrap:wrap; gap:6px; padding:10px 12px 0; }
  .rz { font-size:11px; padding:2px 8px; border-radius:10px; font-weight:600; }
  .rz.kritik { background:#5c2b2b; color:#ffb4ab; }
  .rz.uyari  { background:#5a4a1f; color:#ffd77a; }
  .rz.bilgi  { background:#33383e; color:#b9bcc2; }
  .rz.ok     { background:#264d2c; color:#9ae6a4; }
  .detay { margin:10px 12px 12px; padding-left:18px; font-size:12px; color:#c3c6cc; }
  .detay li { margin:3px 0; }
  .detay .k { color:#ffb4ab; }
  .detay .u { color:#ffd77a; }
  code { background:#1e1f22; padding:1px 4px; border-radius:3px; font-size:11px; }
  dialog { border:none; background:transparent; max-width:96vw; max-height:96vh; padding:0; }
  dialog img { max-width:96vw; max-height:96vh; border-radius:8px; }
  dialog::backdrop { background:rgba(0,0,0,.85); }
</style></head><body>
<div class="ust">
  <h1>uisight</h1>
  <a href="${esc(o.url)}" target="_blank">${esc(o.url)}</a>
  <span class="bilgi">${new Date().toLocaleString('en-US')} · ${kayitlar.length} previews</span>
  ${o.izle ? `<span class="canli">LIVE — refreshes every ${o.izle}s</span>` : ''}
  <span class="bilgi">Spot a problem? Tell your AI the <b>card number</b> (e.g. "the header collides on card 3").</span>
</div>
<div class="izgara">
${kartlar}
</div>
<dialog id="buyut"><img id="buyukGorsel" alt=""></dialog>
<script>
  const dlg = document.getElementById('buyut'), img = document.getElementById('buyukGorsel');
  document.querySelectorAll('.ekran img').forEach((el) => el.addEventListener('click', () => { img.src = el.src; dlg.showModal(); }));
  dlg.addEventListener('click', () => dlg.close());
</script>
</body></html>`;
}

// Yalniz dogrudan calistirilinca CLI olarak kos; sunucu.mjs bu dosyayi import ediyor.
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
