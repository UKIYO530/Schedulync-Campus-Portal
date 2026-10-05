import { Router, type IRouter } from "express";
import healthRouter from "./health";
import studentsRouter from "./students";
import tasksRouter from "./tasks";
import resourcesRouter from "./resources";
import reservationsRouter from "./reservations";
import incidentsRouter from "./incidents";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(studentsRouter);
router.use(tasksRouter);
router.use(resourcesRouter);
router.use(reservationsRouter);
router.use(incidentsRouter);
router.use(dashboardRouter);

export default router;
