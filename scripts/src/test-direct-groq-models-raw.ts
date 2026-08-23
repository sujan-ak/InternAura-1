import path from "path";
import fs from "fs";

function loadEnv() {
  const candidates = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "../.env"),
    path.resolve(process.cwd(), "../../.env"),
    path.resolve(process.cwd(), "artifacts/api-server/.env"),
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

async function runRawTest() {
  const apiKey = process.env.GROQ_API_KEY;
  console.log("GROQ_API_KEY Loaded:", apiKey ? `${apiKey.substring(0, 10)}...` : "NOT FOUND");

  const models = ["llama-3.3-70b-versatile", "groq/compound"];

  for (const model of models) {
    console.log(`\n==================================================`);
    console.log(`RAW ISOLATED GROQ API TEST FOR MODEL: "${model}"`);
    console.log(`==================================================`);
    
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: "hello" }],
        }),
      });

      console.log(`STATUS CODE: ${response.status} ${response.statusText}`);
      const bodyText = await response.text();
      console.log(`RAW RESPONSE BODY:`);
      console.log(bodyText);
    } catch (err: any) {
      console.log(`FETCH ERROR FOR ${model}:`, err.message);
    }
  }
}

runRawTest();
