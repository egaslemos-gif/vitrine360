/**
 * PI-10P — Read-only Preview schema validation (no mutations, no cohort data).
 * Loads `.env.preview.local` only. Never prints secrets.
 */
import { createClient } from "@libsql/client";
import { config } from "dotenv";

const PREVIEW_HOST =
  "libsql://vitrine360-preview-elemos.aws-us-west-2.turso.io";
const PRODUCTION_HOST =
  "libsql://vitrine360-vercel-icfg-rd8hoku6p0oaszo88ixdwcu4.aws-us-east-1.turso.io";

function status(v: string | undefined | null) {
  return v && String(v).trim() ? "PRESENT" : "ABSENT";
}

async function main() {
  config({ path: ".env.preview.local", override: true });
  const url =
    process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL || "";
  const token =
    process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN || "";
  console.log(`DATABASE_URL=${status(url)}`);
  console.log(`DATABASE_AUTH_TOKEN=${status(token)}`);
  if (!url || !token) process.exit(2);
  if (url.trim() === PRODUCTION_HOST || url.trim() !== PREVIEW_HOST) {
    console.error("STOP: target guard failed");
    process.exit(2);
  }
  console.log("target_guard=PASS");

  const client = createClient({ url, authToken: token });

  const tablesNeeded = [
    "users",
    "tenants",
    "memberships",
    "platform_assignments",
    "devices",
    "device_groups",
    "device_group_members",
    "device_assignments",
    "contents",
    "media_assets",
    "content_assets",
    "playlists",
    "playlist_items",
    "schedules",
    "schedule_targets",
    "entitlement_definitions",
    "plans",
    "plan_entitlements",
    "tenant_plans",
    "storage_reservations",
  ];

  const master = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
  );
  const present = new Set(
    (master.rows as unknown as Array<{ name: string }>).map((r) => r.name),
  );
  const missing = tablesNeeded.filter((t) => !present.has(t));
  console.log(`tables_present=${tablesNeeded.filter((t) => present.has(t)).length}/${tablesNeeded.length}`);
  console.log(`tables_missing=${missing.join(",") || "(none)"}`);
  console.log(
    `identity_tables=${["users", "tenants", "memberships", "platform_assignments"].every((t) => present.has(t)) ? "PASS" : "FAIL"}`,
  );
  console.log(
    `devices_tables=${["devices", "device_groups", "device_group_members", "device_assignments"].every((t) => present.has(t)) ? "PASS" : "FAIL"}`,
  );
  console.log(
    `content_tables=${["contents", "media_assets", "content_assets"].every((t) => present.has(t)) ? "PASS" : "FAIL"}`,
  );
  console.log(
    `distribution_tables=${["playlists", "playlist_items", "schedules", "schedule_targets"].every((t) => present.has(t)) ? "PASS" : "FAIL"}`,
  );
  console.log(
    `entitlement_tables=${["entitlement_definitions", "plans", "plan_entitlements", "tenant_plans"].every((t) => present.has(t)) ? "PASS" : "FAIL"}`,
  );
  console.log(
    `storage_tables=${present.has("storage_reservations") ? "PASS" : "FAIL"}`,
  );

  // Entitlement schema columns
  for (const t of [
    "entitlement_definitions",
    "plans",
    "plan_entitlements",
    "tenant_plans",
    "storage_reservations",
    "devices",
    "media_assets",
  ]) {
    const info = await client.execute(`PRAGMA table_info('${t}')`);
    const cols = (info.rows as unknown as Array<{ name: string; pk: number }>)
      .map((r) => `${r.name}${Number(r.pk) ? "*" : ""}`)
      .join(",");
    console.log(`table_info.${t}=${cols}`);
  }

  // storage_reservations expected fields (actual schema uses expected_bytes)
  const sr = await client.execute("PRAGMA table_info('storage_reservations')");
  const srCols = new Set(
    (sr.rows as unknown as Array<{ name: string }>).map((r) => r.name),
  );
  const srNeed = [
    "tenant_id",
    "operation_id",
    "expected_bytes",
    "status",
    "expires_at",
    "created_at",
  ];
  console.log(
    `storage_fields=${srNeed.every((c) => srCols.has(c)) ? "PASS" : "FAIL"} missing=${srNeed.filter((c) => !srCols.has(c)).join(",") || "(none)"}`,
  );
  console.log(
    `storage_note=reserved_bytes_not_in_schema;actual=expected_bytes`,
  );

  // Indexes
  async function hasIndex(table: string, name: string, unique?: boolean) {
    const idx = await client.execute(`PRAGMA index_list('${table}')`);
    const row = (
      idx.rows as unknown as Array<{ name: string; unique: number }>
    ).find((r) => r.name === name);
    if (!row) return false;
    if (unique !== undefined && Number(row.unique) !== (unique ? 1 : 0))
      return false;
    return true;
  }

  const idxChecks: Array<[string, string, boolean | undefined]> = [
    ["media_assets", "media_assets_tenant_checksum_uidx", true],
    ["storage_reservations", "storage_reservations_tenant_operation_uidx", true],
    ["storage_reservations", "storage_reservations_tenant_idx", false],
    ["storage_reservations", "storage_reservations_tenant_status_idx", false],
    ["entitlement_definitions", "entitlement_definitions_key_uidx", true],
    ["plans", "plans_key_uidx", true],
    ["plan_entitlements", "plan_entitlements_plan_def_uidx", true],
    ["tenant_plans", "tenant_plans_tenant_status_idx", false],
    ["devices", "devices_tenant_idx", false],
    ["devices", "devices_status_idx", false],
    ["memberships", "memberships_user_tenant_uidx", true],
  ];
  let idxFail = 0;
  for (const [table, name, uniq] of idxChecks) {
    const ok = await hasIndex(table, name, uniq);
    console.log(`index.${name}=${ok ? "PASS" : "FAIL"}`);
    if (!ok) idxFail++;
  }
  console.log(`indexes_overall=${idxFail === 0 ? "PASS" : "FAIL"}`);

  // Foreign keys sample
  for (const t of [
    "memberships",
    "tenant_plans",
    "storage_reservations",
    "plan_entitlements",
    "devices",
  ]) {
    const fk = await client.execute(`PRAGMA foreign_key_list('${t}')`);
    const n = fk.rows.length;
    console.log(`fk.${t}.count=${n}`);
  }

  // Journal
  const journal = await client.execute(
    "SELECT COUNT(*) AS c FROM __drizzle_migrations",
  );
  const jCount = Number(
    (journal.rows[0] as { c?: number } | undefined)?.c ?? 0,
  );
  console.log(`journal_count=${jCount}`);
  console.log(`journal=${jCount >= 9 ? "PASS" : "FAIL"}`);

  // Device quota structure: status + tenant_id
  const devCols = new Set(
    (
      (await client.execute("PRAGMA table_info('devices')"))
        .rows as unknown as Array<{ name: string }>
    ).map((r) => r.name),
  );
  console.log(
    `device_quota_structure=${devCols.has("status") && devCols.has("tenant_id") ? "PASS" : "FAIL"}`,
  );

  // Clean Preview: no cohort tenants
  const tenantCount = await client.execute(
    "SELECT COUNT(*) AS c FROM tenants",
  );
  const tc = Number(
    (tenantCount.rows[0] as { c?: number } | undefined)?.c ?? -1,
  );
  console.log(`tenant_rows=${tc}`);
  console.log(`preview_clean=${tc === 0 ? "PASS" : "FAIL"}`);

  console.log(
    `ENTITLEMENTS_ENABLED=${process.env.ENTITLEMENTS_ENABLED ?? "UNSET"}`,
  );
  console.log(`validation=${missing.length === 0 && idxFail === 0 && jCount >= 9 && tc === 0 ? "PASS" : "FAIL"}`);
}

main().catch((e) => {
  console.error(String(e).replace(/[A-Za-z0-9_-]{24,}/g, "REDACTED"));
  process.exit(1);
});
