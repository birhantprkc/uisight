# Changelog

## 0.11.0 — 2026-09-04

The update notice was written for the wrong reader.

stderr is right for a terminal, where a person is watching. Under MCP it is
exactly wrong: the client files server stderr into a log, so the model never
sees it — and the model is the one who could actually fix it. An assistant that
does not know an update exists cannot offer to install it.

`status` now carries the news where the model reads it, and carries the fix with
it, including the step that fails silently when skipped: updating the package
does not restart the server already running, so the old one keeps answering
while everyone believes it was updated.

The stderr line stays for CLI runs. Neither one ever touches stdout, which
belongs to JSON-RPC — a test starts the real server, asks for `status`, and
proves every stdout line is still a JSON-RPC message.

## 0.10.0 — 2026-09-04

Everything shipped since 0.1.4 is invisible to the person still running 0.1.4.
npm installs a version and then never mentions it again, so the people most
likely to hit a bug that is already fixed are exactly the ones who cannot find
out.

**A version check that says one line and gets out of the way.** Once a day,
cached on disk, 2s timeout, silent on any failure, off with `NO_UPDATE_NOTIFIER=1`
and off in CI. Nothing is sent anywhere — it is the same public GET `npm view`
makes.

It writes to **stderr**, and that is the whole risk: the MCP server speaks
JSON-RPC over stdout, where one stray line corrupts the stream and the tool dies
looking like nothing at all. So a test starts the real server with a notice
guaranteed to fire and proves stdout stayed pure JSON — the notice must actually
appear on stderr, or the test proves nothing.

Version comparison is numeric, because as strings `"0.9.0" > "0.10.0"` and every
user on 0.10 would be told to downgrade.

## 0.9.0 — 2026-09-04

Someone ran this and watched their plan drain with no way to see where it went.
So the cost was measured rather than guessed, and the three places it actually
hides were closed.

**A full-page capture had no ceiling.** A 10,500px page is ~5,800 tokens and a
20,000px one is ~11,000 — and an image is not paid once, it stays in the
conversation and is re-sent on every later turn. The height is now capped
(`UISIGHT_MAX_IMAGE_TOKENS`, default 2000) rather than downscaled, because
shrinking a page until the text is unreadable defeats the point of looking. The
response says what it cost and what was left out: `~2000 tokens (412x3640) ·
showing the top 3640/10508px`.

**Tool definitions are a fixed tax on every request, not a one-off.** Nine tools
cost ~1,065 tokens whether or not you call them. `UISIGHT_TOOLS=core` keeps the
four a measuring session needs (~419); an explicit list goes lower (~211). Names
stay English even under `UISIGHT_LANG=tr`, so a config file does not change
meaning with the language.

**The cheap path is the CLI, and the README now says so with numbers.** `uisight`
and `uisight-audit` write a report the model reads once (~150-800 tokens);
driving the MCP tools screen by screen re-sends the whole conversation at every
step. The MCP tools are for acting on a page, not for surveying an app.

Nothing here changes what is measured — `inspect` was already returning text and
excluding the theme baseline, which is where 80% of that response would otherwise
have gone.

## 0.8.0 — 2026-09-04

The five checks that were still on the list, three of them measurable from the
page and two that are not.

**Errors that say nothing.** "An error occurred." leaves one option: try again
and hope. Quiet when the message names the problem, and quiet when a retry sits
next to it.

**Irreversible actions with nothing in the way.** The delete button is never
clicked — clicking it really deletes. What is measured is whether the page owns
any confirmation machinery at all: a dialog, a modal, or the button saying it
opens one. None of it means the loss is one tap away.

**Permissions asked for before there is a reason to say yes.** Hooks installed
before page code, calling the real API through, recording whether anything the
person did preceded the request. A load-time request has no context by
definition.

**Offline** (`offline-audit`) and **back** (`back-audit`) are panel actions,
because neither can be measured by looking at a page — the network has to drop
and the button has to be pressed. Offline distinguishes an app that cannot
answer (no service worker: marked `expected`, filtered out of the audit) from
one that registers a worker and still shows the browser's error page. Verified
in both directions on a real app: a finding on the dev server, silence on
production, where the worker serves a cached page.

