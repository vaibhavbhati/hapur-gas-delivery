import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter, { usersRouter } from "./auth";
import deliveriesRouter from "./deliveries";
import settingsRouter from "./settings";
import storageRouter from "./storage";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/users", usersRouter);
router.use("/deliveries", deliveriesRouter);
router.use("/settings", settingsRouter);
router.use(storageRouter);

export default router;
