import { createInsertSchema } from "drizzle-zod";
import {
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { resourcesTable } from "./resources";
import { studentsTable } from "./students";

export const incidentsTable = pgTable("incidents", {
  id: serial("id").primaryKey(),
  resourceId: integer("resource_id")
    .notNull()
    .references(() => resourcesTable.id),
  studentId: text("student_id")
    .notNull()
    .references(() => studentsTable.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  severity: text("severity").notNull(),
  status: text("status").notNull().default("submitted"),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertIncidentSchema = createInsertSchema(incidentsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertIncident = z.infer<typeof insertIncidentSchema>;
export type Incident = typeof incidentsTable.$inferSelect;
