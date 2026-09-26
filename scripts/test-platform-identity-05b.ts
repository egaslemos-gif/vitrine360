/**
 * PLATFORM-IDENTITY-05B — Authorization Service suite.
 * PI05-001… + SEC-PI05-*
 */
import assert from "node:assert/strict";
import { config } from "dotenv";
import { eq } from "drizzle-orm";
import fs from "node:fs";
import path from "node:path";
import { decodeJwt } from "jose";

config({ path: ".env.local" });
config({ path: ".env" });

type Result = { id: string; ok: boolean; detail?: string };
const results: Result[] = [];

function record(id: string, ok: boolean, detail?: string) {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}${detail ? ` — ${detail}` : ""}`);
}

function assertPass(id: string, cond: boolean, detail?: string) {
  record(id, cond, detail);
  if (!cond) throw new Error(`${id} failed${detail ? `: ${detail}` : ""}`);
}

async function main() {
  const originalFlag = process.env.PLATFORM_IDENTITY_ENABLED;
  delete process.env.PLATFORM_IDENTITY_ENABLED;

  const { db, ensureSchema, schema } = await import("../src/db");
  const { createTenant } = await import("../src/services/tenants");
  const { createMembership } = await import("../src/services/memberships");
  const {
    hashPassword,
    createSessionToken,
    sessionFromUser,
    AuthError,
  } = await import("../src/lib/auth");
  const { PERMISSIONS, hasPermission } = await import("../src/domain/types");
  const {
    PLATFORM_PERMISSIONS,
    PLATFORM_ROLE_PERMISSIONS,
    hasPlatformPermission,
  } = await import("../src/domain/platform-identity");
  const platformIdentity = await import("../src/services/platform-identity");
  const {
    buildAuthContext,
    resolvePlatformAuthz,
    contextHasPlatformPermission,
    assertPlatformPermission,
  } = await import("../src/lib/platform-authz");
  const { isPlatformIdentityEnabled } = await import(
    "../src/lib/platform-identity-flag"
  );
  const { listContents, createContent } = await import("../src/services/contents");

  await ensureSchema();
  const stamp = Date.now().toString(36);
  const passwordHash = await hashPassword("Pi05TestPass!");

  const tenantA = await createTenant({
    name: `PI05 A ${stamp}`,
    slug: `pi05-a-${stamp}`,
  });
  const tenantB = await createTenant({
    name: `PI05 B ${stamp}`,
    slug: `pi05-b-${stamp}`,
  });

  async function makeUser(
    email: string,
    home: string,
    role: "SUPER_ADMIN" | "ADMIN" | "VIEWER",
  ) {
    const id = crypto.randomUUID();
    await db.insert(schema.users).values({
      id,
      email,
      name: email.split("@")[0],
      passwordHash,
      role,
      tenantId: home,
    });
    await createMembership({
      userId: id,
      tenantId: home,
      role,
      status: "ACTIVE",
    });
    return id;
  }

  const superA = await makeUser(`super-a-${stamp}@pi05.test`, tenantA, "SUPER_ADMIN");
  const adminA = await makeUser(`admin-a-${stamp}@pi05.test`, tenantA, "ADMIN");
  const platformUser = await makeUser(
    `platform-${stamp}@pi05.test`,
    tenantA,
    "ADMIN",
  );

  // Catalogue isolation
  assertPass(
    "PI05-009",
    !(PERMISSIONS as readonly string[]).some((p) => p.startsWith("platform.")) &&
      PLATFORM_PERMISSIONS.includes("platform.tenants.read") &&
      PLATFORM_ROLE_PERMISSIONS.PLATFORM_SUPER_ADMIN.includes(
        "platform.tenants.read",
      ),
    "platform.* not in tenant PERMISSIONS",
  );

  // Flag OFF → empty platform axis
  delete process.env.PLATFORM_IDENTITY_ENABLED;
  const ctxOff = await buildAuthContext({
    userId: platformUser,
    claimedTenantId: tenantA,
  });
  assert.ok(ctxOff);
  assertPass(
    "PI05-001",
    ctxOff.flag.platformIdentityEnabled === false &&
      ctxOff.platform === null &&
      ctxOff.tenant?.role === "ADMIN",
    "flag OFF → platform null; tenant intact",
  );
  assertPass(
    "PI05-001b",
    (await resolvePlatformAuthz(platformUser)) === null,
    "resolvePlatformAuthz null when flag OFF",
  );

  // Enable flag — still no assignment
  process.env.PLATFORM_IDENTITY_ENABLED = "true";
  const ctxOnEmpty = await buildAuthContext({
    userId: superA,
    claimedTenantId: tenantA,
  });
  assert.ok(ctxOnEmpty);
  assertPass(
    "PI05-002",
    ctxOnEmpty.flag.platformIdentityEnabled === true &&
      ctxOnEmpty.platform !== null &&
      ctxOnEmpty.platform!.permissions.length === 0 &&
      !contextHasPlatformPermission(ctxOnEmpty, "platform.tenants.read"),
    "flag ON without assignment → deny platform",
  );

  // Tenant SUPER_ADMIN alone cannot get platform permission
  assertPass(
    "PI05-004",
    ctxOnEmpty.tenant?.role === "SUPER_ADMIN" &&
      !contextHasPlatformPermission(ctxOnEmpty, "platform.tenants.read") &&
      hasPermission(ctxOnEmpty.tenant!.role, "manage_users") === true,
    "SUPER_ADMIN tenant ≠ platform.tenants.read",
  );

  // Explicit platform assignment
  const assignment = await platformIdentity.createPlatformAssignment({
    userId: platformUser,
    role: "PLATFORM_SUPER_ADMIN",
  });
  const ctxPlat = await buildAuthContext({
    userId: platformUser,
    claimedTenantId: tenantA,
  });
  assert.ok(ctxPlat);
  assertPass(
    "PI05-003",
    contextHasPlatformPermission(ctxPlat, "platform.tenants.read") &&
      ctxPlat.platform!.roles.includes("PLATFORM_SUPER_ADMIN") &&
      ctxPlat.tenant?.role === "ADMIN",
    "ACTIVE PLATFORM_SUPER_ADMIN → platform.tenants.read",
  );

  // Revoked → deny
  await platformIdentity.revokePlatformAssignment(assignment.id);
  const ctxRevoked = await buildAuthContext({
    userId: platformUser,
    claimedTenantId: tenantA,
  });
  assert.ok(ctxRevoked);
  assertPass(
    "PI05-006",
    !contextHasPlatformPermission(ctxRevoked, "platform.tenants.read"),
    "revoked assignment → deny",
  );

  // Re-activate via status update (UNIQUE prevents second insert)
  await platformIdentity.setPlatformAssignmentStatus(assignment.id, "ACTIVE");
  const ctxActiveAgain = await buildAuthContext({
    userId: platformUser,
    claimedTenantId: tenantA,
  });
  assert.ok(ctxActiveAgain);
  assertPass(
    "PI05-006b",
    contextHasPlatformPermission(ctxActiveAgain, "platform.tenants.read"),
    "ACTIVE again after status UPDATE",
  );

  await platformIdentity.suspendPlatformAssignment(assignment.id);
  const ctxSus = await buildAuthContext({
    userId: platformUser,
    claimedTenantId: tenantA,
  });
  assert.ok(ctxSus);
  assertPass(
    "PI05-006c",
    !contextHasPlatformPermission(ctxSus, "platform.tenants.read"),
    "suspended → deny",
  );
  await platformIdentity.setPlatformAssignmentStatus(assignment.id, "ACTIVE");

  // Platform alone does not grant tenant B content
  await createContent(
    {
      type: "TEXT",
      title: `secret-b-${stamp}`,
      durationMs: 5000,
      payload: { body: "secret" },
      status: "ACTIVE",
    },
    tenantB,
  );
  const contentsAsA = await listContents(tenantA);
  assertPass(
    "PI05-005",
    !contentsAsA.some((c) => c.title === `secret-b-${stamp}`) &&
      contextHasPlatformPermission(
        (await buildAuthContext({
          userId: platformUser,
          claimedTenantId: tenantA,
        }))!,
        "platform.tenants.read",
      ),
    "platform grant ≠ tenant B content access",
  );

  // JWT shape unchanged + forgery ineffective
  const [platRow] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, platformUser))
    .limit(1);
  const session = await sessionFromUser(platRow, tenantA);
  assert.ok(session);
  const token = await createSessionToken(session);
  const claims = decodeJwt(token);
  assertPass(
    "PI05-007",
    !Object.keys(claims).some((k) => k.toLowerCase().includes("platform")) &&
      claims.role === "ADMIN",
    "JWT has no platform claims; role is tenant ADMIN",
  );
  assertPass(
    "PI05-008",
    session.role === "ADMIN" &&
      session.tenantId === tenantA &&
      !("platform" in session),
    "getSession/sessionFromUser shape unchanged",
  );

  // assertPlatformPermission throws for SUPER_ADMIN without platform
  const ctxSuper = await buildAuthContext({
    userId: superA,
    claimedTenantId: tenantA,
  });
  assert.ok(ctxSuper);
  await assert.rejects(
    async () => {
      assertPlatformPermission(ctxSuper, "platform.tenants.read");
    },
    (err: unknown) => err instanceof AuthError && err.status === 403,
  );
  assertPass("SEC-PI05-001", true, "SUPER_ADMIN without assignment → 403");

  // API stub surface
  const routePath = path.join(
    process.cwd(),
    "src",
    "app",
    "api",
    "platform",
    "tenants",
    "route.ts",
  );
  const routeSrc = fs.readFileSync(routePath, "utf8");
  assertPass(
    "PI05-010",
    routeSrc.includes("requirePlatformPermission") &&
      routeSrc.includes("platform.tenants.read") &&
      routeSrc.includes("isPlatformIdentityEnabled") &&
      !routeSrc.includes("listContents") &&
      !routeSrc.includes("listPlaylists") &&
      !/export async function POST/i.test(routeSrc),
    "GET /api/platform/tenants metadata-only stub",
  );

  // Flag OFF API returns 404 path in source
  assertPass(
    "SEC-PI05-002",
    /jsonError\(["']Not found["'],\s*404\)/.test(routeSrc),
    "flag OFF → 404 on platform API",
  );

  // Device / experience isolation
  const devicesSrc = fs.readFileSync(
    path.join(process.cwd(), "src", "services", "devices.ts"),
    "utf8",
  );
  const admitSrc = fs.readFileSync(
    path.join(
      process.cwd(),
      "src",
      "app",
      "api",
      "device",
      "experience",
      "admit",
      "route.ts",
    ),
    "utf8",
  );
  const authSrc = fs.readFileSync(
    path.join(process.cwd(), "src", "lib", "auth.ts"),
    "utf8",
  );
  assertPass(
    "SEC-PI05-003",
    !devicesSrc.includes("platform-authz") &&
      !devicesSrc.includes("requirePlatformPermission"),
    "Device Bearer not coupled to platform authz",
  );
  assertPass(
    "SEC-PI05-004",
    !admitSrc.includes("platform-authz") &&
      !admitSrc.includes("requirePlatformPermission"),
    "Experience admit not coupled to platform authz",
  );
  assertPass(
    "SEC-PI05-005",
    !authSrc.includes("platform.tenants") &&
      !authSrc.includes("getAuthContext") &&
      !authSrc.includes("platformAssignments"),
    "auth.ts / getSession untouched by platform catalogue",
  );

  // Domain hasPlatformPermission deny-by-default
  assertPass(
    "PI05-011",
    hasPlatformPermission([], "platform.tenants.read") === false &&
      hasPlatformPermission(
        ["PLATFORM_SUPER_ADMIN"],
        "platform.tenants.read",
      ) === true,
    "hasPlatformPermission deny-by-default",
  );

  // adminA still no platform
  const ctxAdmin = await buildAuthContext({
    userId: adminA,
    claimedTenantId: tenantA,
  });
  assert.ok(ctxAdmin);
  assertPass(
    "SEC-PI05-006",
    !contextHasPlatformPermission(ctxAdmin, "platform.tenants.read"),
    "tenant ADMIN ≠ platform access",
  );

  if (originalFlag === undefined) delete process.env.PLATFORM_IDENTITY_ENABLED;
  else process.env.PLATFORM_IDENTITY_ENABLED = originalFlag;

  const required = [
    "PI05-001",
    "PI05-001b",
    "PI05-002",
    "PI05-003",
    "PI05-004",
    "PI05-005",
    "PI05-006",
    "PI05-006b",
    "PI05-006c",
    "PI05-007",
    "PI05-008",
    "PI05-009",
    "PI05-010",
    "PI05-011",
    "SEC-PI05-001",
    "SEC-PI05-002",
    "SEC-PI05-003",
    "SEC-PI05-004",
    "SEC-PI05-005",
    "SEC-PI05-006",
  ];
  const passed = new Set(results.filter((r) => r.ok).map((r) => r.id));
  for (const id of required) {
    if (!passed.has(id)) {
      console.error(`MISSING/FAIL ${id}`);
      process.exitCode = 1;
    }
  }
  if (process.exitCode) {
    console.error("\nPLATFORM-IDENTITY-05B FAILED");
    process.exit(1);
  }
  console.log(`\nPLATFORM-IDENTITY-05B — ${required.length} checks PASS`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
