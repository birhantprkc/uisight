/**
 * Bulgu kimligi — iki olcumu karsilastirabilmek icin.
 *
 * Ayri bir dosyada, cunku mcp.mjs bir GIRIS NOKTASI: import edilince sunucuyu
 * baslatip bloke oluyor, dolayisiyla testten cagrilamiyor. Test edilemeyen
 * yardimci, sessizce bozulan yardimcidir.
 */
/**
 * Bir bulgunun kimligi. Ayni sorunu iki olcumde eslestirebilmek icin, degisken
 * olan (piksel konumu) degil DEGISMEYEN yanini kullanir.
 */
export const fingerprint = (tur, x) => [
  tur,
  x.sel || '',
  (x.text || '').slice(0, 40),
  x.ratio || x.size || x.percent || x.edge || '',
].join('|');

export function fingerprints(d) {
  const s = new Set();
  for (const [tur, liste] of Object.entries(d || {})) {
    if (!Array.isArray(liste) || tur === 'themeSignature') continue;
    for (const x of liste) s.add(fingerprint(tur, x));
  }
  return s;
}