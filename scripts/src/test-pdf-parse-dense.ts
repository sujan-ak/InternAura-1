import fs from "fs";
import path from "path";
// @ts-ignore
import pdfParse from "pdf-parse/lib/pdf-parse.js";

async function testDensePdf() {
  console.log("Testing pdf-parse on dense_resume.pdf...");
  const denseBuf = fs.readFileSync(path.resolve(process.cwd(), "dense_resume.pdf"));
  const resDense = await pdfParse(denseBuf);
  console.log("\n--- dense_resume.pdf raw text (pages: " + resDense.numpages + ") ---");
  console.log(resDense.text);
}

testDensePdf().catch((err) => console.error("pdf-parse test error:", err));
