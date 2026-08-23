import { pgTable, text, uuid, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

export const studentsTable = pgTable("students", {
  id: uuid("id").primaryKey().defaultRandom(),
  authUser: uuid("auth_user_id"),
  name: text("name").notNull(),
  degree: text("degree").notNull(),
  year: text("year").notNull(),
  careerGoal: text("career_goal").notNull(),
  location: text("location").notNull(),
  workMode: text("work_mode").notNull(),
  stipendPreference: text("stipend_preference").notNull(),
  interests: text("interests").array(),
  skills: jsonb("skills"),
});

export const insertStudentSchema = createInsertSchema(studentsTable);
export const selectStudentSchema = createSelectSchema(studentsTable);
export type InsertStudent = typeof studentsTable.$inferInsert;
export type Student = typeof studentsTable.$inferSelect;
