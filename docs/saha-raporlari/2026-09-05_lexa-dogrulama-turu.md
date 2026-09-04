# Saha raporu — üç yeni kontrolün doğrulama turu (Lexa, 5 Eyl 2026)

**Kim:** lexa-dashboard tarafındaki oturum · **Araç:** yerel repo (0.21.0) · iPhone 15, light
**Neyin devamı:** [4 Eyl saha raporu](2026-09-04_lexa-dashboard.md) üç yeni kontrol istemişti;
0.20.0 üçünü de ekledi. Bu tur onların **sahada ne yaptığını ölçüyor**, öneri değil sonuç raporu.

---

## Özet

| Kontrol | Lexa'da bulgu | Doğrulandı mı |
|---|---|---|
| `clippedContainer` | **2 gerçek kusur** (sonra 11 sayfaya çıktı) | evet — düzeltildikten sonra 0'a düştü |
| `textUnderControl` | 0 | evet — sentetik sayfada ateşliyor |
| `loadingButEmpty` | 0 | evet — sentetik sayfada ateşliyor |

Üçü de çalışıyor. İkisinin Lexa'da bulgu vermemesi aracın körlüğü değil, o desenin
Lexa'da bulunmaması. **Bunu varsaymadım, ölçtüm** — aşağıda nasıl.

---

## 1. `clippedContainer` — istenen kusuru ilk turda buldu

İki sayfa, ikisi de aynı desen: köşeleri yuvarlatmak için konan `overflow-hidden`
tabloyu da kırpıyor ve kaydırma bırakmıyor.

```
/qc              div.bg-white.border      361x2391, 286px hidden — "ÜRÜN FİRMA DURUM AI MODEL HATA ORANI AKSİYON …"
/reference-data  div.bg-white.rounded-xl  361x3145, 354px hidden — "BİLEŞEN CAS EC ANNEX VI H İFADELERİ VERİ BAYRAK …"
```

Kullanıcı için sonucu: son sütunlar ("Aksiyon", "Bayrak") telefonda **tamamen erişilemez**.
4 Eyl'in mobil turu bunları görmemişti — `clippedText` yaprak metin öğelerine bakıyor,
kusur bir üst kapta. Yeni kontrolün var oluş sebebi tam olarak buydu ve doğruladı.

Bulgudan sonra aynı desen kaynak taramasıyla dokuz sayfada daha çıktı; 11 sayfa birlikte
düzeltildi (lexa PR #428) ve tekrar tarandığında `clippedContainer` **0** verdi.
Ardından kural yapısal bir teste bağlandı (PR #430), yani bu kusur sınıfı artık
tarayıcı koşmadan da kapalı.

**Ayırt ediciler sahada tuttu:** mutlak konumlu süs kutuları, kayan şeritler ve
`overflow-x-auto` taşıyan kaplar hiç bulgu üretmedi. Tek yanlış alarm yok.

## 2. `textUnderControl` ve `loadingButEmpty` — Lexa'da 0, ama ölü değil

Sıfır bulgu iki şey anlamına gelebilir: desen yok, ya da kontrol hiç ateşlemiyor.
İkisini ayırmak için tek sayfalık sentetik bir sınama koştum (spinner + "0 kayıt"
yan yana; `position:absolute` bir paragrafın üstünde bir düğme):

```
- 🔴 Text disappearing behind a control (1):
  - "Bu açıklama metni düğmenin arkasına giriyor ve oku" behind `button` "SDS yükle"
- 🟠 Says "empty" while still loading (1): "0 kayıt bulundu"
```

İkisi de ateşledi. Yani Lexa'daki sıfır **gerçek sıfır**.

> Bu ayrımı yapmamın sebebi taze bir yara: aynı gün Lexa'da, sınıflandırma bekçisi olarak
> yazılmış bir desenin (`/^H3\d\d/`) gerçek veri biçimiyle (`"Repr. 1B - H360D"`) hiç
> eşleşmediği ve **baştan beri ölü** olduğu ortaya çıktı — testleri de yeşildi, çünkü
> testler aynı yanlış biçimi besliyordu. "Bulgu yok" ile "kontrol çalışmıyor" arasındaki
> farkı ölçmeden geçmek, aracın kendisine aynı tuzağı kurar.

## 3. Aracın kendisine dair: rapor başlığındaki kimlik altın değerinde

Turun başında sekiz sayfayı tarayıp bulguları okudum; hepsi "ok" dönmüştü ve makul
görünüyordu. Ama rapor satırı şunu diyordu:

```
- HTTP 404 · title: Kokart — Turist Rehberi Pazaryeri
```

Lexa'nın dev sunucusu port 3000 dolu olduğu için 3001'e düşmüştü; ben aracı 3000'e
yöneltmiştim ve **başka bir projeyi** taramıştım. Raporun `HTTP` + `title` satırını
yazıyor olması bunu iki saniyede yakalattı — o satır olmasaydı yanlış bulgularla
saatler harcanırdı.

İkinci sinyal de rapordan okunuyordu: **sekiz farklı rota tıpatıp aynı üç bulguyu**
veriyordu. Farklı girdilerin özdeş çıktı vermesi, hedefin tek bir 404 sayfası olduğunu
söylüyor.

**Öneri (küçük, ergonomik):** rapor başlığındaki HTTP durumu 4xx/5xx ise satırı
görsel olarak işaretlemek (ör. `⚠ HTTP 404`) — ya da tüm rotalar aynı başlığı
döndürdüğünde raporun en üstüne tek satırlık bir uyarı koymak: *"8 rotanın 8'i aynı
sayfayı döndürdü — yanlış hedef mi?"*. Yanlış-hedef, tarama araçlarının en pahalı
sessiz hatası ve bu iki sinyal zaten elinizde.

## 4. Kalan iki gözlem (bu turda düzeltilmedi)

- **Yan menüdeki logo "sabit çubuk altında" sayılıyor.** Her sayfada tekrarlıyor:
  `a.flex.items-center "Lexa AI REGTECH" — 75% under header.h-14.border-b`. Ekran
  görüntüsünde logo görünür durumda; ölçülen öğe mobilde kapalı olan yan menünün
  kendi logosu. Muhtemel kapı: kapsayıcısı görsel olarak ekran dışına taşınmış
  (`-translate-x-full` benzeri) öğeleri elemek.
- **`/admin/users` taramada düştü:** `Execution context was destroyed, most likely
  because of a navigation`. Sayfa açılışta yönlendirme yapıyor (rol kapısı). Aracın
  bunu bir çökme yerine "yönlendirildi → şu adrese" diye raporlaması daha doğru olur.

---

**Sürüm notu:** bu tur yerel repodaki 0.21.0 ile koşuldu. 4 Eyl raporundaki dinleyici
birikmesi düzeltmesi (0.18.0) sahada da doğrulandı: tekrarlanan taramalarda sayılar
şişmedi.