**The Turkish text this tool exists to read does not look like its patterns.**
The error check was written as `olustu` and the screen says `oluştu`, so it
matched nothing. Text is folded to ASCII before matching now. A check that
cannot read its own audience's alphabet is worse than no check.

**`setContent` does not run init scripts**, so the permission hook was never
installed under test and every permission test passed by measuring nothing. The
tests that need a hook in place now navigate for real.

> Note: `uisight@0.7.0` on npm was published from a working tree mid-edit and
> carries three of these checks in an untested state. Everything in it passes its
> tests as of 0.8.0; prefer 0.8.0.

## 0.7.0 — 2026-09-04

A check nobody displays is a check that does not exist.

**Four checks were measured on every page and printed on none of them.** The CLI
report enumerated ten finding types; the engine produced fifteen. Nothing failed
— REPORT.md was simply shorter than the truth, which is the hardest kind of bug
to notice, because a short report is exactly what you hope to see. All of them
now appear, and three tests read the engine's own result initialiser and fail if
any consumer — report, editor extension, audit summary — leaves a type out. That
gate found a fifth gap on its first run: the extension had never shown `tinyText`.

**Notch / home indicator** (`unsafeArea`). The gate is what keeps it quiet:
without `viewport-fit=cover` iOS letterboxes the page and every inset is 0, so
nothing can be hidden. The finding only exists when a page asked for the full
screen and then never used the padding it got back — the PWA/TWA mistake exactly.

**"Two languages on one screen" was firing on 1% noise.** A real page had 591
Turkish markers against 7 English ones, all of them a carousel's "next" label.
The minority language now has to hold a meaningful share and appear as more than
one distinct word. The half-translated screen the check exists for still fires.

## 0.6.0 — 2026-09-04

One copy of the code, and three failures that were silent rather than loud.

**`uisight-audit`** walks every configured role and writes a report per page.
Pages not yet measured under any role go first, so a second role spends its
budget on new ground — that one change took a run from "6 pages, 4 of them
already measured" to four guide pages nobody had looked at, which is where two
covered controls and a keyboard finding turned up.

**The extension was talking to a server that no longer existed.** It called
`/act` with `{tip}` and read `d.dusukKontrast`; the panel had moved to `/action`
with `{type}` and English keys, and later started requiring a CSRF token. None
of that threw. The commands did nothing and Inspect said "no findings" on pages
full of them. Fixed, and `test/extension.test.mjs` now compares the two sides so
the next rename fails in CI instead of in front of a person.

**"No primary action" was firing on bottom navigation.** Tabs, menus and filter
chips are *supposed* to look alike. The check now skips navigation containers
and links that lead to different pages, and only fires when the group contains
an action that costs something to get wrong — save, delete, send, pay. Three
false alarms on one real app went to zero without losing the real case.

**Blocked ports are named.** `fetch()` refuses the ports the URL spec marks
unsafe, and the only clue is "bad port", which reads like a bug in this tool.
5060/5061 sit next to the default 5055 and are an easy accident — worse, a panel
bound to one is unreachable from a browser too. Now it says which port and
suggests another.

**Narrow mode for the side bar** (`?narrow=1`). The extension had been asking for
`?dar=1`, a flag the server stopped reading during the English migration, so the
side panel quietly opened the two-column desktop layout in a 300px strip — the
one thing narrow mode exists to prevent.

The `mobil-qa` fork is retired; nothing was lost (its 10 checks and 16 panel
actions all have an equivalent here) and the reason it had to go is the
extension bug above: two copies drift, and drift between a tool and its caller
is silent.

## 0.5.0 — 2026-09-04

The audit can now get past the sign-in wall, and it can see the keyboard.

**Sign-in** (`login.mjs`, `login` / `role` / `links` actions). Of four real bugs a
person found by hand, three were behind a login the crawler never passed. Three
routes are tried: a `code` in the recipe, a `devCode` returned by the app's own
OTP response, or a password field. The second is the good one — an app in demo
mode is audited with no stored secret at all.

