import { Router, type IRouter } from "express";
import { and, asc, eq, gt, lt } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import {
  db,
  reservationsTable,
  resourcesTable,
} from "@workspace/db";
import {
  CancelReservationParams,
  CancelReservationResponse,
  CreateReservationBody,
  CreateReservationResponse,
  ListReservationsResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();
router.use("/reservations", requireAuth);

function serializeReservation(
  reservation: typeof reservationsTable.$inferSelect,
  resource: typeof resourcesTable.$inferSelect,
) {
  return {
    ...reservation,
    resourceCode: resource.code,
    resourceName: resource.name,
    startAt: reservation.startAt.toISOString(),
    endAt: reservation.endAt.toISOString(),
    createdAt: reservation.createdAt.toISOString(),
  };
}

router.get("/reservations", async (req, res): Promise<void> => {
  const studentId = getAuth(req).userId!;
  const rows = await db
    .select({ reservation: reservationsTable, resource: resourcesTable })
    .from(reservationsTable)
    .innerJoin(
      resourcesTable,
      eq(reservationsTable.resourceId, resourcesTable.id),
    )
    .where(eq(reservationsTable.studentId, studentId))
    .orderBy(asc(reservationsTable.startAt));

  const reservations = rows.map(({ reservation, resource }) =>
    serializeReservation(reservation, resource),
  );
  res.json(ListReservationsResponse.parse(reservations));
});

router.post("/reservations", async (req, res): Promise<void> => {
  const parsed = CreateReservationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const startAt = new Date(parsed.data.startAt);
  const endAt = new Date(parsed.data.endAt);
  if (startAt <= new Date() || endAt <= startAt) {
    res.status(400).json({
      error: "Choose a future time window with an end after the start",
    });
    return;
  }

  const studentId = getAuth(req).userId!;
  const result = await db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(8734, ${parsed.data.resourceId})`,
    );

    const [resource] = await tx
      .select()
      .from(resourcesTable)
      .where(eq(resourcesTable.id, parsed.data.resourceId));
    if (!resource) return { kind: "not_found" as const };
    if (resource.status !== "available") {
      return { kind: "maintenance" as const };
    }

    const [conflict] = await tx
      .select({ id: reservationsTable.id })
      .from(reservationsTable)
      .where(
        and(
          eq(reservationsTable.resourceId, resource.id),
          eq(reservationsTable.status, "confirmed"),
          lt(reservationsTable.startAt, endAt),
          gt(reservationsTable.endAt, startAt),
        ),
      )
      .limit(1);
    if (conflict) return { kind: "conflict" as const };

    const [reservation] = await tx
      .insert(reservationsTable)
      .values({
        resourceId: resource.id,
        studentId,
        title: parsed.data.title,
        startAt,
        endAt,
        notes: parsed.data.notes ?? null,
      })
      .returning();
    return { kind: "created" as const, reservation, resource };
  });

  if (result.kind === "not_found") {
    res.status(404).json({ error: "Resource not found" });
    return;
  }
  if (result.kind === "maintenance") {
    res.status(409).json({ error: "This resource is under maintenance" });
    return;
  }
  if (result.kind === "conflict") {
    res.status(409).json({
      error: "That resource is already reserved during this time window",
    });
    return;
  }

  res.status(201).json(
    CreateReservationResponse.parse(
      serializeReservation(result.reservation, result.resource),
    ),
  );
});

router.patch("/reservations/:id", async (req, res): Promise<void> => {
  const params = CancelReservationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const studentId = getAuth(req).userId!;
  const [updated] = await db
    .update(reservationsTable)
    .set({ status: "cancelled" })
    .where(
      and(
        eq(reservationsTable.id, params.data.id),
        eq(reservationsTable.studentId, studentId),
        eq(reservationsTable.status, "confirmed"),
      ),
    )
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Reservation not found" });
    return;
  }

  const [resource] = await db
    .select()
    .from(resourcesTable)
    .where(eq(resourcesTable.id, updated.resourceId));
  if (!resource) {
    res.status(404).json({ error: "Resource not found" });
    return;
  }

  res.json(
    CancelReservationResponse.parse(serializeReservation(updated, resource)),
  );
});

export default router;
