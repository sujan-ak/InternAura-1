import fs from "fs";
import path from "path";

// Generates a minimal, spec-compliant PDF with text stream containing a Skills section
function generateValidResumePdf(): Buffer {
  const content = `BT
/F1 12 Tf
72 712 Td
(AARAV MEHTA) Tj
0 -20 Td
(Email: aarav@example.com | Bengaluru) Tj
0 -30 Td
(SKILLS) Tj
0 -20 Td
(Technical Skills: Python, React, TypeScript, Node.js, Figma, User Research) Tj
0 -30 Td
(EXPERIENCE) Tj
0 -20 Td
(Product Designer Intern at Design Studio) Tj
0 -30 Td
(EDUCATION) Tj
0 -20 Td
(B.Des in Interaction Design) Tj
ET`;

  const pdf = `%PDF-1.4
1 0 obj
<<
  /Type /Catalog
  /Pages 2 0 R
>>
endobj
2 0 obj
<<
  /Type /Pages
  /Kids [3 0 R]
  /Count 1
>>
endobj
3 0 obj
<<
  /Type /Page
  /Parent 2 0 R
  /Resources <<
    /Font <<
      /F1 <<
        /Type /Font
        /Subtype /Type1
        /BaseFont /Helvetica
      >>
    >>
  >>
  /MediaBox [0 0 612 792]
  /Contents 4 0 R
>>
endobj
4 0 obj
<<
  /Length ${content.length}
>>
stream
${content}
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000282 00000 n 
trailer
<<
  /Size 5
  /Root 1 0 R
>>
startxref
${340 + content.length}
%%EOF`;

  return Buffer.from(pdf);
}

const outputPath = path.resolve(process.cwd(), "sample_resume.pdf");
fs.writeFileSync(outputPath, generateValidResumePdf());
console.log("Sample resume PDF generated at:", outputPath);
