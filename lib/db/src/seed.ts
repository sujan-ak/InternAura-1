import { db, ensureTables } from "./index";
import { studentsTable, internshipsTable, recommendationsTable } from "./schema";
import { eq } from "drizzle-orm";

export const SAMPLE_STUDENT = {
  id: "00000000-0000-0000-0000-000000000001",
  name: "Aarav Mehta",
  degree: "B.Des · Interaction Design",
  year: "3rd year",
  careerGoal: "Product Designer",
  location: "Bengaluru",
  workMode: "Hybrid",
  stipendPreference: "₹30k+/month",
  interests: ["Design Systems", "User Research", "AI Interfaces", "Product Strategy"],
  skills: ["Figma", "User Research", "Visual Design", "Prototyping", "Design Systems", "React"],
};

export const SAMPLE_INTERNSHIPS = [
  {
    id: "10000000-0000-0000-0000-000000000001",
    title: "Product Design Intern",
    company: "Northstar Labs",
    description: "Shape the next generation of tools for creative teams. Work with product, engineering, and research from first sketch to final release.",
    domain: "Design & Product",
    location: "Bengaluru",
    workMode: "Hybrid",
    duration: "6 months",
    stipend: "₹35k / month",
    education: "Undergraduate in Design, HCI, or related field",
    requiredSkills: ["Figma", "User Research"],
    preferredSkills: ["Prototyping", "Design Systems"],
    experienceLevel: "Beginner / Student",
  },
  {
    id: "10000000-0000-0000-0000-000000000002",
    title: "Frontend Engineering Intern",
    company: "Orbit Commerce",
    description: "Build fast, accessible experiences used by thousands of shoppers every day alongside a small, supportive engineering team.",
    domain: "Full Stack Engineering",
    location: "Remote · India",
    workMode: "Remote",
    duration: "4 months",
    stipend: "₹40k / month",
    education: "B.Tech / B.E. in CS, IT, or equivalent",
    requiredSkills: ["JavaScript", "React"],
    preferredSkills: ["TypeScript", "Testing"],
    experienceLevel: "Intermediate",
  },
  {
    id: "10000000-0000-0000-0000-000000000003",
    title: "Growth & Community Intern",
    company: "Mango Social",
    description: "Help a growing community find its people. This role blends creative experiments, events, and thoughtful storytelling.",
    domain: "Marketing & Growth",
    location: "Mumbai",
    workMode: "On-site",
    duration: "3 months",
    stipend: "₹25k / month",
    education: "Bachelor's in Communications, Marketing, or Humanities",
    requiredSkills: ["Content Writing", "Social Media"],
    preferredSkills: ["Analytics", "SEO"],
    experienceLevel: "Beginner",
  },
  {
    id: "10000000-0000-0000-0000-000000000004",
    title: "Data Analyst Intern",
    company: "Verde Mobility",
    description: "Turn real-world mobility data into decisions that make cities move better.",
    domain: "Data Science & Analytics",
    location: "Delhi NCR",
    workMode: "Hybrid",
    duration: "6 months",
    stipend: "₹32k / month",
    education: "B.Sc / B.Tech in Data Science, Statistics, CS",
    requiredSkills: ["Excel", "SQL"],
    preferredSkills: ["Python", "PowerBI"],
    experienceLevel: "Beginner",
  },
  {
    id: "10000000-0000-0000-0000-000000000005",
    title: "AI Research & Development Intern",
    company: "NeuralCraft Studio",
    description: "Explore multimodal LLM applications, fine-tuning techniques, and agentic workflows for generative creativity.",
    domain: "AI & Machine Learning",
    location: "Bengaluru",
    workMode: "Hybrid",
    duration: "6 months",
    stipend: "₹45k / month",
    education: "B.Tech / M.Tech in AI, Data Science, or Computer Science",
    requiredSkills: ["Python", "PyTorch"],
    preferredSkills: ["Transformers", "LangChain"],
    experienceLevel: "Intermediate",
  },
  {
    id: "10000000-0000-0000-0000-000000000006",
    title: "Full Stack Developer Intern",
    company: "Apex Cloud Tech",
    description: "Develop responsive Web applications and REST APIs using Next.js, Node.js, and modern cloud databases.",
    domain: "Full Stack Engineering",
    location: "Hyderabad",
    workMode: "Remote",
    duration: "6 months",
    stipend: "₹38k / month",
    education: "Pursuing CS degree",
    requiredSkills: ["React", "Node.js"],
    preferredSkills: ["TypeScript", "PostgreSQL"],
    experienceLevel: "Intermediate",
  },
  {
    id: "10000000-0000-0000-0000-000000000007",
    title: "UI/UX Designer Intern",
    company: "PixelCraft Systems",
    description: "Craft pixel-perfect visual designs, wireframes, and design components for fintech platforms.",
    domain: "Design & Product",
    location: "Pune",
    workMode: "Hybrid",
    duration: "3 months",
    stipend: "₹30k / month",
    education: "Design / Visual Arts background",
    requiredSkills: ["Figma", "Wireframing"],
    preferredSkills: ["Prototyping", "Design Systems"],
    experienceLevel: "Beginner",
  },
  {
    id: "10000000-0000-0000-0000-000000000008",
    title: "Machine Learning Engineer Intern",
    company: "Cognitive Vision Labs",
    description: "Implement computer vision pipeline models for automated visual inspection in manufacturing.",
    domain: "AI & Machine Learning",
    location: "Bengaluru",
    workMode: "On-site",
    duration: "6 months",
    stipend: "₹42k / month",
    education: "B.Tech / M.Tech",
    requiredSkills: ["Python", "OpenCV"],
    preferredSkills: ["TensorFlow", "Docker"],
    experienceLevel: "Intermediate",
  },
  {
    id: "10000000-0000-0000-0000-000000000009",
    title: "Product Management Intern",
    company: "Zest Health Tech",
    description: "Work closely with tech leads and designers to synthesize user feedback and define feature roadmaps.",
    domain: "Design & Product",
    location: "Bengaluru",
    workMode: "Hybrid",
    duration: "4 months",
    stipend: "₹35k / month",
    education: "Engineering or Management Student",
    requiredSkills: ["User Research", "Product Analytics"],
    preferredSkills: ["Figma", "Agile"],
    experienceLevel: "Beginner",
  },
  {
    id: "10000000-0000-0000-0000-000000000010",
    title: "Digital Marketing & SEO Intern",
    company: "Pulse Media",
    description: "Execute organic growth campaigns, keyword audits, and performance ad monitoring.",
    domain: "Marketing & Growth",
    location: "Delhi NCR",
    workMode: "Remote",
    duration: "3 months",
    stipend: "₹22k / month",
    education: "Bachelor's degree in progress",
    requiredSkills: ["SEO", "Content Strategy"],
    preferredSkills: ["Google Analytics", "Copywriting"],
    experienceLevel: "Beginner",
  },
  {
    id: "10000000-0000-0000-0000-000000000011",
    title: "Data Engineer Intern",
    company: "DataStream Infrastructure",
    description: "Build robust ETL data pipelines, manage data warehousing in Snowflake, and optimize query latency.",
    domain: "Data Science & Analytics",
    location: "Hyderabad",
    workMode: "Hybrid",
    duration: "6 months",
    stipend: "₹36k / month",
    education: "Computer Science or Data Engineering student",
    requiredSkills: ["SQL", "Python"],
    preferredSkills: ["Spark", "Airflow"],
    experienceLevel: "Intermediate",
  },
  {
    id: "10000000-0000-0000-0000-000000000012",
    title: "LLM Systems & Prompt Engineer Intern",
    company: "SynthAI Labs",
    description: "Design evaluation frameworks, RAG retrieval algorithms, and agent workflows for enterprise search.",
    domain: "AI & Machine Learning",
    location: "Remote · India",
    workMode: "Remote",
    duration: "6 months",
    stipend: "₹48k / month",
    education: "CS / Data Science degree",
    requiredSkills: ["Python", "RAG Systems"],
    preferredSkills: ["Vector Databases", "LangChain"],
    experienceLevel: "Intermediate",
  },
  {
    id: "10000000-0000-0000-0000-000000000013",
    title: "Backend Engineering Intern",
    company: "KubeScale Inc.",
    description: "Design distributed Microservices in Go/Node.js with high throughput and event-driven architecture.",
    domain: "Full Stack Engineering",
    location: "Bengaluru",
    workMode: "Hybrid",
    duration: "6 months",
    stipend: "₹40k / month",
    education: "CS student",
    requiredSkills: ["Node.js", "REST APIs"],
    preferredSkills: ["Go", "Docker", "PostgreSQL"],
    experienceLevel: "Intermediate",
  },
  {
    id: "10000000-0000-0000-0000-000000000014",
    title: "Brand & Visual Design Intern",
    company: "Studio Canvas",
    description: "Create brand identity kits, social media visuals, and typography guidelines for emerging startups.",
    domain: "Design & Product",
    location: "Mumbai",
    workMode: "Hybrid",
    duration: "3 months",
    stipend: "₹28k / month",
    education: "Graphic Design student",
    requiredSkills: ["Figma", "Illustrator"],
    preferredSkills: ["Motion Graphics", "Typography"],
    experienceLevel: "Beginner",
  },
  {
    id: "10000000-0000-0000-0000-000000000015",
    title: "Quantitative Analytics Intern",
    company: "QuantEdge Capital",
    description: "Apply statistical modeling, time-series forecasting, and algorithmic simulation to market datasets.",
    domain: "Data Science & Analytics",
    location: "Mumbai",
    workMode: "On-site",
    duration: "4 months",
    stipend: "₹45k / month",
    education: "B.Tech / B.Sc Math, Financial Engineering",
    requiredSkills: ["Python", "Statistics"],
    preferredSkills: ["Pandas", "R"],
    experienceLevel: "Intermediate",
  },
  {
    id: "10000000-0000-0000-0000-000000000016",
    title: "Performance Marketing Intern",
    company: "HyperGrowth Media",
    description: "Analyze paid acquisition channels (Meta, Google, LinkedIn) and optimize customer acquisition costs.",
    domain: "Marketing & Growth",
    location: "Gurugram",
    workMode: "Hybrid",
    duration: "3 months",
    stipend: "₹26k / month",
    education: "Business or Marketing student",
    requiredSkills: ["Digital Ads", "Excel"],
    preferredSkills: ["Google Ads", "A/B Testing"],
    experienceLevel: "Beginner",
  },
  {
    id: "10000000-0000-0000-0000-000000000017",
    title: "NLP Engineer Intern",
    company: "LinguaText AI",
    description: "Train semantic search models, sentiment analysis engines, and entity extraction models for Indic languages.",
    domain: "AI & Machine Learning",
    location: "Bengaluru",
    workMode: "Remote",
    duration: "6 months",
    stipend: "₹42k / month",
    education: "CS / Computational Linguistics",
    requiredSkills: ["Python", "NLP"],
    preferredSkills: ["Hugging Face", "PyTorch"],
    experienceLevel: "Intermediate",
  },
  {
    id: "10000000-0000-0000-0000-000000000018",
    title: "Mobile App Developer (React Native) Intern",
    company: "SwiftTouch Apps",
    description: "Build sleek cross-platform iOS and Android mobile features using React Native and Expo.",
    domain: "Full Stack Engineering",
    location: "Bengaluru",
    workMode: "Hybrid",
    duration: "5 months",
    stipend: "₹35k / month",
    education: "Engineering Student",
    requiredSkills: ["React Native", "JavaScript"],
    preferredSkills: ["TypeScript", "Expo"],
    experienceLevel: "Intermediate",
  },
  {
    id: "10000000-0000-0000-0000-000000000019",
    title: "Design Systems Specialist Intern",
    company: "Omni Design Works",
    description: "Architect reusable UI component libraries, documentation, and design token workflows for enterprise web tools.",
    domain: "Design & Product",
    location: "Remote · India",
    workMode: "Remote",
    duration: "4 months",
    stipend: "₹36k / month",
    education: "Design / CS background",
    requiredSkills: ["Figma", "Design Systems"],
    preferredSkills: ["Storybook", "React"],
    experienceLevel: "Intermediate",
  },
  {
    id: "10000000-0000-0000-0000-000000000020",
    title: "Content Marketing & Social Lead Intern",
    company: "Vibe Tribe",
    description: "Draft newsletter issues, technical blogs, and interactive campaigns for developer tools.",
    domain: "Marketing & Growth",
    location: "Bengaluru",
    workMode: "Hybrid",
    duration: "3 months",
    stipend: "₹24k / month",
    education: "Communications or Arts student",
    requiredSkills: ["Copywriting", "Social Media"],
    preferredSkills: ["Canva", "SEO"],
    experienceLevel: "Beginner",
  },
];

