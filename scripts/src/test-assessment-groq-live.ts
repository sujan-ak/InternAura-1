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

async function testAssessmentLive() {
  console.log("=================================================");
  console.log("TESTING LIVE ASSESSMENT GENERATE + EVALUATE VIA GROQ");
  console.log("=================================================");

  const baseUrl = "http://localhost:5000";

  // 1. GENERATE
  const tGenStart = Date.now();
  console.log("\n[1] Sending POST /api/assessment/generate for skill 'React'...");
  const genRes = await fetch(`${baseUrl}/api/assessment/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      skill: "React",
      level: "Intermediate",
      requirements: "Hooks, Context API, Virtual DOM, state optimization",
    }),
  });

  const tGenEnd = Date.now();
  const genDuration = tGenEnd - tGenStart;
  console.log(`HTTP Status: ${genRes.status}`);
  console.log(`Generation Response Time: ${genDuration}ms`);

  const genData: any = await genRes.json();
  console.log(`\nGenerated Suite Questions Count: ${genData.questions?.length}`);

  console.log("\n--- REAL GROQ GENERATED QUESTION SAMPLE ---");
  if (genData.questions && genData.questions.length > 0) {
    console.log("Question 1 (MCQ):", JSON.stringify(genData.questions[0], null, 2));
    console.log("\nQuestion 6 (Conceptual):", JSON.stringify(genData.questions[5], null, 2));
    console.log("\nQuestion 8 (Debugging):", JSON.stringify(genData.questions[7], null, 2));
    console.log("\nQuestion 10 (Practical):", JSON.stringify(genData.questions[9], null, 2));
  }

  // 2. EVALUATE
  const tEvalStart = Date.now();
  console.log("\n[2] Sending POST /api/assessment/evaluate...");
  const evalRes = await fetch(`${baseUrl}/api/assessment/evaluate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      skill: "React",
      suite_id: genData.suite_id || "test-suite",
      student_id: "00000000-0000-0000-0000-000000000001",
      auth_user: "test-auth-user",
      answers: {
        q1: genData.questions[0]?.correct_answer || "Option A",
        q2: genData.questions[1]?.correct_answer || "Option B",
        q3: genData.questions[2]?.correct_answer || "Option C",
        q4: genData.questions[3]?.correct_answer || "Option D",
        q5: genData.questions[4]?.correct_answer || "Option A",
        q6: "Use React.memo to prevent unnecessary re-renders when parent props do not change, combined with useMemo and useCallback for stable references.",
        q7: "Context API provides a way to pass data through the component tree without manually passing props down at every level, best for global UI state.",
        q8: genData.questions[7]?.correct_answer || "Fix option",
        q9: genData.questions[8]?.correct_answer || "Fix option",
        q10: genData.questions[9]?.correct_answer || "Practical solution",
      },
      questions: genData.questions,
    }),
  });

  const tEvalEnd = Date.now();
  const evalDuration = tEvalEnd - tEvalStart;
  console.log(`HTTP Status: ${evalRes.status}`);
  console.log(`Evaluation Response Time: ${evalDuration}ms`);

  const evalData: any = await evalRes.json();
  console.log("\n--- REAL GROQ EVALUATION RESPONSE ---");
  console.log(`Weighted Score: ${evalData.weighted_score}%`);
  console.log(`Proficiency Tier: ${evalData.proficiency_tier}`);
  console.log("Conceptual Question 6 Feedback:", JSON.stringify(evalData.question_evaluations?.find((q: any) => q.question_id === "q6"), null, 2));
}

testAssessmentLive();
