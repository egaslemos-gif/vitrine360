/**
 * PI-10P — Production OFF smoke (flag must remain OFF).
 * Validates pilot seed + non-cohort witness + FLAG_OFF allow path.
 * No secrets printed. No Production mutations.
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
  console.log("PI-10P Production OFF smoke");
  console.log(`pilot=${PILOT_SLUG}`);
  console.log(`target_host=${host}`);
  console.log(
    `process_ENTITLEMENTS_ENABLED=${process.env.ENTITLEMENTS_ENABLED ?? "UNSET"}`,
  );

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
  delete process.env.ENTITLEMENTS_ENABLED;

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

  if (!pilot || pilot.status !== "ACTIVE") {
    console.error("STOP: pilot missing/inactive");
    process.exit(1);
  }
  if (!witness) {
    console.error("STOP: witness missing");
    process.exit(1);
  }

  const {
    resolveEffectiveEntitlements,
    enforceEntitlement,
  } = await import("../src/services/entitlements");
  const { DEVICES_ENABLED_KEY } = await import("../src/domain/entitlements");
  const { db, schema } = await import("../src/db");
  const { isEntitlementsEnabled } = await import("../src/lib/entitlements-flag");

  console.log(`flag_off=${!isEntitlementsEnabled()}`);
  if (isEntitlementsEnabled()) {
    console.error("STOP: flag ON during OFF smoke");
    process.exit(1);
  }

  const active = await db
    .select()
    .from(schema.tenantPlans)
    .where(eq(schema.tenantPlans.status, "ACTIVE"));
  console.log(`active_tenant_plans=${active.length}`);
  if (active.length !== 1 || active[0]!.tenantId !== pilot.id) {
    console.error("STOP: expected sole ACTIVE TenantPlan = pilot");
    process.exit(1);
  }

  const effPilot = await resolveEffectiveEntitlements(pilot.id);
  const effWitness = await resolveEffectiveEntitlements(witness.id);
  console.log(`pilot_resolve=${effPilot.status}`);
  console.log(`witness_resolve=${effWitness.status}`);
  if (effPilot.status !== "RESOLVED" || effWitness.status !== "NO_ACTIVE_PLAN") {
    console.error("STOP: resolve status mismatch");
    process.exit(1);
  }

  const allowPilot = await enforceEntitlement({
    tenantId: pilot.id,
    key: DEVICES_ENABLED_KEY,
    operation: "device.pair",
  });
  const allowWitness = await enforceEntitlement({
    tenantId: witness.id,
    key: DEVICES_ENABLED_KEY,
    operation: "device.pair",
  });
  console.log(
    `pilot_enforce=${allowPilot.decision}/${allowPilot.reason}`,
  );
  console.log(
    `witness_enforce=${allowWitness.decision}/${allowWitness.reason}`,
  );
  if (
    allowPilot.decision !== "ALLOW" ||
    allowPilot.reason !== "FLAG_OFF" ||
    allowWitness.decision !== "ALLOW" ||
    allowWitness.reason !== "FLAG_OFF"
  ) {
    console.error("STOP: expected FLAG_OFF ALLOW for pilot and witness");
    process.exit(1);
  }

  // Live Production URL probe (code may predate /api/health)
  try {
    const root = await fetch(PROD_URL, { redirect: "manual" });
    console.log(`live_root_status=${root.status}`);
  } catch (e) {
    console.log(`live_root_error=${String(e).slice(0, 80)}`);
  }
  try {
    const health = await fetch(`${PROD_URL}/api/health`);
    console.log(`live_health_status=${health.status}`);
    if (health.ok) {
      const body = (await health.json()) as {
        entitlementsEnabled?: boolean;
        databaseHost?: string;
      };
      console.log(`live_health_entitlementsEnabled=${body.entitlementsEnabled}`);
      console.log(`live_health_databaseHost=${body.databaseHost}`);
      if (body.entitlementsEnabled === true) {
        console.error("STOP: live Production already ON");
        process.exit(1);
      }
      if (body.databaseHost && !body.databaseHost.includes("vitrine360-vercel")) {
        console.error("STOP: live health not Production DB");
        process.exit(1);
      }
    } else {
      console.log(
        "live_health=ABSENT (pre-entitlements Production deploy — expected before code deploy)",
      );
    }
  } catch (e) {
    console.log(`live_health_error=${String(e).slice(0, 80)}`);
  }

  console.log("off_smoke=SUCCESS");
}

main().catch((e) => {
  console.error(String(e).replace(/[A-Za-z0-9_-]{24,}/g, "REDACTED"));
  process.exit(1);
});
