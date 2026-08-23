import { Router, type IRouter } from "express";
import healthRouter from "./health";
import studentsRouter from "./students";
import internshipsRouter from "./internships";
import recommendationsRouter from "./recommendations";
import interactionsRouter from "./interactions";
import resumeRouter from "./resume";
import assessmentRouter from "./assessment";

const router: IRouter = Router();

router.use(healthRouter);
router.use(studentsRouter);
router.use(internshipsRouter);
router.use(recommendationsRouter);
router.use(interactionsRouter);
router.use(resumeRouter);
router.use(assessmentRouter);

export default router;
