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

async function testLocationFilterMatching() {
  const apiUrl = "http://localhost:5000";

  console.log("Testing location filter matching against GET /api/internships and GET /api/recommendations...");

  const resInternships = await fetch(`${apiUrl}/api/internships`);
  const internships: any[] = (await resInternships.json()) as any[];

  const resRecs = await fetch(`${apiUrl}/api/recommendations?student_id=00000000-0000-0000-0000-000000000001`);
  const rawRecs: any[] = (await resRecs.json()) as any[];

  console.log(`Fetched ${internships.length} internships and ${rawRecs.length} recommendations.`);

  const testLocations = ["Bengaluru", "Mumbai", "Remote", "Delhi NCR", "Hyderabad", "Pune", "Gurugram"];

  for (const locFilter of testLocations) {
    const matchedInternships = internships.filter(
      (x: any) => x.location && x.location.toLowerCase().includes(locFilter.toLowerCase())
    );

    const matchedRecs = rawRecs.filter(
      (r: any) => r.internship && r.internship.location && r.internship.location.toLowerCase().includes(locFilter.toLowerCase())
    );

    console.log(`\nFilter Location: "${locFilter}"`);
    console.log(` -> Matched raw internships: ${matchedInternships.length}`);
    console.log(` -> Matched recommendations: ${matchedRecs.length}`);
    if (matchedInternships.length > 0) {
      console.log(`    Sample: ${matchedInternships[0].title} at ${matchedInternships[0].company} (${matchedInternships[0].location})`);
    }
  }
}

testLocationFilterMatching();
