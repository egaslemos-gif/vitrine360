/**
 * PI-10P — Controlled Production cohort expansion for authorized tenant only.
 * Auth: admin@vitrine360.local → tenant slug=demo
 * Reuses entitlement defs. Creates cohort plan sized above current usage.
 * Flag unchanged. No schema change. No secrets printed.
 */
import { config } from "dotenv";
import { createClient } from "@libsql/client";
import { and, eq } from "drizzle-orm";

const PRODUCTION_HOST =
  "vitrine360-vercel-icfg-rd8hoku6p0oaszo88ixdwcu4.aws-us-east-1.turso.io";
const PREVIEW_HOST = "vitrine360-preview-elemos.aws-us-west-2.turso.io";
const AUTH_EMAIL = "admin@vitrine360.local";
const COHORT_SLUG = "demo";
const PILOT_SLUG = "egaslemos";
const COHORT_PLAN_KEY = "pi10p_production_cohort_demo";

/** Conservative floors: demo has 5 paired devices, ~44.9 MiB committed. */
const DEVICES_MAX = 10;
const STORAGE_MAX_BYTES = 100 * 1024 * 1024; // 100 MiB

function hostOf(url: string): string {
  try {
    return new URL(url.includes("://") ? url : `libsql://${url}`).hostname;
  } catch {
    return "";
  }
}

function resolveProdUrl() {
  config({ path: ".env.local" });
  const dbUrl = process.env.DATABASE_URL || "";
  const tursoUrl = process.env.TURSO_DATABASE_URL || "";
  let url = "";
  if (tursoUrl && hostOf(tursoUrl) === PRODUCTION_HOST) {
    url = tursoUrl.startsWith("libsql://") ? tursoUrl : `libsql://${tursoUrl}`;
  } else if (dbUrl.startsWith("libsql://") || dbUrl.startsWith("https://")) {
    url = dbUrl;
  }
  const token =
    process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN || "";
  return { url, token, host: hostOf(url) };
}

