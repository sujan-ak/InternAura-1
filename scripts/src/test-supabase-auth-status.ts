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

async function testSupabaseAuth() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  console.log("Testing Supabase Auth endpoint at:", `${url}/auth/v1/health`);

  try {
    const res = await fetch(`${url}/auth/v1/health`, {
      headers: { apikey: key || "" },
    });
    console.log("Auth Health HTTP Status:", res.status);
    const text = await res.text();
    console.log("Auth Health Response:", text);
  } catch (err: any) {
    console.error("Auth test error:", err.message);
  }
}

testSupabaseAuth();
