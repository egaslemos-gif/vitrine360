/**
 * PLATFORM-IDENTITY-04 — Schema + Platform Identity foundation suite.
 * PI04-001…025 + SEC-PI04-001…010
 */
import assert from "node:assert/strict";
import { config } from "dotenv";
import { eq, sql } from "drizzle-orm";
import fs from "node:fs";
import path from "node:path";
import { decodeJwt } from "jose";

config({ path: ".env.local" });
config({ path: ".env" });

type Result = { id: string; ok: boolean; detail?: string };
const results: Result[] = [];

function record(id: string, ok: boolean, detail?: string) {
  results.push({ id, ok, detail });
  const mark = ok ? "PASS" : "FAIL";
  console.log(`${mark} ${id}${detail ? ` — ${detail}` : ""}`);
}

function assertPass(id: string, cond: boolean, detail?: string) {
  record(id, cond, detail);
  if (!cond) throw new Error(`${id} failed${detail ? `: ${detail}` : ""}`);
}

async function main() {
  const originalFlag = process.env.PLATFORM_IDENTITY_ENABLED;
  delete process.env.PLATFORM_IDENTITY_ENABLED;

  const { isPlatformIdentityEnabled, resolvePlatformIdentityFlagFromTrustedEnvOnly } =
    await import("../src/lib/platform-identity-flag");
  const { db, ensureSchema, schema } = await import("../src/db");
  const { createTenant } = await import("../src/services/tenants");
  const { createMembership } = await import("../src/services/memberships");
  const { hashPassword, createSessionToken, authenticateUser, sessionFromUser } =
    await import("../src/lib/auth");
  const { USER_ROLES, hasPermission } = await import("../src/domain/types");
  const {
    PLATFORM_ROLES,
    isPlatformRole,
    tenantRoleIsNotPlatformRole,
  } = await import("../src/domain/platform-identity");
  const platformIdentity = await import("../src/services/platform-identity");
  const { PlatformIdentityError } = platformIdentity;

  // --- PI04-003 flag defaults false ---
  assertPass(
    "PI04-003",
    isPlatformIdentityEnabled() === false &&
      isPlatformIdentityEnabled({}) === false &&
      isPlatformIdentityEnabled({ PLATFORM_IDENTITY_ENABLED: "" }) === false &&
      isPlatformIdentityEnabled({ PLATFORM_IDENTITY_ENABLED: "false" }) === false,
    "undefined/empty/false → disabled",
  );

  // --- Schema migration via ensureSchema ---
  await ensureSchema();
  const tables = await db.all<{ name: string }>(
    sql`SELECT name FROM sqlite_master WHERE type='table' AND name='platform_assignments'`,
  );
  assertPass(
    "PI04-001",
    tables.length === 1,
    "platform_assignments exists after ensureSchema",
  );

  const idx = await db.all<{ name: string }>(
    sql`SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='platform_assignments'`,
  );
  const idxNames = idx.map((r) => String(r.name));
  assertPass(
    "PI04-002",
    idxNames.includes("platform_assignments_user_role_uidx") &&
      idxNames.includes("platform_assignments_user_idx"),
    "indexes present; existing DB still valid",
  );

  // Migration file additive
  const migPath = path.join(
    process.cwd(),
    "drizzle",
    "0006_platform_identity.sql",
  );
  const migSql = fs.readFileSync(migPath, "utf8");
  assertPass(
    "PI04-024",
    migSql.includes("CREATE TABLE IF NOT EXISTS") &&
      !/DROP TABLE|DELETE FROM memberships|UPDATE memberships/i.test(migSql) &&
      !/SUPER_ADMIN/i.test(migSql),
    "migration additive; no membership backfill",
  );

  const rollbackDoc = fs.readFileSync(
    path.join(
      process.cwd(),
      "docs",
      "evidence",
      "platform-identity-04",
      "MIGRATION-RESULT.md",
    ),
    "utf8",
  );
  assertPass(
    "PI04-025",
    /rollback/i.test(rollbackDoc) && /DROP TABLE/i.test(rollbackDoc),
    "rollback strategy documented",
  );

  // Fixtures: User A SUPER_ADMIN Tenant A; B ADMIN Tenant A; C SUPER_ADMIN Tenant B
  const stamp = Date.now().toString(36);
  const passwordHash = await hashPassword("Pi04TestPass!");
  const tenantA = await createTenant({
    name: `PI04 A ${stamp}`,
    slug: `pi04-a-${stamp}`,
  });
  const tenantB = await createTenant({
    name: `PI04 B ${stamp}`,
    slug: `pi04-b-${stamp}`,
  });

  async function makeUser(
    email: string,
    home: string,
    role: "SUPER_ADMIN" | "ADMIN",
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

  const userA = await makeUser(`a-${stamp}@pi04.test`, tenantA, "SUPER_ADMIN");
  const userB = await makeUser(`b-${stamp}@pi04.test`, tenantA, "ADMIN");
  const userC = await makeUser(`c-${stamp}@pi04.test`, tenantB, "SUPER_ADMIN");

  // No automatic promotion after migration
  const countA = await db
    .select()
    .from(schema.platformAssignments)
    .where(eq(schema.platformAssignments.userId, userA));
  const countB = await db
    .select()
    .from(schema.platformAssignments)
    .where(eq(schema.platformAssignments.userId, userB));
  const countC = await db
    .select()
    .from(schema.platformAssignments)
    .where(eq(schema.platformAssignments.userId, userC));

  assertPass("PI04-006", countA.length === 0, "SUPER_ADMIN A has no platform row");
  assertPass("PI04-007", countA.length === 0 && countC.length === 0, "no SUPER_ADMIN→Platform migration");
  assertPass(
    "PI04-017",
    countB.length === 0,
    "ADMIN membership unchanged / no platform row",
  );

  const memA = await db
    .select()
    .from(schema.memberships)
    .where(eq(schema.memberships.userId, userA));
  assertPass(
    "PI04-018",
    memA.length === 1 &&
      memA[0].role === "SUPER_ADMIN" &&
      memA[0].tenantId === tenantA,
    "tenant membership isolation unchanged",
  );

  // Role distinctness
  assertPass(
    "PI04-008",
    !USER_ROLES.includes("PLATFORM_SUPER_ADMIN" as never) &&
      isPlatformRole("PLATFORM_SUPER_ADMIN") &&
      !isPlatformRole("SUPER_ADMIN") &&
      tenantRoleIsNotPlatformRole("SUPER_ADMIN") &&
      PLATFORM_ROLES[0] === "PLATFORM_SUPER_ADMIN",
    "Platform role ≠ Tenant SUPER_ADMIN",
  );

  // Flag false → repository disabled
  delete process.env.PLATFORM_IDENTITY_ENABLED;
  await assert.rejects(
    () =>
      platformIdentity.createPlatformAssignment({
        userId: userA,
        role: "PLATFORM_SUPER_ADMIN",
      }),
    (err: unknown) =>
      err instanceof PlatformIdentityError && err.code === "DISABLED",
  );
  assertPass("PI04-004", true, "flag false: create rejected (DISABLED)");
  assertPass("SEC-PI04-010", true, "disabled flag does not expose create");

  // Enable infrastructure
  process.env.PLATFORM_IDENTITY_ENABLED = "true";
  assertPass(
    "PI04-005",
    isPlatformIdentityEnabled() === true,
    "flag true enables infrastructure only",
  );

  // Explicit TEST PLATFORM ADMIN (not seed admin)
  const platformUserId = await makeUser(
    `platform-admin-${stamp}@pi04.test`,
    tenantA,
    "ADMIN",
  );
  // Clear any confusion: this user is ADMIN tenant + explicit platform assignment
  const created = await platformIdentity.createPlatformAssignment({
    userId: platformUserId,
    role: "PLATFORM_SUPER_ADMIN",
    createdByUserId: null,
  });
  assertPass(
    "PI04-009",
    created.role === "PLATFORM_SUPER_ADMIN" &&
      created.status === "ACTIVE" &&
      created.userId === platformUserId,
    "platform assignment created",
  );

  const active = await platformIdentity.findActiveByUser(platformUserId);
  assertPass("PI04-016", active.length === 1, "active assignment retrieved");

  // Duplicate rejected
  await assert.rejects(
    () =>
      platformIdentity.createPlatformAssignment({
        userId: platformUserId,
        role: "PLATFORM_SUPER_ADMIN",
      }),
    (err: unknown) =>
      err instanceof PlatformIdentityError && err.code === "DUPLICATE",
  );
  assertPass("PI04-010", true, "duplicate semantic assignment rejected");

  // Invalid role
  await assert.rejects(
    () =>
      platformIdentity.createPlatformAssignment({
        userId: userA,
        role: "SUPER_ADMIN" as never,
      }),
    (err: unknown) =>
      err instanceof PlatformIdentityError && err.code === "INVALID_ROLE",
  );
  assertPass("PI04-011", true, "invalid role rejected");

  // Invalid status
  await assert.rejects(
    () =>
      platformIdentity.createPlatformAssignment({
        userId: userB,
        role: "PLATFORM_SUPER_ADMIN",
        status: "INVITED" as never,
      }),
    (err: unknown) =>
      err instanceof PlatformIdentityError && err.code === "INVALID_STATUS",
  );
  assertPass("PI04-012", true, "invalid status rejected");

  // Missing user
  await assert.rejects(
    () =>
      platformIdentity.createPlatformAssignment({
        userId: "00000000-0000-0000-0000-000000000000",
        role: "PLATFORM_SUPER_ADMIN",
      }),
    (err: unknown) =>
      err instanceof PlatformIdentityError && err.code === "MISSING_USER",
  );
  assertPass("PI04-013", true, "missing user rejected");

  // Revoked / suspended not active
  const revTarget = await platformIdentity.createPlatformAssignment({
    userId: userB,
    role: "PLATFORM_SUPER_ADMIN",
  });
  await platformIdentity.revokePlatformAssignment(revTarget.id);
  const afterRevoke = await platformIdentity.findActiveByUser(userB);
  assertPass("PI04-014", afterRevoke.length === 0, "revoked not active");

  // Unique(user,role) means we update status rather than insert second — create again fails
  // So suspend path: create for userC, then suspend
  const susTarget = await platformIdentity.createPlatformAssignment({
    userId: userC,
    role: "PLATFORM_SUPER_ADMIN",
  });
  await platformIdentity.suspendPlatformAssignment(susTarget.id);
  const afterSus = await platformIdentity.findActiveByUser(userC);
  assertPass("PI04-015", afterSus.length === 0, "suspended not active");

  // Flag true does NOT grant platform access via tenant RBAC / session
  const [platformUserRow] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, platformUserId))
    .limit(1);
  const sessionUser = await sessionFromUser(platformUserRow, tenantA);
  assert.ok(sessionUser);
  assertPass(
    "PI04-005b",
    sessionUser.role === "ADMIN" &&
      !("platformRole" in sessionUser) &&
      hasPermission(sessionUser.role, "manage_users") === true,
    "flag+assignment does not change session role to platform",
  );
  // Re-assert PI04-005 formally
  assertPass(
    "PI04-005",
    String(sessionUser.role) !== "PLATFORM_SUPER_ADMIN",
    "enabled ≠ platform access granted via session",
  );

  // JWT shape unchanged
  const token = await createSessionToken(sessionUser);
  const claims = decodeJwt(token);
  const claimKeys = Object.keys(claims).sort();
  assertPass(
    "PI04-020",
    !claimKeys.some((k) => k.toLowerCase().includes("platform")) &&
      claims.sub === platformUserId &&
      typeof claims.role === "string" &&
      typeof claims.tenantId === "string",
    "JWT has no platform* claims",
  );
  assertPass("SEC-PI04-009", true, "JWT unchanged");

  // Session / login behaviour
  assertPass(
    "PI04-021",
    sessionUser.id === platformUserId && sessionUser.activeTenantId === tenantA,
    "session behaviour unchanged shape",
  );

  const auth = await authenticateUser(`a-${stamp}@pi04.test`, "Pi04TestPass!");
  assert.ok(auth);
  assertPass(
    "PI04-022",
    auth.id === userA && auth.role === "SUPER_ADMIN",
    "login still yields tenant SUPER_ADMIN",
  );

  // Seed behaviour: admin@vitrine360.local must not gain platform via schema
  const [seedAdmin] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, "admin@vitrine360.local"))
    .limit(1);
  if (seedAdmin) {
    const seedPlat = await db
      .select()
      .from(schema.platformAssignments)
      .where(eq(schema.platformAssignments.userId, seedAdmin.id));
    assertPass(
      "PI04-023",
      seedPlat.length === 0 && seedAdmin.role === "SUPER_ADMIN",
      "seed admin remains tenant SUPER_ADMIN only",
    );
  } else {
    assertPass(
      "PI04-023",
      true,
      "seed admin absent in this DB; seed script untouched",
    );
  }

  // Device bearer unchanged — module does not import platform-identity
  const devicesSrc = fs.readFileSync(
    path.join(process.cwd(), "src", "services", "devices.ts"),
    "utf8",
  );
  assertPass(
    "PI04-019",
    !devicesSrc.includes("platform-identity") &&
      !devicesSrc.includes("platformAssignments"),
    "Device Bearer module untouched by Platform Identity",
  );

  // --- Security ---
  assertPass(
    "SEC-PI04-001",
    resolvePlatformIdentityFlagFromTrustedEnvOnly("true", {
      PLATFORM_IDENTITY_ENABLED: "false",
    }) === false &&
      resolvePlatformIdentityFlagFromTrustedEnvOnly(
        { PLATFORM_IDENTITY_ENABLED: "true" },
        {},
      ) === false,
    "request-derived values cannot override flag",
  );

  // No Platform Identity self-create API (GET tenants stub is authz-only; no POST create)
  const apiPlatform = path.join(process.cwd(), "src", "app", "api", "platform");
  const createRoutes = ["assignments", "identity", "roles"].filter((seg) =>
    fs.existsSync(path.join(apiPlatform, seg)),
  );
  const tenantsRoute = path.join(apiPlatform, "tenants", "route.ts");
  const tenantsSrc = fs.existsSync(tenantsRoute)
    ? fs.readFileSync(tenantsRoute, "utf8")
    : "";
  assertPass(
    "SEC-PI04-002",
    createRoutes.length === 0 &&
      !/export async function POST/i.test(tenantsSrc) &&
      !tenantsSrc.includes("createPlatformAssignment"),
    "no Platform Identity self-create API",
  );

  // SUPER_ADMIN cannot self-promote (no API; create requires server call with valid role — tenant role rejected)
  await assert.rejects(
    () =>
      platformIdentity.createPlatformAssignment({
        userId: userA,
        role: "SUPER_ADMIN" as never,
      }),
    (err: unknown) =>
      err instanceof PlatformIdentityError && err.code === "INVALID_ROLE",
  );
  const stillNone = await platformIdentity.findByUser(userA);
  assertPass(
    "SEC-PI04-003",
    stillNone.length === 0,
    "SUPER_ADMIN cannot self-promote via tenant role name",
  );

  await assert.rejects(
    () =>
      platformIdentity.createPlatformAssignment({
        userId: userA,
        role: "PLATFORM_SUPER_ADMIN",
        tenantId: tenantA,
      }),
    (err: unknown) =>
      err instanceof PlatformIdentityError &&
      err.code === "TENANT_SCOPE_FORBIDDEN",
  );
  assertPass("SEC-PI04-004", true, "tenantId cannot create Platform scope");

  // Platform identity does not grant tenant access automatically
  const memPlatformOnly = await db
    .select()
    .from(schema.memberships)
    .where(eq(schema.memberships.userId, platformUserId));
  assertPass(
    "SEC-PI04-005",
    memPlatformOnly.every((m) => m.tenantId === tenantA) &&
      !memPlatformOnly.some((m) => m.tenantId === tenantB),
    "platform assignment does not add Tenant B membership",
  );

  // Tenant membership does not grant Platform
  assertPass(
    "SEC-PI04-006",
    (await platformIdentity.findActiveByUser(userA)).length === 0,
    "tenant SUPER_ADMIN has no active platform assignment",
  );

  // Device Bearer / Experience cannot create platform identity — no imports
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
  assertPass(
    "SEC-PI04-007",
    !devicesSrc.includes("createPlatformAssignment"),
    "Device Bearer path cannot create Platform identity",
  );
  assertPass(
    "SEC-PI04-008",
    !admitSrc.includes("platform-identity") &&
      !admitSrc.includes("platformAssignments"),
    "Experience admit cannot access Platform identity",
  );

  // Restore env
  if (originalFlag === undefined) delete process.env.PLATFORM_IDENTITY_ENABLED;
  else process.env.PLATFORM_IDENTITY_ENABLED = originalFlag;

  const failed = results.filter((r) => !r.ok);
  // Deduplicate PI04-005 recorded twice — both must pass
  const required = [
    "PI04-001",
    "PI04-002",
    "PI04-003",
    "PI04-004",
    "PI04-005",
    "PI04-006",
    "PI04-007",
    "PI04-008",
    "PI04-009",
    "PI04-010",
    "PI04-011",
    "PI04-012",
    "PI04-013",
    "PI04-014",
    "PI04-015",
    "PI04-016",
    "PI04-017",
    "PI04-018",
    "PI04-019",
    "PI04-020",
    "PI04-021",
    "PI04-022",
    "PI04-023",
    "PI04-024",
    "PI04-025",
    "SEC-PI04-001",
    "SEC-PI04-002",
    "SEC-PI04-003",
    "SEC-PI04-004",
    "SEC-PI04-005",
    "SEC-PI04-006",
    "SEC-PI04-007",
    "SEC-PI04-008",
    "SEC-PI04-009",
    "SEC-PI04-010",
  ];
  const passedIds = new Set(results.filter((r) => r.ok).map((r) => r.id));
  for (const id of required) {
    if (!passedIds.has(id)) {
      console.error(`MISSING/FAIL ${id}`);
      process.exitCode = 1;
    }
  }
  if (failed.length || process.exitCode) {
    console.error(`\nPLATFORM-IDENTITY-04 tests FAILED (${failed.length})`);
    process.exit(1);
  }
  console.log(`\nPLATFORM-IDENTITY-04 — ${required.length} checks PASS`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
