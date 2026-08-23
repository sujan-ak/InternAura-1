import fs from "fs";
import path from "path";
import { extractTextFromPdfBuffer, extractSkillsSection, extractSkillsFromSectionText } from "../../artifacts/api-server/src/routes/resume";

async function runDebug() {
  const pdfPath = path.resolve(process.cwd(), "../node_modules/.pnpm/pdf-parse@1.1.1/node_modules/pdf-parse/test/data/01-valid.pdf");
  const buffer = fs.readFileSync(pdfPath);

  const fullText = await extractTextFromPdfBuffer(buffer);
  console.log("Full text extracted length:", fullText.length);

  const sectionText = extractSkillsSection(fullText);
  console.log("Skills section extracted length:", sectionText.length);

  const tokens = extractSkillsFromSectionText(sectionText);
  console.log("Extracted tokens:", tokens);
}

runDebug();
