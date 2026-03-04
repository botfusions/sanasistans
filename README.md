# Sandaluci ASistan 🚀

Sandaluci firması için özel olarak tasarlanmış, **Yalın Kültür (Lean Culture)** ve **Stratejik Hizalama (Hoshin Kanri)** prensiplerini benimsemiş zeki bir yönetici asistanı ve operasyon yönetim sistemidir.

## 🌟 Öne Çıkan Özellikler

### 1. Akıllı Yönetim Paneli (Dashboard)

- **Modern Arayüz:** Next.js 15 ve KokonutUI ile güçlendirilmiş, karanlık mod destekli premium dashboard.
- **Canlı Takip:** [sanasist.turklawai.com](https://sanasist.turklawai.com) adresi üzerinden veya Supabase Realtime ile siparişlerin ve üretim durumunun anlık izlenmesi.
- **Analitik:** Sipariş istatistikleri, personel performans metrikleri ve departman bazlı yoğunluk grafikleri.
- **Güvenlik:** Supabase Auth ve Next.js Middleware ile korunan yetkili erişim katmanı.

### 2. Akıllı Sipariş ve Koordinasyon

- **Çoklu Format Desteği:** Gmail üzerinden gelen siparişlerin metin veya Excel (.xlsx) formatında otomatik işlenmesi.
- **Vektör Hafızası (Qdrant):** Ürün görsellerinin vektörleştirilerek yapay zeka hafızasına kaydedilmesi ve benzer ürün sorgulama yeteneği.
- **Otomatik İş Emri (PDF):** Her departman için (Döşeme, Dikişhane, Kumaş vb.) resimli, profesyonel PDF iş emirlerinin otomatik oluşturulması.
- **Görsel Albüm:** Sipariş görsellerinin Telegram üzerinden düzenli albümler halinde ilgili birimlere iletilmesi.

### 3. Ekip Kontrolü ve RBAC

- **Rol Tabanlı Erişim:** "Patron" (Administrator) ve "Personel" rolleri arasında net yetki ayrımı.
- **Whitelist Güvenliği:** Sadece tanımlı Telegram kullanıcı id'lerine hizmet veren güvenlik katmanı.
- **Periyodik Nabız (Cron):** Sabah planlama, öğlen darboğaz tespiti ve akşam raporlama döngüleri.

## 🛡️ Güvenlik, Altyapı ve Yapay Zeka Kuralları (Mart 2026 Güncellemesi)

Proje, kapsamlı bir güvenlik denetiminden (STRIDE) geçirilmiş ve üretim ortamına (VPS) hazır hale getirilmiştir:

- **Sanitasyon & Sıfırlama:** Tüm veritabanları (Supabase ve JSON) test verilerinden tamamen temizlendi. Proje "sıfır sipariş" mantığıyla yayına hazır hale getirildi. Hardcoded API anahtarları `.env` dosyasına taşındı.
- **Konteyner Güvenliği:** Docker üzerinde `USER node` (non-root) kullanımı ile güvenlik sertleştirilmiştir.
- **Kesin Kırmızı Çizgiler (Soul.md):** Ayça asistanının personel ile iş dışı sohbet etmesi, felsefi yorum yapması veya dış dünyadan dedikodu/siyaset gibi bilgi çekmesi **kesin olarak yasaklanmıştır.**
- **Build Hardening:** TypeScript ve ESLint kontrolleri sıkılaştırılarak hatalı kodun yayına girmesi engellenmiştir.

## 🛠️ Teknik Stack

- **Frontend:** Next.js 15, React 19, Tailwind CSS, Lucide React.
- **Backend:** Node.js, Grammy (Telegram Framework), Supabase (DB & Auth).
- **AI/ML:** OpenRouter (Gemini 2.0 Flash), Qdrant (Vector Search).
- **Altyapı:** Docker, Coolify, Gmail IMAP/SMTP.

## 🚀 Kurulum ve Dağıtım

### 1. Çevre Değişkenleri

`.env.example` dosyasını `.env` olarak kopyalayın ve gerekli anahtarları doldurun:

- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`
- `OPENROUTER_API_KEY`, `QDRANT_API_KEY`
- `GMAIL_USER`, `GMAIL_PASS` (App Password)

### 2. Docker ile Çalıştırma

```bash
# Bot ve Dashboard'u ayağa kaldırın
docker build -t sandaluci-asistan .
docker run --env-file .env -p 3000:3000 sandaluci-asistan
```

### 3. Coolify Dağıtımı

- Coolify üzerinde "Dockerize" uygulama olarak ekleyin.
- Webhook'ları ve Health Check (Port 3000) ayarlarını yapılandırın.
- `.env` içeriğini Coolify "Variables" sekmesine aktarın.

---

_Sandaluci Operasyonel Mükemmellik Projesi - 2026_
