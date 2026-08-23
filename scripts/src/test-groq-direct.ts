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

async function testGroqActiveModel(): Promise<string | undefined> {
  const apiKey = process.env.GROQ_API_KEY;

  const prompt = `You are an expert AI Resume Analyzer assistant. You are provided a list of raw skill strings extracted from a resume. Your task is to:
1. Normalize the skill names (e.g., standardizing capitalization like 'python' to 'Python', 'reactjs' to 'React').
2. Group/assign each skill into a clear category (e.g., 'Programming Languages', 'Web Technologies', 'Databases', 'Design Tools', 'Soft Skills', etc.).
3. Keep track of the original raw skill string in 'original_name'.

You MUST output raw JSON matching this structure exactly:
{
  "skills": [
    {
      "name": "Normalized Skill Name",
      "original_name": "Original Raw Skill Name",
      "category": "Category Name",
      "confidence": 1.0
    }
  ]
}

Raw Skills list to normalize:
-------------------
["Python", "React", "TypeScript", "Node.js", "Figma", "User Research"]
-------------------`;

  const models = ["llama-3.3-70b-versatile", "groq/compound"];

  for (const model of models) {
    console.log(`Testing active Groq model: ${model}...`);
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.1,
      }),
    });

    console.log(`Model ${model} HTTP Status:`, response.status);
    const data: any = await response.json();
    if (response.status === 200) {
      console.log(`SUCCESS with ${model}! Response Content:`);
      console.log(data.choices[0].message.content);
      return model;
    } else {
      console.log(`Error with ${model}:`, data.error?.message);
    }
  }

  return undefined;
}

testGroqActiveModel();
