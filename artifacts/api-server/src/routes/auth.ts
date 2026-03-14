import { Router, type IRouter, type Request, type Response } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

declare module "express-session" {
  interface SessionData {
    userId?: number;
  }
}

const router: IRouter = Router();

router.post("/login", async (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "bad_request", message: "Username and password required" });
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.username, username)).limit(1);

  if (!user || user.password !== password) {
    return res.status(401).json({ error: "unauthorized", message: "Invalid credentials" });
  }

  req.session.userId = user.id;
  return res.json({
    user: { id: user.id, username: user.username, role: user.role, name: user.name },
    message: "Login successful",
  });
});

router.post("/logout", (req: Request, res: Response) => {
  req.session.destroy(() => {
    res.json({ success: true, message: "Logged out" });
  });
});

router.get("/me", async (req: Request, res: Response) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "unauthorized", message: "Not authenticated" });
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId)).limit(1);

  if (!user) {
    return res.status(401).json({ error: "unauthorized", message: "User not found" });
  }

  return res.json({ id: user.id, username: user.username, role: user.role, name: user.name });
});

export default router;
