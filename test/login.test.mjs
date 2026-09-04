/**
 * Sign-in, and the overlay that used to defeat it.
 *
 * Found by an agent auditing a different app: a cookie banner sat over the login
 * form and ate the submit click. Playwright reported nothing useful, and the
 * failure surfaced three steps later as "no code field found" — a wrong
 * diagnosis pointing at a field that was fine. The banner is the bug.
 *
 * The dangerous part of the fix is the fix itself: clicking things that say
 * "Kabul" can navigate away and lose the login page entirely. These tests pin
 * both halves — dismiss the banner, and never leave the page to do it.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser?.close(); });

/**
 * The banner helper on its own. Driving the whole signIn flow to reach it made
 * the tests slow and made a failure ambiguous — the point here is the overlay,
 * not the ten steps after it.
 */
async function dismiss(html, { url = 'https://example.test/login' } = {}) {
  const { dismissConsent } = await import('../src/login.mjs');
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.route('**/*', (r) => r.fulfill({ contentType: 'text/html', body: html }));
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  const clicked = await dismissConsent(page);
  const state = { url: page.url(), banner: (await page.$('#banner')) !== null, clicked };
  await ctx.close();
  return state;
}

test('a fixed consent banner is dismissed so the form underneath is reachable', async () => {
  const s = await dismiss(`
    <body>
      <div id="banner" style="position:fixed;inset:0;background:#000a">
        <button onclick="document.getElementById('banner').remove()">Kabul et</button>
      </div>
      <form><input type="email"><button type="submit">Devam</button></form>
    </body>`);
  assert.equal(s.banner, false, 'the banner must be gone');
  assert.match(s.url, /\/login$/, 'and we must still be on the login page');
});

test('an accept LINK that navigates away is undone, not left behind', async () => {
  // This is the failure mode the guard exists for: losing the login screen is
  // far worse than leaving a banner up.
  const s = await dismiss(`
    <body>
      <div id="banner" style="position:fixed;bottom:0">
        <a href="/policy">Kabul ediyorum</a>
      </div>
      <form><input type="email"><button type="submit">Devam</button></form>
    </body>`);
  assert.match(s.url, /\/login$/, 'a navigation must be walked back');
});

test('an ordinary in-page button that says "Kabul" is not touched', async () => {
  const s = await dismiss(`
    <body>
      <form>
        <input type="email">
        <button type="submit">Kabul ediyorum ve devam et</button>
      </form>
    </body>`);
  assert.equal(s.clicked, null, 'a real form button is not a consent banner');
  assert.match(s.url, /\/login$/);
});

test('a page with no banner is left completely alone', async () => {
  const s = await dismiss(
    `<body><form><input type="email"><button type="submit">Devam</button></form></body>`);
  assert.equal(s.clicked, null, 'nothing to dismiss means nothing is clicked');
});

/**
 * Route 0: a door with no lock.
 *
 * Some apps let you in with one click — "browse the demo without signing up".
 * All three credential routes assume credentials exist, so an audit of an app
 * built that way had to be hand-scripted. It is recipe-driven rather than
 * guessed: a tool that picks its own button will one day pick "Delete
 * everything" because it happened to say "Devam".
 */
async function viaDemo(html, recipe) {
  const { signIn } = await import('../src/login.mjs');
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.route('**/*', (r) => {
    const u = new URL(r.request().url());
    const body = u.pathname === '/app' ? '<body><h1>Panel</h1></body>' : html;
    return r.fulfill({ contentType: 'text/html', body });
  });
  await page.goto('https://demo.test/login', { waitUntil: 'domcontentloaded' });
  const res = await signIn(page, recipe, () => {});
  await ctx.close();
  return res;
}

test('a one-click demo button gets in with no credentials at all', async () => {
  const res = await viaDemo(
    `<body><a href="/app">Kayıt olmadan demoyu incele</a></body>`,
    { loginUrl: '/login', demoButton: 'demoyu incele' },
  );
  assert.equal(res.ok, true, `expected in, got ${JSON.stringify(res)}`);
  assert.equal(res.route, 'demoButton');
});

test('a missing demo button is named, not reported as some other failure', async () => {
  const res = await viaDemo(
    `<body><form><input type="email"></form></body>`,
    { loginUrl: '/login', demoButton: 'demoyu incele' },
  );
  assert.equal(res.ok, false);
  assert.equal(res.step, 'demo-button', 'the wrong diagnosis is what makes these hard to fix');
});
