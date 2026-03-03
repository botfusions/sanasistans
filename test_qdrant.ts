import { QdrantService } from "./src/utils/qdrant.service";

async function testConnection() {
  const qdrant = new QdrantService();
  console.log("Qdrant bağlantısı test ediliyor...");
  const isConnected = await qdrant.checkConnection();
  if (isConnected) {
    console.log("✅ Qdrant BAĞLANTISI BAŞARILI!");
  } else {
    console.log(
      "❌ Qdrant BAĞLANTISI BAŞARISIZ! Lütfen Qdrant server'ın çalıştığından emin olun.",
    );
  }
}

testConnection();
