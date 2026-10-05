import { Router, type IRouter } from "express";
import { and, asc, desc, eq } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { db, tasksTable } from "@workspace/db";
import {
  CreateTaskBody,
  CreateTaskResponse,
  DeleteTaskParams,
  ListTasksQueryParams,
  ListTasksResponse,
  UpdateTaskBody,
  UpdateTaskParams,
  UpdateTaskResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();
router.use("/tasks", requireAuth);

function serializeTask(task: typeof tasksTable.$inferSelect) {
  return {
    ...task,
    dueAt: task.dueAt?.toISOString() ?? null,
    createdAt: task.createdAt.toISOString(),
  };
}

router.get("/tasks", async (req, res): Promise<void> => {
  const query = ListTasksQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const studentId = getAuth(req).userId!;
  const filters = [eq(tasksTable.ownerId, studentId)];
  if (query.data.status) {
    filters.push(eq(tasksTable.status, query.data.status));
  }
  const tasks = await db
    .select()
    .from(tasksTable)
    .where(and(...filters))
    .orderBy(asc(tasksTable.dueAt), desc(tasksTable.createdAt));
  res.json(ListTasksResponse.parse(tasks.map(serializeTask)));
});

router.post("/tasks", async (req, res): Promise<void> => {
  const parsed = CreateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const studentId = getAuth(req).userId!;
  const dueAt = parsed.data.dueAt ? new Date(parsed.data.dueAt) : null;
  const [task] = await db
    .insert(tasksTable)
    .values({
      ownerId: studentId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      dueAt,
      priority: parsed.data.priority,
    })
    .returning();

  res.status(201).json(CreateTaskResponse.parse(serializeTask(task)));
});

router.patch("/tasks/:id", async (req, res): Promise<void> => {
  const params = UpdateTaskParams.safeParse(req.params);
  const parsed = UpdateTaskBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updates: Partial<typeof tasksTable.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (parsed.data.title !== undefined) updates.title = parsed.data.title;
  if (parsed.data.description !== undefined) {
    updates.description = parsed.data.description;
  }
  if (parsed.data.dueAt !== undefined) {
    updates.dueAt = parsed.data.dueAt ? new Date(parsed.data.dueAt) : null;
  }
  if (parsed.data.priority !== undefined) {
    updates.priority = parsed.data.priority;
  }
  if (parsed.data.status !== undefined) updates.status = parsed.data.status;

  const studentId = getAuth(req).userId!;
  const [task] = await db
    .update(tasksTable)
    .set(updates)
    .where(
      and(
        eq(tasksTable.id, params.data.id),
        eq(tasksTable.ownerId, studentId),
      ),
    )
    .returning();

  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  res.json(UpdateTaskResponse.parse(serializeTask(task)));
});

router.delete("/tasks/:id", async (req, res): Promise<void> => {
  const params = DeleteTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const studentId = getAuth(req).userId!;
  const [task] = await db
    .delete(tasksTable)
    .where(
      and(
        eq(tasksTable.id, params.data.id),
        eq(tasksTable.ownerId, studentId),
      ),
    )
    .returning({ id: tasksTable.id });

  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