export const SAMPLE_RECOMMENDATIONS = [
  {
    studentId: SAMPLE_STUDENT.id,
    internshipId: "10000000-0000-0000-0000-000000000001", // Product Design Intern
    score: "94",
    reasons: [
      "Your Figma and user research experience align directly with the team",
      "Your interest in human-centered design systems is a strong fit",
      "Hybrid schedule in Bengaluru matches your location preference",
    ],
    skillGap: [
      ["Figma", "Strong"],
      ["User Research", "Strong"],
      ["Prototyping", "Partial"],
      ["Design Systems", "Missing"],
    ],
  },
  {
    studentId: SAMPLE_STUDENT.id,
    internshipId: "10000000-0000-0000-0000-000000000007", // UI/UX Designer Intern
    score: "91",
    reasons: [
      "High match for Figma and Wireframing fundamentals",
      "Matches preferred hybrid work model",
    ],
    skillGap: [
      ["Figma", "Strong"],
      ["Wireframing", "Strong"],
      ["Prototyping", "Partial"],
      ["Design Systems", "Missing"],
    ],
  },
  {
    studentId: SAMPLE_STUDENT.id,
    internshipId: "10000000-0000-0000-0000-000000000019", // Design Systems Specialist Intern
    score: "89",
    reasons: [
      "Direct match with your Design Systems expertise",
      "Fully remote work mode offers high flexibility",
    ],
    skillGap: [
      ["Figma", "Strong"],
      ["Design Systems", "Strong"],
      ["React", "Partial"],
    ],
  },
  {
    studentId: SAMPLE_STUDENT.id,
    internshipId: "10000000-0000-0000-0000-000000000002", // Frontend Engineering Intern
    score: "88",
    reasons: [
      "Your React projects show practical UI momentum",
      "Remote setup matches your preference",
    ],
    skillGap: [
      ["JavaScript", "Strong"],
      ["React", "Strong"],
      ["TypeScript", "Partial"],
      ["Testing", "Missing"],
    ],
  },
  {
    studentId: SAMPLE_STUDENT.id,
    internshipId: "10000000-0000-0000-0000-000000000009", // Product Management Intern
    score: "83",
    reasons: [
      "Strong overlap in User Research and Product Strategy",
      "Matches hybrid Bengaluru setup",
    ],
    skillGap: [
      ["User Research", "Strong"],
      ["Product Analytics", "Partial"],
      ["Figma", "Strong"],
    ],
  },
  {
    studentId: SAMPLE_STUDENT.id,
    internshipId: "10000000-0000-0000-0000-000000000003", // Growth & Community Intern
    score: "81",
    reasons: [
      "Communication & design presentation skills map well",
      "Creative storytelling alignment",
    ],
    skillGap: [
      ["Content Writing", "Partial"],
      ["Social Media", "Strong"],
      ["Analytics", "Missing"],
    ],
  },
  {
    studentId: SAMPLE_STUDENT.id,
    internshipId: "10000000-0000-0000-0000-000000000004", // Data Analyst Intern
    score: "76",
    reasons: [
      "Analytical design mindset offers a good foundation",
      "Mobility and urban tech interest alignment",
    ],
    skillGap: [
      ["Excel", "Partial"],
      ["SQL", "Missing"],
      ["Python", "Missing"],
    ],
  },
];

