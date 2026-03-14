import { Router, type IRouter, type Request, type Response } from "express";
import { db, deliveriesTable, settingsTable, usersTable, deliveryFilesTable } from "@workspace/db";
import { eq, or, ilike, desc, sql } from "drizzle-orm";
import ExcelJS from "exceljs";

const router: IRouter = Router();

function requireAuth(req: Request, res: Response, next: () => void) {
  if (!req.session.userId) {
    res.status(401).json({ error: "unauthorized", message: "Not authenticated" });
    return;
  }
  next();
}

async function getWaitingDays(): Promise<number> {
  const [settings] = await db.select().from(settingsTable).limit(1);
  return settings?.waitingDays ?? 25;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

router.get("/export/excel", requireAuth, async (req: Request, res: Response) => {
  const deliveries = await db
    .select({
      id: deliveriesTable.id,
      consumerNumber: deliveriesTable.consumerNumber,
      customerName: deliveriesTable.customerName,
      mobileNumber: deliveriesTable.mobileNumber,
      deliveryDate: deliveriesTable.deliveryDate,
      nextEligibleDate: deliveriesTable.nextEligibleDate,
      createdAt: deliveriesTable.createdAt,
      createdByName: usersTable.name,
    })
    .from(deliveriesTable)
    .leftJoin(usersTable, eq(deliveriesTable.createdBy, usersTable.id))
    .orderBy(desc(deliveriesTable.deliveryDate));

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Gas Deliveries");

  sheet.columns = [
    { header: "ID", key: "id", width: 8 },
    { header: "Consumer Number", key: "consumerNumber", width: 20 },
    { header: "Customer Name", key: "customerName", width: 25 },
    { header: "Mobile Number", key: "mobileNumber", width: 18 },
    { header: "Delivery Date", key: "deliveryDate", width: 18 },
    { header: "Next Eligible Date", key: "nextEligibleDate", width: 20 },
    { header: "Added By", key: "createdByName", width: 20 },
    { header: "Added On", key: "createdAt", width: 22 },
  ];

  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1E40AF" },
  };
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

  for (const d of deliveries) {
    sheet.addRow({
      id: d.id,
      consumerNumber: d.consumerNumber,
      customerName: d.customerName,
      mobileNumber: d.mobileNumber,
      deliveryDate: d.deliveryDate,
      nextEligibleDate: d.nextEligibleDate,
      createdByName: d.createdByName ?? "",
      createdAt: d.createdAt ? new Date(d.createdAt).toLocaleString() : "",
    });
  }

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="gas-deliveries-${new Date().toISOString().split("T")[0]}.xlsx"`);

  await workbook.xlsx.write(res);
  res.end();
});

router.get("/", requireAuth, async (req: Request, res: Response) => {
  const { search, page = "1", limit = "50" } = req.query as Record<string, string>;
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
  const offset = (pageNum - 1) * limitNum;

  let whereClause = undefined;
  if (search) {
    whereClause = or(
      ilike(deliveriesTable.consumerNumber, `%${search}%`),
      ilike(deliveriesTable.customerName, `%${search}%`),
      ilike(deliveriesTable.mobileNumber, `%${search}%`)
    );
  }

  const [totalResult, rows] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(deliveriesTable)
      .where(whereClause),
    db
      .select({
        id: deliveriesTable.id,
        consumerNumber: deliveriesTable.consumerNumber,
        customerName: deliveriesTable.customerName,
        mobileNumber: deliveriesTable.mobileNumber,
        deliveryDate: deliveriesTable.deliveryDate,
        nextEligibleDate: deliveriesTable.nextEligibleDate,
        createdBy: deliveriesTable.createdBy,
        createdByName: usersTable.name,
        createdAt: deliveriesTable.createdAt,
        updatedAt: deliveriesTable.updatedAt,
      })
      .from(deliveriesTable)
      .leftJoin(usersTable, eq(deliveriesTable.createdBy, usersTable.id))
      .where(whereClause)
      .orderBy(desc(deliveriesTable.createdAt))
      .limit(limitNum)
      .offset(offset),
  ]);

  res.json({
    data: rows.map((r) => ({ ...r, createdByName: r.createdByName ?? "" })),
    total: totalResult[0]?.count ?? 0,
    page: pageNum,
    limit: limitNum,
  });
});

router.post("/", requireAuth, async (req: Request, res: Response) => {
  const { consumerNumber, customerName, deliveryDate } = req.body;

  if (!consumerNumber || !customerName || !deliveryDate) {
    return res.status(400).json({ error: "bad_request", message: "consumerNumber, customerName and deliveryDate are required" });
  }

  const waitingDays = await getWaitingDays();
  const nextEligibleDate = addDays(deliveryDate, waitingDays);

  const existingMobile = await db
    .select({ mobileNumber: deliveriesTable.mobileNumber })
    .from(deliveriesTable)
    .where(eq(deliveriesTable.consumerNumber, consumerNumber))
    .orderBy(desc(deliveriesTable.createdAt))
    .limit(1);

  const mobileNumber = req.body.mobileNumber ?? existingMobile[0]?.mobileNumber ?? "";

  const [inserted] = await db
    .insert(deliveriesTable)
    .values({
      consumerNumber,
      customerName,
      mobileNumber,
      deliveryDate,
      nextEligibleDate,
      createdBy: req.session.userId!,
    })
    .returning();

  const [user] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, req.session.userId!)).limit(1);

  return res.status(201).json({
    ...inserted,
    createdByName: user?.name ?? "",
  });
});

router.get("/:id", requireAuth, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const [row] = await db
    .select({
      id: deliveriesTable.id,
      consumerNumber: deliveriesTable.consumerNumber,
      customerName: deliveriesTable.customerName,
      mobileNumber: deliveriesTable.mobileNumber,
      deliveryDate: deliveriesTable.deliveryDate,
      nextEligibleDate: deliveriesTable.nextEligibleDate,
      createdBy: deliveriesTable.createdBy,
      createdByName: usersTable.name,
      createdAt: deliveriesTable.createdAt,
      updatedAt: deliveriesTable.updatedAt,
    })
    .from(deliveriesTable)
    .leftJoin(usersTable, eq(deliveriesTable.createdBy, usersTable.id))
    .where(eq(deliveriesTable.id, id))
    .limit(1);

  if (!row) return res.status(404).json({ error: "not_found", message: "Record not found" });
  return res.json({ ...row, createdByName: row.createdByName ?? "" });
});

router.put("/:id", requireAuth, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const { consumerNumber, customerName, mobileNumber, deliveryDate } = req.body;

  const existing = await db.select().from(deliveriesTable).where(eq(deliveriesTable.id, id)).limit(1);
  if (!existing[0]) return res.status(404).json({ error: "not_found", message: "Record not found" });

  const waitingDays = await getWaitingDays();
  const newDeliveryDate = deliveryDate ?? existing[0].deliveryDate;
  const nextEligibleDate = addDays(newDeliveryDate, waitingDays);

  const [updated] = await db
    .update(deliveriesTable)
    .set({
      ...(consumerNumber && { consumerNumber }),
      ...(customerName && { customerName }),
      ...(mobileNumber !== undefined && { mobileNumber }),
      ...(deliveryDate && { deliveryDate, nextEligibleDate }),
      updatedAt: new Date(),
    })
    .where(eq(deliveriesTable.id, id))
    .returning();

  const [user] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, updated.createdBy)).limit(1);

  return res.json({ ...updated, createdByName: user?.name ?? "" });
});

router.delete("/:id", requireAuth, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const existing = await db.select().from(deliveriesTable).where(eq(deliveriesTable.id, id)).limit(1);
  if (!existing[0]) return res.status(404).json({ error: "not_found", message: "Record not found" });

  await db.delete(deliveriesTable).where(eq(deliveriesTable.id, id));
  return res.json({ success: true, message: "Deleted" });
});

router.get("/:id/files", requireAuth, async (req: Request, res: Response) => {
  const deliveryId = parseInt(req.params.id);
  const files = await db.select().from(deliveryFilesTable).where(eq(deliveryFilesTable.deliveryId, deliveryId)).orderBy(desc(deliveryFilesTable.createdAt));
  return res.json(files);
});

router.post("/:id/files", requireAuth, async (req: Request, res: Response) => {
  const deliveryId = parseInt(req.params.id);
  const existing = await db.select().from(deliveriesTable).where(eq(deliveriesTable.id, deliveryId)).limit(1);
  if (!existing[0]) return res.status(404).json({ error: "not_found", message: "Record not found" });

  const { fileName, fileType, fileSize, objectPath } = req.body;
  if (!fileName || !fileType || !fileSize || !objectPath) {
    return res.status(400).json({ error: "bad_request", message: "fileName, fileType, fileSize and objectPath are required" });
  }

  const [file] = await db.insert(deliveryFilesTable).values({
    deliveryId,
    fileName,
    fileType,
    fileSize,
    objectPath,
    uploadedBy: req.session.userId!,
  }).returning();

  return res.status(201).json(file);
});

router.delete("/:id/files/:fileId", requireAuth, async (req: Request, res: Response) => {
  const fileId = parseInt(req.params.fileId);
  const existing = await db.select().from(deliveryFilesTable).where(eq(deliveryFilesTable.id, fileId)).limit(1);
  if (!existing[0]) return res.status(404).json({ error: "not_found", message: "File not found" });

  await db.delete(deliveryFilesTable).where(eq(deliveryFilesTable.id, fileId));
  return res.json({ success: true, message: "Deleted" });
});

export default router;
