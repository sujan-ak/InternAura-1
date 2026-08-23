import fs from "fs";
import path from "path";

function generateValidResumePdf(): Buffer {
  const pdfText = `%PDF-1.0
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Resources<>/Contents 4 0 R/Parent 2 0 R>>endobj
4 0 obj<</Length 120>>stream
BT
/F1 12 Tf
100 700 Td
(SKILLS) Tj
0 -20 Td
(Python, React, TypeScript, Node.js, Figma, User Research) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000052 00000 n 
0000000102 00000 n 
0000000195 00000 n 
trailer<</Size 5/Root 1 0 R>>
startxref
366
%%EOF`;

  return Buffer.from(pdfText);
}

const outputPath = path.resolve(process.cwd(), "sample_resume.pdf");
fs.writeFileSync(outputPath, generateValidResumePdf());
console.log("Valid sample resume PDF written to:", outputPath);
