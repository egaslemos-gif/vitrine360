/**
 * F-01 — Static inventory: privileged API routes must invoke an auth guard.
 *
 * Scans src/app/api/admin route.ts files and selected workspace routes.
 * Allowlist entries must document why requireSession is not used.
 *
 * Exit 0 = all routes guarded; exit 1 = missing guard(s).
 * Does not prove authorization correctness — only that a gate is present.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(process.cwd(), "src", "app", "api");

/** Routes that intentionally use getSession / alternate policy (document why). */
const ALLOWLIST: Record<string, string> = {
  // OAuth return may land without a prior requireSession(permission) call;
  // handlers must still call getSession() and bind tenant/user (when present).
};

const GUARD_RE =
  /\b(requireSession|requireRole|requirePermission|requireAdminPage|getSession|authenticateDevice)\s*\(/;

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
  const targets = [
    ...walk(path.join(ROOT, "admin")),
    ...walk(path.join(ROOT, "workspaces")),
  ];

  const missing: string[] = [];
  const ok: string[] = [];

  for (const file of targets) {
    const key = rel(file);
    const src = fs.readFileSync(file, "utf8");
    if (ALLOWLIST[key]) {
      ok.push(`${key} (allowlist: ${ALLOWLIST[key]})`);
      continue;
    }
    if (!GUARD_RE.test(src)) {
      missing.push(key);
    } else {
      ok.push(key);
    }
  }

  console.log(`check-admin-route-guards: scanned ${targets.length} route(s)`);
  for (const line of ok) console.log(`  OK  ${line}`);
  if (missing.length) {
    console.error("\nMissing auth guard (requireSession / getSession / …):");
    for (const m of missing) console.error(`  FAIL ${m}`);
    process.exit(1);
  }
  console.log("all privileged routes reference an auth guard");
}

main();
