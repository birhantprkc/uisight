// FiKo giris-arkasi uisight denetimi — uisight'in kendi olcum motoru + FiKo'nun demo girisi.
// Gerekce: uisight-audit'in bildigi 3 giris yolu (parola / sabit kod / devCode) FiKo'da yok;
// FiKo'da tek-tik demo butonu var. Motoru dogrudan cagiriyoruz.
import { chromium, devices } from 'playwright';
import { INSPECTION_SCRIPT, PROFILES, deviceSettings } from 'file:///C:/dev/uisight/src/cli.mjs';
import fs from 'fs';

const ADRES = 'https://fiko.sololabs.tr';
const SAYFALAR = ['/app','/transactions','/transactions/new','/borclar','/takvim','/accounts',
                  '/reports','/profile','/fisler','/recurring','/budgets','/modules'];
const CIHAZ = process.argv[2] || 'iphone-15';

const prof = PROFILES[CIHAZ];
const ayar = deviceSettings(prof.playwright);
const tarayici = await chromium.launch();
const ctx = await tarayici.newContext({ ...devices[prof.pw], locale: 'tr-TR' });
const page = await ctx.newPage();

// --- FiKo demo girisi: "Kayit olmadan demoyu incele" butonu ---
await page.goto(ADRES + '/login', { waitUntil: 'networkidle', timeout: 60000 });
const demoBtn = page.locator('text=/demoyu incele/i').first();
if (!(await demoBtn.count())) { console.error('DEMO BUTONU YOK'); process.exit(1); }
await demoBtn.click();
await page.waitForURL(/\/(app|onboarding)/, { timeout: 30000 }).catch(()=>{});
await page.waitForTimeout(3000);
console.error('giris: ' + page.url());

const rapor = [];
for (const yol of SAYFALAR) {
  try {
    await page.goto(ADRES + yol, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(2500);
    const son = new URL(page.url()).pathname;
    if (son === '/login' || son === '/') { rapor.push({ yol, hata: 'giris dusmus (' + son + ')' }); continue; }
    const b = await page.evaluate(INSPECTION_SCRIPT, { mobile: prof.mobile !== false, theme: 'light' });
    rapor.push({ yol, url: son, bulgu: b });
    await page.screenshot({ path: `C:/Users/yusuf/AppData/Local/Temp/claude/c--dev/0eebb62a-5a64-4197-b32e-17e5d9c229af/scratchpad/ss/${CIHAZ}${yol.replace(/\//g,'_')}.png` });
    console.error('ok ' + yol);
  } catch (e) { rapor.push({ yol, hata: String(e).slice(0,120) }); console.error('HATA ' + yol); }
}
fs.writeFileSync(`C:/Users/yusuf/AppData/Local/Temp/claude/c--dev/0eebb62a-5a64-4197-b32e-17e5d9c229af/scratchpad/audit-${CIHAZ}.json`, JSON.stringify(rapor, null, 1));
console.error('BITTI: ' + rapor.length + ' sayfa');
await tarayici.close();
