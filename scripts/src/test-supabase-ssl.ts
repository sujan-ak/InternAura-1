import path from "path";
import fs from "fs";
import pg from "pg";
const { Pool } = pg;

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

async function testWithSslOptions(url: string, label: string) {
  console.log(`\nTesting ${label}:`);
  console.log(`URL: ${url.replace(/:[^:@]+@/, ":****@")}`);
  const pool = new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
  });
  try {
    const res = await pool.query("SELECT 1 as ping");
    console.log(`🎉 SUCCESS! Connected to Supabase PostgreSQL! Ping output:`, res.rows);
    return true;
  } catch (err: any) {
    console.error(`❌ FAILED: [${err.code || "ERR"}] ${err.message}`);
    return false;
  } finally {
    await pool.end();
  }
}

async function runSslTests() {
  const current = process.env.DATABASE_URL || "";
  
  const options = [
    { label: "Pooler Port 6543 (Transaction Mode) + SSL rejectUnauthorized: false", url: current },
    { label: "Pooler Port 5432 (Session Mode) + SSL rejectUnauthorized: false", url: current.replace(":6543/", ":5432/") },
    { label: "Direct Host (aws-0-ap-south-1.pooler.supabase.com:5432)", url: "postgresql://postgres.ahtecmpfwslhcabkypdk:InternAura2026@aws-0-ap-south-1.pooler.supabase.com:5432/postgres" },
  ];

  for (const opt of options) {
    if (opt.url) {
      const ok = await testWithSslOptions(opt.url, opt.label);
      if (ok) {
        console.log(`\n✅ VERIFIED CONNECTIVITY TO SUPABASE POSTGRESQL FOR: ${opt.label}`);
        break;
      }
    }
  }
}

runSslTests();
