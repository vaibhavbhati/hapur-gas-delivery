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

async function isAdmin(userId: number): Promise<boolean> {
  const [user] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  return user?.role === "admin";
}

function styleHeader(row: ExcelJS.Row, color: string) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: color } };
}

router.get("/export/full", requireAuth, async (req: Request, res: Response) => {
  if (!req.session.userId || !(await isAdmin(req.session.userId))) {
    return res.status(403).json({ error: "forbidden", message: "Admin only" });
  }

  const [deliveries, users, files, settings] = await Promise.all([
    db.select({
      id: deliveriesTable.id,
      consumerNumber: deliveriesTable.consumerNumber,
      customerName: deliveriesTable.customerName,
      mobileNumber: deliveriesTable.mobileNumber,
      deliveryDate: deliveriesTable.deliveryDate,
      nextEligibleDate: deliveriesTable.nextEligibleDate,
      createdAt: deliveriesTable.createdAt,
      createdByName: usersTable.name,
    }).from(deliveriesTable)
      .leftJoin(usersTable, eq(deliveriesTable.createdBy, usersTable.id))
      .orderBy(desc(deliveriesTable.deliveryDate)),

    db.select({
      id: usersTable.id,
      username: usersTable.username,
      name: usersTable.name,
      role: usersTable.role,
      deliveryLocked: usersTable.deliveryLocked,
      createdAt: usersTable.createdAt,
    }).from(usersTable).orderBy(usersTable.id),

    db.select().from(deliveryFilesTable).orderBy(desc(deliveryFilesTable.createdAt)),

    db.select().from(settingsTable).limit(1),
  ]);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Gas Delivery Portal";
  workbook.created = new Date();

  const deliverySheet = workbook.addWorksheet("Deliveries");
  deliverySheet.columns = [
    { header: "ID", key: "id", width: 8 },
    { header: "Consumer Number", key: "consumerNumber", width: 20 },
    { header: "Customer Name", key: "customerName", width: 25 },
    { header: "Mobile Number", key: "mobileNumber", width: 18 },
    { header: "Delivery Date", key: "deliveryDate", width: 18 },
    { header: "Next Eligible Date", key: "nextEligibleDate", width: 20 },
    { header: "Added By", key: "createdByName", width: 20 },
    { header: "Added On", key: "createdAt", width: 22 },
  ];
  styleHeader(deliverySheet.getRow(1), "FF1E40AF");
  for (const d of deliveries) {
    deliverySheet.addRow({
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

  const userSheet = workbook.addWorksheet("Users");
  userSheet.columns = [
    { header: "ID", key: "id", width: 8 },
    { header: "Username", key: "username", width: 20 },
    { header: "Full Name", key: "name", width: 25 },
    { header: "Role", key: "role", width: 12 },
    { header: "Delivery Locked", key: "deliveryLocked", width: 18 },
    { header: "Created At", key: "createdAt", width: 22 },
  ];
  styleHeader(userSheet.getRow(1), "FF065F46");
  for (const u of users) {
    userSheet.addRow({
      id: u.id,
      username: u.username,
      name: u.name,
      role: u.role,
      deliveryLocked: u.deliveryLocked ? "Yes" : "No",
      createdAt: u.createdAt ? new Date(u.createdAt).toLocaleString() : "",
    });
  }

  const filesSheet = workbook.addWorksheet("Delivery Files");
  filesSheet.columns = [
    { header: "ID", key: "id", width: 8 },
    { header: "Delivery ID", key: "deliveryId", width: 12 },
    { header: "File Name", key: "fileName", width: 35 },
    { header: "File Type", key: "fileType", width: 15 },
    { header: "File Size (bytes)", key: "fileSize", width: 18 },
    { header: "Uploaded By (ID)", key: "uploadedBy", width: 18 },
    { header: "Uploaded At", key: "createdAt", width: 22 },
  ];
  styleHeader(filesSheet.getRow(1), "FF7C3AED");
  for (const f of files) {
    filesSheet.addRow({
      id: f.id,
      deliveryId: f.deliveryId,
      fileName: f.fileName,
      fileType: f.fileType,
      fileSize: f.fileSize,
      uploadedBy: f.uploadedBy,
      createdAt: f.createdAt ? new Date(f.createdAt).toLocaleString() : "",
    });
  }

  const settingsSheet = workbook.addWorksheet("Settings");
  settingsSheet.columns = [
    { header: "ID", key: "id", width: 8 },
    { header: "Waiting Days", key: "waitingDays", width: 18 },
    { header: "Updated At", key: "updatedAt", width: 22 },
  ];
  styleHeader(settingsSheet.getRow(1), "FFB45309");
  for (const s of settings) {
    settingsSheet.addRow({
      id: s.id,
      waitingDays: s.waitingDays,
      updatedAt: s.updatedAt ? new Date(s.updatedAt).toLocaleString() : "",
    });
  }

  const date = new Date().toISOString().split("T")[0];
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="gas-portal-full-export-${date}.xlsx"`);
  await workbook.xlsx.write(res);
  return res.end();
});

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

  // Fetch files for all returned deliveries in one query
  const deliveryIds = rows.map((r) => r.id);
  const filesRows = deliveryIds.length
    ? await db
        .select({
          deliveryId: deliveryFilesTable.deliveryId,
          id: deliveryFilesTable.id,
          fileName: deliveryFilesTable.fileName,
          fileType: deliveryFilesTable.fileType,
          objectPath: deliveryFilesTable.objectPath,
        })
        .from(deliveryFilesTable)
        .where(sql`${deliveryFilesTable.deliveryId} = ANY(${sql.raw(`ARRAY[${deliveryIds.join(",")}]::int[]`)})`)
    : [];

  const filesByDelivery = new Map<number, typeof filesRows>();
  for (const f of filesRows) {
    const list = filesByDelivery.get(f.deliveryId) ?? [];
    list.push(f);
    filesByDelivery.set(f.deliveryId, list);
  }

  res.json({
    data: rows.map((r) => ({
      ...r,
      createdByName: r.createdByName ?? "",
      files: filesByDelivery.get(r.id) ?? [],
    })),
    total: totalResult[0]?.count ?? 0,
    page: pageNum,
    limit: limitNum,
  });
});

router.post("/", requireAuth, async (req: Request, res: Response) => {
  // Check if this user is locked from adding deliveries
  const [actingUser] = await db
    .select({ deliveryLocked: usersTable.deliveryLocked })
    .from(usersTable)
    .where(eq(usersTable.id, req.session.userId!))
    .limit(1);

  if (actingUser?.deliveryLocked) {
    return res.status(403).json({ error: "locked", message: "Your account is restricted from adding deliveries. Please contact the administrator." });
  }

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
