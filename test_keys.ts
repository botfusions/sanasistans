import { QdrantClient } from "@qdrant/js-client-rest";
import dotenv from "dotenv";

dotenv.config();

const url = "https://qdrant.turklawai.com";
const keys = [
  "PVrZ8QZkHrn4MFCvlZRhor1DMuoDr5l6",
  "PZQEkh2IrpL2CIo00gyuOzqdqnEwMT5I",
];

async function testKeys() {
  for (const key of keys) {
    console.log(`\nTesting API Key: ${key.substring(0, 5)}...`);
    const client = new QdrantClient({ url, apiKey: key });
    try {
      const result = await client.getCollections();
      console.log("✅ Connection SUCCESS!");
      console.log(
        "Collections:",
        result.collections.map((c) => c.name).join(", "),
      );
      console.log(`\n>>> USE THIS KEY: ${key}`);
      return;
    } catch (error: any) {
      console.log(`❌ Failed: ${error.message}`);
    }
  }
}

testKeys();
