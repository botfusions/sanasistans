# CLAUDE.md - Sandaluci Asistan

## Güvenlik Kuralları

### 🔴 kritik: .env Dosyası Asla GitHub'a Pushlanmaz

- `.env` dosyası kesinlikle hiçbir koşulda commitlenmez
- `.gitignore` her zaman `.env` içermelidir
- API key'ler, şifreler ve token'lar asla kod içine yazılmaz
- Sadece `.env.example` veya şablon dosyaları commitlenir

### API Key Yönetimi

- Tüm hassas veriler environment variable olarak saklanır
- Production'da sistem env var'ları kullanılır
- Loglama yaparken API key'ler maskelenir

### Commit Öncesi Kontrol

- `.env` dosyasının `.gitignore`'da olduğunu doğrula
- Hassas veri içeren dosya varsa commit yapma