export async function seedDatabase() {
  await ensureTables();
  console.log("Seeding database via Drizzle ORM...");
  try {
    const existingStudent = await db
      .select()
      .from(studentsTable)
      .where(eq(studentsTable.id, SAMPLE_STUDENT.id));

    if (existingStudent.length === 0) {
      await db.insert(studentsTable).values(SAMPLE_STUDENT);
      console.log("Seeded sample student: Aarav Mehta");
    }

    for (const internship of SAMPLE_INTERNSHIPS) {
      const existing = await db
        .select()
        .from(internshipsTable)
        .where(eq(internshipsTable.id, internship.id));
      if (existing.length === 0) {
        await db.insert(internshipsTable).values(internship);
      }
    }
    console.log(`Seeded ${SAMPLE_INTERNSHIPS.length} sample internships.`);

    for (const rec of SAMPLE_RECOMMENDATIONS) {
      const existing = await db
        .select()
        .from(recommendationsTable)
        .where(eq(recommendationsTable.studentId, rec.studentId));
      
      const foundRec = existing.find((r: any) => r.internshipId === rec.internshipId);
      if (!foundRec) {
        await db.insert(recommendationsTable).values(rec);
      }
    }
    console.log(`Seeded ${SAMPLE_RECOMMENDATIONS.length} sample recommendations.`);

    console.log("Database seeding completed successfully!");
  } catch (error) {
    console.error("Database seeding failed:", error);
  }
}
