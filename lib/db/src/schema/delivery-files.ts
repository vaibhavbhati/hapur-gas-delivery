import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { deliveriesTable } from "./deliveries";

export const deliveryFilesTable = pgTable("delivery_files", {
  id: serial("id").primaryKey(),
  deliveryId: integer("delivery_id").notNull().references(() => deliveriesTable.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(),
  fileSize: integer("file_size").notNull(),
  objectPath: text("object_path").notNull(),
  uploadedBy: integer("uploaded_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertDeliveryFileSchema = createInsertSchema(deliveryFilesTable).omit({ id: true, createdAt: true });
export type InsertDeliveryFile = z.infer<typeof insertDeliveryFileSchema>;
export type DeliveryFile = typeof deliveryFilesTable.$inferSelect;
