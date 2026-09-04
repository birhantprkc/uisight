# Changelog

## 1.3.0

First release that works on a machine other than the one it was written on.

Earlier builds hard-coded a path to a local checkout, so installing the .vsix
anywhere else produced an extension whose every command failed silently. It now
runs the published package through `npx -p uisight@latest`, which also means the
engine updates itself: an extension installed once keeps getting new checks.

Three things that had quietly stopped working are fixed with it:

- Every command was talking to endpoints the panel no longer served (`/act` with
  `{tip}` instead of `/action` with `{type}`) and sending no CSRF token, so each
  one returned 403 and did nothing. Inspect reported "no findings" on pages full
  of them.
- The `nodePath` setting was declared under one name and read under another, so
  setting it had no effect.
- The panel was started with a flag it does not have, so it opened an external
  browser window every time on top of the side panel.

Also: the side panel now really is narrow (one column, phone sized to the bar)
instead of trying to fit a 1440px desktop view into 300px, and the marketplace
listing has an icon, a README and a licence.
