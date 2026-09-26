/**
 * PLATFORM-IDENTITY-07 — Minimal Platform Console suite.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { decodeJwt } from "jose";

config({ path: ".env.local" });
config({ path: ".env" });

type Result = { id: string; ok: boolean; detail?: string };
const results: Result[] = [];

function record(id: string, ok: boolean, detail?: string) {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}${detail ? ` — ${detail}` : ""}`);
}

function assertPass(id: string, ok: boolean, detail?: string) {
  record(id, ok, detail);
  if (!ok) throw new Error(`${id} failed${detail ? `: ${detail}` : ""}`);
}

function read(rel: string) {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

function exists(rel: string) {
  return fs.existsSync(path.join(process.cwd(), rel));
}

async function main() {
  assertPass(
    "PI07-001",
    exists("src/app/platform/layout.tsx") &&
      exists("src/app/platform/page.tsx") &&
      exists("src/app/platform/tenants/page.tsx") &&
      exists("src/app/platform/tenants/[tenantId]/page.tsx"),
    "platform routes exist",
  );

  const access = read("src/lib/platform-access.ts");
  assertPass(
    "PI07-002",
    access.includes("requirePlatformPage") &&
      access.includes("platform.tenants.read") &&
      access.includes("getAuthContext") &&
      access.includes("isPlatformIdentityEnabled") &&
      !access.includes('role === "SUPER_ADMIN"') &&
      !access.includes("hasPermission("),
    "server gate uses platform authz only",
  );

  const tenantsPage = read("src/app/platform/tenants/page.tsx");
  const detailPage = read("src/app/platform/tenants/[tenantId]/page.tsx");
  assertPass(
    "PI07-003",
    tenantsPage.includes("requirePlatformPage") &&
      detailPage.includes("requirePlatformPage") &&
      tenantsPage.includes("PlatformAccessDenied") &&
      tenantsPage.includes("PlatformDisabled"),
    "pages gate before content",
  );

  const list = read("src/features/platform/platform-tenants-list.tsx");
  const detail = read("src/features/platform/platform-tenant-detail.tsx");
  assertPass(
    "PI07-004",
    list.includes("/api/platform/tenants") &&
      list.includes("credentials: \"include\"") &&
      detail.includes("/api/platform/tenants/") &&
      detail.includes("credentials: \"include\""),
    "UI consumes hardened APIs with cookies",
  );

  assertPass(
    "PI07-005",
    list.includes("LoadingState") &&
      list.includes("EmptyState") &&
      list.includes("ErrorState") &&
      list.includes("Carregar mais") &&
      detail.includes("LoadingState") &&
      detail.includes("ErrorState"),
    "loading / empty / error / pagination UX",
  );

  const forbiddenUi = [
    "createTenant",
    "tenants.manage",
    "platform.tenants.manage",
    "impersonat",
    'method: "DELETE"',
    'method: "PATCH"',
  ];
  const uiBlob = list + detail + tenantsPage + detailPage;
  assertPass(
    "PI07-006",
    forbiddenUi.every((f) => !uiBlob.includes(f)) &&
      !list.includes('method: "POST"') &&
      (!detail.includes('method: "POST"') ||
        (detail.includes("suspend") && detail.includes("reactivate"))),
    "no create/delete/manage UI (lifecycle POST allowed on detail)",
  );

  const nav = read("src/components/platform-nav.ts");
  const shell = read("src/components/platform-shell.tsx");
  assertPass(
    "PI07-007",
    nav.includes("/platform/tenants") &&
      shell.includes("Platform Console") &&
      shell.includes("/admin") &&
      shell.includes("aria-label"),
    "platform nav distinct from tenant admin",
  );

  // Runtime authz (without Next cookies store)
  const original = process.env.PLATFORM_IDENTITY_ENABLED;
  delete process.env.PLATFORM_IDENTITY_ENABLED;
  const { db, ensureSchema, schema } = await import("../src/db");
  const { createTenant } = await import("../src/services/tenants");
  const { createMembership } = await import("../src/services/memberships");
  const { hashPassword, sessionFromUser, createSessionToken, SESSION_COOKIE } =
    await import("../src/lib/auth");
  const platformIdentity = await import("../src/services/platform-identity");
  const { buildAuthContext, contextHasPlatformPermission } = await import(
    "../src/lib/platform-authz"
  );

  await ensureSchema();
  const stamp = Date.now().toString(36);
  const home = await createTenant({
    name: `PI07 ${stamp}`,
    slug: `pi07-${stamp}`,
  });
  const passwordHash = await hashPassword("Pi07Pass!");
  const userId = crypto.randomUUID();
  await db.insert(schema.users).values({
    id: userId,
    email: `pi07-${stamp}@test.local`,
    name: "PI07",
    passwordHash,
    role: "SUPER_ADMIN",
    tenantId: home,
  });
  await createMembership({
    userId,
    tenantId: home,
    role: "SUPER_ADMIN",
    status: "ACTIVE",
  });

  // Without cookies(), requirePlatformPage redirects — test authz helpers instead
  const ctxOff = await buildAuthContext({
    userId,
    claimedTenantId: home,
  });
  assert.ok(ctxOff);
  assertPass(
    "PI07-008",
    ctxOff.flag.platformIdentityEnabled === false &&
      !contextHasPlatformPermission(ctxOff, "platform.tenants.read"),
    "flag OFF denies platform.tenants.read",
  );

  process.env.PLATFORM_IDENTITY_ENABLED = "true";
  const ctxSuper = await buildAuthContext({
    userId,
    claimedTenantId: home,
  });
  assert.ok(ctxSuper);
  assertPass(
    "PI07-009",
    ctxSuper.tenant?.role === "SUPER_ADMIN" &&
      !contextHasPlatformPermission(ctxSuper, "platform.tenants.read"),
    "tenant SUPER_ADMIN alone cannot open console authz",
  );

  await platformIdentity.createPlatformAssignment({
    userId,
    role: "PLATFORM_SUPER_ADMIN",
  });
  const ctxOk = await buildAuthContext({
    userId,
    claimedTenantId: home,
  });
  assert.ok(ctxOk);
  assertPass(
    "PI07-010",
    contextHasPlatformPermission(ctxOk, "platform.tenants.read"),
    "PLATFORM_SUPER_ADMIN grants console permission",
  );

  // Session token still has no platform claims
  const [row] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  const session = await sessionFromUser(row, home);
  assert.ok(session);
  const token = await createSessionToken(session);
  const claims = decodeJwt(token);
  assertPass(
    "PI07-011",
    !Object.keys(claims).some((k) => k.toLowerCase().includes("platform")) &&
      SESSION_COOKIE === "v360_session",
    "JWT unchanged for console users",
  );

  // Admin nav must not absorb platform as tenant item
  const adminNav = read("src/components/admin-nav.ts");
  assertPass(
    "PI07-012",
    !adminNav.includes("/platform") && !adminNav.includes("platform.tenants"),
    "tenant admin nav remains tenant-scoped",
  );

  if (original === undefined) delete process.env.PLATFORM_IDENTITY_ENABLED;
  else process.env.PLATFORM_IDENTITY_ENABLED = original;

  const required = [
    "PI07-001",
    "PI07-002",
    "PI07-003",
    "PI07-004",
    "PI07-005",
    "PI07-006",
    "PI07-007",
    "PI07-008",
    "PI07-009",
    "PI07-010",
    "PI07-011",
    "PI07-012",
  ];
  const passed = new Set(results.filter((r) => r.ok).map((r) => r.id));
  for (const id of required) {
    if (!passed.has(id)) {
      console.error(`MISSING ${id}`);
      process.exitCode = 1;
    }
  }
  if (process.exitCode) process.exit(1);
  console.log(`\nPLATFORM-IDENTITY-07 — ${required.length} checks PASS`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
