import { computeVectorCosineSimilarity } from "@workspace/db/hybrid-scorer";

function generateLocalDenseEmbedding(text: string, dimensions: number = 384): number[] {
  const vec = new Array(dimensions).fill(0);
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);

  if (words.length === 0) return vec;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    for (let j = 0; j < word.length; j++) {
      const charCode = word.charCodeAt(j);
      const hash1 = Math.abs((word.length * 31 + charCode * 17 + i * 13 + j * 7) % dimensions);
      const hash2 = Math.abs((charCode * 37 + j * 19 + i * 29) % dimensions);
      const sign = (charCode + j) % 2 === 0 ? 1 : -1;
      
      vec[hash1] += sign * (1 / (j + 1));
      vec[hash2] += (1 / (i + 1));
    }
  }

  let norm = 0;
  for (let i = 0; i < dimensions; i++) {
    norm += vec[i] * vec[i];
  }
  if (norm > 0) {
    const sqrtNorm = Math.sqrt(norm);
    for (let i = 0; i < dimensions; i++) {
      vec[i] /= sqrtNorm;
    }
  }
  return vec;
}

const studentAText = "Product Designer skilled in Figma User Research Prototyping Design Systems AI Interfaces";
const studentBText = "Data Analyst skilled in SQL Python Tableau Pandas ETL Pipelines Data Warehousing";
const internshipText = "Product Design Intern at Northstar Labs. Required: Figma, User Research. Preferred: Prototyping, Design Systems.";

const vecA = generateLocalDenseEmbedding(studentAText);
const vecB = generateLocalDenseEmbedding(studentBText);
const vecIntern = generateLocalDenseEmbedding(internshipText);

console.log("Vector A Dimensions:", vecA.length);
console.log("Vector A Sample (first 5 dims):", vecA.slice(0, 5).map(n => n.toFixed(5)));

console.log("Vector B Dimensions:", vecB.length);
console.log("Vector B Sample (first 5 dims):", vecB.slice(0, 5).map(n => n.toFixed(5)));

console.log("Internship Vector Dimensions:", vecIntern.length);
console.log("Internship Vector Sample (first 5 dims):", vecIntern.slice(0, 5).map(n => n.toFixed(5)));

const simA = computeVectorCosineSimilarity(vecA, vecIntern);
const simB = computeVectorCosineSimilarity(vecB, vecIntern);

console.log(`\nStudent A Vector Cosine Similarity vs Internship: ${(simA * 100).toFixed(1)}%`);
console.log(`Student B Vector Cosine Similarity vs Internship: ${(simB * 100).toFixed(1)}%`);
