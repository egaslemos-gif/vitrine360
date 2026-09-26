/**
 * PI-10P — Seed Preview DB for OFF baseline (Preview host guard).
 * Creates demo tenant + admin if missing. Never prints secrets/passwords in logs beyond known seed email.
 */
import { config } from "dotenv";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import * as schema from "../src/db/schema";

const PREVIEW_HOST =
  "libsql://vitrine360-preview-elemos.aws-us-west-2.turso.io";
const PRODUCTION_HOST =
  "libsql://vitrine360-vercel-icfg-rd8hoku6p0oaszo88ixdwcu4.aws-us-east-1.turso.io";

config({ path: ".env.preview.local", override: true });

async function main() {
  const url = process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL || "";
  const token =
    process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN || "";
  console.log(`DATABASE_URL=${url ? "PRESENT" : "ABSENT"}`);
  console.log(`DATABASE_AUTH_TOKEN=${token ? "PRESENT" : "ABSENT"}`);
  console.log(
    `ENTITLEMENTS_ENABLED=${process.env.ENTITLEMENTS_ENABLED ?? "UNSET"}`,
  );
  if (!url || !token) process.exit(2);
  if (url === PRODUCTION_HOST || url !== PREVIEW_HOST) {
    console.error("STOP: Preview host guard failed");
    process.exit(2);
  }
  console.log("target_guard=PASS");

  const client = createClient({ url, authToken: token });
  const db = drizzle(client, { schema });

  const [existing] = await db
    .select()
    .from(schema.tenants)
    .where(eq(schema.tenants.slug, "preview-demo"))
    .limit(1);

  let tid = existing?.id;
  if (!tid) {
    tid = crypto.randomUUID();
    await db.insert(schema.tenants).values({
      id: tid,
      name: "Preview Demo Org",
      slug: "preview-demo",
      status: "ACTIVE",
    });
    console.log("tenant=created slug=preview-demo");
  } else {
    console.log("tenant=existing slug=preview-demo");
  }

  const email = "preview-admin@vitrine360.local";
  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);

  let uid = user?.id;
  if (!uid) {
    uid = crypto.randomUUID();
    const passwordHash = await bcrypt.hash("PreviewAdmin123!", 12);
    await db.insert(schema.users).values({
      id: uid,
      email,
      name: "Preview Admin",
      passwordHash,
      role: "SUPER_ADMIN",
      tenantId: tid,
    });
    console.log("user=created email=preview-admin@vitrine360.local");
  } else {
    console.log("user=existing email=preview-admin@vitrine360.local");
  }

  await db
    .insert(schema.memberships)
    .values({
      id: `${uid}:home`,
      userId: uid,
      tenantId: tid,
      role: "SUPER_ADMIN",
      status: "ACTIVE",
    })
    .onConflictDoNothing();

  // Compatibility plan seed (flag OFF — no enforcement)
  process.env.DATABASE_URL = url;
  process.env.DATABASE_AUTH_TOKEN = token;
  const { ensureSchema } = await import("../src/db/client");
  await ensureSchema();
  const { seedCompatibilityPlan } = await import(
    "../src/services/entitlements"
  );
  const seeded = await seedCompatibilityPlan();
  console.log(
    `compatibility_plan=${seeded.created ? "created" : "existing"}`,
  );
  console.log("seed_preview=SUCCESS");
  console.log("password_logged=false");
}

main().catch((e) => {
  console.error(String(e).replace(/[A-Za-z0-9_-]{24,}/g, "REDACTED"));
  process.exit(1);
});
