import { pgTable, uuid, numeric, jsonb, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { studentsTable } from "./students";
import { internshipsTable } from "./internships";

export const recommendationsTable = pgTable(
  "recommendations",
  {
    studentId: uuid("student_id").notNull().references(() => studentsTable.id, { onDelete: "cascade" }),
    internshipId: uuid("internship_id").notNull().references(() => internshipsTable.id, { onDelete: "cascade" }),
    score: numeric("score").notNull(),
    reasons: jsonb("reasons"),
    skillGap: jsonb("skill_gap"),
  },
  (table) => [
    primaryKey({ columns: [table.studentId, table.internshipId] }),
  ]
);

export const insertRecommendationSchema = createInsertSchema(recommendationsTable);
export const selectRecommendationSchema = createSelectSchema(recommendationsTable);
export type InsertRecommendation = typeof recommendationsTable.$inferInsert;
export type Recommendation = typeof recommendationsTable.$inferSelect;