Success means LEAVING the login page. "HTTP 200" would call a wrong code a win.

**Roles without extra accounts.** Some apps let an admin view the system as
another role; `switchRole` uses that mechanism instead of asking you to keep one
login per role. What a guide sees is not what an agency sees, and crawling with
one identity leaves half the app unaudited.

**Keyboard** (`keyboard`, `keyboard-audit`). Chromium's device emulation has no
soft keyboard: focusing a field changes nothing, so "the field ended up behind
the keyboard" was structurally invisible. Both behaviours were checked against a
real device (Pixel 7 / API 35), and they need different models:

- a focused field — Chrome scrolls it above the keyboard, so it is **not** a bug.
- a fixed bottom bar — stays pinned to the layout bottom and disappears. Shrinking
  the viewport moves it up and hides the bug, so it is measured against a band.

A floating chat button behind the keyboard is not reported: nearly every app has
one and it blocks nothing. A wide action bar or a submit is.

## 0.3.3 — 2026-09-04

**A round button is not covered by what shows through its corners.** A circle
inside a 56x56 box leaves about 21% of the box unpainted, and sampling those
corners returns whatever is behind. A floating chat button sitting *over* body
text was reported as 27% *covered by* that text — on four pages, in two roles.
Sampling now stays inside the inscribed ellipse for pill and circle shapes.

This one is worth naming because the finding was real and the direction was
backwards: the button did overlap the text. A check that describes a real
problem incorrectly still costs trust.

## 0.3.2 — 2026-09-04

**Truncated lists no longer hide the count.** Detail lists are capped so a bad
page does not flood the report — but printing the capped length as if it were the
total made the tool lie about how bad a page is. A site with 33 contrast failures
reported "12"; you fixed twelve, re-ran, saw "12" again, and nothing looked like it
had changed. That happened to the author, on a real page, while verifying a fix.

Every capped list now reports `shown / total` (`12 / 33`). The cap stays; the count
is honest.

## 0.3.1 — 2026-09-04

The three checks from 0.3.0, run against 14 live sites, produced 36 findings.
Verifying them one by one left **3**. The other 33 were four distinct kinds of
false alarm, and each one is now a test:

- **A modal covering the page beneath it** is what a modal is for. Exempting only
  the scrim was not enough — the dialog's own content box then took its place as
  the reported cover, so the rule walks ancestors and exempts anything inside a
  near-full-viewport overlay or an explicit `role="dialog"`.
- **`line-clamp` is deliberate truncation**, the same as `text-overflow: ellipsis`.
  17 of 18 "clipped text" findings were line-clamped recipe, quote and product
  cards.
- **Geometry alone lies.** A fixed element can overlap a box and still sit *behind*
  it. One site's floating button geometrically covered a cookie banner's buttons
  while rendering behind it, perfectly readable. `coveredByFixed` now asks
  `elementFromPoint` what is actually on top, the way `coveredControls` already did.

What survived is worth having: a cookie banner covering a hero headline, so every
first-time visitor sees the product's main promise hidden.

A check that fires on correct behaviour is a check people learn to ignore, so the
false-alarm tests matter more here than the detection ones.

## 0.3.0 — 2026-09-04

Three new checks, all of them things a person spots in a screenshot in one second
and no amount of contrast or size measurement can see.

- **`coveredControls`** — a control with something sitting on top of it: a floating
  action button parked on the corner of the primary CTA, a toast over "Save". The
  first version of this check sampled only the element's centre and was blind to
  exactly that case; it now samples a grid edge to edge, and the test that proves
  it is the real bug, not a hypothetical.
- **`coveredByFixed`** — text and buttons hidden behind a fixed or sticky bar. A
  header that scrolls over its own content reads as "half the sentence is missing".
- **`clippedText`** — text cut off by its own box. A deliberate `text-overflow:
  ellipsis` is not reported; a scroll container is not reported.

