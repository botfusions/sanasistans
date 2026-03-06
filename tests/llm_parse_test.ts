
function extractJson(response: string): any {
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("JSON not found in response");
  const jsonStr = jsonMatch[0].trim();
  return JSON.parse(jsonStr);
}

function test() {
  console.log("🧪 LLM JSON Ayrıştırma Testi Başlatılıyor...");

  const testCases = [
    {
      name: "Saf JSON",
      input: '{"to": "test@test.com", "subject": "Hello", "body": "World"}'
    },
    {
      name: "Markdown Bloklu JSON",
      input: 'Tabii, işte istediğiniz mail:\n\n```json\n{"to": "test@test.com", "subject": "Hello", "body": "World"}\n```\nUmarım yardımcı olmuştur.'
    },
    {
      name: "Ekstra Metinli JSON",
      input: 'Yanıtım şu: {"to": "test@test.com", "subject": "Hello", "body": "World"} Teşekkürler.'
    }
  ];

  testCases.forEach(tc => {
    try {
      const parsed = extractJson(tc.input);
      if (parsed.to === "test@test.com" && parsed.subject === "Hello") {
        console.log(`✅ Başarılı: ${tc.name}`);
      } else {
        console.log(`❌ Başarısız (Hatalı Veri): ${tc.name}`);
      }
    } catch (e) {
      console.log(`❌ Başarısız (Hata fırlatıldı): ${tc.name} - ${e.message}`);
    }
  });
}

test();
