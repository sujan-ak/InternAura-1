import { pgTable, text, uuid, json } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

export const internshipsTable = pgTable("internships", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  company: text("company").notNull(),
  description: text("description").notNull(),
  domain: text("domain").notNull(),
  location: text("location").notNull(),
  workMode: text("work_mode").notNull(),
  duration: text("duration").notNull(),
  stipend: text("stipend").notNull(),
  education: text("education"),
  requiredSkills: text("required_skills").array().notNull(),
  preferredSkills: text("preferred_skills").array().notNull(),
  experienceLevel: text("experience_level").notNull(),
  embeddingVector: json("embedding_vector").$type<number[]>(),
});

export const insertInternshipSchema = createInsertSchema(internshipsTable);
export const selectInternshipSchema = createSelectSchema(internshipsTable);
export type InsertInternship = typeof internshipsTable.$inferInsert;
export type Internship = typeof internshipsTable.$inferSelect;
