import { db, usersTable, settingsTable, deliveriesTable, deliveryFilesTable } from "@workspace/db";
import { sql, count } from "drizzle-orm";

export async function initDb() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      delivery_locked BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS settings (
      id SERIAL PRIMARY KEY,
      waiting_days INTEGER NOT NULL DEFAULT 25,
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS deliveries (
      id SERIAL PRIMARY KEY,
      consumer_number TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      mobile_number TEXT NOT NULL DEFAULT '',
      delivery_date DATE NOT NULL,
      next_eligible_date DATE NOT NULL,
      created_by INTEGER NOT NULL REFERENCES users(id),
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS delivery_files (
      id SERIAL PRIMARY KEY,
      delivery_id INTEGER NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
      file_name TEXT NOT NULL,
      file_type TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      object_path TEXT NOT NULL,
      uploaded_by INTEGER NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  const [{ value: userCount }] = await db.select({ value: count() }).from(usersTable);
  if (userCount === 0) {
    await db.insert(usersTable).values([
      { username: "admin",  password: "admin123", name: "Administrator", role: "admin" },
      { username: "user1",  password: "user123",  name: "User One",      role: "user" },
      { username: "user2",  password: "user123",  name: "User Two",      role: "user" },
      { username: "user3",  password: "user123",  name: "User Three",    role: "user" },
      { username: "user4",  password: "user123",  name: "User Four",     role: "user" },
    ]);
    console.log("Seeded default users");
  }

  const [{ value: settingsCount }] = await db.select({ value: count() }).from(settingsTable);
  if (settingsCount === 0) {
    await db.insert(settingsTable).values({ waitingDays: 25 });
    console.log("Seeded default settings");
  }

  console.log("Database initialised");
}
