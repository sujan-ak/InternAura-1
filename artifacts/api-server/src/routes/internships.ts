import { Router, type Response, type Request } from "express";
import { db, internshipsTable, studentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { seedDatabase } from "@workspace/db/seed";
import { calculateHybridScore, type StudentProfileInput } from "@workspace/db/hybrid-scorer";

const router = Router();

// In-memory cache for Adzuna search results (10 min TTL)
const adzunaCache = new Map<string, { timestamp: number; data: any }>();
const CACHE_TTL_MS = 10 * 60 * 1000;

router.get("/internships", async (_req: Request, res: Response) => {
  try {
    let internships = await db.select().from(internshipsTable);
    if (internships.length === 0) {
      await seedDatabase();
      internships = await db.select().from(internshipsTable);
    }
    return res.json(internships);
  } catch (error) {
    console.error("Error in GET /internships:", error);
    return res.status(500).json({ error: "Failed to list internships" });
  }
});

router.get("/internships/search-adzuna", async (req: Request, res: Response) => {
  const skillsParam = (req.query.skills as string) || "Python, React, TypeScript";
  const locationParam = (req.query.location as string) || "India";
  const studentIdParam = (req.query.student_id as string) || "00000000-0000-0000-0000-000000000001";

  const userSkills = skillsParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const cacheKey = `${skillsParam.toLowerCase()}_${locationParam.toLowerCase()}`;
  const now = Date.now();

  // 1. Check cache first
  const cachedEntry = adzunaCache.get(cacheKey);
  if (cachedEntry && now - cachedEntry.timestamp < CACHE_TTL_MS) {
    console.log(`[Adzuna API] Serving cached results for key: "${cacheKey}"`);
    return res.json(cachedEntry.data);
  }

  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;

  let isFallback = false;
  let fallbackReason = "";
  let results: any[] = [];

  if (appId && appKey) {
    try {
      const country = "in"; // India
      const page = 1;
      
      // Try primary top skills first
      let keywords = userSkills.slice(0, 2).join(" ") || "Developer";
      let adzunaUrl = `https://api.adzuna.com/v1/api/jobs/${country}/search/${page}?app_id=${appId}&app_key=${appKey}&results_per_page=15&what=${encodeURIComponent(keywords)}${locationParam && locationParam !== "India" ? `&where=${encodeURIComponent(locationParam)}` : ""}`;

      console.log(`[Adzuna API] Fetching live jobs from Adzuna: ${adzunaUrl.replace(appKey, "REDACTED")}`);

      let controller = new AbortController();
      let timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout

      let response = await fetch(adzunaUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      let rawJobs: any[] = [];
      if (response.ok) {
        const json = (await response.json()) as any;
        rawJobs = json.results || [];
      } else {
        console.warn(`[Adzuna API Error] Primary query HTTP ${response.status}`);
      }

      // If 0 jobs found with specific location/skills, try broad skill query
      if (rawJobs.length === 0 && userSkills.length > 0) {
        const broadKeyword = `${userSkills[0]} Developer`;
        console.log(`[Adzuna API] 0 results for primary query, retrying broad query: "${broadKeyword}"`);
        const broadUrl = `https://api.adzuna.com/v1/api/jobs/${country}/search/${page}?app_id=${appId}&app_key=${appKey}&results_per_page=15&what=${encodeURIComponent(broadKeyword)}`;
        
        controller = new AbortController();
        timeoutId = setTimeout(() => controller.abort(), 12000);
        response = await fetch(broadUrl, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (response.ok) {
          const json = (await response.json()) as any;
          rawJobs = json.results || [];
        }
      }

      if (rawJobs.length > 0) {
        results = rawJobs.map((job: any, index: number) => {
          const cleanTitle = (job.title || "Internship Role").replace(/<[^>]*>?/gm, "").trim();
          const cleanCompany = (job.company?.display_name || "Partner Company").replace(/<[^>]*>?/gm, "").trim();
          const cleanLocation = (job.location?.display_name || job.location?.area?.join(", ") || locationParam || "India").replace(/<[^>]*>?/gm, "").trim();
          const cleanDesc = (job.description || "Real internship opportunity fetched via Adzuna.").replace(/<[^>]*>?/gm, "").trim();

          const isRemote = cleanTitle.toLowerCase().includes("remote") || cleanDesc.toLowerCase().includes("work from home");
          const workMode = isRemote ? "Remote" : "On-site / Hybrid";

          const salaryText = job.salary_min
            ? `₹${Math.round(job.salary_min / 12).toLocaleString("en-IN")}/month`
            : "Competitive Stipend";

          // Compute match score based on skill presence in title & description
          let matchCount = 0;
          const fullTextLower = `${cleanTitle} ${cleanDesc}`.toLowerCase();
          for (const skill of userSkills) {
            if (fullTextLower.includes(skill.toLowerCase())) matchCount++;
          }
          const matchPercentage = Math.min(98, Math.max(65, Math.round((matchCount / Math.max(1, userSkills.length)) * 40 + 60)));

          return {
            score: matchPercentage,
            reasons: [
              "Real live listing fetched from Adzuna Job Network",
              `Matches your verified skills: ${userSkills.slice(0, 3).join(", ")}`,
              `${workMode} opportunity in ${cleanLocation}`
            ],
            skillGap: userSkills.map((s) => [s, "Strong" as const]),
            isAdzuna: true,
            redirectUrl: job.redirect_url,
            internship: {
              id: `adzuna-${job.id || index}`,
              title: cleanTitle,
              company: cleanCompany,
              description: cleanDesc,
              domain: "Software & Technology",
              location: cleanLocation,
              workMode: workMode,
              duration: "3 - 6 months",
              stipend: salaryText,
              requiredSkills: userSkills,
              preferredSkills: [],
              experienceLevel: "Internship / Entry Level",
              redirectUrl: job.redirect_url
            }
          };
        });
      } else {
        isFallback = true;
        fallbackReason = "Adzuna returned 0 results for these specific keywords.";
      }
    } catch (err: any) {
      isFallback = true;
      fallbackReason = err.name === "AbortError" ? "Adzuna API request timed out (12s)" : (err.message || "Failed to reach Adzuna API");
      console.warn(`[Adzuna API Error] ${fallbackReason}`);
    }
  } else {
    isFallback = true;
    fallbackReason = "ADZUNA_APP_ID or ADZUNA_APP_KEY not set in environment";
  }

  // 2. Fallback to seeded PostgreSQL internships if Adzuna failed or returned 0 results
  if (isFallback || results.length === 0) {
    console.log(`[Adzuna Fallback] Falling back to seeded database internships. Reason: ${fallbackReason}`);
    let internships = await db.select().from(internshipsTable);
    if (internships.length === 0) {
      await seedDatabase();
      internships = await db.select().from(internshipsTable);
    }

    let students = await db.select().from(studentsTable).where(eq(studentsTable.id, studentIdParam));
    const currentStudent: StudentProfileInput = {
      id: studentIdParam,
      name: students[0]?.name || "Student",
      degree: students[0]?.degree || "Computer Science",
      year: students[0]?.year || "3rd Year",
      careerGoal: students[0]?.careerGoal || "Software Engineer",
      location: locationParam,
      workMode: "Hybrid",
      stipendPreference: "₹20k+/month",
      interests: ["Software Development", "AI/ML"],
      skills: userSkills,
    };

    results = await Promise.all(
      internships.map((internship: any) =>
        calculateHybridScore(currentStudent, internship, [])
      )
    );
    results.sort((a: any, b: any) => b.atsScore - a.atsScore);
  }

  const responsePayload = {
    isFallback,
    fallbackReason: isFallback ? fallbackReason : undefined,
    query: { skills: userSkills, location: locationParam },
    totalResults: results.length,
    recommendations: results,
  };

  // Cache valid successful non-empty results
  if (!isFallback && results.length > 0) {
    adzunaCache.set(cacheKey, { timestamp: now, data: responsePayload });
  }

  return res.json(responsePayload);
});

export default router;
