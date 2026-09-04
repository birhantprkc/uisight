/**
 * What the panel will accept as a page to measure.
 *
 * Its own module so it can be tested without starting a panel: importing
 * server.mjs launches a browser and binds a port, which made the same two
 * assertions take fifty seconds.
 */

/**
 * @param {string} girdi  whatever came in on the command line
 * @returns {{url: string} | {error: string}}
 */
export function normalizeTarget(girdi) {
  let u = (girdi || '').trim();
  if (!u) return { url: 'http://localhost:3000' };

  // `localhost:3000` has the same shape as `data:text/html` -- a word, a colon,
  // then something. What separates them is that a port is digits, so a colon
  // followed by a digit is a host and everything else is a scheme.
  if (!/^[a-z][a-z0-9+.-]*:(?!\d)/i.test(u)) u = 'http://' + u;

  // Carrying an unparseable string forward is worse than refusing it:
  // `about:blank` used to become `http://about:blank`, and the panel started
  // anyway -- serving its HTML, so it looked alive, while /state threw and
  // destroyed the socket. To discovery, to uisight-audit and to the MCP tools
  // that panel did not exist.
  let ayristirilmis;
  try { ayristirilmis = new URL(u); } catch { return { error: u }; }
  if (ayristirilmis.protocol !== 'http:' && ayristirilmis.protocol !== 'https:') return { error: u };
  return { url: u };
}
