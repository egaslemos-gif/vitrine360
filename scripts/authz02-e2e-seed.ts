/**
 * AUTHZ-DEVICE-02B — seed for live validation (throwaway local DB only).
 *
 * Run ONLY against a disposable DB, e.g.:
 *   DATABASE_URL=file:./data/authz02-e2e.db npx tsx scripts/authz02-e2e-seed.ts
 *
 * Creates 3 tenants × 5 roles and pending activation codes; writes
 * data/authz02-e2e-seed.json (consumed by scripts/authz02-e2e-browser.ts).
 */
import { config } from "dotenv";
import { sql } from "drizzle-orm";
import fs from "node:fs";

config({ path: ".env.local" });
config({ path: ".env" });

const ROLES = ["VIEWER", "EDITOR", "OPERATOR", "ADMIN", "SUPER_ADMIN"] as const;
const PASSWORD = "Authz02Pass!";

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (!url.startsWith("file:") || !/authz02/i.test(url)) {
    throw new Error(
      `Refusing to seed: DATABASE_URL must be a local file:...authz02... DB (got "${url.slice(0, 12)}…")`,
    );
  }
  process.env.ENTITLEMENTS_ENABLED = "true";

  const { db, schema, ensureSchema } = await import("../src/db");
  const { createTenant } = await import("../src/services/tenants");
  const { hashPassword } = await import("../src/lib/auth");
  const { createMembership } = await import("../src/services/memberships");
  const { DEVICES_ENABLED_KEY, DEVICES_MAX_KEY } = await import(
    "../src/domain/entitlements"
  );
  const {
    createEntitlementDefinition,
    createPlan,
    createPlanEntitlement,
    createTenantPlan,
  } = await import("../src/services/entitlements");
  const { startDevicePairing, pairDevice } = await import("../src/services/devices");

  await ensureSchema();
  const passwordHash = await hashPassword(PASSWORD);

  async function def(key: string, t: "BOOLEAN" | "INTEGER", e: "FEATURE_GATE" | "HARD_LIMIT") {
    const rows = await db.all<{ id: string }>(
      sql`SELECT id FROM entitlement_definitions WHERE key = ${key} LIMIT 1`,
    );
    if (rows[0]) return rows[0].id;
    return (await createEntitlementDefinition({ key, name: key, valueType: t, enforcementType: e })).id;
  }
  const enabledId = await def(DEVICES_ENABLED_KEY, "BOOLEAN", "FEATURE_GATE");
  const maxId = await def(DEVICES_MAX_KEY, "INTEGER", "HARD_LIMIT");

  async function planFor(tenantId: string, key: string, enabled: boolean, max: number) {
    const plan = await createPlan({ key: `authz02.${key}`, name: key });
    await createPlanEntitlement({ planId: plan.id, entitlementDefinitionId: enabledId, value: enabled });
    await createPlanEntitlement({ planId: plan.id, entitlementDefinitionId: maxId, value: max });
    await createTenantPlan({ tenantId, planId: plan.id });
  }

  async function newCode() {
    return (await startDevicePairing()).activationCode;
  }

  const tenants = {
    ok: { slug: "authz02-ok", enabled: true, max: 100 },
    disabled: { slug: "authz02-disabled", enabled: false, max: 100 },
    quota: { slug: "authz02-quota", enabled: true, max: 1 },
  } as const;

  const out: Record<string, unknown> = { password: PASSWORD, tenants: {}, codes: [] as string[] };
  const ids: Record<string, string> = {};

  for (const [name, t] of Object.entries(tenants)) {
    const tenantId = await createTenant({ name: `AUTHZ02 ${name}`, slug: t.slug });
    ids[name] = tenantId;
    await planFor(tenantId, name, t.enabled, t.max);
    const users: Record<string, string> = {};
    for (const role of ROLES) {
      const id = crypto.randomUUID();
      const email = `${role.toLowerCase().replace("_", "-")}@${t.slug}.test`;
      await db.insert(schema.users).values({
        id, email, name: `${role} ${name}`, passwordHash, role, tenantId,
      });
      await createMembership({ userId: id, tenantId, role, status: "ACTIVE" });
      users[role] = email;
    }
    (out.tenants as Record<string, unknown>)[name] = { slug: t.slug, users };
  }

  // quota tenant: fill to devices.max (usage 1 >= max 1) while entitlements flag is ON
  // (flag ON + enabled plan + 0 usage allows exactly one pairing).
  const fillCode = await newCode();
  await pairDevice({
    activationCode: fillCode,
    name: "Seed filler",
    deviceCode: "SEED-FILL-001",
    tenantId: ids.quota,
  });

  const codes: string[] = [];
  for (let i = 0; i < 40; i++) codes.push(await newCode());
  out.codes = codes;

  fs.writeFileSync("data/authz02-e2e-seed.json", JSON.stringify(out, null, 2));
  console.log("seed OK:", Object.keys(tenants).join(","), `codes=${codes.length}`);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
