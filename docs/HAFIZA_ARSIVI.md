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


---

# 4-5 Eylul 2026 anlik goruntusu (hafiza 3KB'ye indirilmeden once)

Telefonda ekran görüntüsü alıp sohbete yapıştırma derdini bitiren set (9 Ağu 2026 kuruldu).

🔀 **TEK KOD TABANI — `c:\dev\uisight` (4 Eyl 2026).** `AGENTS/tools/mobil-qa` çatallanması emekliye ayrıldı; kayıp yok (10 denetimi + 16 eylemi karşılığıyla taşındı), oradaki `docs/` tarihçe olarak kaldı, kod git geçmişinde. 🔑 **Gitmesinin sebebi somut:** IDE eklentisi denetim sonucunu hâlâ eski Türkçe alan adlarıyla okuyordu (`dusukKontrast`), motor İngilizce anahtara geçince "bulgu yok" demeye başladı — hata değil SESSİZLİK. İki kopya uzaklaşır, araçla çağırıcısı arasındaki kayma sessizdir.

**Parçalar** (hepsi `c:\dev\uisight`, npm `uisight`, GitHub PUBLIC MIT `sololabstr/uisight`):
- `uisight <url> --device iphone-15,pixel,ipad --theme both` → `uisight-outputs/<host>-<zaman>/` PNG + `gallery.html` + `REPORT.md`. Kullanıcı sorunu **kart numarasıyla** tarif eder.
- `uisight-panel` → web(1440)+mobil yan yana canlı panel; adres çubuğu tüm oturumlara gider; **📌 İşaretle** = insan→AI kanalı (alan seçerek kırpar).
- `uisight-mcp` → MCP omurgası. Kayıt: `claude mcp add --scope user uisight -- node c:\dev\uisight\src\mcp.mjs`. `UISIGHT_LANG=tr` ile TR araç adları.
- `uisight-audit` → **giriş yapıp her rolü gezer**; hiçbir rolde ölçülmemiş sayfalar öne alınır. Hesaplar `~/.uisight/accounts.json`.
- `extension/` → VS Code + Antigravity eklentisi (`sololabstr.uisight` 1.4.0 (Open VSX'te yayında), ikisine de kurulu), sol menüde kendi ikonu. Antigravity'nin CLI'si YOK → `.vsix` açılıp `~/.antigravity-ide/extensions/` altına kopyalanır + `extensions.json` elle güncellenir.

🔑 **Panel jetonu her çağırıcıyı bağlar.** Sunucu `/action`'da `x-uisight-token` ister (jeton: `~/.uisight/live/token-<port>`). Bunu göndermeyen çağırıcı 403 alır ve **sessizce hiçbir şey yapmaz** — kullanıcının "her şey göstermelik gibi" dediği arıza buydu, iki kez (panel, sonra eklenti).

🔴 **Bloklu portlar:** `fetch()` ve tarayıcılar URL şartnamesinin yasakladığı portları reddeder (5060, 5061, 6000…). Varsayılan 5055'in hemen yanı → kolay kaza; tek ipucu "bad port" ve aracın hatası sanılır. `checkPort()` artık adıyla söylüyor.

🔑 **Ders (üç kez ödendi): "bulgu yok" ≠ "sorun yok".** Yanlış-temiz rapor eksik rapordan tehlikeli. Ve **yanlış-alarm testleri tespit testlerinden önemli** — doğru davranışta öten kontrol (alt gezinme çubuğunda "ana eylem belirsiz") kimsenin dinlemediği kontroldür. Her kontrolün iki testi var; 116 test.

🔑 **Yapay vaka yalan söyler.** Klavye modeli, örtülme kontrolü ve yuvarlak düğme köşeleri: üçü de ancak GERÇEK şeye bakınca düzeldi. Gerçeği temsil etmeyen sentetik vaka, aracı bozan bir "düzeltme" üretir.

📱 **Emülatör köprüsü:** Android SDK kurulu (`c:\dev\android-sdk`, AVD `fiko-test` = Pixel 7 / API 35). `adb forward tcp:9222 localabstract:chrome_devtools_remote` + Playwright `connectOverCDP` → motor gerçek TWA'da koşar. 🔑 Play 1080×2400'ü REDDEDER (uzun kenar ≤ 2× kısa) → `wm size 1080x1920`. 🔑 Web katmanının göremediği tek şey Android kabuğu: `TranslucentCustomTabActivity`=sağlıklı TWA · `CustomTabActivity`=adres çubuğu var · `FirstRunActivity`=Chrome karşılama ekranı önü kapatıyor.

📲 **scrcpy** (winget `Genymobile.scrcpy`): gerçek telefon aynası. NFC çipi, gerçek PWA kurulumu, bildirim yakalama için tek yol. Claude görsün diye: `adb exec-out screencap -p > x.png` → Read.

💸 **TOKEN MALİYETİ — ölçüldü, tahmin değil (4 Eyl):** görüntü ≈ en×boy/750. `uisight <url>` + RAPOR okuma **~800 token, TEK SEFER** · `uisight-audit` ~150-800 · MCP `inspect` ~570/çağrı · `see_screen` ~460 · `see_screen full` ~2000 (eskiden ~5772, artık tavanlı) · **araç tanımları ~1065 token/HER İSTEK**. 🔑 **En büyük tasarruf CLI:** rapor dosyaya yazılır, model bir kez okur; MCP'yi ekran ekran sürmek her adımda tüm sohbeti yeniden gönderir. 🔑 **Görüntü BİR KEZ ödenmez** — sohbette kalır, her turda yeniden gider; `inspect` metni bu yüzden var. Kaldıraçlar: `UISIGHT_TOOLS=core` (1065→419) · `UISIGHT_MAX_IMAGE_TOKENS` · ham JSON yerine `inspectionText` (%80 az). Detay: repo README "What it costs".

🔭 **KOKART TURU (4 Eyl) — aracın GÖREMEDİKLERİ; sıradaki kontroller buradan çıkar:**
1. **Bayat sunucu sessizce yalan söylüyor.** Açık kalan `next dev` eski CSS'i servis etti, üstelik parça adı AYNI kaldı → araç PR #9'da düzeltilmiş kontrastı "hâlâ 3.1:1" ölçtü, prod'da doğruydu. Öneri: hedefin build kimliğini rapor başına yaz.
2. **Dev katmanı hayalet bulgu üretiyor.** `NEXTJS-PORTAL` sol-altta duruyor; "Kaydet %27 örtülü" onun eseriydi, üretim yapısında yok. Öneri: bilinen dev katmanlarını örtücü sayma ya da etiketle.
3. **Düğmenin KENDİ atası örtücü sayılıyor.** Yuvarlak köşe örneklemesi kaba düşüyor → "covered by DIV.flex items-center" (kabın metni yine "Kaydet"). Öneri: örtücü hedefin atasıysa bulgu değil.
4. **Komşu düğmeler birbirini örtüyor sanılıyor.** İki nokta düğmesi "%20 örtülü" dedi; dördü de tıklanabilir (ölçtüm). Öneri: kenar örneklemesinde 1-2px içeri kaç.
5. **`interactive-widget` okunmuyor — en pahalısı bu.** `keyboard-audit` sabit çubuğu banda göre ölçüyor; `resizes-content` bildiren sayfayı da "klavyenin altında" sayıyor → düzeltme yapılsa bile sayaç düşmüyor ve "tutmadı" sanılıyor. Öneri: viewport meta'sını oku, `resizes-content` varsa düzen alanını küçültüp yeniden ölç.
6. **Dekoratif maket UI'ı gerçek sanıyor.** Karşılama sayfasındaki telefon maketinin sahte alt menüsü her turda "44px altı" veriyor. Öneri: `aria-hidden`/`inert` kabındaki hedefleri ele.
7. **Git Bash `--path /` değerini `C:/Program Files/Git/` yapıyor** (MSYS yol çevirisi) → ana sayfa hiç taranmadı ama rapor "ok" dedi. Çare: `MSYS_NO_PATHCONV=1`. Öneri: Windows mutlak yola benzeyen `--path` değerini reddet.
8. **Panel/port karışması sessiz.** 5055'te fiko'ya bakan panel duruyordu; `uisight-audit` onu denetleyecekti. Öneri: denetim başında hedef URL'i bas, hesap dosyasındaki host ile eşleşmiyorsa dur.
9. **`accounts.json` host bazlı, PROJE bazlı değil.** `localhost:3000` tüm projelerde ortak; oraya sabit `code` koymak başka projenin `devCode` yolunu bozar (bu yüzden geri alındı).
10. **Oran limiti denetimi kilitliyor.** Elle atılan OTP istekleri saatlik limiti doldurdu, denetim `HTTP 429` ile durdu — araç uygulamanın kendi mesajını verdi, bu DOĞRU davranış. Öneri: limit dolduğunda ne zaman açılacağını söyle.

🔬 **SAHA RAPORU MEKANİZMASI — günün asıl kazanımı (4 Eyl).** Prompt: `AGENTS/docs/UISIGHT_DENETIM_PROMPTU.md`, her repoda aynısı, dört başlıkta rapor ister. 🔑 **Dördüncü başlık "aracın göremedikleri" mekanizmanın kendisi:** dört proje (lexa, kokart, fiko, noben) paralel koşturuldu → **16 gerçek uisight hatası + 3 yeni kontrol** çıktı. Raporlar `uisight/docs/saha-raporlari/`. Kural: **birden çok projede tekrar eden şikâyet sıradaki kontrol; tek projeden geleni beklet.**

🔴 **Bulunanların en kötü ikisi, ikisi de SESSİZDİ:** ① Olay dinleyicileri path döngüsünde birikiyordu — 12 sayfada her birinde 2 gerçek hata varken rapor `22,20,18…2` diyordu, yalnız SON sayfa doğruydu. Çıktıda yanlış duran hiçbir şey yok, hayatta kalma sebebi bu. Lexa gürültülü veriyle, Kokart `5,4,3,2,1` ile bağımsız doğruladı. ② `keyboard-audit` ÇALIŞAN bir düzeltmeye "tutmadı" dedirtti (`interactive-widget=resizes-content` okunmuyordu) — ajan doğru düzeltmesini neredeyse geri alıyordu. **Araç kullanıcıyı doğru işi bozmaya iterse, hiç bulmayan araçtan kötüdür.**

🔑 **Üç kez tekrarlanan ders:** sentetik test geçer, gerçek sayfa yalanlar. `clippedContainer` ilk yazımı `scrollWidth` kullandı, testlerinden geçti, ilk gerçek sayfada 4 yanlış alarm verdi (animasyonlu zemin lekeleri + kayan şerit). Doğru ölçü: **akıştaki, metin taşıyan çocuk kabın dışına taşıyor mu.** Aynı şey `textUnderControl`'de de oldu (çerez banner'ı). Yeni kontrol yayınlanmadan önce 4+ gerçek sayfada koşturulur.

📉 **Kalibrasyon sonucu ölçüldü:** aynı 6 sayfada 0.12.0 → 0.21.0, bulgu 132 → 114; `buttonIssues` 13 → 1 (44px kuralı dokunma-hedefi kontrolüyle mükerrerdi). 🔴 Regresyon testi hatayı GERÇEKTEN yakalıyor mu diye hata geri konularak sınanır — yakalayamayan test değersizdir.

📚 Tarihçe (güvenlik denetimi 16 bulgu · npm+registry yayın dersleri · X patlaması ve konumlandırma dersi · TR→EN göçünün iki hasarı · yanlış-pozitif turları): repo `docs/HAFIZA_ARSIVI.md`. Güncel durum: repo `README.md` + `CHANGELOG.md`.

🧩 **EKLENTİ OPEN VSX'TE CANLI (4 Eyl):** `sololabstr.uisight` 1.3.1 — Antigravity/Cursor/VSCodium'da aranıp kurulabiliyor ve **otomatik güncelleniyor**. 🔑 Yayından ÖNCE taşınabilirlik sorunu çözüldü: eklenti `c:/dev/uisight` yoluna çiviliydi, o haliyle yayınlansa herkeste her komut sessizce başarısız olurdu. Artık yerel kopya yoksa `npx -p uisight@latest` ile paketi koşuyor — hem taşınabilir hem motoru kendi güncelliyor. 🔴 **Kimlik tuzağı: `github.com/sololabs` BİZE AİT DEĞİL** (Ekim 2023, başka bir organizasyon); Open VSX namespace doğrulaması aynı adlı GitHub hesabına baktığı için publisher **`sololabstr`** yapıldı. Eclipse username `sololabs` (değişmez, önemsiz) · Eclipse'e yazılan GitHub Username `yusufcemres` · npm `sololabs` (ayrı defter). Yayın adımları + kimlik envanteri: `AGENTS/.credentials/05_infrastructure.md`. 🔴 Yayın token'ı BİLİNÇLİ saklanmıyor: eklenti otomatik güncellendiği için o token sızarsa yabancıların editörüne kod iter — her yayından önce üret, sonra sil.

🔔 **SÜRÜM UYARISI (0.10.0):** 0.1.4'te kalan kullanıcı yeni sürümü hiç öğrenemiyordu. Günde bir kez kontrol, **stderr'e** tek satır — 🔑 stdout JSON-RPC'nin, oraya kaçan tek satır MCP'yi sessizce öldürür (test bunu kanıtlıyor). `NO_UPDATE_NOTIFIER=1` ile kapalı, CI'da zaten kapalı. Sürüm karşılaştırması sayısal: dizi olarak "0.9.0" > "0.10.0" ve herkese "geri in" denirdi.

📦 **ÜÇ KANAL DA 0.11.0'DA (4 Eyl):** npm `uisight@0.11.0` · MCP registry `io.github.yusufcemres/uisight` 0.11.0 · Open VSX `sololabstr.uisight` 1.3.1. ⚠️ npm'deki 0.7.0 düzenleme sürerken yayınlandı, git 0.7.0 ile AYNI DEĞİL — yayın sırasında aynı dosyada çalışılmaz.

🔑 **Yayın token'ı artık dosyada, DEĞER ASLA BASILMADAN kullanılıyor:** `AGENTS/.credentials/tokens/ovsx.txt` (tek satır, gitignore'lu). Kullanım `export OVSX_PAT=$(cat ...)` — 🔴 `-p <değer>` YAZILMAZ, o değeri kalıcı olarak sohbet kaydına geçirir (bir kez yaşandı, token iptal edildi). npm 2FA ve MCP registry JWT'si saklanamaz, onlar kullanıcı terminalinden.

