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

async function testHfDirectCall() {
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  console.log("Testing HUGGINGFACE_API_KEY:", apiKey);

  // Test various models on Hugging Face Serverless Inference
  const endpoints = [
    { url: "https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2", body: { inputs: "Hello world" } },
    { url: "https://api-inference.huggingface.co/models/BAAI/bge-small-en-v1.5", body: { inputs: "Hello world" } },
    { url: "https://router.huggingface.co/hf-inference/models/sentence-transformers/all-MiniLM-L6-v2", body: { inputs: "Hello world" } },
  ];

  for (const ep of endpoints) {
    console.log(`\nTesting ${ep.url}...`);
    try {
      const res = await fetch(ep.url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(ep.body),
      });

      console.log("Status:", res.status, res.statusText);
      const text = await res.text();
      console.log("Response:", text.substring(0, 300));
    } catch (e: any) {
      console.log("Fetch error:", e.message);
    }
  }
}

testHfDirectCall();
