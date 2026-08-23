import path from "path";
import fs from "fs";

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

async function checkAuthConfig() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  const testEmail = `internaura.demo.${Date.now()}@gmail.com`;
  const testPassword = "DemoPassword123!";

  console.log("Checking Supabase Auth email confirmation setting with standard email domain...");
  console.log("Test Email:", testEmail);

  try {
    const res = await fetch(`${url}/auth/v1/signup`, {
      method: "POST",
      headers: {
        "apikey": key || "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
      }),
    });

    const status = res.status;
    const data: any = await res.json();
    console.log("Signup HTTP Status:", status);
    console.log("Signup Response Data:\n", JSON.stringify(data, null, 2));

    if (data.session || (data.user && data.user.email_confirmed_at)) {
      console.log("\n[STATUS: OFF] 'Confirm Email' is DISABLED! New signups get immediate login/session without email verification.");
    } else if (data.user && !data.user.email_confirmed_at && !data.session) {
      console.log("\n[STATUS: ON] 'Confirm Email' is ENABLED in Supabase Auth Dashboard!");
    }
  } catch (err: any) {
    console.error("Error checking auth config:", err.message);
  }
}

checkAuthConfig();
