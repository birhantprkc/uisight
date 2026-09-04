/**
 * Signing in, so the audit can reach the screens behind auth.
 *
 * This is the single biggest coverage gap a UI auditor has. Of four real bugs a
 * person found by hand and sent in, three were behind a login the crawler never
 * passed. Auditing only the public pages means never looking at the half of the
 * app people actually spend their time in.
 *
 * Four routes, tried in order:
 *   0. `demoButton` in the recipe      (one click, no credentials at all)
 *   1. `code` in the recipe            (the store-review-account pattern)
 *   2. `devCode` in the OTP response   (the demo/dev-mode pattern)
 *   3. `password` field                (classic email + password)
 *
 * Route 2 is the valuable one: when an app is in demo mode the tool signs in
 * without any stored secret at all — it reads the code out of the response.
 *
 * Recipes live in ~/.uisight/accounts.json:
 *   {
 *     "default":  { "loginUrl": "/login", "email": "qa@example.com" },
 *     "demo.app":  { "loginUrl": "/login", "demoButton": "demoyu incele" },
 *     "myapp.com": {
 *       "accounts": [ { "name": "guide", "email": "..." },
 *                     { "name": "agency", "email": "..." } ],
 *       "switchRole": { "url": "/api/admin/view-as", "field": "role",
 *                       "roles": { "guide": "GUIDE", "agency": "AGENCY_OWNER" } }
 *     }
 *   }
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CONFIG = join(homedir(), '.uisight', 'accounts.json');

// Ports the URL spec marks unsafe: fetch() refuses them and the only clue is
// "bad port", which reads like a bug in this tool. 5060/5061 (SIP) sit right
// next to the default 5055 and are an easy accident.
const BLOCKED_PORTS = new Set([
  1, 7, 9, 11, 13, 15, 17, 19, 20, 21, 22, 23, 25, 37, 42, 43, 53, 69, 77, 79, 87, 95,
  101, 102, 103, 104, 109, 110, 111, 113, 115, 117, 119, 123, 135, 137, 139, 143, 161,
  179, 389, 427, 465, 512, 513, 514, 515, 526, 530, 531, 532, 540, 548, 554, 556, 563,
  587, 601, 636, 989, 990, 993, 995, 1719, 1720, 1723, 2049, 3659, 4045, 4190, 5060,
  5061, 6000, 6566, 6665, 6666, 6667, 6668, 6669, 6679, 6697, 10080,
]);
export function checkPort(port) {
  if (BLOCKED_PORTS.has(Number(port))) {
    throw new Error(`port ${port} is blocked by the URL spec — browsers and fetch() refuse it. Pick another, e.g. ${Number(port) + 1}.`);
  }
}

const read = () => {
  try { return JSON.parse(readFileSync(CONFIG, 'utf8')); } catch { return null; }
};

/**
 * The recipe for a host: exact host (with port) → hostname → `default`.
 *
 * A shared `default` is the practical answer for a portfolio of apps: register
 * one identity everywhere by hand, and the tool signs in with it. Automating
 * SIGN-UP per app (role choice, consent checkboxes, verification) breaks
 * differently in every app and is deliberately not attempted.
 */
export function recipeFor(url, accountName = null) {
  const cfg = read();
  if (!cfg) return null;
  const u = new URL(url);
  let r = cfg[u.host] || cfg[u.hostname] || cfg.default || null;
  if (!r) return null;
  if (cfg.default && r !== cfg.default) r = { ...cfg.default, ...r };

  // Several identities per host: what a guide sees is not what an agency sees.
  // Crawling with one account leaves half the app unaudited.
  if (Array.isArray(r.accounts) && r.accounts.length) {
    const a = accountName ? r.accounts.find((x) => x.name === accountName) : r.accounts[0];
    if (!a) return null;
    const { accounts, ...shared } = r;
    return { ...shared, ...a };
  }
  return r;
}

/** Account names defined for a host. Empty array means a single account. */
export function accountNames(url) {
  const cfg = read();
  if (!cfg) return [];
  const u = new URL(url);
  let r = cfg[u.host] || cfg[u.hostname] || cfg.default || null;
  if (cfg.default && r && r !== cfg.default) r = { ...cfg.default, ...r };
  return Array.isArray(r?.accounts) ? r.accounts.map((a) => a.name).filter(Boolean) : [];
}

