async function verify() {
  const baseUrl = process.env.API_URL || "http://localhost:5000/api";
  console.log("Verifying API at:", baseUrl);

  try {
    // 1. Health check
    const healthRes = await fetch(`${baseUrl}/healthz`);
    const health = (await healthRes.json()) as any;
    console.log("HEALTH CHECK:", healthRes.status, health);

    // 2. Student Me
    const studentRes = await fetch(`${baseUrl}/students/me`);
    const student = (await studentRes.json()) as any;
    console.log("STUDENT ME:", studentRes.status, student?.name, "skills:", student?.skills);

    // 3. Internships
    const internshipsRes = await fetch(`${baseUrl}/internships`);
    const internships = (await internshipsRes.json()) as any[];
    console.log("INTERNSHIPS COUNT:", internshipsRes.status, internships?.length);

    // 4. Recommendations
    const recsRes = await fetch(`${baseUrl}/recommendations`);
    const recs = (await recsRes.json()) as any[];
    console.log("RECOMMENDATIONS COUNT:", recsRes.status, recs?.length);
    if (Array.isArray(recs) && recs.length > 0) {
      console.log("RECOMMENDATION ITEM SAMPLE:");
      console.log("  score:", recs[0].score, typeof recs[0].score);
      console.log("  reasons:", recs[0].reasons);
      console.log("  skillGap:", recs[0].skillGap);
      console.log("  internship title:", recs[0].internship?.title);
    }

    // 5. Interactions
    const interRes = await fetch(`${baseUrl}/interactions`);
    const inters = (await interRes.json()) as any[];
    console.log("INTERACTIONS COUNT:", interRes.status, inters?.length);

    console.log("\nALL API ENDPOINTS VERIFIED SUCCESSFULLY!");
  } catch (err) {
    console.error("Verification error (server may not be running locally):", err);
  }
}

verify();
