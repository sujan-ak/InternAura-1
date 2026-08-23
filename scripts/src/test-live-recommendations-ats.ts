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

async function testLiveRecommendationsAts() {
  console.log("=================================================================");
  console.log("     TESTING LIVE API SERVER GET /api/recommendations ATS OUTPUT ");
  console.log("=================================================================");

  const apiUrl = process.env.EXPO_PUBLIC_API_URL || "http://localhost:5000";
  console.log(`Connecting to API server at: ${apiUrl}/api/recommendations...`);

  try {
    const res = await fetch(`${apiUrl}/api/recommendations`);
    console.log(`HTTP Status: ${res.status} ${res.statusText}`);

    if (res.ok) {
      const data = (await res.json()) as any[];
      console.log(`Received ${data.length} recommendations!`);

      if (data.length > 0) {
        const top = data[0];
        console.log("\n--- TOP RECOMMENDATION SAMPLE ---");
        console.log(`Role: ${top.internship?.title} @ ${top.internship?.company}`);
        console.log(`ATS Composite Score: ${top.atsScore}% (score: ${top.score}%)`);
        console.log(`ATS Breakdown:`, top.atsBreakdown);
        console.log(`Reasons:`, top.reasons);

        if (top.atsScore !== undefined && top.atsBreakdown !== undefined) {
          console.log("\n[LIVE API VERIFICATION PASSED] API server successfully returned full ATS Score and AtsBreakdown objects!");
        } else {
          console.log("\n[LIVE API VERIFICATION FAILED] Missing atsScore or atsBreakdown fields.");
        }
      }
    } else {
      console.log("Failed to fetch recommendations:", await res.text());
    }
  } catch (err: any) {
    console.error("Error querying live API server:", err.message);
  }
}

testLiveRecommendationsAts();
