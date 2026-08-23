import fs from "fs";
import path from "path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

async function createPdf() {
  const pdfDoc = await PDFDocument.create();
  const timesRomanFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const page = pdfDoc.addPage([600, 800]);
  const { height } = page.getSize();
  const fontSize = 12;

  page.drawText("AARAV MEHTA - RESUME", {
    x: 50,
    y: height - 40,
    size: 18,
    font: timesRomanFont,
    color: rgb(0, 0, 0),
  });

  page.drawText("SKILLS", {
    x: 50,
    y: height - 80,
    size: 14,
    font: timesRomanFont,
    color: rgb(0, 0, 0),
  });

  page.drawText("Technical Skills: Python, React, TypeScript, Node.js, Figma, User Research", {
    x: 50,
    y: height - 110,
    size: fontSize,
    font: timesRomanFont,
    color: rgb(0, 0, 0),
  });

  page.drawText("EXPERIENCE", {
    x: 50,
    y: height - 150,
    size: 14,
    font: timesRomanFont,
    color: rgb(0, 0, 0),
  });

  page.drawText("Product Design Intern at Northstar Labs - Built UI prototypes and design systems.", {
    x: 50,
    y: height - 180,
    size: fontSize,
    font: timesRomanFont,
    color: rgb(0, 0, 0),
  });

  const pdfBytes = await pdfDoc.save();
  const outputPath = path.resolve(process.cwd(), "sample_resume.pdf");
  fs.writeFileSync(outputPath, pdfBytes);
  console.log("SUCCESS: Generated 100% valid PDF with pdf-lib at:", outputPath);
}

createPdf();
