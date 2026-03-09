const { createClient } = require("@supabase/supabase-js");
const crypto = require("crypto");

const supabase = createClient(
  "https://aejhzxvuegchakaknwts.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlamh6eHZ1ZWdjaGFrYWtud3RzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjU0MDcxOSwiZXhwIjoyMDg4MTE2NzE5fQ.SDFo62u3Ss2oG0ecPXkVWS7RLo2_-XWhLMCh0rDW8rU",
);

const TID = 6030287709;

const staff = [
  {
    name: "Marina",
    department: "Kalite Kontrol",
    role: "Personnel",
    is_marina: true,
  },
  {
    name: "Bekbergen",
    department: "Karkas \u00dcretimi",
    role: "Personnel",
    is_marina: false,
  },
  {
    name: "Valeri",
    department: "Metal \u00dcretimi",
    role: "Personnel",
    is_marina: false,
  },
  {
    name: "Zhenis",
    department: "Mobilya Dekorasyon",
    role: "Personnel",
    is_marina: false,
  },
  {
    name: "Almira",
    department: "Diki\u015fhane",
    role: "Personnel",
    is_marina: false,
  },
  {
    name: "Hasan",
    department: "D\u00f6\u015femehane",
    role: "Personnel",
    is_marina: false,
  },
  {
    name: "Zhagir",
    department: "D\u00f6\u015femehane",
    role: "Personnel",
    is_marina: false,
  },
  {
    name: "Aleksi",
    department: "D\u00f6\u015femehane",
    role: "Personnel",
    is_marina: false,
  },
  {
    name: "Yura",
    department: "D\u00f6\u015femehane",
    role: "Personnel",
    is_marina: false,
  },
  {
    name: "Zhanibek",
    department: "Boyahane",
    role: "Personnel",
    is_marina: false,
  },
  {
    name: "Nikita",
    department: "Paketleme",
    role: "Personnel",
    is_marina: false,
  },
  {
    name: "Bekir",
    department: "Sevkiyat",
    role: "Personnel",
    is_marina: false,
  },
];

async function main() {
  console.log(
    "RESTORE & TEST: Inserting " + staff.length + " staff for ID " + TID,
  );

  for (const p of staff) {
    const { error } = await supabase.from("staff").upsert(
      {
        id: crypto.randomUUID(),
        telegram_id: TID,
        name: p.name,
        department: p.department,
        role: p.role,
        is_marina: p.is_marina,
      },
      { onConflict: "id" },
    ); // UUID unique olduğu için insert gibi davranır

    if (error) {
      console.log("FAIL " + p.name + ": " + error.message);
    } else {
      console.log("OK " + p.name + " (" + p.department + ")");
    }
  }
  console.log("Restoration Complete!");
}

main();
