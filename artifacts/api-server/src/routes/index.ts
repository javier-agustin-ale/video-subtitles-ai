import { Router, type IRouter } from "express";
import healthRouter from "./health";
import subtitlesRouter from "./subtitles";

const router: IRouter = Router();

router.use(healthRouter);
router.use(subtitlesRouter);

export default router;
