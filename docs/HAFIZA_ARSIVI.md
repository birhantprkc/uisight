# uisight — hafıza arşivi

Bu dosya, merkezi hafızadaki `reference_mobil_qa_araci` notunun taşan tarihçesidir
(kural: topic dosyası 3KB'yi aşmaz, taşan tarihçe repoya gider). Merkezi hafızada
yalnız güncel gerçek ve buraya işaret kalır.

Aşağısı 9 Ağustos – 4 Eylül 2026 arasında biriken kayıt; tarih sırasıyla değil
konu bloklarıyla yazılmıştı.

**Tarihî belge — bazı satırlar artık geçerli değil.** En belirgini:
`AGENTS/tools/mobil-qa` çatallanması 4 Eylül 2026'da emekliye ayrıldı, kod tek
yerde toplandı (`c:/dev/uisight`), IDE eklentisi ve MCP kaydı oraya çevrildi.
Güncel durum için repo kökündeki `README.md` ve `CHANGELOG.md` esastır.

---

Telefonda ekran görüntüsü alıp sohbete yapıştırma derdini bitiren set (9 Ağu 2026 kuruldu).

🔀 **TEK KOD TABANI — `c:\dev\uisight` (4 Eyl 2026).** `AGENTS/tools/mobil-qa` çatallanması emekliye ayrıldı; kayıp yok (10 denetimi + 16 eylemi karşılığıyla taşındı), oradaki `docs/` tarihçe olarak kaldı, kod git geçmişinde. 🔑 **Gitmesinin sebebi somut:** IDE eklentisi denetim sonucunu hâlâ eski Türkçe alan adlarıyla okuyordu (`dusukKontrast`), motor İngilizce anahtara geçince "bulgu yok" demeye başladı — hata değil SESSİZLİK. İki kopya uzaklaşır, araçla çağırıcısı arasındaki kayma sessizdir.

**Parçalar** (hepsi `c:\dev\uisight`, npm `uisight`, GitHub PUBLIC MIT `sololabstr/uisight`):
- `uisight <url> --device iphone-15,pixel,ipad --theme both` → `uisight-outputs/<host>-<zaman>/` PNG + `gallery.html` + `REPORT.md`. Kullanıcı sorunu **kart numarasıyla** tarif eder.
- `uisight-panel` → web(1440)+mobil yan yana canlı panel; adres çubuğu tüm oturumlara gider; **📌 İşaretle** = insan→AI kanalı (alan seçerek kırpar).
- `uisight-mcp` → MCP omurgası. Kayıt: `claude mcp add --scope user uisight -- node c:\dev\uisight\src\mcp.mjs`. `UISIGHT_LANG=tr` ile TR araç adları.
- `uisight-audit` → **giriş yapıp her rolü gezer**; hiçbir rolde ölçülmemiş sayfalar öne alınır. Hesaplar `~/.uisight/accounts.json`.
- `extension/` → VS Code + Antigravity eklentisi (`sololabs.uisight` 1.2.1, ikisine de kurulu), sol menüde kendi ikonu. Antigravity'nin CLI'si YOK → `.vsix` açılıp `~/.antigravity-ide/extensions/` altına kopyalanır + `extensions.json` elle güncellenir.

🔑 **Panel jetonu her çağırıcıyı bağlar.** Sunucu `/action`'da `x-uisight-token` ister (jeton: `~/.uisight/live/token-<port>`). Bunu göndermeyen çağırıcı 403 alır ve **sessizce hiçbir şey yapmaz** — kullanıcının "her şey göstermelik gibi" dediği arıza buydu, iki kez (panel, sonra eklenti).

🔴 **Bloklu portlar:** `fetch()` ve tarayıcılar URL şartnamesinin yasakladığı portları reddeder (5060, 5061, 6000…). Varsayılan 5055'in hemen yanı → kolay kaza; tek ipucu "bad port" ve aracın hatası sanılır. `checkPort()` artık adıyla söylüyor.

🔑 **Ders (üç kez ödendi): "bulgu yok" ≠ "sorun yok".** Yanlış-temiz rapor eksik rapordan tehlikeli. Ve **yanlış-alarm testleri tespit testlerinden önemli** — doğru davranışta öten kontrol (alt gezinme çubuğunda "ana eylem belirsiz") kimsenin dinlemediği kontroldür. Her kontrolün iki testi var; 49 test.

🔑 **Yapay vaka yalan söyler.** Klavye modeli, örtülme kontrolü ve yuvarlak düğme köşeleri: üçü de ancak GERÇEK şeye bakınca düzeldi. Gerçeği temsil etmeyen sentetik vaka, aracı bozan bir "düzeltme" üretir.

📱 **Emülatör köprüsü:** Android SDK kurulu (`c:\dev\android-sdk`, AVD `fiko-test` = Pixel 7 / API 35). `adb forward tcp:9222 localabstract:chrome_devtools_remote` + Playwright `connectOverCDP` → motor gerçek TWA'da koşar. 🔑 Play 1080×2400'ü REDDEDER (uzun kenar ≤ 2× kısa) → `wm size 1080x1920`. 🔑 Web katmanının göremediği tek şey Android kabuğu: `TranslucentCustomTabActivity`=sağlıklı TWA · `CustomTabActivity`=adres çubuğu var · `FirstRunActivity`=Chrome karşılama ekranı önü kapatıyor.

📲 **scrcpy** (winget `Genymobile.scrcpy`): gerçek telefon aynası. NFC çipi, gerçek PWA kurulumu, bildirim yakalama için tek yol. Claude görsün diye: `adb exec-out screencap -p > x.png` → Read.

📚 Tarihçe (güvenlik denetimi 16 bulgu · npm+registry yayın dersleri · X patlaması ve konumlandırma dersi · TR→EN göçünün iki hasarı · yanlış-pozitif turları): repo `docs/HAFIZA_ARSIVI.md`. Güncel durum: repo `README.md` + `CHANGELOG.md`.

🔴 SENDE: **npm publish KULLANICI TERMİNALİNDEN** (2FA tarayıcı onayı ister, headless kabuktan OLMAZ) — npm 0.1.4, yerel 0.6.0 · Smithery + mcp.so listelemesi · org namespace (registry#1551).

Bkz [[feedback_ui_isinde_mobil_qa_denetimi]] · [[feedback_uretilen_ciktiya_gozle_bak]].
