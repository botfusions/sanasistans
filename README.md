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
- **Aşama 8: Rusça Yerelleştirme & Stabilizasyon (Mart 2026):** Kazakistan bölgesi için tüm raporlar ve PDF iş emirleri **Dual-Language (TR/RU)** formatına geçirildi. `order.service.ts` dosyasındaki syntax hataları giderildi.
- **Aşama 9: PDF İş Emri & Dashboard Tahliye (Mart 2026):** İş emirlerinin sadece görsel değil, gerçek PDF dosyası olarak iletilmesi sağlandı. Kullanıcı talebi üzerine Dashboard entegrasyonu tamamen askıya alındı.
- **Aşama 10: Gelişmiş Dil Politikası & Hatırlatıcılar (Mart 2026):** Sistemde Patron (TR) ve Marina/Personel (RU) ayrımı keskinleştirildi. Kumaş/Boya gecikme uyarıları (24 saat kuralı) ve üretim takip soruları tamamen i18n sistemine bağlandı.
- **Aşama 11: PDF İş Akışı Refaktörü (Mart 2026):** Departman bazlı (Karkas, Metal, Boya) otomatik resimli PDF gönderimi ve manuel departmanlar (Döşeme/Dikiş) için Marina onaylı personel atama süreci optimize edildi.
- **Aşama 12: Sanal Personel & Test Altyapısı (Mart 2026):** Tüm departmanlar için sanal test personelleri (Personas) oluşturuldu. Test süreçlerini hızlandırmak için tüm birimlerin mesajları Patron ID'sine (Shadowing) yönlendirildi.
- **Aşama 13: Temiz Mesaj Politikası (Mart 2026):** Mesaj kalabalığını önlemek için ayrı ürün görseli gönderimi kaldırıldı, tüm görsel ve detaylar yüksek kaliteli PDF iş emirlerinde konsolide edildi.
- **Aşama 14: Kumaş & Özet Raporlama (Mart 2026):** Dağıtım sonunda otomatik "Kumaş Sipariş Formu" (PDF) ve "Genel Sipariş Özet Raporu" (PDF) Marina'ya özel olarak üretilip iletilecek şekilde yapılandırıldı.
- **Aşama 15: Zamanlanmış Silsile & Sıralı Dağıtım (Mart 2026):** Sipariş dağıtım sürecinde kontrolü artırmak için "20-40-60 Saniye" kuralı getirildi. Otomatik birimler (Karkas, Metal, Boya) 20 saniye sonra, Marina onay butonları 40 saniye sonra, Kumaş PDF'i ise 60 saniye sonra iletilecek şekilde yapılandırıldı. Manuel seçim sonrası final raporu için de +20 saniye gecikme eklendi.
- **Aşama 16: Gelişmiş Excel Resim Analizi & Temizlik (Mart 2026):** Excel dosyalarından resim çıkarma mantığı (Smart Score) güçlendirildi. Test verilerini hem veritabanından hem de yerel dosyalardan (orders, processed_uids vb.) tamamen temizleyen `cleanup.ts` scripti devreye alındı.
- **Aşama 17: Plastik Üretim Akışı & Dikişhane Görünürlüğü (Mart 2026):** "Plastik" içeren ürünlerin otomatik olarak Satınalma (Marina) departmanına Rusça ve resimli olarak yönlendirilmesi sağlandı. Dikişhane ve diğer manuel birimler için departman eşleme mantığı (`isManualDept`) güçlendirilerek tüm dil varyasyonlarında (TR/RU) tam görünürlük sağlandı.
- **Aşama 18: Gelişmiş Resim Eşleşme & Scope Fix (Mart 2026):** Excel'den çekilen ürün görsellerinin sipariş kalemleriyle (items) eşleşmesini engelleyen scope shadowing hatası giderildi. `RowIndex` mantığı ile %100 doğru görsel-ürün eşleşmesi sağlandı. PDF başlıkları ve departman isimleri Rusça (ПРОИЗВОДСТВО КАРКАСА) için tam yerelleştirildi.
- **Aşama 19: Git Push & Deployment Stratejisi (Mart 2026):** Tüm kritik hata düzeltmeleri ve yerelleştirme güncellemeleri GitHub'a gönderildi. Netlify (Frontend) ve Coolify (Backend/VPS) ayrımı netleştirilerek kesintisiz çalışma sağlandı.


### 3. Bot Stabilitesi & Webhook Mimarisi (Mart 2026)

- **Webhook Geçişi:** Telegram `409 Conflict` çakışmalarını tamamen önlemek için Polling modundan Webhook mimarisine geçildi.
- **Dashboard Entegrasyonu (ASKIYA ALINDI):** `/api/external` endpoint'i ve dashboard bildirim trafiği kullanıcı talebiyle geçici olarak devre dışı bırakıldı.
- **Mail Odaklı Teşhis (Doctor):** Sistem sağlığını sadece internet varlığına göre değil, Gmail SMTP (587) ve IMAP (993) portlarına doğrudan TCP bağlantısı kurarak denetleyen gelişmiş ağ tarayıcısı entegre edildi.
- **Bölgesel Optimizasyon:** Kazakistan VPS sunucularındaki şebeke gecikmeleri için 300ms tolerans eşiği tanımlanarak gereksiz uyarıların önüne geçildi.
- **Gelişmiş Health Check:** Coolify entegrasyonu için port 3000 üzerinde `/health` ve `/ping` desteği.

### 4. Hybrid Deployment (Netlify & Coolify)

- **Netlify:** Projenin Dashboard/Frontend kısmı için kullanılır. Statik dosyaları ve rapor görüntüleyiciyi barındırır.
- **Coolify (VPS):** Bot çekirdeği, Gmail servisi ve görsel işleme motoru burada çalışır.
- **Görsel Senkronizasyon:** Üretilen görseller VPS üzerinde yerel olarak saklanır. Frontend üzerinden erişim için görsellerin Supabase Storage'a taşınması planlanmaktadır (Gelecek Aşama).

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

> **Not:** Dashboard entegrasyonu ( `/api/external`) kullanıcı talebiyle askıya alınmıştır. Sistem şu an saf Telegram & Mail Koordinatörü olarak çalışmaktadır.

_SanaSistans: Geleceğin Mobilya Üretim Teknolojisi - 2026_
