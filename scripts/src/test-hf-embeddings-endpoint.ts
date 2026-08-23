import path from "path";
import fs from "fs";
import { getHuggingFaceEmbedding, computeVectorCosineSimilarity } from "@workspace/db/hybrid-scorer";

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

async function testHfEmbeddingsEndpoint() {
  console.log("Testing Hugging Face API key with feature extraction models...");

  const testModels = [
    "https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2",
    "https://router.huggingface.co/hf-inference/models/sentence-transformers/all-MiniLM-L6-v2",
    "https://router.huggingface.co/hf-inference/v1/embeddings",
  ];

  const apiKey = process.env.HUGGINGFACE_API_KEY;

  for (const url of testModels) {
    console.log(`\nTrying URL: ${url}`);
    try {
      const isV1 = url.endsWith("/embeddings");
      const body = isV1
        ? { model: "sentence-transformers/all-MiniLM-L6-v2", input: "React Native developer skilled in TypeScript" }
        : { inputs: "React Native developer skilled in TypeScript" };

      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      console.log("Status:", res.status, res.statusText);
      const text = await res.text();
      console.log("Body snippet:", text.substring(0, 200));

      if (res.ok) {
        const json = JSON.parse(text);
        let vec: number[] = [];
        if (Array.isArray(json) && typeof json[0] === "number") vec = json;
        else if (Array.isArray(json) && Array.isArray(json[0])) vec = json[0];
        else if (json.data && json.data[0]?.embedding) vec = json.data[0].embedding;

        console.log(`SUCCESS! Retrieved ${vec.length}-dim embedding vector!`);
        console.log("First 5 dimensions:", vec.slice(0, 5));
      }
    } catch (e: any) {
      console.log("Error:", e.message);
    }
  }
}

testHfEmbeddingsEndpoint();
