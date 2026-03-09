import { CronService } from "../src/utils/cron.service";

async function test() {
  console.log("🕒 Zaman Dilimi Testi Başlatılıyor...");
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = {
    timeZone: "Asia/Almaty",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  };
  const almatyTime = now.toLocaleString("tr-TR", options);
  const localTime = now.toLocaleString("tr-TR");

  console.log(`🌍 Yerel Zaman: ${localTime}`);
  console.log(`🇰🇿 Almatı Zamanı: ${almatyTime}`);

  if (almatyTime !== localTime) {
    console.log(
      "ℹ️ Yerel zaman Almatı zamanından farklı. Servis Almatı saatini baz alacak.",
    );
  } else {
    console.log("✅ Yerel zaman zaten Almatı zamanı.");
  }
}

test();
