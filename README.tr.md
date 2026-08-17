# uisight (Türkçe özet)

**AI ekranı göremiyor; sen hatayı tarif edemiyorsun. uisight ikisini birden çözer.**

AI kod ajanına (Claude Code, Cursor, Antigravity — MCP konuşan her araç) uygulamanın üzerinde gerçek gözler verir: yan yana canlı mobil + masaüstü oturumları, "kötü görünüyor" yerine **sayı** raporlayan ölçüm motoru (`1.14:1`), ve insanla AI'ın aynı ekranı izlediği ortak panel.

## Hızlı başlangıç

```bash
npx uisight https://siteniz.com --theme both     # tek seferlik denetim: PNG + galeri + rapor
npx uisight-panel http://localhost:3000          # canlı panel: sen gez, AI izlesin (ve tersi)
```

MCP kaydı (Claude Code): `claude mcp add --scope user uisight -- npx -y uisight-mcp`

Türkçe araç adları için: `UISIGHT_LANG=tr` (`ekrani_gor`, `denetle`, `git`, `tikla`, `yaz`, `kaydir`, `cihaz_degistir`, `durum`, `isaretler`).

## Ne ölçer

Görünmez metin ve WCAG AA kontrast ihlalleri (alfa-harmanlı zeminler, gradient yazı, `oklab()` dahil) · 44px altı dokunma hedefleri · yatay taşma · 12px altı yazı · **tema kayması** (iki temada da aynı kalan = sabit-kodlu renk) · cihaz başına konsol/ağ hataları.

Panelde 📌: not yaz, iğnele — AI notunu ve o anki ekranı `marks`/`isaretler` aracıyla okur. "Ekran görüntüsü atayım da bak" devri kapanır.

Her şey lokal çalışır — bulut yok, hesap yok. Ayrıntı: [README.md](README.md) (İngilizce).

MIT © [SoloLabs](https://sololabs.com.tr)
