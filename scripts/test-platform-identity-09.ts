/**
 * PLATFORM-IDENTITY-09 — Tenant lifecycle enforcement suite (TL-I*).
 */
import assert from "node:assert/strict";
import { config } from "dotenv";
import { eq } from "drizzle-orm";
import fs from "node:fs";
import path from "node:path";

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

async function main() {
  const originalFlag = process.env.PLATFORM_IDENTITY_ENABLED;
  process.env.PLATFORM_IDENTITY_ENABLED = "true";

  const { db, ensureSchema, schema } = await import("../src/db");
  const { createTenant } = await import("../src/services/tenants");
  const { createMembership } = await import("../src/services/memberships");
  const {
    hashPassword,
    createSessionToken,
    sessionFromUser,
    getAuthSecretString,
  } = await import("../src/lib/auth");
  const { jwtVerify } = await import("jose");
  const platformIdentity = await import("../src/services/platform-identity");
  const {
    suspendTenant,
    reactivateTenant,
    isTenantOperable,
  } = await import("../src/services/tenant-lifecycle");
  const { PLATFORM_PERMISSIONS, PLATFORM_ROLE_PERMISSIONS } = await import(
    "../src/domain/platform-identity"
  );
  const { TENANT_STATUSES, isTenantOperableStatus } = await import(
    "../src/domain/tenant-lifecycle"
  );
  const { clearRateLimitBuckets } = await import("../src/lib/rate-limit");
  const { GET: getTenant } = await import(
    "../src/app/api/platform/tenants/[tenantId]/route"
  );
  const { POST: suspendPost } = await import(
    "../src/app/api/platform/tenants/[tenantId]/suspend/route"
  );
  const { POST: reactivatePost } = await import(
    "../src/app/api/platform/tenants/[tenantId]/reactivate/route"
  );
  const { authenticateDevice } = await import("../src/services/devices");
  const { hashToken, generateDeviceToken } = await import("../src/lib/auth");

  await ensureSchema();
  const stamp = Date.now().toString(36);
  const passwordHash = await hashPassword("Pi09Pass!");

  const tenantA = await createTenant({
    name: `PI09 A ${stamp}`,
    slug: `pi09-a-${stamp}`,
  });
  const tenantB = await createTenant({
    name: `PI09 B ${stamp}`,
    slug: `pi09-b-${stamp}`,
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

  const superA = await makeUser(`super-${stamp}@pi09.test`, tenantA, "SUPER_ADMIN");
  const platformUser = await makeUser(
    `plat-${stamp}@pi09.test`,
    tenantA,
    "ADMIN",
  );
  await platformIdentity.createPlatformAssignment({
    userId: platformUser,
    role: "PLATFORM_SUPER_ADMIN",
  });

  assertPass(
    "TL-I0",
    TENANT_STATUSES.includes("ACTIVE") &&
      TENANT_STATUSES.includes("SUSPENDED") &&
      isTenantOperableStatus("ACTIVE") &&
      !isTenantOperableStatus("SUSPENDED") &&
      !isTenantOperableStatus("WEIRD") &&
      PLATFORM_PERMISSIONS.includes("platform.tenants.suspend") &&
      PLATFORM_ROLE_PERMISSIONS.PLATFORM_SUPER_ADMIN.includes(
        "platform.tenants.suspend",
      ),
    "domain statuses + suspend permission",
  );

  // Session works while ACTIVE
  const [superRow] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, superA))
    .limit(1);
  let session = await sessionFromUser(superRow, tenantA);
  assertPass("TL-I1a", session?.tenantId === tenantA, "session ACTIVE ok");

  // Suspend
  const sus = await suspendTenant({
    tenantId: tenantA,
    actorUserId: platformUser,
    reason: "pi09-test",
  });
  assertPass(
    "TL-I-SUS",
    sus.status === "SUSPENDED" && sus.idempotent === false,
    "suspend ACTIVE→SUSPENDED",
  );

  // Idempotent suspend
  const sus2 = await suspendTenant({
    tenantId: tenantA,
    actorUserId: platformUser,
  });
  assertPass("TL-I6a", sus2.idempotent === true, "idempotent suspend");

  // Session denied for suspended tenant
  session = await sessionFromUser(superRow, tenantA);
  assertPass("TL-I1", session === null, "getSession/sessionFromUser denied when SUSPENDED");

  // Tenant B still operable
  assertPass(
    "TL-I1b",
    (await isTenantOperable(tenantB)) === true &&
      (await isTenantOperable(tenantA)) === false,
    "suspend is tenant-scoped",
  );

  // Device bearer: create ACTIVE device on tenantA then authenticate fails when suspended
  const deviceId = crypto.randomUUID();
  const deviceToken = generateDeviceToken();
  await db.insert(schema.devices).values({
    id: deviceId,
    tenantId: tenantA,
    status: "ACTIVE",
    name: `pi09-dev-${stamp}`,
    deviceTokenHash: hashToken(deviceToken),
    deviceTokenExpiresAt: new Date(Date.now() + 86400000).toISOString(),
  });
  const authDev = await authenticateDevice(`Bearer ${deviceToken}`);
  assertPass("TL-I2", authDev === null, "Device Bearer denied when tenant SUSPENDED");

  // Experience /x/ gate present in source
  const xSrc = fs.readFileSync(
    path.join(
      process.cwd(),
      "src/app/x/[tenantId]/[experienceId]/[version]/[[...path]]/route.ts",
    ),
    "utf8",
  );
  assertPass(
    "TL-I3",
    xSrc.includes("isTenantOperable") && xSrc.includes("TENANT_NOT_OPERABLE"),
    "Experience serve checks tenant operable",
  );

  // Platform list still returns suspended tenant
  async function cookieFor(userId: string, home: string) {
    // Need ACTIVE tenant for session cookie — use tenantB membership for platform user
    await createMembership({
      userId,
      tenantId: home,
      role: "ADMIN",
      status: "ACTIVE",
    }).catch(() => undefined);
    const [row] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);
    const s = await sessionFromUser(row, home);
    assert.ok(s, "platform user needs operable home tenant for cookie");
    return `v360_session=${await createSessionToken(s)}`;
  }

  // Give platformUser membership on B for cookie while A suspended
  const platCookie = await cookieFor(platformUser, tenantB);
  clearRateLimitBuckets();
  const getRes = await getTenant(
    new Request(`http://localhost/api/platform/tenants/${tenantA}`, {
      headers: {
        cookie: platCookie,
        "x-forwarded-for": "198.51.100.9",
      },
    }),
    { params: Promise.resolve({ tenantId: tenantA }) },
  );
  const getBody = (await getRes.json()) as {
    tenant?: { id: string; status: string };
    error?: string;
  };
  assertPass(
    "TL-I4",
    getRes.status === 200 &&
      getBody.tenant?.id === tenantA &&
      getBody.tenant?.status === "SUSPENDED",
    `platform read still returns SUSPENDED (status=${getRes.status})`,
  );

  // SUPER_ADMIN cannot call suspend API
  const superCookie = await cookieFor(superA, tenantB);
  await createMembership({
    userId: superA,
    tenantId: tenantB,
    role: "SUPER_ADMIN",
    status: "ACTIVE",
  }).catch(() => undefined);
  // re-cookie after membership
  const superCookie2 = await cookieFor(superA, tenantB);
  clearRateLimitBuckets();
  const forbidSus = await suspendPost(
    new Request(`http://localhost/api/platform/tenants/${tenantB}/suspend`, {
      method: "POST",
      headers: {
        cookie: superCookie2,
        "content-type": "application/json",
        "x-forwarded-for": "198.51.100.10",
      },
      body: "{}",
    }),
    { params: Promise.resolve({ tenantId: tenantB }) },
  );
  assertPass(
    "TL-I5",
    forbidSus.status === 403,
    "tenant SUPER_ADMIN cannot suspend via platform API",
  );

  // Reactivate + session works again
  const rea = await reactivateTenant({
    tenantId: tenantA,
    actorUserId: platformUser,
  });
  assertPass("TL-I-REA", rea.status === "ACTIVE", "reactivate");
  const rea2 = await reactivateTenant({
    tenantId: tenantA,
    actorUserId: platformUser,
  });
  assertPass("TL-I6b", rea2.idempotent === true, "idempotent reactivate");

  session = await sessionFromUser(superRow, tenantA);
  assertPass(
    "TL-I1c",
    session?.tenantId === tenantA,
    "session restored after reactivate",
  );

  const authDev2 = await authenticateDevice(`Bearer ${deviceToken}`);
  assertPass(
    "TL-I2b",
    authDev2?.id === deviceId,
    "Device Bearer restored after reactivate",
  );

  // Audit rows exist
  const logs = await db
    .select()
    .from(schema.activityLogs)
    .where(eq(schema.activityLogs.resourceId, tenantA));
  assertPass(
    "TL-I7",
    logs.some((l) => l.action === "platform.tenant.suspend") &&
      logs.some((l) => l.action === "platform.tenant.reactivate"),
    "audit log for suspend/reactivate",
  );

  // Flag OFF → suspend route 404
  delete process.env.PLATFORM_IDENTITY_ENABLED;
  clearRateLimitBuckets();
  const off = await suspendPost(
    new Request(`http://localhost/api/platform/tenants/${tenantB}/suspend`, {
      method: "POST",
      headers: {
        cookie: platCookie,
        "content-type": "application/json",
        "x-forwarded-for": "198.51.100.11",
      },
      body: "{}",
    }),
    { params: Promise.resolve({ tenantId: tenantB }) },
  );
  assertPass("TL-I8", off.status === 404, "flag OFF → lifecycle API 404");
  process.env.PLATFORM_IDENTITY_ENABLED = "true";

  // No delete route
  assertPass(
    "TL-I9",
    !fs.existsSync(
      path.join(
        process.cwd(),
        "src/app/api/platform/tenants/[tenantId]/delete",
      ),
    ),
    "no hard delete API",
  );

  // JWT does not carry tenant status — revalidation required
  const token = await createSessionToken(session!);
  const { payload } = await jwtVerify(
    token,
    new TextEncoder().encode(getAuthSecretString()),
  );
  assertPass(
    "TL-I10",
    !("tenantStatus" in payload) &&
      !Object.keys(payload).some((k) => k.toLowerCase().includes("suspend")),
    "JWT has no tenant status claims",
  );

  // HTTP suspend by platform user
  clearRateLimitBuckets();
  const httpSus = await suspendPost(
    new Request(`http://localhost/api/platform/tenants/${tenantB}/suspend`, {
      method: "POST",
      headers: {
        cookie: platCookie,
        "content-type": "application/json",
        "x-forwarded-for": "198.51.100.12",
      },
      body: JSON.stringify({ reason: "http" }),
    }),
    { params: Promise.resolve({ tenantId: tenantB }) },
  );
  const httpBody = (await httpSus.json()) as { tenant?: { status: string } };
  assertPass(
    "TL-I-HTTP",
    httpSus.status === 200 && httpBody.tenant?.status === "SUSPENDED",
    "HTTP suspend 200",
  );
  clearRateLimitBuckets();
  await reactivatePost(
    new Request(
      `http://localhost/api/platform/tenants/${tenantB}/reactivate`,
      {
        method: "POST",
        headers: {
          cookie: platCookie,
          "content-type": "application/json",
          "x-forwarded-for": "198.51.100.12",
        },
        body: "{}",
      },
    ),
    { params: Promise.resolve({ tenantId: tenantB }) },
  );

  if (originalFlag === undefined) delete process.env.PLATFORM_IDENTITY_ENABLED;
  else process.env.PLATFORM_IDENTITY_ENABLED = originalFlag;

  const required = [
    "TL-I0",
    "TL-I1a",
    "TL-I-SUS",
    "TL-I6a",
    "TL-I1",
    "TL-I1b",
    "TL-I2",
    "TL-I3",
    "TL-I4",
    "TL-I5",
    "TL-I-REA",
    "TL-I6b",
    "TL-I1c",
    "TL-I2b",
    "TL-I7",
    "TL-I8",
    "TL-I9",
    "TL-I10",
    "TL-I-HTTP",
  ];
  const passed = new Set(results.filter((r) => r.ok).map((r) => r.id));
  for (const id of required) {
    if (!passed.has(id)) {
      console.error(`MISSING ${id}`);
      process.exitCode = 1;
    }
  }
  if (process.exitCode) process.exit(1);
  console.log(`\nPLATFORM-IDENTITY-09 — ${required.length} checks PASS`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