async function main() {
  const { url, token, host } = resolveProdUrl();
  console.log("PI-10P Production controlled cohort expansion");
  console.log(`auth_email=${AUTH_EMAIL}`);
  console.log(`authorized_slug=${COHORT_SLUG}`);
  console.log(`target_host=${host}`);

  if (!url || !token || host !== PRODUCTION_HOST) {
    console.error("STOP: Production target guard failed");
    process.exit(2);
  }
  if ((host as string) === PREVIEW_HOST) {
    console.error("STOP: Preview host refused");
    process.exit(2);
  }
  console.log("target_guard=PASS");

  process.env.DATABASE_URL = url;
  process.env.TURSO_DATABASE_URL = url;
  process.env.DATABASE_AUTH_TOKEN = token;
  process.env.TURSO_AUTH_TOKEN = token;
  // Do not force local flag; Production is already ON. Script must work with flag ON.
  process.env.ENTITLEMENTS_ENABLED = "true";

  const raw = createClient({ url, authToken: token });

  // Resolve authorization identity → tenant
  const users = await raw.execute({
    sql: "SELECT id, email FROM users WHERE lower(email)=lower(?)",
    args: [AUTH_EMAIL],
  });
  if (users.rows.length !== 1) {
    console.error("STOP: auth email not uniquely found");
    process.exit(1);
  }
  const userId = users.rows[0]!.id as string;
  const mem = await raw.execute({
    sql: `SELECT t.id, t.slug, t.status, m.role, m.status AS mem_status
          FROM memberships m JOIN tenants t ON t.id=m.tenant_id
          WHERE m.user_id=?`,
    args: [userId],
  });
  if (mem.rows.length !== 1) {
    console.error("STOP: auth email membership ambiguous or missing");
    process.exit(1);
  }
  const m0 = mem.rows[0]!;
  if (m0.slug !== COHORT_SLUG || m0.status !== "ACTIVE" || m0.mem_status !== "ACTIVE") {
    console.error(
      `STOP: expected ACTIVE membership on ${COHORT_SLUG}, got slug=${m0.slug} tenant=${m0.status} mem=${m0.mem_status}`,
    );
    process.exit(1);
  }
  console.log(`identity_resolved_slug=${m0.slug}`);
  console.log(`identity_role=${m0.role}`);

  const tenantId = m0.id as string;

  const [pilot] = (
    await raw.execute({
      sql: "SELECT id, slug FROM tenants WHERE slug=?",
      args: [PILOT_SLUG],
    })
  ).rows as unknown as Array<{ id: string; slug: string }>;
  if (!pilot) {
    console.error("STOP: pilot tenant missing");
    process.exit(1);
  }

  const usageDev = await raw.execute({
    sql: `SELECT COUNT(*) AS n FROM devices WHERE tenant_id=? AND status != 'DISABLED'`,
    args: [tenantId],
  });
  const usageStor = await raw.execute({
    sql: `SELECT COALESCE(SUM(file_size),0) AS n FROM media_assets WHERE tenant_id=?`,
    args: [tenantId],
  });
  const usageRes = await raw.execute({
    sql: `SELECT COALESCE(SUM(expected_bytes),0) AS n FROM storage_reservations WHERE tenant_id=? AND status='RESERVED'`,
    args: [tenantId],
  });
  const deviceUsage = Number(usageDev.rows[0]?.n ?? 0);
  const committed = Number(usageStor.rows[0]?.n ?? 0);
  const reserved = Number(usageRes.rows[0]?.n ?? 0);
  console.log(`current_device_usage=${deviceUsage}`);
  console.log(`current_committed_bytes=${committed}`);
  console.log(`current_reserved_bytes=${reserved}`);
  console.log(`devices_max=${DEVICES_MAX}`);
  console.log(`storage_max_bytes=${STORAGE_MAX_BYTES}`);

  if (deviceUsage > DEVICES_MAX) {
    console.error("STOP: devices.max below current usage");
    process.exit(1);
  }
  if (committed > STORAGE_MAX_BYTES) {
    console.error("STOP: storage.maxBytes below committed");
    process.exit(1);
  }
  if (committed + reserved > STORAGE_MAX_BYTES) {
    console.error("STOP: storage.maxBytes below committed+reserved");
    process.exit(1);
  }
  console.log("usage_within_limits=PASS");

  // Inventory other tenants for post-expansion non-cohort witness
  const others2 = await raw.execute({
    sql: `SELECT t.slug, t.status,
      (SELECT COUNT(*) FROM tenant_plans tp WHERE tp.tenant_id=t.id AND tp.status='ACTIVE') AS active_plans
     FROM tenants t WHERE t.slug NOT IN (?, ?) ORDER BY t.slug`,
    args: [COHORT_SLUG, PILOT_SLUG],
  });
  console.log(`other_tenants=${JSON.stringify(others2.rows)}`);

  const {
    createEntitlementDefinition,
    createPlan,
    createPlanEntitlement,
    createTenantPlan,
    resolveEffectiveEntitlements,
  } = await import("../src/services/entitlements");
  const {
    DEVICES_ENABLED_KEY,
    DEVICES_MAX_KEY,
    STORAGE_MAX_KEY,
  } = await import("../src/domain/entitlements");
  const { db, schema } = await import("../src/db");
  const { isEntitlementsEnabled } = await import("../src/lib/entitlements-flag");
  const { assertDevicesMaxAllocation } = await import(
    "../src/services/device-quota"
  );

  console.log(`process_flag_on=${isEntitlementsEnabled()}`);
  if (!isEntitlementsEnabled()) {
    console.error("STOP: expected ENTITLEMENTS_ENABLED=true for post-activation expansion");
    process.exit(1);
  }

  async function ensureDef(
    key: string,
    name: string,
    valueType: "BOOLEAN" | "INTEGER" | "BYTES",
    enforcementType: "FEATURE_GATE" | "HARD_LIMIT",
  ) {
    const [ex] = await db
      .select()
      .from(schema.entitlementDefinitions)
      .where(eq(schema.entitlementDefinitions.key, key))
      .limit(1);
    if (ex) return ex;
    return createEntitlementDefinition({
      key,
      name,
      valueType,
      enforcementType,
      active: true,
    });
  }

  const defEnabled = await ensureDef(
    DEVICES_ENABLED_KEY,
    "Devices Enabled",
    "BOOLEAN",
    "FEATURE_GATE",
  );
  const defMax = await ensureDef(
    DEVICES_MAX_KEY,
    "Devices Max",
    "INTEGER",
    "HARD_LIMIT",
  );
  const defStor = await ensureDef(
    STORAGE_MAX_KEY,
    "Storage Max Bytes",
    "BYTES",
    "HARD_LIMIT",
  );
  console.log("definitions=PASS");

  let [plan] = await db
    .select()
    .from(schema.plans)
    .where(eq(schema.plans.key, COHORT_PLAN_KEY))
    .limit(1);
  if (!plan) {
    plan = await createPlan({
      key: COHORT_PLAN_KEY,
      name: "PI-10P Production Cohort (demo)",
      description:
        "Controlled Production cohort expansion plan for authorized demo tenant (admin@vitrine360.local).",
      active: true,
    });
    console.log("plan_created=true");
  } else {
    console.log("plan_created=false reused");
  }

  async function ensureBinding(defId: string, value: unknown) {
    const [hit] = await db
      .select()
      .from(schema.planEntitlements)
      .where(
        and(
          eq(schema.planEntitlements.planId, plan!.id),
          eq(schema.planEntitlements.entitlementDefinitionId, defId),
        ),
      )
      .limit(1);
    if (hit) return hit;
    return createPlanEntitlement({
      planId: plan!.id,
      entitlementDefinitionId: defId,
      value,
    });
  }

  await ensureBinding(defEnabled.id, true);
  await ensureBinding(defMax.id, DEVICES_MAX);
  await ensureBinding(defStor.id, STORAGE_MAX_BYTES);

  const bindings = await db
    .select()
    .from(schema.planEntitlements)
    .where(eq(schema.planEntitlements.planId, plan.id));
  console.log(`plan_entitlements_count=${bindings.length}`);
  if (bindings.length !== 3) {
    console.error("STOP: expected exactly 3 plan entitlements");
    process.exit(1);
  }

  // Pre-check: cohort tenant must have zero ACTIVE plans
  const activeForCohort = await db
    .select()
    .from(schema.tenantPlans)
    .where(
      and(
        eq(schema.tenantPlans.tenantId, tenantId),
        eq(schema.tenantPlans.status, "ACTIVE"),
      ),
    );
  if (activeForCohort.length === 0) {
    await createTenantPlan({
      tenantId,
      planId: plan.id,
      status: "ACTIVE",
    });
    console.log("tenant_plan_created=true");
  } else if (
    activeForCohort.length === 1 &&
    activeForCohort[0]!.planId === plan.id
  ) {
    console.log("tenant_plan_created=false reused");
  } else {
    console.error("STOP: unexpected ACTIVE TenantPlan for cohort tenant");
    process.exit(1);
  }

  const allActive = await db
    .select()
    .from(schema.tenantPlans)
    .where(eq(schema.tenantPlans.status, "ACTIVE"));
  console.log(`active_tenant_plans_total=${allActive.length}`);
  const activeTenantIds = new Set(allActive.map((r) => r.tenantId));
  if (
    allActive.length !== 2 ||
    !activeTenantIds.has(tenantId) ||
    !activeTenantIds.has(pilot.id)
  ) {
    console.error(
      `STOP: expected exactly pilot+demo ACTIVE TenantPlans; got ${allActive.length}`,
    );
    process.exit(1);
  }
  console.log("cohort_size=2 (egaslemos + demo)");

  const effDemo = await resolveEffectiveEntitlements(tenantId);
  const effPilot = await resolveEffectiveEntitlements(pilot.id);
  console.log(`eff_demo_status=${effDemo.status}`);
  console.log(`eff_pilot_status=${effPilot.status}`);
  if (effDemo.status !== "RESOLVED" || effPilot.status !== "RESOLVED") {
    console.error("STOP: effective resolution failed");
    process.exit(1);
  }
  const map = new Map(
    effDemo.entitlements.entitlements.map((e) => [e.key, e.value]),
  );
  console.log(`eff_demo_devices.enabled=${map.get(DEVICES_ENABLED_KEY)}`);
  console.log(`eff_demo_devices.max=${map.get(DEVICES_MAX_KEY)}`);
  console.log(`eff_demo_storage.maxBytes=${map.get(STORAGE_MAX_KEY)}`);
  if (
    map.get(DEVICES_ENABLED_KEY) !== true ||
    map.get(DEVICES_MAX_KEY) !== DEVICES_MAX ||
    map.get(STORAGE_MAX_KEY) !== STORAGE_MAX_BYTES
  ) {
    console.error("STOP: demo effective values mismatch");
    process.exit(1);
  }

  const dq = await assertDevicesMaxAllocation(tenantId, "cohort.expand.validate");
  console.log(`device_quota_decision=${dq.decision} reason=${dq.reason}`);
  if (dq.decision !== "ALLOW") {
    console.error("STOP: demo device quota should ALLOW under headroom");
    process.exit(1);
  }

  // Non-cohort witness: first other ACTIVE tenant with 0 plans, else ABSENT
  const witness = others2.rows.find(
    (r) => r.status === "ACTIVE" && Number(r.active_plans) === 0,
  );
  if (witness) {
    const [w] = (
      await raw.execute({
        sql: "SELECT id FROM tenants WHERE slug=?",
        args: [witness.slug as string],
      })
    ).rows as unknown as Array<{ id: string }>;
    const effW = await resolveEffectiveEntitlements(w.id);
    console.log(`non_cohort_witness=${witness.slug}`);
    console.log(`non_cohort_status=${effW.status}`);
    if (effW.status !== "NO_ACTIVE_PLAN") {
      console.error("STOP: non-cohort witness must be NO_ACTIVE_PLAN");
      process.exit(1);
    }
  } else {
    console.log("non_cohort_witness=ABSENT (only egaslemos+demo ACTIVE tenants with plans)");
  }

  console.log("cohort_expansion=SUCCESS");
}

main().catch((e) => {
  console.error(String(e).replace(/[A-Za-z0-9_-]{24,}/g, "REDACTED"));
  process.exit(1);
});
