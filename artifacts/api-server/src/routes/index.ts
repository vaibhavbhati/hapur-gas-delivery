import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import deliveriesRouter from "./deliveries";
import settingsRouter from "./settings";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/deliveries", deliveriesRouter);
router.use("/settings", settingsRouter);

export default router;