/** A throwaway address for apps that hand back the code. No mailbox needed. */
export const throwawayEmail = (host) =>
  `qa-${Date.now().toString(36)}@${String(host).replace(/[^a-z0-9.-]/gi, '') || 'example'}.test`;

/**
 * Runs the sign-in flow. Returns { ok, email, step, message }.
 * `step` says where it stopped, so a failure is never silent.
 */
export async function signIn(page, recipe, log = () => {}) {
  const origin = new URL(page.url()).origin;

  // Route 0: a button that lets someone in without an account at all — "browse
  // the demo without signing up". Found the hard way: an audit of an app built
  // that way had to be scripted by hand, because all three credential routes
  // assume there are credentials. Some apps just have a door.
  //
  // Recipe-driven on purpose. Guessing which button opens a demo means one day
  // clicking "Delete everything" because it happened to say "Devam".
  if (recipe.demoButton) {
    await page.goto(origin + (recipe.loginUrl || '/login'), { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.waitForTimeout(1500);
    await dismissConsent(page);
    const target = recipe.demoButton.startsWith('/') || recipe.demoButton.includes('[')
      ? page.locator(recipe.demoButton).first()
      : page.locator(`text=/${recipe.demoButton}/i`).first();
    if (!(await target.count())) {
      return { ok: false, step: 'demo-button', message: `no button matching ${recipe.demoButton}` };
    }
    await target.click({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(4000);
    return finish(page, '(demo, no account)', 'demoButton');
  }

  const email = recipe.email || (recipe.generateEmail ? throwawayEmail(new URL(origin).hostname) : null);
  if (!email) return { ok: false, step: 'config', message: 'no email, and generateEmail is off' };

  let devCode = null;
  let apiError = null;
  const listener = async (res) => {
    if (!/otp|code|login|signin|auth/i.test(res.url())) return;
    try {
      const b = await res.json();
      const c = b?.devCode || b?.code;
      if (c && /^\d{4,8}$/.test(String(c))) devCode = String(c);
      // Keep the app's OWN error. Without it the tool says "no devCode — is the
      // app in demo mode?" and sends you hunting in the wrong place; the real
      // cause was a rate limit.
      if (res.status() >= 400 || b?.error) {
        apiError = `HTTP ${res.status()} · ${b?.error?.message || b?.message || b?.error?.code || 'unknown'}`;
      }
    } catch { /* not JSON */ }
  };
  page.on('response', listener);

  try {
    await page.goto(origin + (recipe.loginUrl || '/login'), { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.waitForTimeout(1800);

    const consent = await dismissConsent(page);
    if (consent) log(`consent banner dismissed: "${consent}"`);

    const emailField = await page.$('input[type=email], input[name*=mail i], input[placeholder*="@"]');
    if (!emailField) return { ok: false, step: 'email-field', message: 'no email field found' };
    await emailField.fill(email);
    log(`email filled: ${email}`);

    const passwordField = await page.$('input[type=password]');
    if (passwordField && recipe.password) {
      await passwordField.fill(recipe.password);
      await submit(page, log);
      await page.waitForTimeout(4000);
      return finish(page, email, 'password');
    }

    // The send button often stays disabled until the email is valid.
    await page.waitForFunction(
      () => [...document.querySelectorAll('button[type=submit], button')]
        .some((b) => !b.disabled && /code|send|continue|next|login|sign|kod|gonder|devam|giris/i.test(b.innerText)),
      { timeout: 12000 },
    ).catch(() => {});
    await submit(page, log);
    await page.waitForTimeout(3500);

    const code = recipe.code || devCode;
    if (!code) {
      return { ok: false, step: 'code', email,
        message: apiError ? `the app refused to send a code: ${apiError}`
                          : 'no code: none in the recipe and no devCode in the response' };
    }
    log(`code obtained (${recipe.code ? 'from recipe' : 'devCode from response'})`);

    const boxes = await page.$$('input[inputmode=numeric], input[maxlength="6"], input[maxlength="1"]');
    if (boxes.length === 1) await boxes[0].fill(code);
    else if (boxes.length >= 6) for (let i = 0; i < 6; i++) await boxes[i].fill(code[i]);
    else {
      const x = await page.$('input[type=text]:not([type=email]), input[type=tel]');
      if (!x) return { ok: false, step: 'code-field', email, message: 'no code field found' };
      await x.fill(code);
    }
    await page.waitForTimeout(600);
    await submit(page, log);
    await page.waitForTimeout(5000);
    return finish(page, email, recipe.code ? 'fixed-code' : 'devCode');
  } catch (e) {
    return { ok: false, step: 'error', email, message: String(e).split('\n')[0].slice(0, 140) };
  } finally {
    page.off('response', listener);
  }
}

async function submit(page, log = () => {}) {
  const b = await page.$$('button[type=submit]:not([disabled])');
  if (b.length) {
    // A swallowed click is how a cookie banner used to look like "no code field
    // found": the button was there, the overlay ate the click, and the failure
    // surfaced three steps later as the wrong diagnosis. Say what happened.
    const err = await b[b.length - 1].click({ timeout: 5000 }).then(() => null, (e) => String(e).slice(0, 160));
    if (!err) return;
    log(`submit click failed: ${err.slice(0, 120)}`);
    // Second chance without hit-testing: the element is real, something covers it.
    const forced = await b[b.length - 1].click({ force: true, timeout: 3000 }).then(() => null, () => 'forced click failed');
    if (!forced) { log('submit went through with force'); return; }
  }
  await page.keyboard.press('Enter').catch(() => {});
}

/**
 * Consent banners sit in a fixed overlay over the page and eat the very click
 * the sign-in needs. Dismissing one is not "extra automation" — without it the
 * audit never gets past the login screen on a first visit.
 */
export async function dismissConsent(page) {
  const before = page.url();
  const accepted = await page.evaluate(() => {
    const wanted = /kabul|accept|allow|tamam|onayla|agree|got it|anladim|anladım/i;
    for (const el of document.querySelectorAll('button, [role=button], a')) {
      const label = (el.textContent || '').trim();
      if (!wanted.test(label) || label.length > 40) continue;   // uzun metin banner dugmesi degil
      // Sabitlik EN YAKIN sarmalayicida degil, YUKARIDA bir yerde olur: banner'in
      // dugmeleri once static bir satir div'inde durur, `fixed` olan onun atasidir.
      // Yalniz closest()'e bakan surum Noben'in cerez bandini bulamadi ve giris
      // "kod alani yok" diye basarisiz oldu — yanlis teshis, gercek sebep ortulmus dugme.
      let fixed = false;
      for (let n = el; n && n !== document.body; n = n.parentElement) {
        if (/fixed|sticky/.test(getComputedStyle(n).position)) { fixed = true; break; }
      }
      if (!fixed) continue;
      el.click();
      return label.slice(0, 40);
    }
    return null;
  }).catch(() => null);
  if (!accepted) return null;

  await page.waitForTimeout(500);

  // Bir <a> "Kabul ediyorum" baglantisi sayfadan CIKARABILIR — o zaman kapattigimiz
  // sey bir banner degildi ve giris ekranini kaybettik. Geri don; kaybolmus bir
  // giris sayfasi, kapatilmamis bir banner'dan cok daha kotu.
  if (page.url() !== before) {
    await page.goto(before, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
    return null;
  }
  return accepted;
}


/** Success means LEAVING the login page. "HTTP 200" would call a wrong code a win. */
function finish(page, email, route) {
  const url = page.url();
  const still = /login|signin|auth|giris/i.test(new URL(url).pathname);
  return still
    ? { ok: false, step: 'verify', email, route, message: `still on the login page: ${url}` }
    : { ok: true, email, route, message: url };
}

/**
 * Switch role without a second account.
 *
 * Some apps let an admin view the system as another role. Using the app's OWN
 * mechanism is both more faithful and less to maintain than keeping one login
 * per role.
 */
export async function switchRole(page, recipe, roleName, log = () => {}) {
  const s = recipe?.switchRole;
  if (!s) return { ok: false, message: 'no switchRole in the recipe' };
  const value = s.roles?.[roleName];
  if (!value) return { ok: false, message: `unknown role: ${roleName} (have: ${Object.keys(s.roles || {}).join(', ')})` };

  const origin = new URL(page.url()).origin;
  const res = await page.evaluate(async ([url, field, value]) => {
    const r = await fetch(url, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    });
    let body = null;
    try { body = await r.json(); } catch { /* not JSON */ }
    return { status: r.status, body };
  }, [origin + s.url, s.field || 'role', value]);

  if (res.status >= 400) return { ok: false, message: `role switch refused (HTTP ${res.status})` };
  await page.goto(origin + (res.body?.redirect || '/'), { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(1500);
  log(`role -> ${roleName} (${value}) · ${page.url()}`);
  return { ok: true, role: roleName, url: page.url() };
}
