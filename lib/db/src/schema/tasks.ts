import { createInsertSchema } from "drizzle-zod";
import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { studentsTable } from "./students";

export const tasksTable = pgTable("tasks", {
  id: serial("id").primaryKey(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => studentsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  dueAt: timestamp("due_at", { withTimezone: true }),
  priority: text("priority").notNull().default("normal"),
  status: text("status").notNull().default("todo"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertTaskSchema = createInsertSchema(tasksTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasksTable.$inferSelect;
