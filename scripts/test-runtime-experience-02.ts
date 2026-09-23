/**
 * RUNTIME-EXPERIENCE-02 — Package & Manifest CONTRACT validation.
 *
 * Design-contract only: does not upload, parse packages, create iframes,
 * or execute Experience JavaScript.
 *
 * Run: npm run test:runtime-experience-02
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { CONTENT_TYPES } from "../src/domain/types";

const ROOT = path.resolve(".");
const EVIDENCE = path.resolve("docs/evidence/runtime-experience-02");
const CONTRACT = path.join(ROOT, "docs/RUNTIME-EXPERIENCE-02-PACKAGE-CONTRACT.md");
const ADR = path.join(ROOT, "docs/adr/ADR-EXPERIENCE-002.md");
const CHECKLIST = path.join(
  EVIDENCE,
  "PACKAGE-CONTRACT-CHECKLIST.md",
);

function read(p: string): string {
  return fs.readFileSync(p, "utf8");
}

function walkTs(dir: string, acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    if (["node_modules", ".next", "dist", ".git"].includes(name)) continue;
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walkTs(full, acc);
    else if (/\.(ts|tsx)$/.test(name)) acc.push(full);
  }
  return acc;
}

function mustInclude(doc: string, needles: string[], label: string) {
  for (const n of needles) {
    assert.ok(
      doc.includes(n),
      `${label} missing required text: ${n}`,
    );
  }
}

function main() {
  console.log("RUNTIME-EXPERIENCE-02 package contract validation");
  fs.mkdirSync(EVIDENCE, { recursive: true });

  const results: { id: string; detail: string }[] = [];

  // EXP-CONTRACT-001 docs exist
  console.log("EXP-CONTRACT-001 docs");
  assert.ok(fs.existsSync(CONTRACT), "contract doc missing");
  assert.ok(fs.existsSync(ADR), "ADR missing");
  assert.ok(fs.existsSync(CHECKLIST), "checklist missing");
  const contract = read(CONTRACT);
  const adr = read(ADR);
  results.push({ id: "EXP-CONTRACT-001", detail: "docs present" });

  // EXP-CONTRACT-002 mandatory manifest fields
  console.log("EXP-CONTRACT-002 manifest fields");
  mustInclude(
    contract,
    [
      "schemaVersion",
      '"id"',
      "entrypoint",
      "assets",
      "dependencies",
      "capabilities",
      "permissions",
      "networkPolicy",
      "offlineRequirements",
      "runtimeLimits",
      "storagePolicy",
    ],
    "contract",
  );
  results.push({ id: "EXP-CONTRACT-002", detail: "manifest fields documented" });

  // EXP-CONTRACT-003 package structure
  console.log("EXP-CONTRACT-003 package structure");
  mustInclude(
    contract,
    ["experience.zip", "manifest.json", "index.html", "Path traversal", "Symlinks"],
    "contract",
  );
  results.push({ id: "EXP-CONTRACT-003", detail: "package structure documented" });

  // EXP-CONTRACT-004 deny-by-default
  console.log("EXP-CONTRACT-004 deny-by-default");
  mustInclude(
    contract,
    ["NONE", "**Default.**", "deny-by-default", "all default `false`"],
    "contract",
  );
  assert.ok(/networkPolicy[\s\S]*NONE/i.test(contract));
  assert.ok(/storagePolicy[\s\S]*NONE/i.test(contract));
  results.push({ id: "EXP-CONTRACT-004", detail: "deny-by-default documented" });

  // EXP-CONTRACT-005 capability ≠ permission
  console.log("EXP-CONTRACT-005 capability vs permission");
  mustInclude(
    contract,
    [
      "Declared ≠ available ≠ allowed",
      "Device ∩ Requested ∩ Permission",
      "Unsupported ≠ unauthorized",
    ],
    "contract",
  );
  results.push({
    id: "EXP-CONTRACT-005",
    detail: "capability ≠ permission documented",
  });

  // EXP-CONTRACT-006 integrity ≠ authenticity
  console.log("EXP-CONTRACT-006 integrity");
  mustInclude(
    contract,
    ["integrity ≠ authenticity ≠ authorization", "SHA-256"],
    "contract",
  );
  results.push({ id: "EXP-CONTRACT-006", detail: "integrity model documented" });

  // EXP-CONTRACT-007 tenant isolation
  console.log("EXP-CONTRACT-007 multi-tenancy");
  mustInclude(
    contract,
    [
      "tenant scope MUST be enforced",
      "Tenant A package must never resolve",
    ],
    "contract",
  );
  results.push({ id: "EXP-CONTRACT-007", detail: "multi-tenancy documented" });

  // EXP-CONTRACT-008 lifecycle + validation states
  console.log("EXP-CONTRACT-008 lifecycle / validation");
  mustInclude(
    contract,
    [
      "LOAD",
      "INIT",
      "READY",
      "ACTIVE",
      "PAUSED",
      "STOPPING",
      "STOPPED",
      "ERROR",
      "UNVALIDATED",
      "VALIDATING",
      "VALID",
      "INVALID",
      "INCOMPATIBLE",
      "BLOCKED",
    ],
    "contract",
  );
  results.push({
    id: "EXP-CONTRACT-008",
    detail: "lifecycle + validation states documented",
  });

  // EXP-CONTRACT-009 error model
  console.log("EXP-CONTRACT-009 error model");
  mustInclude(
    contract,
    [
      "EXPERIENCE_INVALID_MANIFEST",
      "EXPERIENCE_UNSUPPORTED_SCHEMA",
      "EXPERIENCE_ENTRYPOINT_INVALID",
      "EXPERIENCE_ASSET_INTEGRITY_FAILED",
      "EXPERIENCE_PERMISSION_DENIED",
      "EXPERIENCE_BLOCKED",
    ],
    "contract",
  );
  results.push({ id: "EXP-CONTRACT-009", detail: "error model documented" });

  // EXP-CONTRACT-010 versioning separation + UNSPECIFIED limits
  console.log("EXP-CONTRACT-010 versioning / limits");
  mustInclude(
    contract,
    [
      "schemaVersion",
      "MAJOR.MINOR.PATCH",
      "Runtime compatibility",
      "UNSPECIFIED",
    ],
    "contract",
  );
  assert.ok(
    contract.includes("Experience / package version") ||
      contract.includes("Experience version"),
  );
  results.push({
    id: "EXP-CONTRACT-010",
    detail: "version axes + UNSPECIFIED limits",
  });

  // EXP-CONTRACT-011 threat mapping
  console.log("EXP-CONTRACT-011 threats");
  for (const t of [
    "T1",
    "T2",
    "T3",
    "T6",
    "T10",
    "T12",
    "T13",
    "T14",
  ]) {
    assert.ok(contract.includes(t), `missing threat ${t}`);
  }
  results.push({ id: "EXP-CONTRACT-011", detail: "threat mapping present" });

  // EXP-CONTRACT-012 ADR
  console.log("EXP-CONTRACT-012 ADR");
  mustInclude(
    adr,
    [
      "Experience Package & Manifest Contract",
      "schemaVersion",
      "deny",
      "UNSPECIFIED",
      "Do not",
    ],
    "ADR",
  );
  results.push({ id: "EXP-CONTRACT-012", detail: "ADR coherent" });

  // EXP-CONTRACT-013 no HTML_APP / no executor / no migration
  console.log("EXP-CONTRACT-013 absences");
  assert.ok(!(CONTENT_TYPES as readonly string[]).includes("HTML_APP"));
  assert.ok(!(CONTENT_TYPES as readonly string[]).includes("EXPERIENCE"));
  for (const rel of [
    "src/player/experience",
    "src/player/runtime/experience",
    "src/features/experience",
    "src/services/experience",
  ]) {
    assert.ok(!fs.existsSync(path.join(ROOT, rel)), `forbidden path ${rel}`);
  }
  const schema = read(path.join(ROOT, "src/db/schema.ts"));
  assert.ok(
    !/\bexperiences\b\s*=\s*sqliteTable|experienceVersions/.test(schema),
  );
  const hits: string[] = [];
  for (const file of walkTs(path.join(ROOT, "src"))) {
    const text = read(file);
    if (
      /ExperienceSandboxHost|ExperienceIframeExecutor|createExperienceRuntime/.test(
        text,
      )
    ) {
      hits.push(path.relative(ROOT, file));
    }
  }
  assert.equal(hits.length, 0, `executor hits: ${hits.join(",")}`);
  results.push({
    id: "EXP-CONTRACT-013",
    detail: "no HTML_APP / executor / Experience schema",
  });

  // EXP-CONTRACT-014 UPLOAD ≠ TRUST principles
  console.log("EXP-CONTRACT-014 principles");
  mustInclude(
    contract,
    ["UPLOAD ≠ TRUST", "VALIDATE ≠ AUTHORIZE", "`VALID` ≠ authorized"],
    "contract",
  );
  results.push({ id: "EXP-CONTRACT-014", detail: "trust principles documented" });

  const md = `# RUNTIME-EXPERIENCE-02 Package Contract Checklist

**Date:** ${new Date().toISOString()}
**Verdict:** CONTRACT VALIDATED

| ID | Result | Detail |
|----|--------|--------|
${results.map((r) => `| ${r.id} | PASS | ${r.detail} |`).join("\n")}

## Confirmed absences
- HTML_APP / EXPERIENCE not in CONTENT_TYPES
- No Experience Runtime / sandbox executor under src/
- No Experience tables in schema

## Docs
- docs/RUNTIME-EXPERIENCE-02-PACKAGE-CONTRACT.md
- docs/adr/ADR-EXPERIENCE-002.md
`;
  fs.writeFileSync(CHECKLIST, md, "utf8");

  console.log("RUNTIME-EXPERIENCE-02 PASS");
}

main();
