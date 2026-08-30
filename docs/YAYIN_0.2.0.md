# 0.2.0 yayın adımları (kullanıcı terminali)

Kod hazır, main'de, CI yeşil, 17/17 test geçiyor. Kalan iki adım **senin terminalinden**
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
npm view uisight version        # 0.2.0 yazmalı
```

Sonra registry kaydı (npm'de 0.2.0 görünmeden bu adım paketi doğrulayamaz):

```powershell
& "$env:USERPROFILE\.uisight\bin\mcp-publisher.exe" login github
& "$env:USERPROFILE\.uisight\bin\mcp-publisher.exe" publish
```

🔑 `login` cihaz kodu verir ve aldığı JWT **dakikalar içinde ölür** — `login` ve `publish`
arasına başka iş sokma, ikisini arka arkaya koş.

## Bu sürümde ne değişti

Kıran değişiklik: iç kod ve panelin HTTP yüzeyi baştan sona İngilizce. CLI bayrakları,
9 MCP aracı ve rapor biçimi aynı — yani `npx uisight` ve MCP kullanımı etkilenmiyor.
Panelin HTTP ucunu doğrudan çağıran varsa yeniden adlandırma tablosu `CHANGELOG.md`'de.

## Tarayıcı gereken, bende olmayan işler

- **Smithery listeleme** (~2 dk): smithery.ai → GitHub ile giriş → server ekle → repo
  `sololabstr/uisight`. `smithery.yaml` repoda hazır, Smithery onu okur.
- **mcp.so submit** (~2 dk): bot duvarlı form, insan gerekiyor.
- **registry#1551**: org namespace izni hâlâ gelmedi (19 Ağustos'tan beri 0 yorum).
  Çözülünce `io.github.sololabstr/uisight` olarak yeniden kayıt + eskisini deprecate.
