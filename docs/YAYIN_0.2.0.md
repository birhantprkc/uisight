# 0.2.1 yayın adımları (kullanıcı terminali)

Kod hazır, main'de, CI yeşil, 18/18 test geçiyor. Kalan iki adım **senin terminalinden**
koşmak zorunda: npm publish her seferinde tarayıcıda 2FA onayı ister ve headless kabukta
onay bağlantısı `***` diye maskelenir.

PowerShell'de sırayla:

```powershell
cd c:\dev\uisight
git pull
npm publish
```

`npm publish` bir bağlantı basar ve orada bekler — tarayıcıda passkey ile onayla. Bittiğinde:

```powershell
npm view uisight version        # 0.2.1 yazmalı
```

Sonra registry kaydı (npm'de 0.2.0 görünmeden bu adım paketi doğrulayamaz):

```powershell
& "$env:USERPROFILE\.uisight\bin\mcp-publisher.exe" login github
& "$env:USERPROFILE\.uisight\bin\mcp-publisher.exe" publish
```

🔑 `login` cihaz kodu verir ve aldığı JWT **dakikalar içinde ölür** — `login` ve `publish`
arasına başka iş sokma, ikisini arka arkaya koş.

## Bu sürümde ne değişti

**0.2.0 (kıran):** iç kod ve panelin HTTP yüzeyi baştan sona İngilizce. CLI bayrakları,
9 MCP aracı ve rapor biçimi aynı — `npx uisight` ve MCP kullanımı etkilenmiyor. Panelin
HTTP ucunu doğrudan çağıran varsa yeniden adlandırma tablosu `CHANGELOG.md`'de.

**0.2.1 (soğuk başlangıç):** üç kusur, üçü de yalnız YENİ kullanıcıyı vuruyordu — bu
yüzden 99 klonda tek issue gelmemiş olabilir. Tarayıcı yoksa ham Playwright yığın izi
yerine ne koşulacağını söylüyor · `locale: 'tr-TR'` koda çakılıydı, dünyadaki herkes
uygulamasını Türkçe denetliyordu (artık zorlanmıyor, `--locale` ile sabitlenir) · rapor
tarihi ISO+UTC. 🔴 **Reddit/HN paylaşımı bu yayından SONRA** — yoksa gelen kişi hâlâ
eski soğuk-başlangıç hatasını alır.

## Tarayıcı gereken, bende olmayan işler

- **Smithery listeleme** (~2 dk): smithery.ai → GitHub ile giriş → server ekle → repo
  `sololabstr/uisight`. `smithery.yaml` repoda hazır, Smithery onu okur.
- **mcp.so submit** (~2 dk): bot duvarlı form, insan gerekiyor.
- **registry#1551**: org namespace izni hâlâ gelmedi (19 Ağustos'tan beri 0 yorum).
  Çözülünce `io.github.sololabstr/uisight` olarak yeniden kayıt + eskisini deprecate.
