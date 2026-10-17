/**
 * F-05 — Static discipline: admin API handlers must not authorize from
 * client-supplied tenantId/workspaceId.
 *
 * Allowlist: workspace switch intentionally accepts body.tenantId *after*
 * membership verification (not as the sole authority).
 *
 * Exit 0 = clean; exit 1 = suspicious client-tenant trust patterns.
 */
import fs from "node:fs";
import path from "node:path";

const ADMIN_ROOT = path.join(process.cwd(), "src", "app", "api", "admin");
const WORKSPACES = path.join(process.cwd(), "src", "app", "api", "workspaces");

/** Relative paths allowed to read body.tenantId (must still verify membership). */
const ALLOWLIST = new Set([
  "src/app/api/workspaces/switch/route.ts",
]);

/**
 * Only flag explicit client-body tenant fields — not session.tenantId after
 * await req.json().
 */
const SUSPICIOUS = [
  /\bbody\.tenantId\b/,
  /\bbody\.workspaceId\b/,
  /\bparsed\.tenantId\b/,
  /\bdata\.tenantId\b/,
  /tenantId:\s*body\.[a-zA-Z]/,
];

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name === "route.ts") out.push(full);
  }
  return out;
}

function rel(p: string) {
  return path.relative(process.cwd(), p).replace(/\\/g, "/");
}

function main() {
  const files = [...walk(ADMIN_ROOT), ...walk(WORKSPACES)];
  const hits: { file: string; match: string }[] = [];

  for (const file of files) {
    const key = rel(file);
    if (ALLOWLIST.has(key)) continue;
    const src = fs.readFileSync(file, "utf8");
    for (const re of SUSPICIOUS) {
      const m = src.match(re);
      if (m) hits.push({ file: key, match: m[0].slice(0, 80) });
    }
  }

  console.log(`check-admin-client-tenant: scanned ${files.length} route(s)`);
  if (hits.length) {
    console.error("Possible client-supplied tenant trust (review / allowlist):");
    for (const h of hits) console.error(`  FAIL ${h.file} :: ${h.match}`);
    process.exit(1);
  }
  console.log(
    "no unallowlisted client tenantId patterns in admin/workspaces APIs",
  );
}

main();
