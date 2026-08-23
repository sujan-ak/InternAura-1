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
      process.loadEnvFile(file);
      break;
    }
  }
}
loadEnv();

function mask(str: string | undefined): string {
  if (!str) return "UNDEFINED / EMPTY";
  if (str.length <= 10) return "****";
  return `${str.substring(0, 6)}...${str.substring(str.length - 4)}`;
}

console.log("=================================================");
console.log("         SUPABASE ENVIRONMENT LOAD TEST          ");
console.log("=================================================");
console.log("DATABASE_URL:          ", mask(process.env.DATABASE_URL));
console.log("SUPABASE_URL:          ", mask(process.env.SUPABASE_URL));
console.log("SUPABASE_ANON_KEY:     ", mask(process.env.SUPABASE_ANON_KEY));
console.log("SUPABASE_SERVICE_KEY:  ", mask(process.env.SUPABASE_SERVICE_ROLE_KEY));
console.log("=================================================");

if (process.env.DATABASE_URL?.includes("[project-ref]") || process.env.DATABASE_URL?.includes("[password]")) {
  console.log("\n⚠️ ATTENTION: DATABASE_URL contains placeholder text '[project-ref]' or '[password]'.");
}
