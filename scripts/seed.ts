import { config } from "dotenv";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import * as schema from "../src/db/schema";

config({ path: ".env.local" });
config({ path: ".env" });

function resolveUrl() {
  const url = process.env.DATABASE_URL ?? "file:./data/vitrine360.db";
  if (url.startsWith("file:")) {
    const filePath = url.replace(/^file:/, "");
    const absolute = path.isAbsolute(filePath)
      ? filePath
      : path.join(process.cwd(), filePath);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    return `file:${absolute.replace(/\\/g, "/")}`;
  }
  return url;
}

async function main() {
  const client = createClient({ 
    url: resolveUrl(),
    authToken: process.env.DATABASE_AUTH_TOKEN 
  });
  const db = drizzle(client, { schema });

  const tenantId = crypto.randomUUID();
  await db
    .insert(schema.tenants)
    .values({
      id: tenantId,
      name: "Demo Organization",
      slug: "demo",
      status: "ACTIVE",
    })
    .onConflictDoNothing();

  const [tenant] = await db
    .select()
    .from(schema.tenants)
    .where(eq(schema.tenants.slug, "demo"))
    .limit(1);
  const tid = tenant?.id ?? tenantId;

  const passwordHash = await bcrypt.hash("Admin123!", 12);
  const adminId = crypto.randomUUID();

  await db
    .insert(schema.users)
    .values({
      id: adminId,
      email: "admin@vitrine360.local",
      name: "Super Admin",
      passwordHash,
      role: "SUPER_ADMIN",
      tenantId: tid,
    })
    .onConflictDoNothing();

  const [admin] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, "admin@vitrine360.local"))
    .limit(1);
  if (admin) {
    await db
      .insert(schema.memberships)
      .values({
        id: `${admin.id}:home`,
        userId: admin.id,
        tenantId: admin.tenantId,
        role: admin.role,
        status: "ACTIVE",
      })
      .onConflictDoNothing();
  }

  await db
    .insert(schema.systemSettings)
    .values({
      key: "heartbeat_offline_after_ms",
      value: JSON.stringify(90_000),
    })
    .onConflictDoNothing();

  // PLATFORM-IDENTITY-10B — technical compatibility plan (idempotent)
  const { ensureSchema } = await import("../src/db/client");
  await ensureSchema();
  const { seedCompatibilityPlan } = await import(
    "../src/services/entitlements"
  );
  const seeded = await seedCompatibilityPlan();
  console.log(
    `Compatibility plan: ${seeded.planId} (${seeded.created ? "created" : "existing"})`,
  );

  console.log("Seed complete. [DEVELOPMENT ONLY — do not use in production]");
  console.log("Tenant slug: demo");
  console.log("DEV admin: admin@vitrine360.local / Admin123!");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
