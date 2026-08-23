import { Router, type Request, type Response } from "express";
import multer from "multer";
// @ts-ignore
import pdfParse from "pdf-parse/lib/pdf-parse.js";

const router = Router();

const upload = multer({
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf" || file.originalname.toLowerCase().endsWith(".pdf")) {
      cb(null, true);
    } else {
      cb(new Error("Please upload a PDF file only."));
    }
  },
});

export interface SkillItem {
  name: string;
  original_name?: string;
  category: string;
  confidence: number;
}

/**
 * Strip literal HTML/XML tags from raw PDF text.
 * Some PDFs (exported from Canva, web-to-PDF tools, or doc converters) embed
 * actual tag strings like "<h2>Technical Skills</h2>", "<ul>", "<li>PowerBI</li>"
 * as plain text inside the PDF layer. pdf-parse faithfully extracts these verbatim.
 * This sanitizer removes them before any regex or token extraction runs.
 */
function stripHtmlTags(text: string): string {
  // 1. Replace tags fused to real content: extract text between tags
  //    e.g. "<li>Power BI</li>" → "Power BI", "<h2>Skills</h2>" → "Skills"
  let sanitized = text.replace(/<[^>]+>([^<]*)<\/[^>]+>/g, (_, inner) => inner.trim() ? " " + inner.trim() + " " : " ");
  // 2. Strip any remaining standalone/unclosed tags: <h2>, </li>, <br/>, etc.
  sanitized = sanitized.replace(/<[^>]+>/g, " ");
  // 3. Collapse multiple spaces/blank lines created by tag removal
  sanitized = sanitized.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  return sanitized;
}

export async function extractTextFromPdfBuffer(buffer: Buffer): Promise<string> {
  try {
    const data = await pdfParse(buffer as any);
    let text = (data.text || "").replace(/\r\n/g, "\n").trim();

    if (!text || text.length < 20) {
      console.warn("[PDF Parse] Extracted text is empty or too short.");
      return "";
    }

    // Sanity check against raw binary garbage (e.g. FlateDecode, startxref, %PDF, /FontDescriptor)
    if (text.includes("FlateDecode") || text.includes("startxref") || text.includes("/FontDescriptor")) {
      console.warn("[PDF Parse] Detected raw PDF binary syntax in text output. Rejecting garbage.");
      return "";
    }

    // --- HTML TAG SANITIZATION ---
    // Applied BEFORE printable-ratio check so tag characters don't inflate the non-printable ratio
    const hadHtmlTags = /<[^>]+>/.test(text);
    if (hadHtmlTags) {
      console.log("[PDF Parse] HTML-like tags detected in raw PDF text — sanitizing before extraction.");
      text = stripHtmlTags(text);
    }

    const printableCount = (text.match(/[\w\s.,;:()\/\-+•]/g) || []).length;
    const ratio = printableCount / text.length;
    if (ratio < 0.60) {
      console.warn(`[PDF Parse] Low readable text ratio (${(ratio * 100).toFixed(1)}%). Likely scanned image or unsupported PDF encoding.`);
      return "";
    }

    return text;
  } catch (err: any) {
    console.error("[PDF Parse Error]", err?.message || err);
    return "";
  }
}

