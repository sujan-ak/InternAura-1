import pg from "pg";
const { Pool } = pg;

const host = "aws-0-ap-south-1.pooler.supabase.com";
const user = "postgres.ahtecmpfwslhcabkypdk";

const passList = [
  "InternAura2026",
  "InternAura2026!",
  "InternAura#2026",
  "InternAura@2026",
  "postgres",
];

async function check() {
  for (const pass of passList) {
    const url = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}:6543/postgres`;
    console.log(`Trying password '${pass}'...`);
    const pool = new Pool({
      connectionString: url,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 4000,
    });
    try {
      const res = await pool.query("SELECT 1 as ping");
      console.log(`🎉 SUCCESS! Password '${pass}' CONNECTED! Ping output:`, res.rows);
      await pool.end();
      return;
    } catch (err: any) {
      console.error(`❌ FAILED: [${err.code || "ERR"}] ${err.message}`);
    } finally {
      await pool.end();
    }
  }
}

check();
