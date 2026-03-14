import { Router, type IRouter, type Request, type Response } from "express";
import { db, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

function requireAuth(req: Request, res: Response, next: () => void) {
  if (!req.session.userId) {
    res.status(401).json({ error: "unauthorized", message: "Not authenticated" });
    return;
  }
  next();
}

router.get("/", async (_req: Request, res: Response) => {
  let [settings] = await db.select().from(settingsTable).limit(1);
  if (!settings) {
    [settings] = await db.insert(settingsTable).values({ waitingDays: 25 }).returning();
  }
  res.json({ waitingDays: settings.waitingDays, updatedAt: settings.updatedAt });
});

router.put("/", requireAuth, async (req: Request, res: Response) => {
  const { waitingDays } = req.body;
  if (!waitingDays || typeof waitingDays !== "number" || waitingDays < 1) {
    return res.status(400).json({ error: "bad_request", message: "waitingDays must be a positive integer" });
  }

  let [settings] = await db.select().from(settingsTable).limit(1);
  if (!settings) {
    [settings] = await db.insert(settingsTable).values({ waitingDays }).returning();
  } else {
    [settings] = await db
      .update(settingsTable)
      .set({ waitingDays, updatedAt: new Date() })
      .where(eq(settingsTable.id, settings.id))
      .returning();
  }

  return res.json({ waitingDays: settings.waitingDays, updatedAt: settings.updatedAt });
});

export default router;