Six tests cover them, three for the defect and three for the false alarm — the
false-alarm half matters more, because a check people stop trusting is worse than
no check.

The "automated checks clean" line in both the report and the MCP summary now
accounts for these three. It is the same trap as before: a new check that the
clean-claim does not know about makes the tool print "clean" under its own findings.

## 0.2.1 — 2026-08-31

Three cold-start defects, all of them things a first-time user would hit and none of
them things an existing user would report:

- **A missing browser now tells you what to run.** npm installs Playwright's driver but
  not the browsers it drives, so the first `npx uisight` on a clean machine died on a raw
  Playwright stack trace. It now says `npx playwright install chromium` and explains why.
  The README says it too, as step one.
- **No locale is forced any more.** `locale: 'tr-TR'` was hard-coded in both the CLI and
  the panel, so every user in the world audited their app in Turkish — language switchers,
  date formats and all. The page now renders the way your machine would render it, and
  `--locale en-US` (or `UISIGHT_LOCALE`) pins one when you want a fixed baseline.
- **Report timestamps are locale-neutral** (ISO + UTC) instead of Turkish-formatted.

Two leftover Turkish strings in CLI output are gone, and the missing-browser path is
covered by a test.

## 0.2.0 — 2026-08-30

**Breaking.** The internals were written in Turkish (this started as a personal tool). Everything
is English now: identifiers, comments, HTTP endpoints and JSON field names. If you only use the
CLI, the MCP tools, or the panel, nothing changes — the CLI flags, the nine MCP tool names, and
the report format are all the same. If you called the panel's HTTP API directly, read on.

### Panel HTTP API (breaking)

| Before | Now |
| --- | --- |
| `POST /eylem` | `POST /action` |
| `GET /akis` (SSE) | `GET /stream` |
| `GET /kare` | `GET /frame` |
| `GET /durum` | `GET /state` |
| `GET /isaretler` | `GET /marks` |
| `{ tip: 'git' \| 'tikla' \| 'kaydir' \| 'tus' \| 'geri' \| 'ileri' \| 'yenile' \| 'denetle' \| 'kaydet' }` | `{ type: 'goto' \| 'click' \| 'scroll' \| 'press' \| 'back' \| 'forward' \| 'reload' \| 'inspect' \| 'save' }` |
| `?tam=1`, `?temizle=1` | `?full=1`, `?clear=1` |

### Inspection result fields (breaking)

`sel` replaces `secici` in every finding; `border` replaces `kenar` in theme-signature entries;
records carry `console` / `network` instead of `konsol` / `ag`, and a failed request reports
`status` instead of `kod`. The wire format is otherwise unchanged, and the measurements are
byte-identical — verified against a captured baseline before and after the migration.

### Also in this release

- `UISIGHT_FALLBACK=1` is the documented name for forcing the fallback frame stream
  (`MOBILQA_YEDEK=1` still works).
- The report no longer prints `Rapor :` in Turkish; it says `Gallery:` and `Report :`.

## 0.1.4 — 2026-08-20

- 13 regression tests that drive the real inspection engine in a real Chromium, plus GitHub
  Actions CI (syntax gate, tests, pack dry-run, version-sync gate, CLI smoke).
- README repositioned around the one thing that is hard to copy: your agent can already see a
  screenshot, but it cannot measure contrast, touch targets, or theme drift from one.

## 0.1.3 — 2026-08-19

Security hardening for the panel server, all four found by audit and each verified with a live
request before and after the fix:

- The server binds `127.0.0.1` only (it used to bind every interface, so anyone on the same
  network could drive the browser session).
- A per-run token, written to `~/.uisight/live/token-<port>` and required as a header on
  mutating endpoints (CSRF).
- A Host allowlist on every endpoint (DNS rebinding).
- A 1 MB request-body cap, and panel findings are HTML-escaped before they reach the page.

## 0.1.0 — 2026-08-18

First public release: CLI audits across device profiles and themes, the live panel with shared
human+AI sessions and the 📌 mark channel, and the MCP server with nine tools.
