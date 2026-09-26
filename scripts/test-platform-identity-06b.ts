/**
 * PLATFORM-IDENTITY-06B — Platform Tenants API hardening suite.
 * Pagination, query validation, GET by id, HTTP+cookie authz, rate limit, allowlist.
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
  delete process.env.PLATFORM_IDENTITY_ENABLED;

  const { db, ensureSchema, schema } = await import("../src/db");
  const { createTenant } = await import("../src/services/tenants");
  const { createMembership } = await import("../src/services/memberships");
  const { hashPassword, createSessionToken, sessionFromUser } = await import(
    "../src/lib/auth"
  );
  const platformIdentity = await import("../src/services/platform-identity");
  const {
    listPlatformTenantsMetadata,
    getPlatformTenantMetadata,
    parsePlatformTenantsListQuery,
    PLATFORM_TENANTS_MAX_LIMIT,
    encodePlatformTenantsCursor,
  } = await import("../src/services/platform-tenants");
  const { clearRateLimitBuckets } = await import("../src/lib/rate-limit");
  const { GET: listGet } = await import(
    "../src/app/api/platform/tenants/route"
  );
  const { GET: itemGet } = await import(
    "../src/app/api/platform/tenants/[tenantId]/route"
  );

  await ensureSchema();
  const stamp = Date.now().toString(36);
  const passwordHash = await hashPassword("Pi06bPass!");

  const tenantIds: string[] = [];
  for (let i = 0; i < 5; i++) {
    tenantIds.push(
      await createTenant({
        name: `PI06B ${stamp} ${i}`,
        slug: `pi06b-${stamp}-${i}`,
      }),
    );
  }
  const home = tenantIds[0]!;

  async function makeUser(
    email: string,
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

  const superUser = await makeUser(`super-${stamp}@pi06b.test`, "SUPER_ADMIN");
  const platformUser = await makeUser(`plat-${stamp}@pi06b.test`, "ADMIN");

  process.env.PLATFORM_IDENTITY_ENABLED = "true";
  await platformIdentity.createPlatformAssignment({
    userId: platformUser,
    role: "PLATFORM_SUPER_ADMIN",
  });

  // --- Query validation ---
  const badLimit = parsePlatformTenantsListQuery(
    new URL("http://x/api/platform/tenants?limit=0"),
  );
  assertPass("PI06B-001", !badLimit.ok, "limit=0 rejected");

  const overLimit = parsePlatformTenantsListQuery(
    new URL(`http://x/api/platform/tenants?limit=${PLATFORM_TENANTS_MAX_LIMIT + 1}`),
  );
  assertPass("PI06B-002", !overLimit.ok, "limit > max rejected");

  const badCursor = parsePlatformTenantsListQuery(
    new URL("http://x/api/platform/tenants?cursor=%%%"),
  );
  assertPass("PI06B-003", !badCursor.ok, "invalid cursor rejected");

  const unknownQ = parsePlatformTenantsListQuery(
    new URL("http://x/api/platform/tenants?foo=1"),
  );
  assertPass("PI06B-004", !unknownQ.ok, "unknown query param rejected");

  const okQ = parsePlatformTenantsListQuery(
    new URL("http://x/api/platform/tenants?limit=2"),
  );
  assertPass("PI06B-005", okQ.ok && okQ.ok && okQ.limit === 2, "valid limit accepted");

  // --- Pagination ---
  const page1 = await listPlatformTenantsMetadata({ limit: 2 });
  assertPass(
    "PI06B-006",
    page1.tenants.length === 2 &&
      page1.page.hasMore === true &&
      typeof page1.page.nextCursor === "string",
    "first page has cursor",
  );
  const page2 = await listPlatformTenantsMetadata({
    limit: 2,
    cursor: page1.page.nextCursor
      ? JSON.parse(
          Buffer.from(page1.page.nextCursor, "base64url").toString("utf8"),
        )
      : null,
  });
  assertPass(
    "PI06B-007",
    page2.tenants.length >= 1 &&
      page2.tenants[0]!.id !== page1.tenants[0]!.id,
    "cursor advances without overlap of first item",
  );

  // Allowlist fields only
  const keys = Object.keys(page1.tenants[0]!).sort();
  assertPass(
    "PI06B-008",
    keys.join(",") === "createdAt,id,name,slug,status",
    "metadata allowlist only",
  );

  // GET by id
  const one = await getPlatformTenantMetadata(home);
  assertPass("PI06B-009", one?.id === home, "get by id");
  assertPass(
    "PI06B-010",
    (await getPlatformTenantMetadata("../etc/passwd")) === null,
    "path-like id rejected",
  );
  assertPass(
    "PI06B-011",
    (await getPlatformTenantMetadata("missing-id-zzzz")) === null,
    "missing id → null",
  );

  // --- Session cookies for HTTP handler tests ---
  async function cookieFor(userId: string) {
    const [row] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);
    const session = await sessionFromUser(row, home);
    assert.ok(session);
    const token = await createSessionToken(session);
    return `v360_session=${token}`;
  }

  const platCookie = await cookieFor(platformUser);
  const superCookie = await cookieFor(superUser);

  clearRateLimitBuckets();

  // Flag OFF → 404
  delete process.env.PLATFORM_IDENTITY_ENABLED;
  const offRes = await listGet(
    new Request("http://localhost/api/platform/tenants", {
      headers: { cookie: platCookie },
    }),
  );
  assertPass("PI06B-012", offRes.status === 404, "flag OFF → 404");
  process.env.PLATFORM_IDENTITY_ENABLED = "true";

  // 401 no cookie
  clearRateLimitBuckets();
  const unauth = await listGet(
    new Request("http://localhost/api/platform/tenants"),
  );
  assertPass("PI06B-013", unauth.status === 401, "no cookie → 401");

  // 403 SUPER_ADMIN without platform
  clearRateLimitBuckets();
  const forbidden = await listGet(
    new Request("http://localhost/api/platform/tenants", {
      headers: { cookie: superCookie },
    }),
  );
  assertPass(
    "PI06B-014",
    forbidden.status === 403,
    "tenant SUPER_ADMIN → 403",
  );

  // 200 platform user + contract shape
  clearRateLimitBuckets();
  const okRes = await listGet(
    new Request("http://localhost/api/platform/tenants?limit=3", {
      headers: { cookie: platCookie },
    }),
  );
  const okBody = (await okRes.json()) as {
    tenants: Record<string, unknown>[];
    page: { limit: number; nextCursor: string | null; hasMore: boolean };
    error?: string;
  };
  assertPass(
    "PI06B-015",
    okRes.status === 200 &&
      Array.isArray(okBody.tenants) &&
      okBody.page.limit === 3 &&
      typeof okBody.page.hasMore === "boolean",
    "200 list contract",
  );
  assertPass(
    "PI06B-016",
    okBody.tenants.every(
      (t) =>
        Object.keys(t).sort().join(",") === "createdAt,id,name,slug,status",
    ),
    "HTTP response allowlist",
  );
  assertPass(
    "PI06B-017",
    !JSON.stringify(okBody).includes("password") &&
      !JSON.stringify(okBody).includes("deviceToken") &&
      !JSON.stringify(okBody).includes("playlist"),
    "no sensitive fields in body",
  );

  // bad query → 400
  clearRateLimitBuckets();
  const badRes = await listGet(
    new Request("http://localhost/api/platform/tenants?limit=abc", {
      headers: { cookie: platCookie },
    }),
  );
  assertPass("PI06B-018", badRes.status === 400, "malformed limit → 400");

  // GET by id HTTP
  clearRateLimitBuckets();
  const itemOk = await itemGet(
    new Request(`http://localhost/api/platform/tenants/${home}`, {
      headers: { cookie: platCookie },
    }),
    { params: Promise.resolve({ tenantId: home }) },
  );
  const itemBody = (await itemOk.json()) as {
    tenant: { id: string };
  };
  assertPass(
    "PI06B-019",
    itemOk.status === 200 && itemBody.tenant.id === home,
    "GET by id 200",
  );

  clearRateLimitBuckets();
  const item404 = await itemGet(
    new Request("http://localhost/api/platform/tenants/does-not-exist", {
      headers: { cookie: platCookie },
    }),
    { params: Promise.resolve({ tenantId: "does-not-exist" }) },
  );
  assertPass("PI06B-020", item404.status === 404, "GET by id missing → 404");

  clearRateLimitBuckets();
  const itemForbidden = await itemGet(
    new Request(`http://localhost/api/platform/tenants/${home}`, {
      headers: { cookie: superCookie },
    }),
    { params: Promise.resolve({ tenantId: home }) },
  );
  assertPass(
    "PI06B-021",
    itemForbidden.status === 403,
    "GET by id SUPER_ADMIN → 403",
  );

  // Device Bearer cannot use list
  clearRateLimitBuckets();
  const bearer = await listGet(
    new Request("http://localhost/api/platform/tenants", {
      headers: { Authorization: "Bearer device-token-fake" },
    }),
  );
  assertPass("PI06B-022", bearer.status === 401, "Device Bearer → 401");

  // Rate limit
  clearRateLimitBuckets();
  let hit429 = false;
  for (let i = 0; i < 65; i++) {
    const r = await listGet(
      new Request("http://localhost/api/platform/tenants?limit=1", {
        headers: {
          cookie: platCookie,
          "x-forwarded-for": "203.0.113.50",
        },
      }),
    );
    if (r.status === 429) {
      hit429 = true;
      break;
    }
  }
  assertPass("PI06B-023", hit429, "rate limit returns 429");

  // Enumeration: cursor pagination does not return duplicates across two pages
  clearRateLimitBuckets();
  // Need fresh rate limit IP
  const enum1 = await listGet(
    new Request("http://localhost/api/platform/tenants?limit=2", {
      headers: {
        cookie: platCookie,
        "x-forwarded-for": "203.0.113.60",
      },
    }),
  );
  const enum1Body = (await enum1.json()) as {
    tenants: { id: string }[];
    page: { nextCursor: string | null };
  };
  const enum2 = await listGet(
    new Request(
      `http://localhost/api/platform/tenants?limit=2&cursor=${enum1Body.page.nextCursor}`,
      {
        headers: {
          cookie: platCookie,
          "x-forwarded-for": "203.0.113.60",
        },
      },
    ),
  );
  const enum2Body = (await enum2.json()) as { tenants: { id: string }[] };
  const ids = new Set([
    ...enum1Body.tenants.map((t) => t.id),
    ...enum2Body.tenants.map((t) => t.id),
  ]);
  assertPass(
    "PI06B-024",
    enum1.status === 200 &&
      enum2.status === 200 &&
      ids.size === enum1Body.tenants.length + enum2Body.tenants.length,
    "cursor pages do not duplicate ids",
  );

  // No POST handlers
  const listSrc = fs.readFileSync(
    path.join(process.cwd(), "src/app/api/platform/tenants/route.ts"),
    "utf8",
  );
  const itemSrc = fs.readFileSync(
    path.join(
      process.cwd(),
      "src/app/api/platform/tenants/[tenantId]/route.ts",
    ),
    "utf8",
  );
  assertPass(
    "PI06B-025",
    !/export async function (POST|PATCH|PUT|DELETE)/.test(listSrc) &&
      !/export async function (POST|PATCH|PUT|DELETE)/.test(itemSrc),
    "read-only methods only",
  );

  // Cursor encode roundtrip used by service
  const enc = encodePlatformTenantsCursor({
    createdAt: "2020-01-01 00:00:00",
    id: "abc",
  });
  assertPass("PI06B-026", enc.length > 0 && !enc.includes("{"), "cursor opaque");

  if (originalFlag === undefined) delete process.env.PLATFORM_IDENTITY_ENABLED;
  else process.env.PLATFORM_IDENTITY_ENABLED = originalFlag;

  const required = [
    "PI06B-001",
    "PI06B-002",
    "PI06B-003",
    "PI06B-004",
    "PI06B-005",
    "PI06B-006",
    "PI06B-007",
    "PI06B-008",
    "PI06B-009",
    "PI06B-010",
    "PI06B-011",
    "PI06B-012",
    "PI06B-013",
    "PI06B-014",
    "PI06B-015",
    "PI06B-016",
    "PI06B-017",
    "PI06B-018",
    "PI06B-019",
    "PI06B-020",
    "PI06B-021",
    "PI06B-022",
    "PI06B-023",
    "PI06B-024",
    "PI06B-025",
    "PI06B-026",
  ];
  const passed = new Set(results.filter((r) => r.ok).map((r) => r.id));
  for (const id of required) {
    if (!passed.has(id)) {
      console.error(`MISSING/FAIL ${id}`);
      process.exitCode = 1;
    }
  }
  if (process.exitCode) {
    console.error("\nPLATFORM-IDENTITY-06B FAILED");
    process.exit(1);
  }
  console.log(`\nPLATFORM-IDENTITY-06B — ${required.length} checks PASS`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
