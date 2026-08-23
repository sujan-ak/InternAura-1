import fs from "fs";
import path from "path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

async function createDenseResumePdf() {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const page = pdfDoc.addPage([600, 800]);

  const skillsText = [
    "AARAV MEHTA - SENIOR FULL STACK & UI/UX ENGINEER",
    "Email: aarav.mehta@example.com | Phone: +91 9876543210",
    "",
    "SKILLS",
    "Programming Languages: Python, TypeScript, JavaScript, Java, C++, Go, Rust, Kotlin, Swift, SQL",
    "Web Frameworks: React, Next.js, Node.js, Express, Django, FastAPI, Tailwind, HTML5, CSS3, GraphQL",
    "Cloud & DevOps: AWS, Docker, Kubernetes, PostgreSQL, MongoDB, Redis, Git, CI/CD, Terraform, Linux",
    "Design & Product: Figma, User Research, Prototyping, Wireframing, Product Analytics, Design Systems",
    "",
    "WORK EXPERIENCE",
    "Lead Engineer at TechCorp (2023 - Present)",
    "- Built real-time scalable WebRTC applications and microservices architecture.",
    "- Optimized PostgreSQL queries reducing latency by 45%.",
  ].join("\n");

  page.drawText(skillsText, {
    x: 50,
    y: 740,
    size: 11,
    font,
    color: rgb(0.1, 0.1, 0.1),
    lineHeight: 16,
  });

  const pdfBytes = await pdfDoc.save({ useObjectStreams: false });
  const outputPath = path.resolve(process.cwd(), "dense_resume.pdf");
  fs.writeFileSync(outputPath, pdfBytes);
  console.log(`Successfully generated dense PDF resume at ${outputPath} (${pdfBytes.length} bytes)`);
}

createDenseResumePdf();
