import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { db, studentsTable } from "@workspace/db";
import {
  GetStudentProfileResponse,
  UpsertStudentProfileBody,
  UpsertStudentProfileResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();
router.use("/students", requireAuth);

function serializeStudent(student: typeof studentsTable.$inferSelect) {
  return {
    ...student,
    createdAt: student.createdAt.toISOString(),
  };
}

router.get("/students/me", async (req, res): Promise<void> => {
  const studentId = getAuth(req).userId!;
  const [student] = await db
    .select()
    .from(studentsTable)
    .where(eq(studentsTable.id, studentId));

  if (!student) {
    res.status(404).json({ error: "Student profile not found" });
    return;
  }

  res.json(GetStudentProfileResponse.parse(serializeStudent(student)));
});

router.put("/students/me", async (req, res): Promise<void> => {
  const parsed = UpsertStudentProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const studentId = getAuth(req).userId!;
  const values = {
    id: studentId,
    fullName: parsed.data.fullName,
    email: parsed.data.email,
    program: parsed.data.program ?? null,
    yearLevel: parsed.data.yearLevel ?? null,
  };
  const [student] = await db
    .insert(studentsTable)
    .values(values)
    .onConflictDoUpdate({
      target: studentsTable.id,
      set: {
        fullName: values.fullName,
        email: values.email,
        program: values.program,
        yearLevel: values.yearLevel,
        updatedAt: new Date(),
      },
    })
    .returning();

  res.json(
    UpsertStudentProfileResponse.parse(serializeStudent(student)),
  );
});

export default router;
