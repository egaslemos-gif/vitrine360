import { config } from "dotenv";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import * as schema from "../src/db/schema";
import fs from "node:fs";
import path from "node:path";

config({ path: ".env.local" });
config({ path: ".env" });

function resolveUrl() {
  return process.env.TURSO_DATABASE_URL || "file:./.data/sqlite.db";
}

async function main() {
  const client = createClient({ 
    url: resolveUrl(),
    authToken: process.env.TURSO_AUTH_TOKEN 
  });
  
  const db = drizzle(client, { schema });
  
  const user = await db.query.users.findMany({
    where: eq(schema.users.email, "elemos@unilicungo.ac.mz"),
  });
  
  if (user && user.length > 0) {
    const bcrypt = require("bcryptjs");
    const newHash = bcrypt.hashSync("Admin123!", 12);
    await db.update(schema.users).set({ passwordHash: newHash }).where(eq(schema.users.id, user[0].id));
    console.log("Password updated to Admin123!");
  }
  console.log(JSON.stringify(user, null, 2));
  
  if (user && user.length > 0) {
    const memberships = await db.query.memberships.findMany({
      where: eq(schema.memberships.userId, user[0].id),
    });
    console.log("MEMBERSHIPS:");
    console.log(JSON.stringify(memberships, null, 2));

    const tenant = await db.query.tenants.findFirst({
      where: eq(schema.tenants.id, memberships[0].tenantId),
    });
    console.log("TENANT:");
    console.log(JSON.stringify(tenant, null, 2));
  }

  process.exit(0);
}

main().catch(console.error);
