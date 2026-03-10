# Sandaluci Asistan: Akıllı Üretim Koordinatörü 🚀

Sandaluci firması için özel olarak tasarlanmış, **Kazakistan merkezli** operasyonlarda **Yalın Kültür (Lean Culture)** ve **Stratejik Hizalama (Hoshin Kanri)** prensiplerini uçtan uca yöneten zeki bir asistan sistemidir.

---

## 📊 Proje Gelişim Raporu ve Sunum Rehberi

Bu bölüm, projenin başından sonuna kadar geçirdiği evreleri ve teknik başarıları özetler:

### 1. Vizyon ve Başlangıç

- **Hedef:** Kağıt üzerindeki sipariş takibini dijitalize etmek ve departmanlar arası koordinasyonu otomatiğe bağlamak.
- **Kültür:** Sistemin merkezine "Yalın Üretim" prensipleri (israfı önleme, tam zamanında üretim) yerleştirildi.

### 2. Teknik Evrim Basamakları

- **Aşama 1: Veri Yakalama:** Gmail üzerinden gelen karmaşık sipariş formlarını (Excel/PDF) yapay zeka ile okuma yeteneği eklendi.
- **Aşama 2: Departman Dağıtımı:** Tek bir siparişi parçalara bölüp; Karkas, Dikişhane ve Döşemehane'ye ilgili kısımları resimli olarak gönderme (Multi-Dept Logic) kuruldu.
- **Aşama 3: Personel & Verimlilik:** Parça başı (Piecework) takip sistemi ve "Marina" onay mekanizması ile üretim disiplini sağlandı.
- **Aşama 4: Görsel Hafıza:** Supabase (pgvector) vektör veritabanı ile geçmiş ürün görsellerinden benzerlik araması yapabilen "Görsel Bellek" entegre edildi. Görseller VPS üzerindeki yerel depolama biriminde güvenle saklanır.
- **Aşama 5: Sesli Komut & Telegram Voice:** Telegram üzerinden gelen sesli mesajları (Voice Message) OpenAI/Grok/Gemini altyapısı ile metne dönüştürüp analiz eden ve ilgili departmanlara not olarak ileten sesli asistan yeteneği kazandırıldı.
- **Aşama 6: Telegram Excel İşleme (Mart 2026):** Telegram üzerinden gönderilen `.xlsx` ve `.xls` dosyalarını otomatik olarak indiren, `XlsxUtils` ile ayrıştıran ve `OrderService` üzerinden sipariş taslağına dönüştüren uçtan uca dosya işleme akışı entegre edildi.
- **Aşama 7: Gelişmiş Test Modu & Fallback (Mart 2026):** Departmanlarda kayıtlı personel olmasa bile sistemin tıkanmaması için `StaffService` üzerinden "Otomatik Test Personeli" (Fallback) mantığı eklendi. Tüm dağıtımlar yönetici hesabına yönlendirilerek uçtan uca test imkanı sağlandı.

### 3. Bot Stabilitesi & Çakışma Yönetimi (Mart 2026)

- **Çatışma Çözümü:** Telegram `409 Conflict` hataları artık sistemi çökertmez. `bot.catch` yapısı ile bot başka bir yerde çalışıyor olsa bile sistem uyarı verir ve diğer servisler (Health Check, API) çalışmaya devam eder.
- **Mail Odaklı Teşhis (Doctor):** Sistem sağlığını sadece internet varlığına göre değil, Gmail SMTP (587) ve IMAP (993) portlarına doğrudan TCP bağlantısı kurarak denetleyen gelişmiş ağ tarayıcısı entegre edildi.
- **Bölgesel Optimizasyon:** Kazakistan VPS sunucularındaki şebeke gecikmeleri için 300ms tolerans eşiği tanımlanarak gereksiz uyarıların önüne geçildi.
- **Gelişmiş Health Check:** Coolify entegrasyonu için port 3000 üzerinde `/health` ve `/ping` desteği.

---

## 🌟 Öne Çıkan Özellikler

### 1. Hibrit Görsel Depolama & Vektör Hafızası

- **Teknoloji:** Qdrant'tan **Supabase (pgvector)** altyapısına geçiş yapıldı.
- **Performans:** Vektör aramaları doğrudan ana veritabanı (SQL) üzerinde çalışır (1024-dim).
- **VPS Depolama:** Orijinal ürün resimleri VPS üzerindeki `data/images` klasöründe saklanır.

### 2. Otomatik & Akıllı Üretim Dağıtımı

- **Multi-Dept Logic:** Sipariş tipi ve departman ihtiyacına göre otomatik iş emri ayrıştırma.
- **Senkronize Rapor:** Dağıtım raporu tüm birimlere iş emirleri ulaştıktan sonra özet olarak yönetime iletilir.

### 3. Çok Dillilik ve Bölgesel Adaptasyon

- **Dinamik Dil:** Kullanıcının diline göre (Türkçe veya Rusça) otomatik cevap verir.
- **Kazakistan Operasyonu:** Personelin Rusça, yönetimin çift dilli olduğu yapıya tam uyumludur.

### 4. Güvenlik & İzleme

- **Mükerrer İşlem Önleme:** E-posta UID'leri `processed_uids.json` ile kalıcı olarak depolanır.
- **Gmail Temizleme (Cleanup):** `clear-gmail.ts` scripti ile gelen kutusundaki tüm test verilerini tek komutla temizleme yeteneği.
- **Doctor Service (TCP Check):** Sistem sağlığını (Database, LLM, Gmail Portları, Network Latency) anlık denetleyen `/doctor` komutu. Mail portları TCP socket seviyesinde taranır.

---

## 🛠️ Teknik Altyapı

- **Model:** OpenRouter üzerinden `google/gemini-2.0-flash-001` (Yüksek hızlı ve zeki JSON analizi).
- **Veritabanı:** Supabase (SQL & pgvector).
- **Excel Analizi:** `xlsx` ve `exceljs` kütüphaneleri ile derinlemesine dosya ve resim ayrıştırma.
- **Arşivleme:** İşlenen sipariş formları `data/orders` altında, görseller ise `data/images` altında.
- **Takvim Yönetimi:** `gogcli` (v0.12.0) entegrasyonu ile Google Calendar üzerinden tam ajanda yönetimi.
- **Deployment:** Docker & Coolify (Port 3000 Healthcheck aktif).

## 🚀 Kurulum

1. `.env` dosyasını yapılandırın (Supabase, Telegram, Gmail, OpenRouter).
2. Supabase projesinde `supabase_schema.sql` dosyasını çalıştırın.
3. `npm install` ve `npm run build` ile derleyin.
4. Docker üzerinden yayına alın (Health Check Port: 3000).

---

> **Not:** Visible Swarm Web Dashboard projesi geliştirme aşamasındadır ve sonraki versiyonlarda aktif edilecektir.

_SanaSistans: Geleceğin Mobilya Üretim Teknolojisi - 2026_
