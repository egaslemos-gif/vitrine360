/**
 * PI-10P — Resolve cohort expansion authorization identity (Production Turso only).
 * Read-only. Never prints secrets.
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
  const identity = process.argv[2] || "admin@vitrine360.local";
  const { url, token, host } = resolveProdUrl();
  console.log(`identity=${identity}`);
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

  const c = createClient({ url, authToken: token });
  const users = await c.execute({
    sql: "SELECT id, email, name FROM users WHERE lower(email)=lower(?)",
    args: [identity],
  });
  console.log(`users_found=${users.rows.length}`);
  for (const u of users.rows) {
    console.log(`user_id=${u.id}`);
    console.log(`user_email=${u.email}`);
    console.log(`user_name=${u.name ?? ""}`);
    const mem = await c.execute({
      sql: `SELECT m.role, m.status AS membership_status, t.id AS tenant_id, t.slug, t.status AS tenant_status, t.name AS tenant_name
            FROM memberships m JOIN tenants t ON t.id=m.tenant_id WHERE m.user_id=?`,
      args: [u.id as string],
    });
    console.log(`memberships=${mem.rows.length}`);
    for (const m of mem.rows) {
      console.log(
        `membership role=${m.role} mem_status=${m.membership_status} slug=${m.slug} tenant_status=${m.tenant_status} tenant_id=${m.tenant_id}`,
      );
      const usageDev = await c.execute({
        sql: `SELECT COUNT(*) AS n FROM devices WHERE tenant_id=? AND status != 'DISABLED'`,
        args: [m.tenant_id as string],
      });
      const usageStor = await c.execute({
        sql: `SELECT COALESCE(SUM(file_size),0) AS n FROM media_assets WHERE tenant_id=?`,
        args: [m.tenant_id as string],
      });
      const usageRes = await c.execute({
        sql: `SELECT COALESCE(SUM(expected_bytes),0) AS n FROM storage_reservations WHERE tenant_id=? AND status='RESERVED'`,
        args: [m.tenant_id as string],
      });
      const tp = await c.execute({
        sql: `SELECT tp.status, p.key FROM tenant_plans tp JOIN plans p ON p.id=tp.plan_id WHERE tp.tenant_id=?`,
        args: [m.tenant_id as string],
      });
      console.log(
        `usage devices=${usageDev.rows[0]?.n} committed=${usageStor.rows[0]?.n} reserved=${usageRes.rows[0]?.n}`,
      );
      console.log(`tenant_plans=${JSON.stringify(tp.rows)}`);
    }
  }

  // Also try as slug
  const bySlug = await c.execute({
    sql: "SELECT id, slug, status, name FROM tenants WHERE slug=?",
    args: [identity],
  });
  console.log(`tenants_by_slug=${JSON.stringify(bySlug.rows)}`);

  const active = await c.execute(
    `SELECT t.slug, p.key, tp.status FROM tenant_plans tp
     JOIN tenants t ON t.id=tp.tenant_id JOIN plans p ON p.id=tp.plan_id
     WHERE tp.status='ACTIVE'`,
  );
  console.log(`active_tenant_plans=${JSON.stringify(active.rows)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
