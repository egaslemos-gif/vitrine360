import { db } from "../src/db";
import { sql } from "drizzle-orm";

async function main() {
  try {
    await db.run(sql`ALTER TABLE tenants ADD COLUMN timezone TEXT NOT NULL DEFAULT 'UTC';`);
    console.log("Column 'timezone' added successfully.");
  } catch (err: any) {
    if (err.message.includes("duplicate column name")) {
      console.log("Column 'timezone' already exists.");
    } else {
      console.error("Error:", err);
    }
  }
  process.exit(0);
}

main();
