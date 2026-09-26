/**
 * PI-10P — Production ON validation (flag must be ON in process).
 * Pilot ALLOW; non-cohort fail-closed DENY. No secrets. No mutations.
 */
import { config } from "dotenv";
import { createClient } from "@libsql/client";
import { eq } from "drizzle-orm";

const PRODUCTION_HOST =
  "vitrine360-vercel-icfg-rd8hoku6p0oaszo88ixdwcu4.aws-us-east-1.turso.io";
const PREVIEW_HOST = "vitrine360-preview-elemos.aws-us-west-2.turso.io";
const PILOT_SLUG = "egaslemos";
const WITNESS_SLUG = "demo";
const PROD_URL = "https://vitrine360-psi.vercel.app";

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
  console.log("PI-10P Production ON validation");
  console.log(`pilot=${PILOT_SLUG}`);
  console.log(`target_host=${host}`);

  if (!url || !token || host !== PRODUCTION_HOST) {
    console.error("STOP: Production target guard failed");
    process.exit(2);
  }
  if ((host as string) === PREVIEW_HOST) {
    console.error("STOP: Preview host refused");
    process.exit(2);
  }

  process.env.DATABASE_URL = url;
  process.env.TURSO_DATABASE_URL = url;
  process.env.DATABASE_AUTH_TOKEN = token;
  process.env.TURSO_AUTH_TOKEN = token;
  process.env.ENTITLEMENTS_ENABLED = "true";

  const health = await fetch(`${PROD_URL}/api/health`);
  if (!health.ok) {
    console.error(`STOP: live health HTTP ${health.status}`);
    process.exit(1);
  }
  const body = (await health.json()) as {
    entitlementsEnabled?: boolean;
    databaseHost?: string;
    r2BucketName?: string;
    environmentHint?: string;
  };
  console.log(`live_entitlementsEnabled=${body.entitlementsEnabled}`);
  console.log(`live_databaseHost=${body.databaseHost}`);
  console.log(`live_r2BucketName=${body.r2BucketName}`);
  console.log(`live_environmentHint=${body.environmentHint}`);
  if (body.entitlementsEnabled !== true) {
    console.error("STOP: live flag not ON");
    process.exit(1);
  }
  if (!body.databaseHost?.includes("vitrine360-vercel")) {
    console.error("STOP: live health not Production DB");
    process.exit(1);
  }
  if (body.r2BucketName?.includes("preview")) {
    console.error("STOP: Production pointing at preview bucket");
    process.exit(1);
  }

  const raw = createClient({ url, authToken: token });
  const [pilot] = (
    await raw.execute({
      sql: "SELECT id, slug, status FROM tenants WHERE slug = ?",
      args: [PILOT_SLUG],
    })
  ).rows as unknown as Array<{ id: string; slug: string; status: string }>;
  const [witness] = (
    await raw.execute({
      sql: "SELECT id, slug FROM tenants WHERE slug = ?",
      args: [WITNESS_SLUG],
    })
  ).rows as unknown as Array<{ id: string; slug: string }>;
  if (!pilot || !witness) {
    console.error("STOP: pilot/witness missing");
    process.exit(1);
  }

  const {
    resolveEffectiveEntitlements,
    enforceEntitlement,
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
  const { EntitlementDeniedError } = await import("../src/services/entitlements");

  console.log(`process_flag_on=${isEntitlementsEnabled()}`);
  if (!isEntitlementsEnabled()) {
    console.error("STOP: process flag not ON");
    process.exit(1);
  }

  const active = await db
    .select()
    .from(schema.tenantPlans)
    .where(eq(schema.tenantPlans.status, "ACTIVE"));
  console.log(`active_tenant_plans=${active.length}`);
  if (active.length !== 1 || active[0]!.tenantId !== pilot.id) {
    console.error("STOP: cohort expansion detected");
    process.exit(1);
  }

  const effPilot = await resolveEffectiveEntitlements(pilot.id);
  const effWitness = await resolveEffectiveEntitlements(witness.id);
  console.log(`pilot_resolve=${effPilot.status}`);
  console.log(`witness_resolve=${effWitness.status}`);
  if (effPilot.status !== "RESOLVED" || effWitness.status !== "NO_ACTIVE_PLAN") {
    console.error("STOP: resolve mismatch");
    process.exit(1);
  }

  const map = new Map(
    effPilot.entitlements.entitlements.map((e) => [e.key, e.value]),
  );
  console.log(`eff_devices.enabled=${map.get(DEVICES_ENABLED_KEY)}`);
  console.log(`eff_devices.max=${map.get(DEVICES_MAX_KEY)}`);
  console.log(`eff_storage.maxBytes=${map.get(STORAGE_MAX_KEY)}`);

  const pilotGate = await enforceEntitlement({
    tenantId: pilot.id,
    key: DEVICES_ENABLED_KEY,
    operation: "device.pair",
  });
  const witnessGate = await enforceEntitlement({
    tenantId: witness.id,
    key: DEVICES_ENABLED_KEY,
    operation: "device.pair",
  });
  console.log(`pilot_gate=${pilotGate.decision}/${pilotGate.reason}`);
  console.log(`witness_gate=${witnessGate.decision}/${witnessGate.reason}`);
  if (pilotGate.decision !== "ALLOW") {
    console.error("STOP: pilot devices.enabled DENY");
    process.exit(1);
  }
  if (witnessGate.decision !== "DENY") {
    console.error("STOP: witness must fail-closed DENY when flag ON");
    process.exit(1);
  }

  const pilotQuota = await assertDevicesMaxAllocation(pilot.id);
  console.log(`pilot_device_quota=${pilotQuota.decision}/${pilotQuota.reason}`);
  if (pilotQuota.decision !== "ALLOW") {
    console.error("STOP: pilot device quota unexpected DENY at usage floor");
    process.exit(1);
  }

  let witnessQuotaDenied = false;
  try {
    await assertDevicesMaxAllocation(witness.id);
  } catch (e) {
    if (e instanceof EntitlementDeniedError) {
      witnessQuotaDenied = true;
      console.log(`witness_device_quota=DENY/${e.reason}`);
    } else {
      throw e;
    }
  }
  if (!witnessQuotaDenied) {
    console.error("STOP: witness device quota must DENY");
    process.exit(1);
  }

  // Catalog counts
  const defs = await db.select().from(schema.entitlementDefinitions);
  const plans = await db.select().from(schema.plans);
  const bindings = await db.select().from(schema.planEntitlements);
  const tps = await db.select().from(schema.tenantPlans);
  console.log(
    `catalog defs=${defs.length} plans=${plans.length} bindings=${bindings.length} tenant_plans=${tps.length}`,
  );

  console.log("on_validation=SUCCESS");
}

main().catch((e) => {
  console.error(String(e).replace(/[A-Za-z0-9_-]{24,}/g, "REDACTED"));
  process.exit(1);
});