export function extractSkillsSection(text: string): string {
  const lines = text.split("\n");

  const headerRegexes = [
    /^\s*(?:technical\s+|core\s+|professional\s+|it\s+)?skills\b/i,
    /^\s*technologies\b/i,
    /^\s*tools\b/i,
    /^\s*core\s+competencies\b/i,
    /^\s*(?:technical\s+)?expertise\b/i,
    /^\s*areas\s+of\s+expertise\b/i,
    /^\s*it\s+skills\b/i,
  ];

  const stopRegexes = [
    /experience/i,
    /work\s+history/i,
    /employment/i,
    /education/i,
    /projects/i,
    /certifications/i,
    /licenses/i,
    /achievements/i,
    /honors/i,
    /awards/i,
    /publications/i,
    /summary/i,
    /objective/i,
    /languages/i,
    /interests/i,
    /profile/i,
    /about\s+me/i,
    /activities/i,
    /declarations/i,
    /references/i,
  ];

  let startLineIdx = -1;

  for (let idx = 0; idx < lines.length; idx++) {
    const cleanLine = lines[idx].trim().toLowerCase();
    let matched = false;
    for (const r of headerRegexes) {
      if (r.test(cleanLine)) {
        matched = true;
        break;
      }
    }
    if (matched) {
      startLineIdx = idx;
      break;
    }
  }

  if (startLineIdx === -1) {
    for (let idx = 0; idx < lines.length; idx++) {
      const cleanLine = lines[idx].trim().toLowerCase();
      const cleanLineClean = cleanLine.replace(/[:\-\*\#\d\•]/g, "").trim();
      if (cleanLineClean.length < 25) {
        for (const pattern of [/\bskills\b/i, /\btechnologies\b/i, /\btools\b/i, /\bexpertise\b/i]) {
          if (pattern.test(cleanLineClean)) {
            startLineIdx = idx;
            break;
          }
        }
      }
      if (startLineIdx !== -1) break;
    }
  }

  if (startLineIdx === -1) {
    return text;
  }

  const extractedLines: string[] = [];
  for (let idx = startLineIdx; idx < lines.length; idx++) {
    const line = lines[idx];
    const cleanLine = line.trim().toLowerCase();
    const cleanLineClean = cleanLine.replace(/[:\-\*\#\d\•]/g, "").trim();

    if (idx > startLineIdx) {
      let isStop = false;
      if (cleanLineClean.length < 30) {
        for (const r of stopRegexes) {
          const fullStopRegex = new RegExp(`^\\s*(?:professional\\s+|academic\\s+|key\\s+)?${r.source}(?:\\s+history|\\s+profile|\\s+details)?\\s*$`, "i");
          if (fullStopRegex.test(cleanLineClean)) {
            isStop = true;
            break;
          }
        }
      }
      if (isStop) break;
    }
    extractedLines.push(line);
  }

  return extractedLines.join("\n").trim();
}

// Known multi-word skill names that must be preserved as single tokens in the
// fallback path. Used to re-join fragments produced by multi-column PDF layouts
// where pdf-parse emits one word per line (e.g. "Hugging" + "Face" → two lines).
const KNOWN_COMPOUND_SKILLS: ReadonlySet<string> = new Set([
  "hugging face", "scikit learn", "scikit-learn",
  "machine learning", "deep learning", "natural language processing",
  "computer vision", "large language models",
  "aws s3", "aws ec2", "aws lambda", "aws sagemaker",
  "google cloud", "google colab", "azure devops",
  "react native", "next.js", "node.js", "vue.js", "express.js",
  "power bi", "vs code", "visual studio", "github actions", "gitlab ci",
  "rest api", "graphql api",
]);

export function extractSkillsFromSectionText(sectionText: string): string[] {
  const rawTokens: string[] = [];
  const lines = sectionText.split("\n");

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    // Secondary HTML tag sanitization
    if (/<[^>]+>/.test(line)) {
      line = line.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      if (!line) continue;
    }

    if (line.includes(":") && !line.startsWith("http")) {
      const parts = line.split(":", 2);
      if (parts[0].trim().length < 30) {
        line = parts[1].trim();
      }
    }

    // Split on commas, semicolons, bullets, and tabs ONLY.
    // Do NOT split on bare hyphens — that breaks compound tokens like
    // "scikit-learn", "C++", "AWS S3", etc.
    // A hyphen only acts as a list separator when flanked by whitespace.
    const subparts = line.split(/[,;•\t]|(?<!\S)-(?!\S)/);
    for (let part of subparts) {
      let partClean = part.trim();
      if (partClean) {
        partClean = partClean.replace(/^[\s•\-\*]+|[\s•\-\*]+$/g, "").trim();
        if (partClean && partClean.length > 1 && !/^\/?(h[1-6]|ul|ol|li|p|br|div|span|strong|em|b|i|table|tr|td|th)$/i.test(partClean)) {
          rawTokens.push(partClean);
        }
      }
    }
  }

  // Re-join consecutive single-word tokens that form a known compound skill.
  // This fixes multi-column PDF layouts where pdf-parse emits one word per line,
  // causing "Hugging" and "Face" to appear as two separate tokens.
  const rejoined: string[] = [];
  let i = 0;
  while (i < rawTokens.length) {
    let matched = false;
    for (let len = 3; len >= 2; len--) {
      if (i + len - 1 < rawTokens.length) {
        const candidate = rawTokens.slice(i, i + len).join(" ");
        if (KNOWN_COMPOUND_SKILLS.has(candidate.toLowerCase())) {
          rejoined.push(candidate);
          i += len;
          matched = true;
          break;
        }
      }
    }
    if (!matched) { rejoined.push(rawTokens[i]); i++; }
  }

  const seen = new Set<string>();
  const uniqueTokens: string[] = [];

  for (const token of rejoined) {
    const normalized = token.toLowerCase().trim();
    if (!normalized || normalized.length <= 1 || /^[&;#<>\/]+$/.test(normalized)) continue;
    if (!seen.has(normalized)) {
      seen.add(normalized);
      uniqueTokens.push(token.trim());
    }
  }

  return uniqueTokens;
}

router.post("/resume/analyze", (req: Request, res: Response, next) => {
  (req as any)._startTime = Date.now();
  console.log(`[SERVER TIMING 1/7] Request received at +0ms`);
  upload.single("file")(req, res, (err) => {
    if (err) {
      res.status(400).json({ error: err.message || "File upload failed." });
      return;
    }
    const tUploadEnd = Date.now();
    console.log(`[SERVER TIMING 2/7] File upload parsed by multer in ${tUploadEnd - (req as any)._startTime}ms`);
    next();
  });
}, async (req: Request, res: Response) => {
  const reqStart = (req as any)._startTime || Date.now();
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: "No resume PDF file uploaded." });
    }

    const tBufferReadStart = Date.now();
    const bufferSize = req.file.buffer.length;
    console.log(`[SERVER TIMING 3/7] PDF buffer read (size: ${bufferSize} bytes) at +${tBufferReadStart - reqStart}ms`);

    const tPdfParseStart = Date.now();
    const fullText = await extractTextFromPdfBuffer(req.file.buffer);
    const tPdfParseEnd = Date.now();
    console.log(`[SERVER TIMING 4/7] PDF text extraction completed in ${tPdfParseEnd - tPdfParseStart}ms (text length: ${fullText?.length || 0})`);

    if (!fullText) {
      return res.status(400).json({ error: "Could not extract readable text from this PDF — it may be a scanned image or unsupported format. Please try a text-based PDF." });
    }

    // 1. Identify Skills Section
    const tSkillsSectionStart = Date.now();
    const skillsSectionText = extractSkillsSection(fullText);
    const rawTokens = extractSkillsFromSectionText(skillsSectionText.length > 0 ? skillsSectionText : fullText);
    const tSkillsSectionEnd = Date.now();
    console.log(`[SERVER TIMING 5/7] Skills section regex & token extraction completed in ${tSkillsSectionEnd - tSkillsSectionStart}ms (tokens found: ${rawTokens.length})`);

    if (rawTokens.length === 0) {
      return res.json({ skills: [] });
    }

    // 3. Normalize & Categorize with Groq (or Fallback if GROQ_API_KEY missing/error)
    const apiKey = process.env.GROQ_API_KEY;
    let normalizedSkills: SkillItem[] = [];
    const safeTokensForPrompt = rawTokens
      .filter((t) => t.trim().length > 1 && t.trim().length <= 35)
      .slice(0, 30);

    if (!apiKey) {
      console.log("[SERVER TIMING 6/7] GROQ_API_KEY is not set. Falling back to raw tokens.");
      normalizedSkills = rawTokens.map((token) => ({
        name: token,
        original_name: token,
        category: "Detected Skills",
        confidence: 1.0,
      }));
    } else {
      const groqController = new AbortController();
      const groqTimeoutId = setTimeout(() => {
        console.warn(`[SERVER TIMING GROQ TIMEOUT] Groq API call timed out after 15000ms. Aborting...`);
        groqController.abort();
      }, 15000);

      try {
        const tGroqStart = Date.now();
        console.log(`[SERVER TIMING 6/7] Groq API call sent at +${tGroqStart - reqStart}ms (tokens count: ${safeTokensForPrompt.length})`);
        const prompt = `You are an expert AI Resume Analyzer assistant. You are provided a list of raw skill strings extracted from a resume. Your task is to:
1. Normalize the skill names (e.g., standardizing capitalization like 'python' to 'Python', 'reactjs' to 'React').
2. Group/assign each skill into a clear category (e.g., 'Programming Languages', 'Web Technologies', 'Databases', 'Design Tools', 'Soft Skills', etc.).
3. Keep track of the original raw skill string in 'original_name'.

You MUST output raw JSON matching this structure exactly:
{
  "skills": [
    {
      "name": "Normalized Skill Name",
      "original_name": "Original Raw Skill Name",
      "category": "Category Name",
      "confidence": 1.0
    }
  ]
}

Do not fabricate confidence scores; set 'confidence' to 1.0 for all normalized items.
Do not include any preambles, explanations, or markdown formatting (outside of the JSON).
Return only the valid JSON structure.

Raw Skills list to normalize:
-------------------
${JSON.stringify(safeTokensForPrompt)}
-------------------`;

        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: process.env.GROQ_MODEL || "openai/gpt-oss-20b",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
            temperature: 0.1,
          }),
          signal: groqController.signal,
        });

        const tGroqEnd = Date.now();
        console.log(`[SERVER TIMING 6/7 - RES] Groq API response received in ${tGroqEnd - tGroqStart}ms, status: ${response.status}`);

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`AI normalization service returned HTTP ${response.status}: ${errText}`);
        }

        const data: any = await response.json();
        const responseText = data?.choices?.[0]?.message?.content;
        const parsed = JSON.parse(responseText);

        if (Array.isArray(parsed.skills)) {
          normalizedSkills = parsed.skills;
        } else {
          throw new Error("Invalid AI normalization JSON format");
        }
      } catch (groqErr: any) {
        console.warn(`[SERVER TIMING 6/7 - ERR] AI normalization error after ${Date.now() - reqStart}ms: ${groqErr.message}. Falling back to raw tokens.`);
        normalizedSkills = rawTokens.map((token) => ({
          name: token,
          original_name: token,
          category: "Detected Skills",
          confidence: 1.0,
        }));
      } finally {
        clearTimeout(groqTimeoutId);
      }
    }

    // 4. Grounding Check: Discard any skill not substring-matched in skills section / full text
    const tGroundingStart = Date.now();
    const textLower = (skillsSectionText || fullText).toLowerCase();
    const validatedSkills = normalizedSkills.filter((item) => {
      const origLower = item.original_name ? item.original_name.trim().toLowerCase() : "";
      const nameLower = item.name ? item.name.trim().toLowerCase() : "";
      const isValid = (origLower && textLower.includes(origLower)) || (nameLower && textLower.includes(nameLower));
      if (!isValid) {
        console.log(`[Resume Analyzer Grounding] Discarding non-grounded skill: ${item.name} (${item.original_name})`);
      }
      return isValid;
    });
    const tGroundingEnd = Date.now();
    const tTotal = Date.now() - reqStart;
    console.log(`[SERVER TIMING 7/7] Grounding done in ${tGroundingEnd - tGroundingStart}ms. Total response sent in ${tTotal}ms`);

    return res.json({ skills: validatedSkills });
  } catch (err: any) {
    console.error(`[SERVER TIMING ERR] Resume analysis error after ${Date.now() - reqStart}ms:`, err);
    return res.status(500).json({ error: err.message || "Failed to analyze resume." });
  }
});

export default router;
