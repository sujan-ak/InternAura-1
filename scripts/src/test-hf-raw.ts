import path from "path";
import fs from "fs";

function loadEnv() {
  const candidates = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "../.env"),
    path.resolve(process.cwd(), "../../.env"),
  ];
  for (const file of candidates) {
    if (fs.existsSync(file)) {
      try {
        process.loadEnvFile(file);
      } catch {}
      break;
    }
  }
}
loadEnv();

async function testHfRaw() {
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  console.log("Testing Hugging Face API key:", apiKey ? `${apiKey.substring(0, 10)}...` : "MISSING");

  const response = await fetch(
    "https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: {
          source_sentence: "React Native developer skilled in TypeScript and Mobile UI",
          sentences: [
            "Frontend Engineer specializing in React Native, Expo, and TypeScript",
            "Data Analyst experienced in SQL, Python, and Tableau dashboards",
          ],
        },
      }),
    }
  );

  console.log("HTTP Status:", response.status, response.statusText);
  const data: any = await response.json();
  console.log("Raw Response Data:", JSON.stringify(data).substring(0, 300) + "...");
}

testHfRaw();
