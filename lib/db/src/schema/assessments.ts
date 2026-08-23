import { pgTable, text, uuid, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { studentsTable } from "./students";

export const assessmentsTable = pgTable("assessments", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id").references(() => studentsTable.id, { onDelete: "cascade" }),
  authUser: uuid("auth_user_id"),
  skill: text("skill"),
  title: text("title"),
  skillName: text("skill_name"),
  weightedScore: numeric("weighted_score").notNull(),
  proficiencyTier: text("proficiency_tier").notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertAssessmentSchema = createInsertSchema(assessmentsTable);
export const selectAssessmentSchema = createSelectSchema(assessmentsTable);
export type InsertAssessment = typeof assessmentsTable.$inferInsert;
export type Assessment = typeof assessmentsTable.$inferSelect;
