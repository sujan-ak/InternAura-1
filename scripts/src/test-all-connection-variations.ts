import pg from "pg";
const { Pool } = pg;

const pass = "InternAura2026";
const ref = "ahtecmpfwslhcabkypdk";

const options = [
  { label: "Pooler Port 6543 (Transaction Mode)", url: `postgresql://postgres.${ref}:${pass}@aws-0-ap-south-1.pooler.supabase.com:6543/postgres` },
  { label: "Pooler Port 5432 (Session Mode)", url: `postgresql://postgres.${ref}:${pass}@aws-0-ap-south-1.pooler.supabase.com:5432/postgres` },
  { label: "Direct DB Connection (Port 5432)", url: `postgresql://postgres:${pass}@db.${ref}.supabase.co:5432/postgres` },
  { label: "Direct DB Connection with tenant user", url: `postgresql://postgres.${ref}:${pass}@db.${ref}.supabase.co:5432/postgres` },
  { label: "Direct DB Connection Port 6543", url: `postgresql://postgres:${pass}@db.${ref}.supabase.co:6543/postgres` },
];

async function run(): Promise<string | null> {
  console.log("=================================================");
  console.log("    SUPABASE POSTGRESQL CONNECTION MATRIX        ");
  console.log("=================================================");

  for (const opt of options) {
    console.log(`\nTesting ${opt.label}...`);
    console.log(`URL: ${opt.url.replace(/:[^:@]+@/, ":****@")}`);
    const pool = new Pool({
      connectionString: opt.url,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 5000,
    });
    try {
      const res = await pool.query("SELECT 1 as ping");
      console.log(`🎉 SUCCESS! Connected! Ping result:`, res.rows);
      console.log(`\n✅ WORKING DATABASE_URL FOUND:\n${opt.url}`);
      await pool.end();
      return opt.url;
    } catch (err: any) {
      console.error(`❌ FAILED: [${err.code || "ERR"}] ${err.message}`);
    } finally {
      try { await pool.end(); } catch {}
    }
  }
  return null;
}

run();
