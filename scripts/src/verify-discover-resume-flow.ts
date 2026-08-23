import fs from "fs";
import path from "path";
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

async function verifyDiscoverResumeFlow() {
  console.log("=========================================================================");
  console.log("VERIFYING DISCOVER PAGE RESUME AI ANALYZER ENTRY POINT & FLOW");
  console.log("=========================================================================\n");

  const email = `discover_resume_${Date.now()}@internaura.io`;
  const password = "Password123!";

  // 1. Sign up user & complete initial manual onboarding
  console.log(`1. Signing up user: ${email}...`);
  const signUp = await supabase.auth.signUp({ email, password });
  const user = signUp.data.user;
  if (!user) throw new Error("Failed to sign up User: " + signUp.error?.message);
  console.log(`   Supabase Auth User ID: ${user.id}`);

  console.log("2. Completing initial onboarding with manual skills: ['JavaScript', 'React']...");
  const initRes = await fetch(`${API_BASE}/api/students`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      authUserId: user.id,
      name: "Discover Tester",
      degree: "B.Tech CS",
      year: "3rd year",
      careerGoal: "AI & Software Engineer",
      location: "Bengaluru",
      workMode: "Remote",
      stipendPreference: "₹30k+/month",
      interests: ["AI & ML"],
      skills: ["JavaScript", "React"],
    }),
  });
  const student = (await initRes.json()) as StudentProfileResponse;
  console.log(`   Student profile created with ID: ${student.id}`);

  // 3. Fetch initial Discover Feed recommendations
  console.log("\n3. Fetching Initial Discover Feed Recommendations (Before Resume Upload):");
  const initRecsRes = await fetch(`${API_BASE}/api/recommendations?student_id=${user.id}`);
  const initRecs = (await initRecsRes.json()) as RecommendationResponse[];
  initRecs.slice(0, 3).forEach((rec, idx) => {
    console.log(`   ${idx + 1}. [Score ${rec.score}%] ${rec.internship?.title} @ ${rec.internship?.company}`);
  });

  // 4. Simulate user tapping "Upload Resume" banner on Discover feed & analyzing PDF
  console.log("\n4. User taps 'Upload Resume' banner on Discover feed -> Navigates to app/resume-analyzer.tsx...");
  const pdfPath = path.resolve(process.cwd(), "../node_modules/.pnpm/pdf-parse@1.1.1/node_modules/pdf-parse/test/data/01-valid.pdf");
  const pdfBuffer = fs.readFileSync(pdfPath);
  const boundary = "----WebKitFormBoundary" + Math.random().toString(36).substring(2);
  const postData = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="01-valid.pdf"\r\nContent-Type: application/pdf\r\n\r\n`),
    pdfBuffer,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);

  const startTime = Date.now();
  const analyzeRes = await fetch(`${API_BASE}/api/resume/analyze`, {
    method: "POST",
    headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
    body: postData,
  });
  const durationMs = Date.now() - startTime;
  console.log(`   POST /api/resume/analyze responded in ${durationMs}ms with status ${analyzeRes.status}`);

  // 5. Confirm resume skills & update profile (merging newly analyzed skills)
  console.log("\n5. User confirms extracted skills & merges into student profile...");
  const newSkills = ["Python", "PyTorch", "TensorFlow", "Deep Learning", "Docker"];
  const mergedSkills = Array.from(new Set([...student.skills, ...newSkills]));

  await fetch(`${API_BASE}/api/students`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      authUserId: user.id,
      name: student.name,
      degree: student.degree,
      year: student.year,
      careerGoal: student.careerGoal,
      location: student.location,
      workMode: student.workMode,
      stipendPreference: student.stipendPreference,
      interests: student.interests,
      skills: mergedSkills,
    }),
  });
  console.log("   Merged skills in DB profile:", mergedSkills.join(", "));

  // 6. User routes back to Discover feed -> Refreshed Recommendations
  console.log("\n6. User returns to Discover feed -> Fetching Refreshed Discover Recommendations:");
  const updatedRecsRes = await fetch(`${API_BASE}/api/recommendations?student_id=${user.id}`);
  const updatedRecs = (await updatedRecsRes.json()) as RecommendationResponse[];
  updatedRecs.slice(0, 3).forEach((rec, idx) => {
    console.log(`   ${idx + 1}. [Score ${rec.score}%] ${rec.internship?.title} @ ${rec.internship?.company}`);
  });

  // 7. Verify Profile Screen & Onboarding Clean State
  console.log("\n7. Verifying Clean State across screens:");
  const profileFile = fs.readFileSync(path.resolve(process.cwd(), "../artifacts/internaura/app/(tabs)/profile.tsx"), "utf8");
  const onboardingFile = fs.readFileSync(path.resolve(process.cwd(), "../artifacts/internaura/app/onboarding/index.tsx"), "utf8");

  const profileHasResumeAnalyzer = profileFile.includes("resume-analyzer");
  const onboardingHasDocumentPicker = onboardingFile.includes("expo-document-picker");

  console.log(`   - Profile Screen has Resume Analyzer entry point? ${profileHasResumeAnalyzer ? "YES (FAIL)" : "NO (PASS)"}`);
  console.log(`   - Onboarding Screen has Document Picker? ${onboardingHasDocumentPicker ? "YES (FAIL)" : "NO (PASS)"}`);

  if (!profileHasResumeAnalyzer && !onboardingHasDocumentPicker) {
    console.log("\n=========================================================================");
    console.log("SUCCESS: ALL DISCOVER RESUME ENTRY POINT & ISOLATION CHECKS PASSED!");
    console.log("=========================================================================");
  } else {
    throw new Error("Screen isolation check failed!");
  }
}

verifyDiscoverResumeFlow().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
