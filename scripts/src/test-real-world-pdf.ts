import fs from "fs";
import path from "path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
// @ts-ignore
import pdfParse from "pdf-parse/lib/pdf-parse.js";

async function createAndTestRealWorldResume() {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const page = pdfDoc.addPage([595, 842]); // A4 size

  page.drawText("SUJAN SHARMA", { x: 50, y: 790, size: 20, font: fontBold, color: rgb(0.1, 0.2, 0.4) });
  page.drawText("Full Stack Software Engineer | sujan.sharma@example.com | +91 98765 43210", { x: 50, y: 770, size: 10, font, color: rgb(0.3, 0.3, 0.3) });

  page.drawText("TECHNICAL SKILLS", { x: 50, y: 730, size: 14, font: fontBold, color: rgb(0.1, 0.2, 0.4) });
  page.drawText("Languages: JavaScript, TypeScript, Python, C++, Java, HTML5, CSS3", { x: 50, y: 710, size: 11, font });
  page.drawText("Frameworks & Libraries: React, React Native, Next.js, Node.js, Express, TailwindCSS, Redux", { x: 50, y: 690, size: 11, font });
  page.drawText("Databases & Cloud: PostgreSQL, MongoDB, Redis, Supabase, AWS S3, Docker, Git", { x: 50, y: 670, size: 11, font });

  page.drawText("WORK EXPERIENCE", { x: 50, y: 630, size: 14, font: fontBold, color: rgb(0.1, 0.2, 0.4) });
  page.drawText("Senior Frontend Developer — Acme Innovations (2023 - Present)", { x: 50, y: 610, size: 11, font: fontBold });
  page.drawText("• Architected high-performance React Native mobile applications serving 100k+ active users.", { x: 50, y: 590, size: 10, font });
  page.drawText("• Reduced bundle size by 35% through dynamic code splitting and asset optimization.", { x: 50, y: 575, size: 10, font });

  page.drawText("PROJECTS", { x: 50, y: 530, size: 14, font: fontBold, color: rgb(0.1, 0.2, 0.4) });
  page.drawText("InternAura — AI-Powered Internship Matcher", { x: 50, y: 510, size: 11, font: fontBold });
  page.drawText("• Implemented automated resume skill extraction using LLMs and vector embeddings.", { x: 50, y: 490, size: 10, font });

  const pdfBytes = await pdfDoc.save();
  const realPdfPath = path.resolve(process.cwd(), "real_resume_sujan.pdf");
  fs.writeFileSync(realPdfPath, pdfBytes);
  console.log("Saved real_resume_sujan.pdf (", pdfBytes.length, "bytes)");

  // Test pdf-parse with buffer as any
  const parsed = await pdfParse(Buffer.from(pdfBytes) as any);
  console.log("\n--- RAW EXTRACTED TEXT (data.text) BEFORE SKILLS-SECTION REGEX ---");
  console.log(parsed.text);
}

createAndTestRealWorldResume().catch((err) => console.error("Error:", err));
