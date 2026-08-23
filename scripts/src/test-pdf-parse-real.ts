import fs from "fs";
import path from "path";
// @ts-ignore
import pdfParse from "pdf-parse/lib/pdf-parse.js";

async function testPdfParse() {
  console.log("Testing pdf-parse/lib/pdf-parse.js on sample_resume.pdf...");
  const sampleBuf = fs.readFileSync(path.resolve(process.cwd(), "sample_resume.pdf"));
  const resSample = await pdfParse(sampleBuf);
  console.log("\n--- sample_resume.pdf raw text (pages: " + resSample.numpages + ") ---");
  console.log(resSample.text);

  console.log("\nTesting pdf-parse/lib/pdf-parse.js on dense_resume.pdf...");
  const denseBuf = fs.readFileSync(path.resolve(process.cwd(), "dense_resume.pdf"));
  const resDense = await pdfParse(denseBuf);
  console.log("\n--- dense_resume.pdf raw text (pages: " + resDense.numpages + ") ---");
  console.log(resDense.text);
}

testPdfParse().catch((err) => console.error("pdf-parse test error:", err));
