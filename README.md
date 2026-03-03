# Ayça - Sandaluci Yönetici Asistanı 🚀 hardware_security

Ayça, Sandaluci firması için özel olarak tasarlanmış, **Yalın Kültür (Lean Culture)** ve **Stratejik Hizalama (Hoshin Kanri)** prensiplerini benimsemiş zeki bir yönetici asistanıdır.

## 🌟 Temel Özellikler

### 1. Akıllı Personel ve Departman Yönetimi (RBAC)

- **Rol Tabanlı Erişim:** Sistem "Patron" (Cenk Bey) ve "Personel" rollerinden oluşur.
- **Kayıt:** `/kayit İsim | Departman | TelegramID` komutuyla sadece **Patron** tarafından personel eklenir.
- **Silme:** `/sil TelegramID` komutuyla sadece **Patron** tarafından personel kaydı silinir.
- **Yönlendirme:** İlgili departman personeli görevler/siparişler için otomatik olarak etiketlenir.
- **Liste:** `/personel` komutuyla tüm ekip ve uzmanlık alanları görülebilir (Sadece Patron'a özel detaylar içerir).

### 2. Gelişmiş Sipariş ve Koordinasyon Sistemi (Gmail & Excel)

- **Çoklu Format Desteği:** Mağazadan gelen siparişler e-posta metni veya **Excel (.xlsx)** eki olarak otomatik okunur.
- **Görsel Hafıza (Qdrant):** Excel'den çıkarılan ürün resimleri Gemini 2.0 Flash ile analiz edilir ve vektör hafızasına (Qdrant) kaydedilir.
- **Otomatik Arşivleme:** Gelen tüm sipariş formları `data/orders/YYYY-MM-DD/` dizininde tarihli olarak yedeklenir.
- **Akıllı Kategorizasyon:** Ayça, her ürünü analiz ederek kaynağını belirler (Stok, Üretim, Dış Alım).
- **Görsel Koordinasyon Özeti:** Tüm birimlerin anlayabileceği, gruplandırılmış ve temiz bir iş akışı tablosu Telegram'a iletilir.
- **Departman Bazlı PDF:** Her birim için resimli, detaylı ve resmi bir PDF İş Emri oluşturulup Telegram üzerinden gönderilir.
- **Görsel Albüm Desteği:** Çoklu ürün görselleri Telegram "Media Group" özelliği ile düzenli bir albüm olarak iletilir.
- **Ekip Etiketleme:** İlgili personel görev alanına göre @mention ile anlık bilgilendirilir.

### 3. Otomatik Ekip Kontrol Sistemi (Cron)

Günde üç kez ekibin nabzını tutan periyodik mesajlar:

- **09:00 (Sabah):** "Engel var mı?" ve planlama brifingi.
- **13:30 (Öğlen):** Darboğaz tespiti ve saha uyumu.
- **17:30 (Akşam):** Standartlaştırma ve başarı raporu.

### 4. Yönetici Brifingleri (Cenk Bey Özel)

- Gmail ve Google Takvim üzerinden alınan verilerle günlük ajanda ve stratejik odak özeti sunulur.

## 🛠️ Teknik Altyapı

- **Dil:** TypeScript / Node.js
- **Bot Framework:** Grammy
- **LLM:** OpenRouter API (Google Gemini 2.0 Flash / Ayça Persona)
- **Vektör Veritabanı:** Qdrant (Görsel ürün hafızası için)
- **Veritabanı:** Yerel JSON (Staff/Orders) - Personel bilgileri ve aktif siparişler için.
- **PDF Motoru:** PDFKit (İş emri üretimi için)
- **E-posta:** Gmail IMAP (ImapFlow) & SMTP (Nodemailer)
- **Planlama:** node-cron
- **Deployment:** Coolify (Dockerized)
- **Health Check:** HTTP Server (Port 3000)

## 🔄 Son Teknik Güncellemeler (Mart 2026)

- **Görsel Hafıza ve Arşivleme:** Qdrant entegrasyonu ile ürün görselleri vektörleştirildi; sipariş formları tarihli klasörlerde yerel olarak yedeklenmeye başlandı.
- **Resimli PDF İş Emirleri:** Departmanlar için ürün resimlerini içeren teknik PDF belgeleri oluşturma yeteneği eklendi.
- **Telegram Albüm (Media Group):** E-posta ve Excel'den gelen çoklu görsellerin departmanlara düzenli albümler halinde iletilmesi sağlandı.
- **Gmail Bağlantı Kararlılığı:** `ImapFlow` nesnesinin yeniden kullanım hatası (`Can not re-use instance`) giderildi; her kontrol periyodunda yeni bağlantı kurulumuna geçildi.
- **Hata Toleranslı Bildirimler:** Telegram'da Markdown formatlama hatası oluşması durumunda, sistemin sessizce çökmesi yerine bildirimleri **sade metin (Plain Text)** olarak iletmesi sağlandı.
- **Gelişmiş İzlenebilirlik:** `pino-pretty` entegrasyonu ile e-posta işleme, LLM analizi ve Telegram iletim aşamaları için detaylı loglama yapısı kuruldu.
- **E-posta Kontrol Optimizasyonu:** Varsayılan 5 dakikalık kontrol süresi, test süreçleri için `index.ts` üzerinden 1 dakikaya indirildi.
- **Sonsuz Döngü Koruması:** E-postaların işlendikten sonra (hata alsa dahi) okundu olarak işaretlenmesi garanti altına alınarak bildirim döngüleri engellendi.
- **Güçlendirilmiş Excel Resim Ayıklama:** Kopyala-yapıştır ile eklenen ve hücreye sabitlenmemiş (floating) resimleri yakalayan **Fallback Mekanizması** eklendi; ekran görüntüleri ile gerçek ürün fotoğrafları arasında ayrım yapan **Skorlama Algoritması** devreye alındı.
- **PDF Görselleştirme (Screenshot):** Departmanlara artık PDF yerine, PDF'in yüksek kaliteli (3.0 scale) görsel kopyası gönderiliyor. Bu sayede personel PDF indirmeden siparişi anlık görebiliyor.
- **Yüksek Kalite Render & Font Uyumluluğu:** PDF'den görsel üretilirken metinlerin bozulmaması için **Roboto** fontları entegre edildi ve Windows tabanlı `file:///` protokolü uyumluluğu sağlandı.
- **Konsolide Bildirim (Albüm):** Siparişin görsel özeti (PDF screenshot) ve tüm ürün fotoğrafları tek bir Telegram albümü (Media Group) olarak birleştirildi.
- **Otomatik PDF Arşivleme:** Oluşturulan tüm PDF iş emirleri `data/orders/YYYY-MM-DD/pdfs/` klasöründe yerel olarak saklanarak dijital arşivleme altyapısı kuruldu.

---

_Sandaluci Operasyonel Mükemmellik Projesi - 2026_
