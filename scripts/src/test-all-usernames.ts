import pg from "pg";
const { Pool } = pg;

const pass = "InternAura2026";
const ref = "ahtecmpfwslhcabkypdk";
const host = "aws-0-ap-south-1.pooler.supabase.com";

const candidates = [
  { user: `postgres.${ref}`, host, port: 6543, db: "postgres" },
  { user: `postgres.${ref}`, host, port: 5432, db: "postgres" },
  { user: `postgres`, host, port: 6543, db: "postgres" },
  { user: `postgres`, host, port: 5432, db: "postgres" },
];

async function run() {
  for (const c of candidates) {
    const url = `postgresql://${c.user}:${pass}@${c.host}:${c.port}/${c.db}`;
    console.log(`\nTesting: user=${c.user} host=${c.host} port=${c.port}`);
    const pool = new Pool({
      connectionString: url,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 4000,
    });
    try {
      const res = await pool.query("SELECT 1 as ping");
      console.log(`🎉 SUCCESS! Ping:`, res.rows);
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
