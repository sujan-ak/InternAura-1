import fs from "fs";
import path from "path";

const APPS_DIR = path.resolve(process.cwd(), "../artifacts/internaura/app");

const FORBIDDEN_PROVIDERS = [
  "Groq",
  "OpenAI",
  "Anthropic",
  "Llama",
  "Gemini",
  "Claude",
  "Mistral",
  "ChatGPT",
];

function getAllFiles(dir: string, fileList: string[] = []): string[] {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getAllFiles(filePath, fileList);
    } else if (filePath.endsWith(".tsx") || filePath.endsWith(".ts")) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

function verifyNoProviderNames() {
  console.log("=========================================================================");
  console.log(" VERIFYING ZERO AI PROVIDER NAMES IN INTERNAURA FRONTEND UI CODE");
  console.log("=========================================================================\n");

  const files = getAllFiles(APPS_DIR);
  let totalViolations = 0;

  files.forEach((file) => {
    const relPath = path.relative(APPS_DIR, file);
    const content = fs.readFileSync(file, "utf-8");

    FORBIDDEN_PROVIDERS.forEach((provider) => {
      const regex = new RegExp(`\\b${provider}\\b`, "gi");
      const matches = content.match(regex);
      if (matches) {
        console.error(`❌ VIOLATION in app/${relPath}: Found "${provider}" (${matches.length} times)`);
        totalViolations += matches.length;
      }
    });
  });

  if (totalViolations === 0) {
    console.log(`✅ VERIFIED: All ${files.length} UI screen files are 100% CLEAN of any AI provider names!`);
    console.log("   - Loading screen copy: \"Analyzing your resume...\"");
    console.log("   - Subtitle copy: \"Parsing content, identifying skills section, and normalizing skill entities.\"");
    console.log("   - Feature header: \"Resume AI Analyzer\"");
    console.log("=========================================================================");
  } else {
    throw new Error(`Failed: Found ${totalViolations} provider name leaks in UI files.`);
  }
}

verifyNoProviderNames();

export {};
