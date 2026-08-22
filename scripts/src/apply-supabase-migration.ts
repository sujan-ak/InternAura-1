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

async function applyMigration() {
  console.log("=================================================");
  console.log("    APPLYING BASELINE SCHEMA MIGRATION TO SUPABASE");
  console.log("=================================================");

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const migrationPath = path.resolve(
      process.cwd(),
      "../supabase/migrations/20260822000000_baseline.sql"
    );
    const sql = fs.readFileSync(migrationPath, "utf-8");

    console.log("Executing SQL migration script on Supabase PostgreSQL...");
    await pool.query(sql);
    console.log("🎉 SUCCESS! Migration applied successfully.");

    const res = await pool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
    );
    console.log(
      "Tables existing in public schema:",
      res.rows.map((r) => r.table_name)
    );
  } catch (err: any) {
    console.error("Migration failed:", err.message);
  } finally {
    await pool.end();
  }
}

applyMigration();
