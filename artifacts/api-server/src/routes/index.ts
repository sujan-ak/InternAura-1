import { Router, type IRouter } from "express";
import healthRouter from "./health";
import studentsRouter from "./students";
import internshipsRouter from "./internships";
import recommendationsRouter from "./recommendations";
import interactionsRouter from "./interactions";

const router: IRouter = Router();

router.use(healthRouter);
router.use(studentsRouter);
router.use(internshipsRouter);
router.use(recommendationsRouter);
router.use(interactionsRouter);

export default router;
