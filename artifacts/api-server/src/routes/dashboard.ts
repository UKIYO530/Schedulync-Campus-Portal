import { Router, type IRouter } from "express";
import { and, asc, desc, eq, gte } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import {
  db,
  incidentsTable,
  reservationsTable,
  resourcesTable,
  studentsTable,
  tasksTable,
} from "@workspace/db";
import { GetDashboardSummaryResponse } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();
router.use("/dashboard", requireAuth);

router.get("/dashboard/summary", async (req, res): Promise<void> => {
  const studentId = getAuth(req).userId!;
  const now = new Date();
  const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const tasks = await db
    .select()
    .from(tasksTable)
    .where(eq(tasksTable.ownerId, studentId));
  const resources = await db
    .select({ status: resourcesTable.status })
    .from(resourcesTable);
  const [upcomingRow] = await db
    .select({ reservation: reservationsTable, resource: resourcesTable })
    .from(reservationsTable)
    .innerJoin(
      resourcesTable,
      eq(reservationsTable.resourceId, resourcesTable.id),
    )
    .where(
      and(
        eq(reservationsTable.studentId, studentId),
        eq(reservationsTable.status, "confirmed"),
        gte(reservationsTable.startAt, now),
      ),
    )
    .orderBy(asc(reservationsTable.startAt))
    .limit(1);
  const recentIncidentRows = await db
    .select({
      incident: incidentsTable,
      resource: resourcesTable,
      student: studentsTable,
    })
    .from(incidentsTable)
    .innerJoin(resourcesTable, eq(incidentsTable.resourceId, resourcesTable.id))
    .innerJoin(studentsTable, eq(incidentsTable.studentId, studentsTable.id))
    .where(eq(incidentsTable.studentId, studentId))
    .orderBy(desc(incidentsTable.createdAt))
    .limit(3);

  const upcomingReservation = upcomingRow
    ? {
        ...upcomingRow.reservation,
        resourceCode: upcomingRow.resource.code,
        resourceName: upcomingRow.resource.name,
        startAt: upcomingRow.reservation.startAt.toISOString(),
        endAt: upcomingRow.reservation.endAt.toISOString(),
        createdAt: upcomingRow.reservation.createdAt.toISOString(),
      }
    : null;
  const recentIncidents = recentIncidentRows.map(
    ({ incident, resource, student }) => ({
      ...incident,
      resourceCode: resource.code,
      resourceName: resource.name,
      studentName: student.fullName,
      occurredAt: incident.occurredAt.toISOString(),
      createdAt: incident.createdAt.toISOString(),
    }),
  );

  const summary = {
    tasksTotal: tasks.length,
    tasksComplete: tasks.filter((task) => task.status === "completed").length,
    tasksDueSoon: tasks.filter(
      (task) =>
        task.status !== "completed" &&
        task.dueAt !== null &&
        task.dueAt >= now &&
        task.dueAt <= weekFromNow,
    ).length,
    resourcesAvailable: resources.filter(
      (resource) => resource.status === "available",
    ).length,
    upcomingReservation,
    recentIncidents,
  };

  res.json(GetDashboardSummaryResponse.parse(summary));
});

export default router;
