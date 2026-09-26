/**
 * PI-10P — Provision dedicated Preview Turso database (never Production).
 *
 * Requires:
 *   TURSO_API_TOKEN  — Platform API token (NOT the SQL DATABASE_AUTH_TOKEN)
 *   TURSO_ORG        — organization slug
 *
 * Optional:
 *   TURSO_PREVIEW_DB_NAME (default: vitrine360-preview)
 *   TURSO_GROUP (default: default)
 *
 * Writes Preview credentials to `.env.preview.local` (do not commit).
 * Does NOT write Vercel Production env. Does NOT print secret values.
 */
import { config } from "dotenv";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

config({ path: ".env.local" });

const DB_NAME = process.env.TURSO_PREVIEW_DB_NAME || "vitrine360-preview";
const GROUP = process.env.TURSO_GROUP || "default";
const ORG = process.env.TURSO_ORG || "";
const TOKEN = process.env.TURSO_API_TOKEN || process.env.TURSO_PLATFORM_TOKEN || "";
const API = "https://api.turso.tech/v1";

function status(v: string | undefined | null) {
  return v && String(v).trim() ? "SET" : "NOT SET";
}

async function api(
  method: string,
  pathSuffix: string,
  body?: Record<string, unknown>,
) {
  const res = await fetch(`${API}/organizations/${ORG}${pathSuffix}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text.slice(0, 200) };
  }
  return { status: res.status, json };
}

async function main() {
  console.log("PI-10P Turso Preview provisioner");
  console.log(`TURSO_API_TOKEN=${status(TOKEN)}`);
  console.log(`TURSO_ORG=${status(ORG)}`);
  console.log(`preview_db_name=${DB_NAME}`);
  console.log(`group=${GROUP}`);

  if (!TOKEN || !ORG) {
    console.error(
      "BLOCKED: set TURSO_API_TOKEN (Platform API) and TURSO_ORG before provisioning.",
    );
    console.error(
      "SQL TURSO_AUTH_TOKEN from .env.local is NOT a Platform API token.",
    );
    process.exit(2);
  }

  let created = false;
  const create = await api("POST", "/databases", {
    name: DB_NAME,
    group: GROUP,
  });
  if (create.status === 200 || create.status === 201) {
    created = true;
  } else if (
    create.status === 409 ||
    /already exists|conflict/i.test(JSON.stringify(create.json))
  ) {
    console.log("database_exists=true (reuse)");
  } else {
    console.error(
      `create_failed status=${create.status} body=${JSON.stringify(create.json).replace(/[A-Za-z0-9_-]{24,}/g, "REDACTED")}`,
    );
    process.exit(1);
  }
  console.log(`database_created=${created}`);

  const get = await api("GET", `/databases/${DB_NAME}`);
  if (get.status !== 200) {
    console.error(`get_failed status=${get.status}`);
    process.exit(1);
  }
  const dbObj =
    (get.json as { database?: Record<string, string> })?.database ||
    (get.json as Record<string, string>);
  const hostname =
    dbObj.Hostname ||
    dbObj.hostname ||
    `${DB_NAME}-${ORG}.turso.io`;
  const databaseUrl = hostname.startsWith("libsql://")
    ? hostname
    : `libsql://${String(hostname).replace(/^https?:\/\//, "")}`;

  const tok = await api(
    "POST",
    `/databases/${DB_NAME}/auth/tokens?expiration=never&authorization=full-access`,
  );
  if (tok.status !== 200) {
    console.error(`token_failed status=${tok.status}`);
    process.exit(1);
  }
  const jwt =
    (tok.json as { jwt?: string })?.jwt ||
    (tok.json as { token?: string })?.token ||
    "";
  if (!jwt) {
    console.error("token_failed empty jwt");
    process.exit(1);
  }

  const outPath = path.join(process.cwd(), ".env.preview.local");
  const authSecret = randomBytes(48).toString("hex");
  const body = [
    `# PI-10P Preview-only secrets — DO NOT copy to Production`,
    `# Generated ${new Date().toISOString()}`,
    `DATABASE_URL=${databaseUrl}`,
    `DATABASE_AUTH_TOKEN=${jwt}`,
    `TURSO_DATABASE_URL=${databaseUrl}`,
    `TURSO_AUTH_TOKEN=${jwt}`,
    `AUTH_SECRET=${authSecret}`,
    `ENTITLEMENTS_ENABLED=false`,
    `MEDIA_STORAGE_PROVIDER=r2`,
    `R2_BUCKET_NAME=vitrine360-preview`,
    `# Fill R2_* Preview-specific keys separately (prefer bucket-scoped)`,
    ``,
  ].join("\n");
  fs.writeFileSync(outPath, body, { encoding: "utf8", mode: 0o600 });

  console.log("wrote=.env.preview.local");
  console.log(`preview_db_identity=${DB_NAME}`);
  console.log("preview_db_url=REDACTED");
  console.log("preview_db_token=REDACTED");
  console.log("AUTH_SECRET=SET (new, Preview-only)");
  console.log("environment=PREVIEW");
  console.log(
    "Next: wire Vercel Preview env from .env.preview.local (target=preview only), migrate, deploy.",
  );
}

main().catch((err) => {
  console.error(String(err).replace(/[A-Za-z0-9_-]{24,}/g, "REDACTED"));
  process.exit(1);
});
