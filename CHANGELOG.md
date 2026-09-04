# Changelog

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