✅ 0.1.0-0.1.4 ve 0.7.0 DEPRECATED (4 Eyl) — eski `npm i -g` kurulumlarina ulasmanin tek yolu buydu. 🔴 SENDE: VS Code Marketplace (aex.dev.azure.com — 🔴 portal.azure.com DEĞİL, o kart ister; PAT'lar 1 Ara 2026'da kapanıyor) · Open VSX doğrulama rozeti · Smithery + mcp.so listelemesi · org namespace (registry#1551).

🔑 **Uyarı iki kanalda (0.11.0):** CLI koşusunda stderr, MCP'de **status aracının çıktısı** — stderr MCP'de istemcinin log dosyasına düşer, model görmez, görmeyen asistan güncellemeyi teklif edemez. Metin çözümü de taşıyor: 🔴 paketi güncellemek ÇALIŞAN sunucuyu yeniden başlatmaz, editor restart ŞART. ⚠️ **Sürüm uyarısının SINIRI:** kod 0.10.0'ın içinde, yani 0.1.4'te donmuş biri onu göremez — sonraki donmaları engeller, mevcut olanı değil. `npx uisight` kullananlar zaten `latest` çözüyor, sorun yalnız eski `npm i -g` kurulumlarında; onlara ulaşmanın tek yolu `npm deprecate`.

Bkz [[feedback_ui_isinde_mobil_qa_denetimi]] · [[feedback_uretilen_ciktiya_gozle_bak]].
