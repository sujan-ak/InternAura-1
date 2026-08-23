import { pgTable, text, uuid, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { studentsTable } from "./students";
import { internshipsTable } from "./internships";

export const actionEnum = pgEnum("action", ["view", "save", "skip", "apply", "like"]);

export const interactionsTable = pgTable("interactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id").notNull().references(() => studentsTable.id, { onDelete: "cascade" }),
  internshipId: uuid("internship_id").notNull().references(() => internshipsTable.id, { onDelete: "cascade" }),
  action: actionEnum("action").notNull(),
  reason: text("reason"),
  // FIX (gap #19): the Drizzle schema declared a naive timestamp while both the
  // ensureTables() DDL and the Supabase migration created TIMESTAMPTZ. That
  // mismatch silently dropped timezone info on read.
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertInteractionSchema = createInsertSchema(interactionsTable);
export const selectInteractionSchema = createSelectSchema(interactionsTable);
export type InsertInteraction = typeof interactionsTable.$inferInsert;
export type Interaction = typeof interactionsTable.$inferSelect;
