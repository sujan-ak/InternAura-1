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

async function applyAutoConfirmTrigger() {
  try {
    console.log("Applying auto-confirm trigger on auth.users in Supabase PostgreSQL...");

    await pool.query(`
      CREATE OR REPLACE FUNCTION public.auto_confirm_new_user()
      RETURNS trigger AS $$
      BEGIN
        NEW.email_confirmed_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;

      DROP TRIGGER IF EXISTS on_auth_user_created_auto_confirm ON auth.users;
      CREATE TRIGGER on_auth_user_created_auto_confirm
        BEFORE INSERT ON auth.users
        FOR EACH ROW
        EXECUTE FUNCTION public.auto_confirm_new_user();
    `);

    console.log("SUCCESS: Created trigger 'on_auth_user_created_auto_confirm' on auth.users!");
  } catch (err: any) {
    console.error("Error creating auto-confirm trigger:", err.message);
  } finally {
    process.exit(0);
  }
}

applyAutoConfirmTrigger();
