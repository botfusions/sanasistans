import fs from "fs";
import fetch from "node-fetch";
import FormData from "form-data";

async function transcribeWithGroq(filePath: string) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
        console.log("No GROQ_API_KEY");
        return;
    }

    const formData = new FormData();
    formData.append("file", fs.createReadStream(filePath));
    formData.append("model", "whisper-large-v3");
    formData.append("response_format", "json");
    formData.append("language", "tr");

    try {
        const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`
            },
            body: formData,
        });

        const data = await response.json();
        console.log("Groq Sonuç:", data);
    } catch (e) {
        console.error("Hata:", e);
    }
}
