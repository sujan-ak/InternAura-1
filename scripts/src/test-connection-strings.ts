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

async function testUrl(url: string, label: string) {
  console.log(`\nTesting ${label}:`);
  console.log(`URL: ${url.replace(/:[^:@]+@/, ":****@")}`);
  const pool = new Pool({ connectionString: url, connectionTimeoutMillis: 5000 });
  try {
    const res = await pool.query("SELECT 1 as ping");
    console.log(`✅ SUCCESS! Ping returned:`, res.rows);
    return true;
  } catch (err: any) {
    console.error(`❌ FAILED: [${err.code || "ERR"}] ${err.message}`);
    return false;
  } finally {
    await pool.end();
  }
}

async function runTests() {
  const current = process.env.DATABASE_URL || "";
  
  const options = [
    { label: "Current DATABASE_URL from .env", url: current },
    { label: "Direct DB Connection (Port 5432)", url: "postgresql://postgres:InternAura2026@db.ahtecmpfwslhcabkypdk.supabase.co:5432/postgres" },
    { label: "Direct DB Connection with sslmode=require", url: "postgresql://postgres:InternAura2026@db.ahtecmpfwslhcabkypdk.supabase.co:5432/postgres?sslmode=require" },
    { label: "Pooler IPv4 (Port 6543 Session Mode)", url: "postgresql://postgres.ahtecmpfwslhcabkypdk:InternAura2026@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require" },
    { label: "Pooler Port 5432 (Session Mode)", url: "postgresql://postgres.ahtecmpfwslhcabkypdk:InternAura2026@aws-0-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=require" },
  ];

  for (const opt of options) {
    if (opt.url) {
      const ok = await testUrl(opt.url, opt.label);
      if (ok) {
        console.log(`\n🎉 WORKING CONNECTION URL FOUND: ${opt.label}`);
        break;
      }
    }
  }
}

runTests();
