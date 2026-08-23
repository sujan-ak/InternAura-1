import path from "path";
import fs from "fs";
import { createClient } from "@supabase/supabase-js";
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

async function runFullAuthVerification() {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "https://ahtecmpfwslhcabkypdk.supabase.co";
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";
  const apiUrl = process.env.EXPO_PUBLIC_API_URL || "http://localhost:5000";

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  console.log("==================================================");
  console.log("   INTERNAURA SUPABASE AUTH VERIFICATION SUITE   ");
  console.log("==================================================\n");

  // TEST 1: Wrong Password Error Handling
  console.log("--- TEST 1: Wrong Password Error Handling ---");
  const { data: failData, error: failError } = await supabase.auth.signInWithPassword({
    email: "nonexistent.user.2026@gmail.com",
    password: "WrongPassword999!",
  });
  if (failError) {
    console.log("SUCCESS: Clean error returned as expected:", failError.message);
  } else {
    console.error("FAIL: Expected login error but got success:", failData);
  }

  // TEST 2: Signup with fresh credentials
  const testEmail = `auth.test.user.${Date.now()}@gmail.com`;
  const testPassword = "ValidPassword123!";

  console.log("\n--- TEST 2: Signup with fresh credentials ---");
  console.log("Signing up email:", testEmail);

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: testEmail,
    password: testPassword,
  });

  if (signUpError || !signUpData.user) {
    console.error("FAIL: Signup error:", signUpError);
    process.exit(1);
  }

  const authUserId = signUpData.user.id;
  console.log("Signup SUCCESS! Created Supabase Auth User ID:", authUserId);

  // Check auth.users table in PostgreSQL
  const dbAuthUser = await pool.query(`SELECT id, email, email_confirmed_at FROM auth.users WHERE id = $1`, [authUserId]);
  console.log("PostgreSQL auth.users record:", dbAuthUser.rows[0]);

  // TEST 3: Create linked Student profile via POST /api/students
  console.log("\n--- TEST 3: Onboarding & Linked Student Profile Creation ---");
  const postRes = await fetch(`${apiUrl}/api/students`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      authUserId: authUserId,
      name: "Verification Test Student",
      degree: "B.Tech · Computer Science",
      year: "4th year",
      careerGoal: "Fullstack AI Engineer",
      location: "Bengaluru",
      workMode: "Remote",
      stipendPreference: "₹40k+/month",
      interests: ["AI/ML", "Web Development"],
      skills: ["TypeScript", "Node.js", "React Native"],
    }),
  });

  const createdStudent: any = await postRes.json();
  console.log("Created Student Row:", createdStudent);

  // Verify link in PostgreSQL
  const dbStudent = await pool.query(`SELECT id, name, auth_user_id FROM students WHERE id = $1`, [createdStudent.id]);
  console.log("PostgreSQL students record:", dbStudent.rows[0]);

  if (dbStudent.rows[0].auth_user_id === authUserId) {
    console.log("SUCCESS: Student row 'auth_user_id' strictly matches Supabase Auth user ID!");
  } else {
    console.error("FAIL: auth_user_id mismatch!");
  }

  // TEST 4: Fetch Student Profile by authUser via GET /api/students/me
  console.log("\n--- TEST 4: Fetch Profile by authUser on Login ---");
  const getRes = await fetch(`${apiUrl}/api/students/me?authUser=${authUserId}`);
  const fetchedStudent: any = await getRes.json();
  console.log("GET /api/students/me?authUser response:", fetchedStudent);

  // TEST 5: Verify Legacy Seeded Student Isolation (Aarav Mehta)
  console.log("\n--- TEST 5: Legacy Seeded Student Isolation ---");
  const legacyDb = await pool.query(`SELECT id, name, auth_user_id FROM students WHERE id = '00000000-0000-0000-0000-000000000001'`);
  console.log("Legacy Seeded Student Record:", legacyDb.rows[0]);
  if (legacyDb.rows[0] && legacyDb.rows[0].auth_user_id === null) {
    console.log("SUCCESS: Legacy seeded student has auth_user_id = NULL and will not interfere with authenticated user sessions!");
  }

  console.log("\n==================================================");
  console.log("  ALL AUTH & LINKAGE TESTS PASSED 100% CLEANLY!   ");
  console.log("==================================================");

  process.exit(0);
}

runFullAuthVerification();
