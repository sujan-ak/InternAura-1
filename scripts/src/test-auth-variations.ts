import pg from "pg";
const { Pool } = pg;

const host = "aws-0-ap-south-1.pooler.supabase.com";
const user = "postgres.ahtecmpfwslhcabkypdk";

const passVariations = [
  "InternAura2026",
  encodeURIComponent("InternAura2026"),
];

async function run() {
  for (const pass of passVariations) {
    const url = `postgresql://${user}:${pass}@${host}:6543/postgres`;
    console.log(`Testing password variant length=${pass.length}...`);
    const pool = new Pool({
      connectionString: url,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 5000,
    });
    try {
      const res = await pool.query("SELECT 1 as ping");
      console.log(`🎉 SUCCESS! Connected to Supabase! Ping:`, res.rows);
      await pool.end();
      return;
    } catch (err: any) {
      console.error(`❌ FAILED: [${err.code || "ERR"}] ${err.message}`);
    } finally {
      await pool.end();
    }
  }
}

run();
