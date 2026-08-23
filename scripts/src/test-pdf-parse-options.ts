import fs from "fs";
import path from "path";
// @ts-ignore
import pdfParse from "pdf-parse/lib/pdf-parse.js";

async function testPdfParseWithUint8Array() {
  const denseBuf = fs.readFileSync(path.resolve(process.cwd(), "dense_resume.pdf"));

  try {
    const data = await pdfParse(denseBuf as any);
    console.log("PDF parse success! Pages:", data.numpages);
    console.log("Text snippet:\n", data.text);
  } catch (err: any) {
    console.error("pdfParse Uint8Array error:", err);
  }
}

testPdfParseWithUint8Array();
