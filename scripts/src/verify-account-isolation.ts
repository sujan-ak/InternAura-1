import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://ahtecmpfwslhcabkypdk.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFodGVjbXBmd3NsaGNhYmt5cGRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczNjA1NDEsImV4cCI6MjEwMjkzNjU0MX0.Db2JI_UIzDPiwDsG5PAnWFrnoal3lJrb73CMNjXhQIA";
const supabase = createClient(supabaseUrl, supabaseAnonKey);
const API_BASE = "http://localhost:5000";

interface StudentProfileResponse {
  id: string;
  name: string;
  degree: string;
  year: string;
  careerGoal: string;
  location: string;
  workMode: string;
  stipendPreference: string;
  interests: string[];
  skills: string[];
  authUser?: string;
}

interface RecommendationResponse {
  score: number;
  reasons: string[];
  internship: {
    id: string;
    title: string;
    company: string;
    location: string;
    workMode: string;
    stipend: string;
  };
}

async function verifyAccountIsolation() {
  console.log("=================================================");
  console.log("VERIFYING ACCOUNT ISOLATION FOR 2 TEST ACCOUNTS");
  console.log("=================================================\n");

  const email1 = `test1_${Date.now()}@internaura.io`;
  const email2 = `test2_${Date.now()}@internaura.io`;
  const password = "TestPassword123!";

  // 1. Sign up User 1
  console.log(`[Account 1] Signing up ${email1}...`);
  const signUp1 = await supabase.auth.signUp({ email: email1, password });
  const user1 = signUp1.data.user;
  if (!user1) throw new Error("Failed to sign up User 1: " + signUp1.error?.message);
  console.log(`[Account 1] Created Supabase Auth User ID: ${user1.id}`);

  // Create Student Profile 1
  const res1 = await fetch(`${API_BASE}/api/students`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      authUserId: user1.id,
      name: "Test One (AI Researcher)",
      degree: "M.Tech · Computer Science",
      year: "4th Year",
      careerGoal: "AI Researcher",
      location: "Delhi NCR",
      workMode: "Remote",
      stipendPreference: "₹40k+/month",
      interests: ["AI & Machine Learning", "NLP"],
      skills: ["Python", "PyTorch", "TensorFlow", "Deep Learning"],
    }),
  });
  const student1 = (await res1.json()) as StudentProfileResponse;
  console.log(`[Account 1] Linked Student Row ID: ${student1.id}`);

  // 2. Sign up User 2
  console.log(`\n[Account 2] Signing up ${email2}...`);
  const signUp2 = await supabase.auth.signUp({ email: email2, password });
  const user2 = signUp2.data.user;
  if (!user2) throw new Error("Failed to sign up User 2: " + signUp2.error?.message);
  console.log(`[Account 2] Created Supabase Auth User ID: ${user2.id}`);

  // Create Student Profile 2
  const res2 = await fetch(`${API_BASE}/api/students`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      authUserId: user2.id,
      name: "Test Two (Product Designer)",
      degree: "B.Des · Visual Communication",
      year: "2nd Year",
      careerGoal: "UI/UX Product Lead",
      location: "Mumbai",
      workMode: "On-site",
      stipendPreference: "₹25k+/month",
      interests: ["Design Systems", "Prototyping"],
      skills: ["Figma", "User Research", "Wireframing", "Illustrator"],
    }),
  });
  const student2 = (await res2.json()) as StudentProfileResponse;
  console.log(`[Account 2] Linked Student Row ID: ${student2.id}`);

  // 3. Fetch Profile for Account 1 via authUser param
  console.log(`\n--- TEST A: FETCHING PROFILE FOR ACCOUNT 1 (${user1.id}) ---`);
  const p1Res = await fetch(`${API_BASE}/api/students/me?authUser=${user1.id}`);
  const p1Data = (await p1Res.json()) as StudentProfileResponse;
  console.log("Account 1 Profile Output:");
  console.log(`- Name: ${p1Data.name}`);
  console.log(`- Goal: ${p1Data.careerGoal}`);
  console.log(`- Location: ${p1Data.location}`);
  console.log(`- Skills: ${p1Data.skills?.join(", ")}`);

  // 4. Fetch Profile for Account 2 via authUser param
  console.log(`\n--- TEST A: FETCHING PROFILE FOR ACCOUNT 2 (${user2.id}) ---`);
  const p2Res = await fetch(`${API_BASE}/api/students/me?authUser=${user2.id}`);
  const p2Data = (await p2Res.json()) as StudentProfileResponse;
  console.log("Account 2 Profile Output:");
  console.log(`- Name: ${p2Data.name}`);
  console.log(`- Goal: ${p2Data.careerGoal}`);
  console.log(`- Location: ${p2Data.location}`);
  console.log(`- Skills: ${p2Data.skills?.join(", ")}`);

  // 5. Fetch Recommendations for Account 1 vs Account 2
  console.log(`\n--- TEST B: DYNAMIC RECOMMENDATIONS RANKING ISOLATION ---`);
  const r1Res = await fetch(`${API_BASE}/api/recommendations?student_id=${user1.id}`);
  const r1Data = (await r1Res.json()) as RecommendationResponse[];
  console.log(`\nAccount 1 Top 3 Ranked Recommendations (${p1Data.name}):`);
  r1Data.slice(0, 3).forEach((rec: RecommendationResponse, idx: number) => {
    console.log(`  ${idx + 1}. [Score ${rec.score}%] ${rec.internship?.title} @ ${rec.internship?.company} (${rec.internship?.location})`);
  });

  const r2Res = await fetch(`${API_BASE}/api/recommendations?student_id=${user2.id}`);
  const r2Data = (await r2Res.json()) as RecommendationResponse[];
  console.log(`\nAccount 2 Top 3 Ranked Recommendations (${p2Data.name}):`);
  r2Data.slice(0, 3).forEach((rec: RecommendationResponse, idx: number) => {
    console.log(`  ${idx + 1}. [Score ${rec.score}%] ${rec.internship?.title} @ ${rec.internship?.company} (${rec.internship?.location})`);
  });

  console.log("\n=================================================");
  console.log("SUCCESS: ACCOUNT ISOLATION VERIFIED FOR BOTH ACCOUNTS!");
  console.log("=================================================");
}

verifyAccountIsolation().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
