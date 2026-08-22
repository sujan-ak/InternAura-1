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

async function testRawDb() {
  console.log("=================================================");
  console.log("           RAW DB CONNECTION TEST                ");
  console.log("=================================================");

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const ping = await pool.query("SELECT 1 as ping");
    console.log("Ping query output (SELECT 1):", ping.rows);

    const tables = await pool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
    );
    console.log("Public schema table names:", tables.rows.map((r) => r.table_name));
  } catch (err: any) {
    console.error("RAW DATABASE CONNECTION FAILED WITH ERROR:");
    console.error("Error Code:", err.code);
    console.error("Error Message:", err.message);
  } finally {
    await pool.end();
  }
}

testRawDb();
