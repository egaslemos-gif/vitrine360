/**
 * PI-10P — Pre-activation Production baseline (read-only).
 * Lists tenant slug/id + usage for pilot authorization. No mutations. No secrets.
 */
import { config } from "dotenv";
import { createClient } from "@libsql/client";

const PRODUCTION_HOST =
  "vitrine360-vercel-icfg-rd8hoku6p0oaszo88ixdwcu4.aws-us-east-1.turso.io";
const PREVIEW_HOST = "vitrine360-preview-elemos.aws-us-west-2.turso.io";

function hostOf(url: string): string {
  try {
    return new URL(url.includes("://") ? url : `libsql://${url}`).hostname;
  } catch {
    return "";
  }
}

function resolveProd() {
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
  const { url, token, host } = resolveProd();
  console.log("=== PRE-ACTIVATION BASELINE ===");
  console.log(`target_host=${host}`);
  console.log(`ENTITLEMENTS_ENABLED=${process.env.ENTITLEMENTS_ENABLED ?? "UNSET"}`);
  if (host !== PRODUCTION_HOST || !token) {
    console.error("STOP: safety");
    process.exit(2);
  }
  if ((host as string) === PREVIEW_HOST) {
    console.error("STOP: Preview host refused");
    process.exit(2);
  }

  const c = createClient({ url, authToken: token });
  const tables = [
    "tenants",
    "users",
    "memberships",
    "devices",
    "contents",
    "media_assets",
    "playlists",
    "schedules",
    "entitlement_definitions",
    "plans",
    "plan_entitlements",
    "tenant_plans",
    "storage_reservations",
  ];
  for (const t of tables) {
    const r = await c.execute(`SELECT COUNT(*) AS n FROM ${t}`);
    console.log(`count_${t}=${r.rows[0]?.n}`);
  }

  const activeTp = await c.execute(
    `SELECT COUNT(*) AS n FROM tenant_plans WHERE status='ACTIVE'`,
  );
  console.log(`active_tenant_plans=${activeTp.rows[0]?.n}`);

  const devices = await c.execute(`
    SELECT
      SUM(CASE WHEN status='ACTIVE' THEN 1 ELSE 0 END) AS active,
      SUM(CASE WHEN status='OFFLINE' THEN 1 ELSE 0 END) AS offline,
      SUM(CASE WHEN status='DISABLED' THEN 1 ELSE 0 END) AS disabled,
      SUM(CASE WHEN status='PENDING' THEN 1 ELSE 0 END) AS pending,
      SUM(CASE WHEN tenant_id IS NOT NULL AND status != 'DISABLED' THEN 1 ELSE 0 END) AS paired_non_disabled
    FROM devices
  `);
  const d = devices.rows[0] as Record<string, unknown>;
  console.log(
    `devices_active=${d.active} offline=${d.offline} disabled=${d.disabled} pending=${d.pending} paired_non_disabled=${d.paired_non_disabled}`,
  );

  const storage = await c.execute(
    `SELECT COALESCE(SUM(file_size),0) AS committed FROM media_assets`,
  );
  console.log(`committed_storage_bytes=${storage.rows[0]?.committed}`);

  const reserved = await c.execute(
    `SELECT COALESCE(SUM(expected_bytes),0) AS reserved FROM storage_reservations WHERE status='RESERVED'`,
  );
  console.log(`reserved_storage_bytes=${reserved.rows[0]?.reserved}`);

  const dups = await c.execute(`
    SELECT COUNT(*) AS groups FROM (
      SELECT tenant_id, checksum FROM media_assets
      WHERE checksum IS NOT NULL
      GROUP BY tenant_id, checksum HAVING COUNT(*) > 1
    )
  `);
  console.log(`duplicate_tenant_checksum_groups=${dups.rows[0]?.groups}`);

  console.log("=== TENANTS (for pilot authorization — no selection) ===");
  const tenants = await c.execute(`
    SELECT t.id, t.slug, t.name, t.status,
      (SELECT COUNT(*) FROM devices d WHERE d.tenant_id=t.id AND d.status != 'DISABLED') AS paired_non_disabled,
      (SELECT COALESCE(SUM(m.file_size),0) FROM media_assets m WHERE m.tenant_id=t.id) AS committed_bytes
    FROM tenants t
    ORDER BY t.slug ASC
  `);
  for (const row of tenants.rows) {
    const r = row as Record<string, unknown>;
    console.log(
      `tenant slug=${r.slug} id=${String(r.id).slice(0, 12)}… status=${r.status} devices_paired_non_disabled=${r.paired_non_disabled} committed_bytes=${r.committed_bytes}`,
    );
  }
  console.log(`tenant_count=${tenants.rows.length}`);
  console.log("authorized_pilot_tenant=NONE");
  console.log("mutations=none");
  console.log("read_only=true");
}

main().catch((e) => {
  console.error(String(e).replace(/[A-Za-z0-9_-]{24,}/g, "REDACTED"));
  process.exit(1);
});
