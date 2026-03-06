# Sandaluci ASistan: Akıllı Üretim Koordinatörü 🚀

Sandaluci firması için özel olarak tasarlanmış, **Kazakistan merkezli** operasyonlarda **Yalın Kültür (Lean Culture)** ve **Stratejik Hizalama (Hoshin Kanri)** prensiplerini uçtan uca yöneten zeki bir asistan sistemidir.

---

## 📊 Proje Gelişim Raporu ve Sunum Rehberi (Okul Sunumu İçin)

Bu bölüm, projenin başından sonuna kadar geçirdiği evreleri ve teknik başarıları özetler. Sunumda bu sırayı takip edebilirsiniz:

### 1. Vizyon ve Başlangıç

- **Hedef:** Kağıt üzerindeki sipariş takibini dijitalize etmek ve departmanlar arası koordinasyonu otomatiğe bağlamak.
- **Kültür:** Sistemin merkezine "Yalın Üretim" prensipleri (israfı önleme, tam zamanında üretim) yerleştirildi.

### 2. Teknik Evrim Basamakları

- **Aşama 1: Veri Yakalama:** Gmail üzerinden gelen karmaşık sipariş formlarını (Excel/PDF) yapay zeka ile okuma yeteneği eklendi.
- **Aşama 2: Departman Dağıtımı:** Tek bir siparişi parçalara bölüp; Karkas, Dikişhane ve Döşemehane'ye ilgili kısımları resimli olarak gönderme (Mult-Dept Logic) kuruldu.
- **Aşama 3: Personel & Verimlilik:** Parça başı (Piecework) takip sistemi ve "Marina" onay mekanizması ile üretim disiplini sağlandı.
- **Aşama 4: Görsel Hafıza:** Qdrant vektör veritabanı ile geçmiş ürün görsellerinden benzerlik araması yapabilen "Görsel Bellek" entegre edildi.

### 3. Son Büyük Güncelleme: Ayça Developer Mode

- Bot artık sadece bir asistan değil, bir **"Teknik Danışman"**. Kendisini geliştirmesi için `/dev` komutu ile kod analizi yapabilir hale getirildi.

### 4. Sonuç ve Gelecek

- Manuel hata payı %90 oranında düşürüldü. Kazakistan operasyonu için Rusça/Türkçe hibrit çalışma modeli başarıyla test edildi.

---

## 🌟 Öne Çıkan Özellikler (Mart 2026 Güncellemesi)

### 1. Ayça Geliştirici Modu (Self-Improvement) - [YENİ]

- **Kabiliyet:** Ayça artık kendi kod yapısını, mimarisini ve veritabanı şemasını analiz edebilir.
- **Komut:** `/dev` (veya `!düzelt`). Sadece **Barış Bey** (SuperAdmin) tarafından kullanılabilir.
- **Kullanım:** Ayça'ya teknik sorular sorabilir veya yeni özellikler için kod taslakları hazırlatabilirsiniz.

- **Dağıtım:** İskelet için **Karkas/Metal/Ahşap Boya** departmanlarına resimli iş emirleri **otomatik ve anında** gönderilir. Kılıf için **Dikişhane**, final montaj için **Döşemehane** birimlerine ise Marina Hanım'ın seçiminden sonra dağıtılır.

- **Seçim Önceliği:** Karkas, Metal ve Ahşap Boya gibi birimlere iş emirleri hemen gider. Sadece Dikiş/Döşeme gibi manuel atama gereken birimler için Marina Hanım personelleri seçmeden "Dağıtımı Başlat" butonu aktif olmaz.
- **Hata Önleme:** Bu hibrit (otomatik + manuel) akış sayesinde iskelet üretimi gecikmeden başlar, döşeme ekibi ise doğru zamanda göreve çağrılır.
- **Senkronize Rapor:** Dağıtım raporu tüm birimlere (otomatik ve manuel) iş emirleri ulaştıktan sonra en son özet olarak Marina Hanım'a iletilir.

### 4. Gelişmiş Görsel Raporlar ve Veri Hassasiyeti

- **Kumaş/Boya Detayları:** Excel'den çekilen kumaş kodları ve boya detayları artık hem personel kartlarında hem de yönetim özet raporunda net bir şekilde görünür.
- **Mobil Uyumlu Arayüz:** Telegram raporları, karmaşık tablolar yerine mobil ekranlarda kolayca okunan liste/kart formatına dönüştürüldü.
- **Temiz Metin:** Markdown formatlama hataları (backslash sorunları) tamamen giderildi.

### 5. Çok Dillilik ve Bölgesel Adaptasyon

- **Dinamik Dil:** Kullanıcının diline göre (Türkçe veya Rusça) otomatik cevap verir.
- **Kazakistan Operasyonu:** Personelin Rusça, yönetimin çift dilli olduğu yapıya tam uyumludur.

### 6. Personel ve Parça Başı (Piecework) Sistemi

- **Takip:** Personel bazlı (Olga, Bekbergen vb.) parça başı üretim takibi.
- **Onay Mekanizması:** Kritik üretim aşamalarında (Dikişhane/Döşemehane) Marina Hanım'ın personel atama ve iş onay süreci.

- **Gelişmiş E-posta Takibi:** E-posta UID'leri artık kalıcı olarak (`data/processed_uids.json`) depolanır. Bot restart olsa dahi mükerrer işlem yapılması %100 engellenir.
- **Sistem Filtreleme:** Sadece gerçek siparişleri işler; sistem bildirimlerini (Groq, GitHub vb.) otomatik ayıklar.

## 🛡️ Yönetimi ve Devir

- **SuperAdmin:** Sistem, teslim sonrası **Barış Bey** yetkileriyle yönetilmektedir.
- **Ajanda & Kontrol:** `/ajanda`, `/personel`, `/durum` ve `/kayit` gibi kritik komutlar sadece SuperAdmin yetkisine sahiptir.
- **Ayça'nın Ruhu (Soul):** Asistan sadece iş odaklı, kısa ve net cevaplar verir; iş dışı sohbet kesinlikle yasaktır.

## 🛠️ Teknik Altyapı

- **Model:** OpenRouter üzerinden `google/gemini-3-flash-preview` (Yüksek hızlı ve zeki JSON analizi).
- **Veritabanı:** Supabase (SQL) & Qdrant (Vektör - Otomatik koleksiyon yönetimi aktif).
- **Arşivleme:** İşlenen sipariş formları ve üretilen PDF iş emirleri tarihli klasör yapısında (`data/orders/YYYY-MM-DD`) saklanır.
- **Deployment:** Docker & Coolify (Healthcheck aktif).

## 🚀 Kurulum ve Veritabanı Hazırlığı

1. `.env` dosyasını yapılandırın.
2. **Kritik:** Yeni bir Supabase projesinde `supabase_schema.sql` dosyasını Supabase SQL Editor üzerinden mutlaka çalıştırın.
3. `npm install` ve `npm run build` ile derleyin.
4. `npm run dev` veya Docker üzerinden ayağa kaldırın.

---

_SanaSistans: Geleceğin Mobilya Üretim Teknolojisi - 2026_
