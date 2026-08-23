import path from "path";
import fs from "fs";
import http from "http";

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

import app from "../../artifacts/api-server/src/app";
import { extractTextFromPdfBuffer, extractSkillsSection, extractSkillsFromSectionText } from "../../artifacts/api-server/src/routes/resume";

// Create a realistic ~200KB PDF buffer with extensive resume text
function generate200KbResumePdf(): Buffer {
  let textContent = `AARAV MEHTA - SENIOR FULL STACK & AI ENGINEER\nEmail: aarav@example.com | Phone: +91 9876543210 | Bengaluru, India\n\n`;

  textContent += `SUMMARY\nPassionate software engineer with 4+ years of experience building high-scale web applications, microservices, and AI models.\n\n`;

  textContent += `TECHNICAL SKILLS\n`;
  textContent += `Programming Languages: Python, JavaScript, TypeScript, C++, Java, Go, Rust, SQL, HTML5, CSS3\n`;
  textContent += `Frameworks & Libraries: React, Next.js, Node.js, Express, FastAPI, Django, PyTorch, TensorFlow, TailwindCSS, Redux Toolkit, GraphQL, REST APIs\n`;
  textContent += `Databases & Storage: PostgreSQL, MongoDB, Redis, Pinecone, Weaviate, SQLite, DynamoDB\n`;
  textContent += `DevOps & Cloud: Docker, Kubernetes, AWS (S3, EC2, Lambda), GCP, CI/CD, Git, GitHub Actions, Linux, Nginx\n`;
  textContent += `Tools & Concepts: Figma, Wireframing, Agile/Scrum, System Design, Microservices, RAG Systems, LLM Fine-Tuning, Unit Testing, Jest, Playwright\n\n`;

  textContent += `PROFESSIONAL EXPERIENCE\n`;
  for (let i = 1; i <= 25; i++) {
    textContent += `Senior Software Engineer - Tech Company ${i} (2020 - 2024)\n`;
    textContent += `- Architected and deployed high-throughput microservices handling over ${i * 50000} daily active users.\n`;
    textContent += `- Reduced database query latency by ${i * 2}% through strategic index optimization and Redis caching layer.\n`;
    textContent += `- Integrated Groq LLM and OpenAI APIs to enable real-time semantic document search and summary generation.\n`;
    textContent += `- Led a team of ${i} engineers in implementing CI/CD pipelines with GitHub Actions and automated E2E testing.\n\n`;
  }

  textContent += `PROJECTS\n`;
  for (let i = 1; i <= 15; i++) {
    textContent += `Project Alpha ${i} - Generative AI Knowledge Platform\n`;
    textContent += `Built a full-stack RAG system using Next.js, FastAPI, Vector DB, and Llama 3 models. Processed over 100,000 documents with 99.4% precision.\n\n`;
  }

  // Pad to reach ~200KB size with standard PDF stream structure
  const pdfHead = `%PDF-1.4\n1 0 obj\n<</Type /Catalog /Pages 2 0 R>>\nendobj\n2 0 obj\n<</Type /Pages /Kids [3 0 R] /Count 1>>\nendobj\n3 0 obj\n<</Type /Page /Parent 2 0 R /Resources <</Font <</F1 <</Type /Font /Subtype /Type1 /BaseFont /Helvetica>>>>>> /MediaBox [0 0 612 792] /Contents 4 0 R>>\nendobj\n4 0 obj\n<</Length ${textContent.length}>>\nstream\nBT /F1 10 Tf 50 750 Td (${textContent.replace(/[()]/g, "")}) Tj ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \ntrailer\n<</Size 5 /Root 1 0 R>>\nstartxref\n500\n%%EOF`;

  // Create buffer padded to exactly ~200KB
  const baseBuf = Buffer.from(pdfHead);
  const targetSize = 200 * 1024; // 200KB
  if (baseBuf.length < targetSize) {
    const padding = Buffer.alloc(targetSize - baseBuf.length, " ");
    return Buffer.concat([baseBuf, padding]);
  }
  return baseBuf;
}

async function runPerformanceBenchmark() {
  console.log("=================================================================");
  console.log("      REAL-WORLD 0.20MB RESUME PDF TIMING BENCHMARK              ");
  console.log("=================================================================\n");

  const pdfBuffer = generate200KbResumePdf();
  console.log(`Padded Test PDF Buffer Size: ${(pdfBuffer.length / 1024).toFixed(2)} KB (${pdfBuffer.length} bytes)\n`);

  // 1. Benchmark PDF Text Extraction
  const tPdfStart = Date.now();
  const extractedText = await extractTextFromPdfBuffer(pdfBuffer);
  const tPdfEnd = Date.now();
  console.log(`[BENCHMARK 1] pdf-parse Extraction Time: ${tPdfEnd - tPdfStart}ms`);
  console.log(`Extracted Text Length: ${extractedText.length} chars\n`);

  // 2. Benchmark Skills Section Regex & Token Extraction
  const tSkillsStart = Date.now();
  const sectionText = extractSkillsSection(extractedText);
  const tokens = extractSkillsFromSectionText(sectionText.length > 0 ? sectionText : extractedText);
  const tSkillsEnd = Date.now();
  console.log(`[BENCHMARK 2] Skills Section & Token Extraction Time: ${tSkillsEnd - tSkillsStart}ms`);
  console.log(`Raw Tokens Found: ${tokens.length}`);
  console.log(`Tokens Sample:`, tokens.slice(0, 15), "\n");

  // 3. Benchmark End-to-End API Route Request
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(5004, resolve));
  console.log("Test Server running on http://localhost:5004");

  const formData = new FormData();
  const blob = new Blob([new Uint8Array(pdfBuffer)], { type: "application/pdf" });
  formData.append("file", blob, "Final_resume.pdf");

  const tApiStart = Date.now();
  const apiRes = await fetch("http://localhost:5004/api/resume/analyze", {
    method: "POST",
    body: formData,
  });
  const tApiEnd = Date.now();

  const apiData: any = await apiRes.json();
  console.log(`\n[BENCHMARK 3] End-to-End API Response Time: ${tApiEnd - tApiStart}ms`);
  console.log(`HTTP Status: ${apiRes.status}`);
  console.log(`Skills Returned Count: ${apiData.skills?.length}`);
  console.log(`Skills Returned Sample:`, apiData.skills?.slice(0, 10));

  server.close();
}

runPerformanceBenchmark();
