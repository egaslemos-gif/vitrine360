/**
 * PI-10P — Controlled Production pilot setup (flag remains OFF).
 * Authorized pilot slug: egaslemos only.
 * Creates defs + pilot plan + TenantPlan. No flag change. No secrets printed.
 */
import { config } from "dotenv";
import { createClient } from "@libsql/client";
import { eq } from "drizzle-orm";

const PRODUCTION_HOST =
  "vitrine360-vercel-icfg-rd8hoku6p0oaszo88ixdwcu4.aws-us-east-1.turso.io";
const PREVIEW_HOST = "vitrine360-preview-elemos.aws-us-west-2.turso.io";
const PILOT_SLUG = "egaslemos";
const PILOT_PLAN_KEY = "pi10p_production_pilot";

/** Conservative floors: pilot has 0 paired devices, ~90 bytes storage. */
const DEVICES_MAX = 5;
const STORAGE_MAX_BYTES = 10 * 1024 * 1024; // 10 MiB

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
  console.log("PI-10P Production pilot setup");
  console.log(`authorized_slug=${PILOT_SLUG}`);
  console.log(`ENTITLEMENTS_ENABLED=${process.env.ENTITLEMENTS_ENABLED ?? "UNSET"}`);
  console.log(`target_host=${host}`);

  if (!url || !token || host !== PRODUCTION_HOST) {
    console.error("STOP: Production target guard failed");
    process.exit(2);
  }
  if ((host as string) === PREVIEW_HOST) {
    console.error("STOP: Preview host refused");
    process.exit(2);
  }
  if (process.env.ENTITLEMENTS_ENABLED === "true") {
    console.error("STOP: flag already ON — refuse setup-only path");
    process.exit(2);
  }
  console.log("target_guard=PASS");

  // Force process env to Production Turso for drizzle client used by services
  process.env.DATABASE_URL = url;
  process.env.TURSO_DATABASE_URL = url;
  process.env.DATABASE_AUTH_TOKEN = token;
  process.env.TURSO_AUTH_TOKEN = token;
  delete process.env.ENTITLEMENTS_ENABLED;

  const raw = createClient({ url, authToken: token });
  const [tenant] = (
    await raw.execute({
      sql: "SELECT id, slug, status FROM tenants WHERE slug = ?",
      args: [PILOT_SLUG],
    })
  ).rows as unknown as Array<{ id: string; slug: string; status: string }>;

  if (!tenant) {
    console.error("STOP: pilot tenant not found");
    process.exit(1);
  }
  console.log(`pilot_id=${tenant.id}`);
  console.log(`pilot_status=${tenant.status}`);
  if (tenant.status !== "ACTIVE") {
    console.error("STOP: pilot tenant not ACTIVE");
    process.exit(1);
  }

  const usageDev = await raw.execute({
    sql: `SELECT COUNT(*) AS n FROM devices WHERE tenant_id=? AND status != 'DISABLED'`,
    args: [tenant.id],
  });
  const usageStor = await raw.execute({
    sql: `SELECT COALESCE(SUM(file_size),0) AS n FROM media_assets WHERE tenant_id=?`,
    args: [tenant.id],
  });
  const usageRes = await raw.execute({
    sql: `SELECT COALESCE(SUM(expected_bytes),0) AS n FROM storage_reservations WHERE tenant_id=? AND status='RESERVED'`,
    args: [tenant.id],
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

  // Non-cohort witness (read-only): demo
  const [witness] = (
    await raw.execute({
      sql: "SELECT id, slug FROM tenants WHERE slug = 'demo' LIMIT 1",
      args: [],
    })
  ).rows as unknown as Array<{ id: string; slug: string }>;
  console.log(
    `non_cohort_witness=${witness ? witness.slug : "ABSENT"} id=${witness ? witness.id.slice(0, 12) + "…" : "n/a"}`,
  );

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

  console.log(`flag_still_off=${!isEntitlementsEnabled()}`);

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
    .where(eq(schema.plans.key, PILOT_PLAN_KEY))
    .limit(1);
  if (!plan) {
    plan = await createPlan({
      key: PILOT_PLAN_KEY,
      name: "PI-10P Production Pilot",
      description:
        "Controlled Production activation pilot plan for authorized tenant only.",
      active: true,
    });
    console.log("plan_created=true");
  } else {
    console.log("plan_created=false reused");
  }

  const { and } = await import("drizzle-orm");

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

  const activeForPilot = (
    await db
      .select()
      .from(schema.tenantPlans)
      .where(
        and(
          eq(schema.tenantPlans.tenantId, tenant.id),
          eq(schema.tenantPlans.status, "ACTIVE"),
        ),
      )
  );

  if (activeForPilot.length === 0) {
    await createTenantPlan({
      tenantId: tenant.id,
      planId: plan.id,
      status: "ACTIVE",
    });
    console.log("tenant_plan_created=true");
  } else if (
    activeForPilot.length === 1 &&
    activeForPilot[0]!.planId === plan.id
  ) {
    console.log("tenant_plan_created=false reused");
  } else {
    console.error("STOP: unexpected ACTIVE TenantPlan for pilot");
    process.exit(1);
  }

  const allActive = await db
    .select()
    .from(schema.tenantPlans)
    .where(eq(schema.tenantPlans.status, "ACTIVE"));
  console.log(`active_tenant_plans_total=${allActive.length}`);
  if (allActive.length !== 1 || allActive[0]!.tenantId !== tenant.id) {
    console.error("STOP: unexpected ACTIVE TenantPlans outside pilot-only");
    process.exit(1);
  }

  const eff = await resolveEffectiveEntitlements(tenant.id);
  console.log(`effective_status=${eff.status}`);
  if (eff.status !== "RESOLVED") {
    console.error("STOP: effective resolution failed");
    process.exit(1);
  }
  const map = new Map(
    eff.entitlements.entitlements.map((e) => [e.key, e.value]),
  );
  console.log(`eff_devices.enabled=${map.get(DEVICES_ENABLED_KEY)}`);
  console.log(`eff_devices.max=${map.get(DEVICES_MAX_KEY)}`);
  console.log(`eff_storage.maxBytes=${map.get(STORAGE_MAX_KEY)}`);
  if (
    map.get(DEVICES_ENABLED_KEY) !== true ||
    map.get(DEVICES_MAX_KEY) !== DEVICES_MAX ||
    map.get(STORAGE_MAX_KEY) !== STORAGE_MAX_BYTES
  ) {
    console.error("STOP: effective values mismatch");
    process.exit(1);
  }

  if (witness) {
    const wTp = await db
      .select()
      .from(schema.tenantPlans)
      .where(eq(schema.tenantPlans.tenantId, witness.id));
    console.log(`non_cohort_tenant_plans=${wTp.length}`);
  }

  console.log(`flag_unchanged_off=${!isEntitlementsEnabled()}`);
  console.log("pilot_setup=SUCCESS");
}

main().catch((e) => {
  console.error(String(e).replace(/[A-Za-z0-9_-]{24,}/g, "REDACTED"));
  process.exit(1);
});
