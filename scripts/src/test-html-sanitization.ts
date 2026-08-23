/**
 * Unit test for HTML tag sanitization in resume.ts
 * Tests that literal HTML tags embedded in PDF-extracted text are stripped cleanly.
 */

import { extractSkillsFromSectionText, extractSkillsSection } from "../../artifacts/api-server/src/routes/resume";

// --------------------------------------------------------------------------
// Helper: inline stripHtmlTags for testing (mirrors the function in resume.ts)
// --------------------------------------------------------------------------
function stripHtmlTags(text: string): string {
  let sanitized = text.replace(/<[^>]+>([^<]*)<\/[^>]+>/g, (_, inner) => inner.trim() ? " " + inner.trim() + " " : " ");
  sanitized = sanitized.replace(/<[^>]+>/g, " ");
  sanitized = sanitized.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  return sanitized;
}

// --------------------------------------------------------------------------
// Test 1 — Raw HTML text from a PDF exported via Canva / web tool
// --------------------------------------------------------------------------
const htmlPollutedRaw = `<h2>Technical Skills</h2>
<ul>
<li>powerBI</li>
<li>Data base MYSQL</li>
<li>Python</li>
<li>Microsoft Excel</li>
<li>Tableau</li>
</ul>
<h3>Other Tools</h3>
<li>React.js</li>
<li>Node.js</li>
<li>TypeScript</li>`;

console.log("=== TEST 1: stripHtmlTags() on HTML-polluted PDF text ===");
console.log("INPUT:");
console.log(htmlPollutedRaw);
console.log("\nOUTPUT after stripHtmlTags():");
const stripped = stripHtmlTags(htmlPollutedRaw);
console.log(stripped);

// --------------------------------------------------------------------------
// Test 2 — extractSkillsFromSectionText on already-stripped text
// --------------------------------------------------------------------------
console.log("\n=== TEST 2: extractSkillsFromSectionText on stripped text ===");
const tokens = extractSkillsFromSectionText(stripped);
console.log("Extracted tokens:", tokens);

// Verify no HTML tag fragments remain
const htmlRemnants = tokens.filter(t => /<|>|<\//.test(t));
if (htmlRemnants.length > 0) {
  console.error("❌ FAIL: HTML tag remnants found in tokens:", htmlRemnants);
} else {
  console.log("✅ PASS: No HTML tag remnants in extracted tokens");
}

// Verify real skills are present
const expected = ["powerBI", "MYSQL", "Python", "Microsoft Excel", "Tableau", "React.js", "Node.js", "TypeScript"];
const tokenNames = tokens.map(t => t.toLowerCase());
const allPresent = expected.every(e => tokenNames.some(t => t.includes(e.toLowerCase())));
if (allPresent) {
  console.log("✅ PASS: All expected skills extracted correctly");
} else {
  const missing = expected.filter(e => !tokenNames.some(t => t.includes(e.toLowerCase())));
  console.warn("⚠️  PARTIAL: Some expected skills missing:", missing);
}

// --------------------------------------------------------------------------
// Test 3 — extractSkillsFromSectionText with residual tags (secondary sanitizer)
// --------------------------------------------------------------------------
console.log("\n=== TEST 3: extractSkillsFromSectionText with residual tags (secondary sanitizer) ===");
const residualTagText = `Skills
powerBI</li>
<li>Data base MYSQL</li>
TypeScript
<li>Node.js`;
const tokens2 = extractSkillsFromSectionText(residualTagText);
console.log("Extracted tokens:", tokens2);

const htmlRemnants2 = tokens2.filter(t => /<|>/.test(t));
if (htmlRemnants2.length > 0) {
  console.error("❌ FAIL: HTML tag remnants in secondary sanitizer test:", htmlRemnants2);
} else {
  console.log("✅ PASS: Secondary sanitizer removes residual tags correctly");
}

// --------------------------------------------------------------------------
// Test 4 — section boundary detection should NOT break on HTML section headers
// --------------------------------------------------------------------------
console.log("\n=== TEST 4: extractSkillsSection handles HTML-polluted section boundaries ===");
const fullDocWithHtmlHeaders = `John Doe
<h1>Software Developer</h1>
john@example.com

<h2>Summary</h2>
Experienced developer with 5 years of experience.

<h2>Technical Skills</h2>
<ul>
<li>Python</li>
<li>React</li>
<li>PostgreSQL</li>
</ul>

<h2>Experience</h2>
Software Engineer at XYZ Corp...`;

// Strip HTML first (as resume.ts now does)
const fullDocStripped = stripHtmlTags(fullDocWithHtmlHeaders);
console.log("Stripped document:");
console.log(fullDocStripped);
const section = extractSkillsSection(fullDocStripped);
console.log("\nExtracted skills section:");
console.log(section);
const finalTokens = extractSkillsFromSectionText(section);
console.log("\nFinal tokens:", finalTokens);
const htmlRemnants3 = finalTokens.filter(t => /<|>/.test(t));
console.log(htmlRemnants3.length === 0 ? "✅ PASS: No HTML tags in final tokens" : "❌ FAIL: Tags remain: " + htmlRemnants3.join(", "));

console.log("\n=== ALL HTML SANITIZATION TESTS COMPLETE ===");
