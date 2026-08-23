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

async function testUrls() {
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  console.log("Using HUGGINGFACE_API_KEY:", apiKey);

  const urls = [
    "https://router.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2",
    "https://router.huggingface.co/hf-inference/models/sentence-transformers/all-MiniLM-L6-v2",
    "https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2",
    "https://router.huggingface.co/hf-inference/v1/embeddings",
  ];

  for (const url of urls) {
    console.log(`\nTesting URL: ${url}`);
    try {
      const body = url.endsWith("/v1/embeddings")
        ? { model: "sentence-transformers/all-MiniLM-L6-v2", input: "React Native developer" }
        : { inputs: ["React Native developer", "Frontend Engineer"] };

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      console.log(`Unauthenticated HTTP ${res.status} ${res.statusText}`);
      const text = await res.text();
      console.log(`Response snippet: ${text.substring(0, 250)}`);
    } catch (err: any) {
      console.log(`Error: ${err.message}`);
    }
  }
}

testUrls();
