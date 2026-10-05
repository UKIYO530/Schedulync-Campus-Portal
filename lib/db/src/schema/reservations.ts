import { createInsertSchema } from "drizzle-zod";
import { sql } from "drizzle-orm";
import {
  check,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { resourcesTable } from "./resources";
import { studentsTable } from "./students";

export const reservationsTable = pgTable(
  "reservations",
  {
    id: serial("id").primaryKey(),
    resourceId: integer("resource_id")
      .notNull()
      .references(() => resourcesTable.id),
    studentId: text("student_id")
      .notNull()
      .references(() => studentsTable.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
    status: text("status").notNull().default("confirmed"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check("reservations_time_order", sql`${table.startAt} < ${table.endAt}`),
  ],
);

export const insertReservationSchema = createInsertSchema(
  reservationsTable,
).omit({
  id: true,
  createdAt: true,
});
export type InsertReservation = z.infer<typeof insertReservationSchema>;
export type Reservation = typeof reservationsTable.$inferSelect;
