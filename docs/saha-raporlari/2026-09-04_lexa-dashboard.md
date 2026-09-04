# Saha raporu — lexa-dashboard (4 Eylül 2026)

Denetim promptu: `AGENTS/docs/UISIGHT_DENETIM_PROMPTU.md`.
Uygulama: KKDİK GBF üretim platformu (Next.js 16 / React 19 / Tailwind v4), yoğun tablo,
çok-firma, mevzuat verisi. Ölçüm: iPhone 15 + Pixel + desktop × light/dark × 12 sayfa,
**dolu gerçek veriyle** (25 GBF / 45 SDS / 5.055 madde).

Sonuç: 8 gerçek bulgu düzeltildi (lexa PR #418). Aşağısı **aracı ilgilendiren** kısım.

> 🔴 **Sürüm uyarısı — bu raporu okurken:** ölçüm `npx uisight@latest` ile yapıldı ve
> npm'deki son yayın **0.15.0** idi; yerel repo o sırada **0.17.0**'daydı (0.16/0.17
> düzeltmeleri yayınlanmamıştı). Bulguları yazmadan önce **her birini 0.17.0 kaynağına
> karşı okudum**; aşağıdaki maddeler 0.17.0'da hâlâ geçerli olanlar. İki istisna ayrıca
> işaretlendi: `--version` (0.17.0'da eklenmiş) ve "fixed bar" yanlış alarmı (0.17.0'da
> `elementFromPoint` kapısı var, muhtemelen zaten kapanmış — 0.15.0 çıktısında görüldü,
> yeni sürümle yeniden koşulmadı). Ders olarak da kayda değer: **`@latest` yerel repodan
> geride olabilir**; saha koşumlarında sürüm not edilmezse rapor bayat bulgu taşır.

---

## 1. Doğrulanmış BUG — olay dinleyicileri path'ler arasında birikiyor

**En önemli madde.** `src/cli.mjs`: sayfa nesnesi path döngüsünün DIŞINDA açılıyor
(`const page = await ctx.newPage()`), ama `page.on('pageerror' | 'console' | 'response')`
dinleyicileri döngünün İÇİNDE her path için yeniden ekleniyor ve hiç kaldırılmıyor.

Her dinleyici kendi `record`'una kapanış (closure) tutuyor. N'inci sayfa yüklenirken
N dinleyici birden tetikleniyor → aynı olay önceki tüm kayıtlara da yazılıyor.

Lexa koşumunda gözlemlenen imza (12 sayfa, hepsinde sayfa başına 2 gerçek 401):

```
/ → 22 failed    /gbf → 20    /sds → 18    /kkdik-radar → 16 …  /themes → 2
```

İlk sayfa 11× şişmiş, son sayfa doğru. Rapor okuyan kişi ana sayfada "22 başarısız
istek" görüp paniğe kapılıyor; gerçek sayı 2. Aynı şey `console` ve `js-error` için de
geçerli — "Encountered two children with the same key" uyarısının hangi sayfada
doğduğunu bu yüzden izole edemedim (raporda `/kkdik-radar`'da görünüyor ama orada
üretilmiş olmayabilir).

Ek olarak bu bir dinleyici sızıntısı: 12 path × 3 dinleyici = 36 canlı listener.

**Öneri:** her path için `page.removeAllListeners()` (ya da `page.off(...)` ile aynı
referansları çıkar), veya path başına yeni sayfa aç. Yeni sayfa aynı zamanda konsolu
sıfırlar — sayfa-başı izolasyon zaten raporun vaat ettiği şey.

---

## 2. Kırpma kontrolü kapsayıcıları görmüyor (yeni kontrol önerisi)

`clippedText` kontrolü (`cli.mjs` §6) yalnız **yaprak metin öğelerine** bakıyor:
`if (!isVisible(el) || el.children.length) return;`

Lexa'daki gerçek kusur bunun bir üstündeydi:

```html
<div class="… overflow-hidden">   <!-- çocuğu var → kontrol atlıyor -->
  <table class="w-full"> … </table>  <!-- 6 sütun, telefonda 3'ü görünüyor -->
```

Telefonda "Sınıflandırma" ve "H ifadeleri" sütunları **hiç görülemiyordu ve kaydırma da
yoktu** — `overflow-hidden` kırpıyor, `overflow-x-auto` olsa kaydırılabilirdi. Üç sayfada
aynı desen vardı ve araç hiçbirini bulmadı; ben ekran görüntüsüne bakarken yakaladım.

**Öneri — yeni kontrol `clippedContainer`:** çocuğu olan öğelerde de
`scrollWidth - clientWidth > 3` VE `overflow-x: hidden` ise bulgu üret.
Ayırt edici: `overflow-x: auto|scroll` olan aynı öğe **temizdir** (kullanıcı kaydırabilir).
Yanlış-alarm koruması: gizli/0 boyutlu kapsayıcılar ve `line-clamp` zaten elenmeli.

Bu, mobil tablo düzenlerinde muhtemelen en sık gerçek kusur; "yatay taşma" kontrolü
(§1) bunu göremiyor çünkü sayfa gövdesi taşmıyor — kırpma kapsayıcı içinde kalıyor.

---

## 3. "Boş durum" ile "veri gelmedi" ayrımı yok

`/gbf` sayfası **TOPLAM 0** gösterirken veritabanında 45 belge vardı; araç sayfayı
tertemiz raporladı. Ben DB'yi sorgulayınca yakaladım.

İkinci vaka daha net: `/substances` başlığı ilk yüklemede `· 0 madde` yazıyor, sayaç
`0 / 0 madde gösteriliyor` diyor, **aynı anda** arama kutusunda yükleme spinner'ı dönüyor.
Kütüphane 5.055 kayıtlı. Kullanıcı bir an "veritabanı boş" görüyor.

**Öneri:** sayfada eşzamanlı olarak (a) `0`/`boş`/`bulunamadı` metni ve (b) dönen bir
yükleme göstergesi (`animate-spin`, `role="progressbar"`, `aria-busy="true"`) varsa
"yükleniyor ama boş gösteriliyor" bulgusu. Ucuz, DOM'dan ölçülebilir ve gerçek bir
kullanıcı yanılgısını yakalıyor.

---

## 4. Metin–kontrol çakışması ölçülmüyor (yalnız `fixed` bar var)

`/sds`'te açıklama paragrafı "SDS yükle" butonunun **altında** kalıyordu: `flex
items-center justify-between` satırı telefonda sarmıyor, metin butonun arkasına giriyor.
Araç bunu görmedi — `coveredByFixed` yalnız `position: fixed|sticky` barlara bakıyor,
`coveredControls` ise kontrol örtülmesine.

**Öneri:** normal akıştaki metin bloklarının, kendinden sonra gelen ve daha yüksek
yığın sırasına sahip kardeş öğelerle kesişimi. Bilinen yanlış-alarm sınıflarını
(dekoratif katmanlar, `pointer-events:none`) elemek şartıyla.

---

## 5. Yanlış alarmlar (gerekçeleriyle — kontrol kalibrasyonu için)

| Bulgu | Neden yanlış |
|---|---|
| `Covered controls: … % covered by nextjs-portal` | **Next.js dev-tools düğmesi.** Prod'da yok. Bilinen dev-overlay seçicileri (`nextjs-portal`, `#__next-build-watcher`, Vite overlay) otomatik elenmeli. |
| `Hidden under a fixed bar: "Lexa AI REGTECH" %75` | **12 sayfanın 12'sinde** çıktı; ekran görüntüsünde logo tamamen görünür. Sidebar logosu ile üst bar geometrik olarak kesişiyor ama farklı sütunlarda. ⚠️ **0.15.0 çıktısı** — 0.17.0'daki `elementFromPoint` kapısı bunu muhtemelen zaten eliyor; doğrulanmadı. |
| `401 /api/notifications` | Yerel ortamda auth kapalıyken beklenen; uygulama zaten sessizce yutuyor. Kod kaynaklı değil, tarayıcının kendi konsol mesajı. |
| `Button issues: "Kayıt raporu oluştur" → disabled but visually indistinguishable` | Düzeltmeden **sonra da** çıktı: zemin `zinc-900 → zinc-200`, metin `zinc-600` (5.3:1), `cursor: not-allowed`, açıklayıcı `title`. Kontrol muhtemelen yalnız `opacity`ye bakıyor; zemin/metin renginin değişmesini de "ayırt edilebilir" saymalı. |

---

## 6. Ergonomi / koşum engelleri

1. **`page.goto` sabit 30 sn, `--timeout` yok.** İlk denemede Next.js dev sunucusunun
   ilk derlemesi bunu aştı ve **72 ekranın tamamı** `TimeoutError` ile boş çıktı. Ağır
   uygulamalarda ısıtma turu gerekiyor; bir bayrak bunu gereksiz kılar.
2. **Eşzamanlılık ayarı yok.** Paralel context'ler, `connection_limit=1` ile koşan
   yerel sunucuyu **iki kez tamamen kilitledi** (Prisma havuzu tükendi, sunucu yanıt
   vermez oldu). `--concurrency 1` olsaydı tek turda biterdi. Not: bu ayar Vercel
   serverless için doğru olduğundan uygulama tarafında "bug" değil.
3. **Git Bash / MSYS path çevirisi.** `--path "/,/gbf,…"` içindeki tek başına `/`,
   MSYS tarafından `C:/Program Files/Git`e çevrildi; araç bunu URL sanıp
   `C-Program-Files-Git__pixel__dark.png` üretti — **ana sayfa hiç taranmadı** ve hata
   vermedi. Windows kullanıcısı bunu ancak dosya adlarına bakarsa fark eder.
   **Öneri:** path argümanı `/` ile başlamıyorsa ya da sürücü harfi içeriyorsa uyar
   (`MSYS_NO_PATHCONV=1` ipucuyla).
4. ~~**`--version` sürüm basmıyor**~~ — 0.15.0'da yardım metnini döküyordu; **0.17.0'da
   eklenmiş** (`cli.mjs:940`). Kapandı, kayıt için bırakıldı.

---

## 7. Aracın doğru yakaladıkları (regresyon koruması)

Bunlar gerçekti ve düzeltildi — kontroller çalışıyor, kalibrasyonları iyi:

- **Kontrast:** QC sorun sayısı 3.2:1, "Kalemi sil" ikonu 2.62:1, pasif düğme 3.27:1.
  Üçü de bilgi taşıyan öğelerdi; eşik doğru yerde.
- **Dokunma hedefi < 44px:** sidebar öğeleri 32–36px. Düzeltilmedi (tasarım kararı)
  ama bulgu geçerli ve raporlanmaya değer.
- **12px altı metin:** 10px rozetler (`ETAP 1`, H kodları) — bilinçli yoğun-bilgi
  tasarımı, ama tespit doğru.
- **US tarih formatı:** `01/01/2026` — TR arayüzde gerçek belirsizlik.
- **Disabled düğme tespiti:** düzeltme öncesi tamamen haklıydı (kullanıcı tıklıyor,
  hiçbir şey olmuyor, neden olduğu hiçbir yerde yazmıyordu).

---

## 8. Bu uygulamaya özgü not (prompt tablosuna eklenebilir)

**lexa-dashboard'ı yerelde denetlerken `next start` işe yaramaz.** `prodAuthKapali`
guard'ı `NODE_ENV=production` + auth kapalıyken firma listesini **bilinçli olarak boş**
döndürür (çapraz-firma sızıntısına karşı fail-closed). Sonuç: tüm liste sayfaları boş
taranır, gerçek tablolar hiç görülmez. Doğrusu `next dev`. Bu, "girişin arkasına geç"
maddesinin bu repoda nasıl karşılandığının da cevabı: auth yerelde kapalı olduğu için
korumalı sayfalar zaten görülüyor, asıl mesele **veri** görünürlüğü.
