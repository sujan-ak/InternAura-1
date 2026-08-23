import fs from "fs";
import path from "path";

async function testResumeAnalyzerApi() {
  console.log("=================================================");
  console.log(" TESTING POST /api/resume/analyze ENDPOINT       ");
  console.log("=================================================");

  const pdfPath = path.resolve(process.cwd(), "real_resume_sujan.pdf");
  if (!fs.existsSync(pdfPath)) {
    throw new Error("real_resume_sujan.pdf missing!");
  }

  const formData = new FormData();
  const fileBuffer = fs.readFileSync(pdfPath);
  const blob = new Blob([fileBuffer], { type: "application/pdf" });
  formData.append("file", blob, "real_resume_sujan.pdf");

  console.log("Sending PDF to http://localhost:5000/api/resume/analyze...");
  const res = await fetch("http://localhost:5000/api/resume/analyze", {
    method: "POST",
    body: formData,
  });

  console.log("HTTP Status Code:", res.status);
  const json = (await res.json()) as any;
  console.log("Returned JSON Response:");
  console.log(JSON.stringify(json, null, 2));

  if (res.status === 200 && Array.isArray(json.skills)) {
    console.log(`\nSUCCESS: Extracted ${json.skills.length} skills from PDF!`);
  } else {
    console.error("\nFAILED: Invalid response structure");
  }
}

testResumeAnalyzerApi();
