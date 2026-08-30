# uisight (Türkçe özet)

**AI ekranı zaten görüyor. Ölçemiyor.**

Ekran görüntüsü ajana *tahmin* ettirir: "şu başlık biraz soluk duruyor." uisight **bildirir**:

```diff
- ekran goruntusunden:  "baslik biraz soluk gorunuyor, rengi ayarlasak?"
+ uisight'tan:          GORUNMEZ METIN 1.04:1 — span.bg-gradient-to-r "basligin"
+                       (metin rgba(255,255,255,.5) / zemin rgb(247,247,248))
```

Biri izlenim, diğeri seçicisi elinde bir ölçüm — ajan aramadan doğrudan o elemanı düzeltiyor.

uisight, **web ve responsive arayüzler** için bir MCP sunucusu (Claude Code, Cursor, Antigravity — MCP konuşan her araç): yan yana canlı mobil + masaüstü oturumları, ölçüm motoru ve insanla ajanın aynı ekranı paylaştığı panel.

## "Ajanım zaten yapıyor"

Kısmen doğru — computer use, tarayıcı araçları ve çoğu ajan iskeleti sayfayı açıp ekran görüntüsü alabiliyor. uisight o kısmın yerine geçmeye çalışmıyor. Eksik kalan üç şey var:

**1. Bakmak ölçmek değil.** Görüntüye bakan bir model kontrast oranı söyleyemez; 4,6:1 (geçer) ile 4,3:1'i (AA'da kalır) ayırt edemez — gözle aynı görünürler. Dokunma hedefinin 44 değil 41px olduğunu ya da bir elemanın açık/koyu temada aynı kaldığını (rengi sabit-kodlu) fark etmez. uisight bunları canlı DOM'dan hesaplar: alfa-harmanlı zeminler, gradient yazı, `oklch()` renkler dahil.

**2. Ekran görüntüsü hem pahalı hem az şey söyler.** Bir mobil kare ~1.500 token; karşılığı olan `denetle` çıktısı birkaç yüz token ve doğrudan aksiyona dönüşen bilgi.

**3. Kimse seninle birlikte bakmıyor.** Alışıldık kurulumda ajan sayfaya tek başına bakıp rapor eder. Burada aynı canlı oturumu ikiniz izlersiniz; bir sorun gördüğünde 📌 ile not bırakırsın, ajan notunu ve o anki kareyi okur.

Kapsam notu: uisight **web/responsive** içindir. Native iOS/Android uygulama kontrolü için [Argent](https://github.com/software-mansion/argent) çok daha kapsamlıdır.

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
