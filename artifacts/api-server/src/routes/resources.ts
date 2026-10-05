import { Router, type IRouter } from "express";
import { and, eq, gt, lt } from "drizzle-orm";
import { db, reservationsTable, resourcesTable } from "@workspace/db";
import {
  CheckResourceAvailabilityQueryParams,
  CheckResourceAvailabilityResponse,
  ListResourcesQueryParams,
  ListResourcesResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/resources", async (req, res): Promise<void> => {
  const query = ListResourcesQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const resources = await db
    .select()
    .from(resourcesTable)
    .where(
      query.data.type
        ? eq(resourcesTable.type, query.data.type)
        : undefined,
    )
    .orderBy(resourcesTable.type, resourcesTable.name);
  res.json(ListResourcesResponse.parse(resources));
});

router.get("/resources/availability", async (req, res): Promise<void> => {
  const queryStartAt =
    typeof req.query.startAt === "string"
      ? new Date(req.query.startAt)
      : undefined;
  const queryEndAt =
    typeof req.query.endAt === "string"
      ? new Date(req.query.endAt)
      : undefined;
  const query = CheckResourceAvailabilityQueryParams.safeParse({
    ...req.query,
    startAt: queryStartAt,
    endAt: queryEndAt,
  });
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const startAt = query.data.startAt;
  const endAt = query.data.endAt;
  if (endAt <= startAt) {
    res.status(400).json({ error: "End time must be after start time" });
    return;
  }

  const resources = await db
    .select()
    .from(resourcesTable)
    .where(
      query.data.type
        ? eq(resourcesTable.type, query.data.type)
        : undefined,
    )
    .orderBy(resourcesTable.type, resourcesTable.name);
  const conflictingReservations = await db
    .select({ resourceId: reservationsTable.resourceId })
    .from(reservationsTable)
    .where(
      and(
        eq(reservationsTable.status, "confirmed"),
        lt(reservationsTable.startAt, endAt),
        gt(reservationsTable.endAt, startAt),
      ),
    );
  const busyResourceIds = new Set(
    conflictingReservations.map((reservation) => reservation.resourceId),
  );
  const availability = resources.map((resource) => ({
    ...resource,
    available:
      resource.status === "available" && !busyResourceIds.has(resource.id),
  }));

  res.json(CheckResourceAvailabilityResponse.parse(availability));
});

export default router;
