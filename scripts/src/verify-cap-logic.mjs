// Simulate what the component now does for an 8-category resume
const skills = [
  { name: "Python",      category: "Programming Languages", confidence: 1.0 },
  { name: "JavaScript", category: "Programming Languages", confidence: 1.0 },
  { name: "React",      category: "Web Technologies",      confidence: 1.0 },
  { name: "Node.js",    category: "Web Technologies",      confidence: 1.0 },
  { name: "Git",        category: "Version Control",       confidence: 1.0 },
  { name: "PostgreSQL", category: "Databases",             confidence: 1.0 },
  { name: "Docker",     category: "Dev Tools",             confidence: 1.0 },
  { name: "TensorFlow", category: "AI/ML Libraries",       confidence: 1.0 },
  { name: "OOP",        category: "CS Fundamentals",       confidence: 1.0 },
  { name: "Recursion",  category: "Programming Paradigms", confidence: 1.0 },
];

const allCategoryReps = [];
const seenCategories = new Set();
for (const skillItem of skills) {
  const cat = (skillItem.category || "Other").trim();
  if (!seenCategories.has(cat)) {
    seenCategories.add(cat);
    allCategoryReps.push(skillItem);
  }
}
const categoryRepresentatives = allCategoryReps.slice(0, 3);

console.log("Full per-category list (" + allCategoryReps.length + " distinct categories found):");
allCategoryReps.forEach(s => console.log("  [" + s.category + "] -> " + s.name));

console.log("\nCapped list shown to user (" + categoryRepresentatives.length + " cards — max 3):");
categoryRepresentatives.forEach(s => console.log("  [" + s.category + "] -> " + s.name));

const totalRequired = categoryRepresentatives.length;
console.log("\ntotalRequired = " + totalRequired);
console.log("Button at 0/3: 'Complete " + (totalRequired - 0) + " more to unlock matches'");
console.log("Button at 1/3: 'Complete " + (totalRequired - 1) + " more to unlock matches'");
console.log("Button at 2/3: 'Complete " + (totalRequired - 2) + " more to unlock matches'");
console.log("Button at 3/3: allDone = true -> 'View My Matches ->'");
console.log("\nProgress bar at 0/3: " + Math.round((0/totalRequired)*100) + "%");
console.log("Progress bar at 2/3: " + Math.round((2/totalRequired)*100) + "%");
console.log("Progress bar at 3/3: " + Math.round((3/totalRequired)*100) + "%");

// Verify single-category resume still works
console.log("\n--- Single-category resume (1 card expected) ---");
const singleCatSkills = [
  { name: "Excel",     category: "Data Tools", confidence: 1.0 },
  { name: "Power BI",  category: "Data Tools", confidence: 1.0 },
  { name: "Tableau",   category: "Data Tools", confidence: 1.0 },
];
const singleReps = [];
const seenSingle = new Set();
for (const s of singleCatSkills) {
  const cat = (s.category || "Other").trim();
  if (!seenSingle.has(cat)) { seenSingle.add(cat); singleReps.push(s); }
}
const singleCapped = singleReps.slice(0, 3);
console.log("Cards shown: " + singleCapped.length + " (expected: 1)");
console.log("Button copy: 'Complete all " + singleCapped.length + " assessment" + (singleCapped.length !== 1 ? "s" : "") + " to unlock...'");
