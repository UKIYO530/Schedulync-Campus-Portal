import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import {
  db,
  incidentsTable,
  resourcesTable,
  studentsTable,
} from "@workspace/db";
import {
  CreateIncidentBody,
  CreateIncidentResponse,
  ListIncidentsResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();
router.use("/incidents", requireAuth);

function serializeIncident(
  incident: typeof incidentsTable.$inferSelect,
  resource: typeof resourcesTable.$inferSelect,
  student: typeof studentsTable.$inferSelect,
) {
  return {
    ...incident,
    resourceCode: resource.code,
    resourceName: resource.name,
    studentName: student.fullName,
    occurredAt: incident.occurredAt.toISOString(),
    createdAt: incident.createdAt.toISOString(),
  };
}

router.get("/incidents", async (req, res): Promise<void> => {
  const studentId = getAuth(req).userId!;
  const rows = await db
    .select({
      incident: incidentsTable,
      resource: resourcesTable,
      student: studentsTable,
    })
    .from(incidentsTable)
    .innerJoin(resourcesTable, eq(incidentsTable.resourceId, resourcesTable.id))
    .innerJoin(studentsTable, eq(incidentsTable.studentId, studentsTable.id))
    .where(eq(incidentsTable.studentId, studentId))
    .orderBy(desc(incidentsTable.createdAt));

  const incidents = rows.map(({ incident, resource, student }) =>
    serializeIncident(incident, resource, student),
  );
  res.json(ListIncidentsResponse.parse(incidents));
});

router.post("/incidents", async (req, res): Promise<void> => {
  const parsed = CreateIncidentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [resource] = await db
    .select()
    .from(resourcesTable)
    .where(eq(resourcesTable.id, parsed.data.resourceId));
  if (!resource) {
    res.status(404).json({ error: "Instrument not found" });
    return;
  }
  if (resource.type !== "instrument") {
    res.status(400).json({ error: "Select a laboratory instrument" });
    return;
  }

  const studentId = getAuth(req).userId!;
  const [student] = await db
    .select()
    .from(studentsTable)
    .where(eq(studentsTable.id, studentId));
  if (!student) {
    res.status(409).json({ error: "Complete your student profile first" });
    return;
  }

  const [incident] = await db
    .insert(incidentsTable)
    .values({
      resourceId: resource.id,
      studentId,
      description: parsed.data.description,
      severity: parsed.data.severity,
      occurredAt: new Date(parsed.data.occurredAt),
    })
    .returning();

  res.status(201).json(
    CreateIncidentResponse.parse(
      serializeIncident(incident, resource, student),
    ),
  );
});

export default router;
