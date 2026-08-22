import { defineConfig } from "drizzle-kit";
import path from "path";
import fs from "fs";

const candidates = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "../.env"),
  path.resolve(process.cwd(), "../../.env"),
  path.resolve(__dirname, "../../.env"),
];
for (const file of candidates) {
  if (fs.existsSync(file)) {
    try {
      process.loadEnvFile(file);
    } catch {}
    break;
  }
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be defined in environment or .env");
}

export default defineConfig({
  schema: [
    "./src/schema/students.ts",
    "./src/schema/internships.ts",
    "./src/schema/interactions.ts",
    "./src/schema/recommendations.ts",
  ],
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
