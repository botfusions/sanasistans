/**
 * i18n - İkidilli Çeviri Modülü (Türkçe / Rusça)
 *
 * Kural:
 * - Tüm personel (çalışanlar) → Rusça (ru)
 * - Barış Bey (patron) → Türkçe (tr)
 * - Marina Hanım (süpervizör) → Rusça (ru)
 */

export type Language = "tr" | "ru";

const translations: Record<string, Record<Language, string>> = {
  // === Genel ===
  welcome_boss: {
    tr: "Hoş geldiniz Barış Bey! 👋\n\nSandaluci üretim süreçleri ve ekip yönetimi için hazırım.\n\nKullanabileceğiniz Yönetici Komutları:\n/ajanda - Günlük planınız\n/personel - Ekip listesi\n/durum - Üretim durumu\n/kayit - Yeni personel ekle\n/sil - Personel sil\n/takip - İş takip paneli\n/dev - Geliştirici Modu",
    ru: "Добро пожаловать, Барыш Бей! 👋\n\nЯ готова помочь с управлением производства Sandaluci.\n\nДоступные команды:\n/ajanda - Расписание\n/personel - Список персонала\n/durum - Статус производства\n/kayit - Добавить персонал\n/sil - Удалить персонал\n/takip - Панель отслеживания\n/dev - Режим разработчика",
  },
  welcome_staff: {
    tr: "Merhaba {name}! Ben Ayça. 👋\n\n*{department}* bölümündeki süreçlerde sana destek olmak için buradayım.\n\nKullanabileceğin komutlar:\n/durum - Üretim durumu\n/start - Yardım menüsü",
    ru: "Здравствуйте, {name}! Я Айча. 👋\n\nЯ здесь, чтобы помочь вам в отделе *{department}*.\n\nДоступные команды:\n/durum - Статус производства\n/start - Меню помощи",
  },
  welcome_guest: {
    tr: "Merhaba! Ben Ayça, Sandaluci Yönetici Asistanıyım. 🙋‍♀️\n\nŞu an sadece kayıtlı personele hizmet verebiliyorum. Lütfen Cenk Bey ile iletişime geçerek kaydınızı yaptırın.",
    ru: "Здравствуйте! Я Айча, ассистент управления Sandaluci. 🙋‍♀️\n\nВ данный момент я обслуживаю только зарегистрированный персонал. Пожалуйста, свяжитесь с руководством для регистрации.",
  },
  access_denied: {
    tr: "🔒 Bu komuta erişim yetkiniz bulunmamaktadır.",
    ru: "🔒 У вас нет доступа к этой команде.",
  },

  // === Takip Paneli ===
  tracking_title: {
    tr: "📋 *Aktif İş Takip Paneli*",
    ru: "📋 *Панель отслеживания работ*",
  },
  tracking_empty: {
    tr: "✨ Şu an aktif takip gerektiren bir iş bulunmuyor.",
    ru: "✨ В данный момент нет активных работ для отслеживания.",
  },
  tracking_boss_only: {
    tr: "🔒 Takip paneline sadece yöneticiler erişebilir.",
    ru: "🔒 Панель отслеживания доступна только руководству.",
  },
  tracking_actions_hint: {
    tr: "\nDetaylı işlem yapmak için yukarıdaki butonları kullanabilirsiniz:",
    ru: "\nИспользуйте кнопки выше для управления:",
  },
  tracking_refreshed: {
    tr: "Liste güncellendi.",
    ru: "Список обновлён.",
  },

  // === Statüler ===
  status_bekliyor: {
    tr: "Bekliyor",
    ru: "Ожидание",
  },
  status_uretimde: {
    tr: "Üretimde",
    ru: "В производстве",
  },
  status_boyada: {
    tr: "Boyada",
    ru: "На покраске",
  },
  status_dikiste: {
    tr: "Dikiş'te",
    ru: "На шитье",
  },
  status_dosemede: {
    tr: "Döşeme'de",
    ru: "На обивке",
  },
  status_hazir: {
    tr: "Hazır",
    ru: "Готово",
  },
  status_sevk_edildi: {
    tr: "Sevk Edildi",
    ru: "Отправлено",
  },
  status_arsivlendi: {
    tr: "Arşivlendi",
    ru: "В архиве",
  },

  // === Butonlar ===
  btn_start_production: {
    tr: "⚙️ Üretime Başlat",
    ru: "⚙️ Начать производство",
  },
  btn_send_to_paint: {
    tr: "🎨 Boya'ya Gönder",
    ru: "🎨 На покраску",
  },
  btn_send_to_sewing: {
    tr: "🧵 Dikiş'e Gönder",
    ru: "🧵 На шитьё",
  },
  btn_send_to_upholstery: {
    tr: "🪑 Döşeme'ye Gönder",
    ru: "🪑 На обивку",
  },
  btn_ready: {
    tr: "✅ Hazır",
    ru: "✅ Готово",
  },
  btn_refresh: {
    tr: "🔄 Listeyi Yenile",
    ru: "🔄 Обновить список",
  },
  btn_archive: {
    tr: "🏁 Bitenleri Arşivle",
    ru: "🏁 Архивировать",
  },

  // === Bildirimler (Personel) ===
  notification_new_order: {
    tr: "📦 *YENİ İŞ EMRİ*\n\nMüşteri: {customer}\nÜrün: {product}\nAdet: {quantity}\nBirim: {department}",
    ru: "📦 *НОВЫЙ ЗАКАЗ*\n\nКлиент: {customer}\nИзделие: {product}\nКоличество: {quantity}\nОтдел: {department}",
  },
  notification_status_updated: {
    tr: "Durum {status} olarak güncellendi.",
    ru: "Статус обновлён: {status}.",
  },

  // === Sipariş Dağıtım Raporu ===
  distribution_complete: {
    tr: "🔔 Sipariş dağıtım işlemleri tamamlandı.",
    ru: "🔔 Распределение заказов завершено.",
  },
  auto_depts_distributed: {
    tr: "✅ *Karkas ve Diğer Otomatik Birimler Dağıtıldı.*",
    ru: "✅ *Каркас и другие автоматические отделы распределены.*",
  },

  // === Kayıt / Silme ===
  staff_registered: {
    tr: "✅ Personel başarıyla kaydedildi.",
    ru: "✅ Сотрудник успешно зарегистрирован.",
  },
  staff_removed: {
    tr: "✅ Personel başarıyla silindi.",
    ru: "✅ Сотрудник успешно удалён.",
  },

  // === Otomatik Takip (Follow-Up) ===
  followup_question: {
    tr: "📋 *Durum Sorgusu*\n\nMüşteri: *{customer}*\nÜrün: {product}\nAdet: {quantity}\n\nBu sipariş bitti mi?",
    ru: "📋 *Проверка статуса*\n\nКлиент: *{customer}*\nИзделие: {product}\nКоличество: {quantity}\n\nЭтот заказ готов?",
  },
  btn_yes_done: {
    tr: "✅ Evet, bitti",
    ru: "✅ Да, готово",
  },
  btn_no_ongoing: {
    tr: "⏳ Hayır, devam ediyor",
    ru: "⏳ Нет, в процессе",
  },
  followup_noted_done: {
    tr: "✅ Teşekkürler! Sipariş tamamlandı olarak işaretlendi.",
    ru: "✅ Спасибо! Заказ отмечен как выполненный.",
  },
  followup_noted_ongoing: {
    tr: "⏳ Tamam, 3 gün sonra tekrar soracağım.",
    ru: "⏳ Хорошо, спрошу снова через 3 дня.",
  },
  followup_paint_sent: {
    tr: "🎨 Boya bölümüne iş emri otomatik gönderildi.",
    ru: "🎨 Заказ автоматически отправлен в покрасочный отдел.",
  },
  // === Departmanlar ===
  dept_karkas: {
    tr: "Karkas Üretimi",
    ru: "Производство каркаса",
  },
  dept_metal: {
    tr: "Metal Üretimi",
    ru: "Металлопроизводство",
  },
  dept_mobilya: {
    tr: "Mobilya Dekorasyon",
    ru: "Мебельный декор",
  },
  dept_sewing: {
    tr: "Dikişhane",
    ru: "Швейный цех",
  },
  dept_upholstery: {
    tr: "Döşemehane",
    ru: "Обивочный цех",
  },
  dept_paint: {
    tr: "Boyahane",
    ru: "Покрасочный цех",
  },

  followup_summary_marina: {
    tr: "📊 *Takip Özeti*\n\n{summary}",
    ru: "📊 *Сводка отслеживания*\n\n{summary}",
  },
};

/**
 * Çeviri fonksiyonu
 * @param key - Çeviri anahtarı
 * @param lang - Dil kodu ("tr" | "ru")
 * @param params - Opsiyonel parametreler ({name}, {department} vb.)
 */
export function t(
  key: string,
  lang: Language = "ru",
  params?: Record<string, string>,
): string {
  const entry = translations[key];
  if (!entry) {
    console.warn(`⚠️ i18n: Missing translation key "${key}"`);
    return key;
  }

  let text = entry[lang] || entry["tr"]; // Fallback: Türkçe

  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, "g"), v);
    }
  }

  return text;
}

/**
 * Kullanıcının dilini belirle
 * Boss → "tr", Herkes → "ru"
 */
export function getUserLanguage(role: string): Language {
  return role === "boss" ? "tr" : "ru";
}
