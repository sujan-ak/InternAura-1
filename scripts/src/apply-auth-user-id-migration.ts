import path from "path";
import fs from "fs";
import { pool } from "../../lib/db/src/index";

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

async function applyAuthUserIdMigration() {
  try {
    console.log("Applying auth_user_id column migration to students table...");

    await pool.query(`
      ALTER TABLE students ADD COLUMN IF NOT EXISTS auth_user_id UUID;
    `);

    console.log("SUCCESS: Column 'auth_user_id' added to 'students' table!");
  } catch (err: any) {
    console.error("Error applying migration:", err.message);
  } finally {
    process.exit(0);
  }
}

applyAuthUserIdMigration();
