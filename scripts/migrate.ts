import { db } from "../src/db";
import { schedules, scheduleTargets } from "../src/db/schema";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";

async function run() {
  console.log("Migrating existing schedules to ALL targets...");
  
  const existing = await db.select().from(schedules);
  let count = 0;
  
  for (const schedule of existing) {
    const targets = await db
      .select()
      .from(scheduleTargets)
      .where(eq(scheduleTargets.scheduleId, schedule.id));
      
    if (targets.length === 0) {
      await db.insert(scheduleTargets).values({
        id: randomUUID(),
        scheduleId: schedule.id,
        targetType: "ALL",
        targetId: null
      });
      count++;
    }
  }
  
  console.log(`Migrated ${count} schedules. Done.`);
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
