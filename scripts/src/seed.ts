import path from "path";
import fs from "fs";

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

import { seedDatabase } from "@workspace/db/seed";

async function main() {
  console.log("Using DATABASE_URL:", process.env.DATABASE_URL?.substring(0, 30) + "...");
  await seedDatabase();
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed script error:", err);
  process.exit(1);
});
