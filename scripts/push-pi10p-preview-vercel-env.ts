/**
 * PI-10P — Push Preview-only Vercel env via `vercel env add` (CLI auth).
 * Never prints secret values. Never targets Production.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";

const PREVIEW_HOST =
  "libsql://vitrine360-preview-elemos.aws-us-west-2.turso.io";
const PRODUCTION_HOST =
  "libsql://vitrine360-vercel-icfg-rd8hoku6p0oaszo88ixdwcu4.aws-us-east-1.turso.io";
const PREVIEW_BUCKET = "vitrine360-preview";

function status(v: string | undefined | null) {
  return v && String(v).trim() ? "PRESENT" : "ABSENT";
}

function parseEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};
  const out: Record<string, string> = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

function upsert(
  key: string,
  value: string,
  opts: { sensitive?: boolean } = {},
) {
  const args = [
    "vercel",
    "env",
    "add",
    key,
    "preview",
    "--yes",
    "--force",
    "--non-interactive",
  ];
  if (opts.sensitive) args.push("--sensitive");
  else args.push("--no-sensitive");

  const r = spawnSync("npx", args, {
    input: value,
    encoding: "utf8",
    shell: true,
    cwd: process.cwd(),
  });
  const out = `${r.stdout || ""}\n${r.stderr || ""}`
    .replace(/[A-Za-z0-9_-]{24,}/g, "REDACTED")
    .trim();
  if (r.status !== 0) {
    console.error(`FAIL ${key} exit=${r.status} ${out.slice(0, 300)}`);
    process.exit(1);
  }
  console.log(`OK ${key} target=preview sensitive=${Boolean(opts.sensitive)}`);
}

async function main() {
  const preview = parseEnvFile(".env.preview.local");
  const local = parseEnvFile(".env.local");

  const dbUrl = preview.DATABASE_URL || preview.TURSO_DATABASE_URL || "";
  const dbTok =
    preview.DATABASE_AUTH_TOKEN || preview.TURSO_AUTH_TOKEN || "";
  const authSecret = preview.AUTH_SECRET || "";

  console.log("PI-10P push Preview Vercel env (CLI)");
  console.log(`DATABASE_URL=${status(dbUrl)}`);
  console.log(`DATABASE_AUTH_TOKEN=${status(dbTok)}`);
  console.log(`AUTH_SECRET=${status(authSecret)}`);

  if (!dbUrl || !dbTok || !authSecret) {
    console.error("STOP: Preview DB/AUTH secrets ABSENT");
    process.exit(2);
  }
  if (dbUrl === PRODUCTION_HOST || dbUrl !== PREVIEW_HOST) {
    console.error("STOP: Preview DATABASE_URL guard failed");
    process.exit(2);
  }

  const accountId = local.R2_ACCOUNT_ID || "";
  const accessKey = local.R2_ACCESS_KEY_ID || "";
  const secretKey = local.R2_SECRET_ACCESS_KEY || "";
  let endpoint =
    local.R2_ENDPOINT ||
    (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : "");
  if (endpoint.endsWith(`/${PREVIEW_BUCKET}`)) {
    endpoint = endpoint.slice(0, -(PREVIEW_BUCKET.length + 1));
  }
  if (endpoint.endsWith("/vitrine360")) {
    endpoint = endpoint.slice(0, -"/vitrine360".length);
  }

  console.log(`R2_ACCOUNT_ID=${status(accountId)}`);
  console.log(`R2_ACCESS_KEY_ID=${status(accessKey)}`);
  console.log(`R2_SECRET_ACCESS_KEY=${status(secretKey)}`);
  console.log(`R2_ENDPOINT=${status(endpoint)}`);
  console.log(`R2_BUCKET_NAME=${PREVIEW_BUCKET}`);

  if (!accountId || !accessKey || !secretKey || !endpoint) {
    console.error("STOP: R2 credentials ABSENT");
    process.exit(2);
  }

  upsert("ENTITLEMENTS_ENABLED", "false");
  upsert("MEDIA_STORAGE_PROVIDER", "r2");
  upsert("R2_BUCKET_NAME", PREVIEW_BUCKET);
  upsert("R2_ACCOUNT_ID", accountId);
  upsert("R2_ENDPOINT", endpoint);
  upsert("DATABASE_URL", dbUrl);
  upsert("TURSO_DATABASE_URL", dbUrl);
  upsert("DATABASE_AUTH_TOKEN", dbTok, { sensitive: true });
  upsert("TURSO_AUTH_TOKEN", dbTok, { sensitive: true });
  upsert("AUTH_SECRET", authSecret, { sensitive: true });
  upsert("R2_ACCESS_KEY_ID", accessKey, { sensitive: true });
  upsert("R2_SECRET_ACCESS_KEY", secretKey, { sensitive: true });

  // Temporary until Preview URL known
  upsert("NEXT_PUBLIC_APP_URL", "https://vitrine360-psi.vercel.app");
  upsert("APP_URL", "https://vitrine360-psi.vercel.app");

  // Optional Google OAuth on Preview (same client as Production if present locally)
  if (local.GOOGLE_CLIENT_ID && local.GOOGLE_CLIENT_SECRET) {
    upsert("GOOGLE_CLIENT_ID", local.GOOGLE_CLIENT_ID, { sensitive: true });
    upsert("GOOGLE_CLIENT_SECRET", local.GOOGLE_CLIENT_SECRET, {
      sensitive: true,
    });
    console.log("GOOGLE_OAUTH=PRESENT_ON_PREVIEW");
  } else {
    console.log("GOOGLE_OAUTH=ABSENT (password login still available)");
  }

  console.log("push_preview_env=SUCCESS");
  console.log("production_env_mutated=false");
}

main().catch((e) => {
  console.error(String(e).replace(/[A-Za-z0-9_-]{24,}/g, "REDACTED"));
  process.exit(1);
});
