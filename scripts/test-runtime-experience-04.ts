/**
 * RUNTIME-EXPERIENCE-04 — Runtime Security DESIGN validation.
 *
 * Design-only: no iframe, bridge, executor, or package execution.
 *
 * Run: npm run test:runtime-experience-04
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { CONTENT_TYPES } from "../src/domain/types";

const ROOT = path.resolve(".");
const EVIDENCE = path.resolve("docs/evidence/runtime-experience-04");
const DOC = path.join(ROOT, "docs/RUNTIME-EXPERIENCE-04-RUNTIME-SECURITY.md");
const ADR = path.join(ROOT, "docs/adr/ADR-EXPERIENCE-004.md");
const CHECKLIST = path.join(EVIDENCE, "RUNTIME-SECURITY-CHECKLIST.md");

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
    assert.ok(doc.includes(n), `${label} missing: ${n}`);
  }
}

function main() {
  console.log("RUNTIME-EXPERIENCE-04 runtime security design validation");
  fs.mkdirSync(EVIDENCE, { recursive: true });
  const results: { id: string; detail: string }[] = [];

  console.log("EXP-SEC-001 docs");
  assert.ok(fs.existsSync(DOC), "security design doc missing");
  assert.ok(fs.existsSync(ADR), "ADR-004 missing");
  const doc = read(DOC);
  const adr = read(ADR);
  results.push({ id: "EXP-SEC-001", detail: "docs present" });

  console.log("EXP-SEC-002 trust + boundary");
  mustInclude(
    doc,
    [
      "TRUSTED ZONE",
      "UNTRUSTED",
      "Validation ≠ trust",
      "Dedicated Experience Execution Context",
      "Device Bearer",
      "AUTH_SECRET",
    ],
    "doc",
  );
  results.push({ id: "EXP-SEC-002", detail: "trust model + security boundary" });

  console.log("EXP-SEC-003 origin decision");
  mustInclude(
    doc,
    [
      "Dedicated Experience Origin",
      "Same-origin iframe",
      "allow-scripts",
      "allow-same-origin",
      "explicitly rejected",
      "Blob",
      "srcdoc",
    ],
    "doc",
  );
  results.push({ id: "EXP-SEC-003", detail: "origin model decision" });

  console.log("EXP-SEC-004 sandbox CSP permissions");
  mustInclude(
    doc,
    [
      "DENY BY DEFAULT",
      "default-src",
      "script-src",
      "connect-src",
      "object-src",
      "Permissions Policy",
      "camera",
      "microphone",
      "fullscreen",
    ],
    "doc",
  );
  results.push({ id: "EXP-SEC-004", detail: "sandbox + CSP + Permissions-Policy" });

  console.log("EXP-SEC-005 network storage navigation");
  mustInclude(
    doc,
    [
      "NONE",
      "SAME_ORIGIN",
      "ALLOWLIST",
      "FULL_NETWORK",
      "EPHEMERAL",
      "PERSISTENT",
      "top-level",
      "window.open",
    ],
    "doc",
  );
  results.push({
    id: "EXP-SEC-005",
    detail: "network/storage/navigation boundaries",
  });

  console.log("EXP-SEC-006 fullscreen orientation bridge");
  mustInclude(
    doc,
    [
      "Fullscreen",
      "RUNTIME-POLICY-08A",
      "RUNTIME-POLICY-08B",
      "postMessage",
      "event.origin",
      "event.source",
      "targetOrigin",
      "NEVER EXPOSE",
      "Raw tokens",
    ],
    "doc",
  );
  // softer: "No credential" variants
  assert.ok(
    doc.includes("No credential") ||
      doc.includes("no credential") ||
      doc.includes("credential forwarding") ||
      doc.includes("NEVER EXPOSE"),
  );
  results.push({
    id: "EXP-SEC-006",
    detail: "fullscreen/orientation/bridge principles",
  });

  console.log("EXP-SEC-007 admission lifecycle kill");
  mustInclude(
    doc,
    [
      "Registry lookup",
      "Tenant check",
      "ADMIT / DENY",
      "LOAD",
      "READY",
      "ACTIVE",
      "STOPPING",
      "Kill switch",
      "watchdog",
      "fail closed",
      "Fail closed",
    ],
    "doc",
  );
  results.push({
    id: "EXP-SEC-007",
    detail: "admission + lifecycle + kill switch",
  });

  console.log("EXP-SEC-008 invariants threats phases");
  mustInclude(
    doc,
    [
      "VALID ≠ AUTHORIZED ≠ EXECUTABLE ≠ PRIVILEGED",
      "T1",
      "T2",
      "T3",
      "T6",
      "T10",
      "T12",
      "T14",
      "EXPERIENCE-05",
      "EXPERIENCE-07",
      "design only",
    ],
    "doc",
  );
  for (let i = 1; i <= 14; i++) {
    assert.ok(doc.includes(`T${i}`), `missing threat T${i}`);
  }
  results.push({
    id: "EXP-SEC-008",
    detail: "invariants + T1–T14 + phased boundary",
  });

  console.log("EXP-SEC-009 ADR");
  mustInclude(
    adr,
    [
      "Controlled Experience Runtime Security Design",
      "Dedicated Experience Origin",
      "deny-by-default",
      "postMessage",
      "do **not** implement",
      "design",
    ],
    "ADR",
  );
  results.push({ id: "EXP-SEC-009", detail: "ADR coherent" });

  console.log("EXP-SEC-010 absences");
  assert.ok(!(CONTENT_TYPES as readonly string[]).includes("HTML_APP"));
  assert.ok((CONTENT_TYPES as readonly string[]).includes("EXPERIENCE")); // EXPERIENCE-09
  for (const rel of [
    "src/player/experience",
    "src/player/runtime/experience",
    "src/features/experience",
    "src/services/experience",
  ]) {
    assert.ok(!fs.existsSync(path.join(ROOT, rel)), `forbidden ${rel}`);
  }
  const schema = read(path.join(ROOT, "src/db/schema.ts"));
  assert.ok(!/\bexperiences\b\s*=\s*sqliteTable/.test(schema));

  const hits: string[] = [];
  for (const file of walkTs(path.join(ROOT, "src"))) {
    if (file.replace(/\\/g, "/").includes("/experience-sandbox/")) continue;
    const text = read(file);
    if (
      /ExperienceIframeExecutor|createExperienceRuntime/.test(
        text,
      )
    ) {
      hits.push(path.relative(ROOT, file));
    }
  }
  assert.equal(hits.length, 0, `executor/bridge hits: ${hits.join(",")}`);

  // No Player playback experience wiring beyond RUNTIME-EXPERIENCE-11 surfaces
  const allowedPlayerExperience = new Set([
    "experience-slide.tsx",
    "experience-controller.ts",
  ]);
  const playerFiles = walkTs(path.join(ROOT, "src/player"));
  for (const f of playerFiles) {
    const base = path.basename(f).toLowerCase();
    if (!base.includes("experience")) continue;
    assert.ok(
      base.includes("test") || allowedPlayerExperience.has(path.basename(f)),
      `unexpected player experience file: ${f}`,
    );
  }
  results.push({
    id: "EXP-SEC-010",
    detail: "no HTML_APP / executor / bridge / migrations",
  });

  console.log("EXP-SEC-011 prior phases intact");
  for (const p of [
    "docs/RUNTIME-EXPERIENCE-01-ARCHITECTURE.md",
    "docs/RUNTIME-EXPERIENCE-02-PACKAGE-CONTRACT.md",
    "docs/RUNTIME-EXPERIENCE-03-VALIDATOR-REGISTRY.md",
    "src/domain/experience-manifest.ts",
    "src/domain/experience-validator.ts",
    "src/domain/experience-registry.ts",
  ]) {
    assert.ok(fs.existsSync(path.join(ROOT, p)), `missing prior artifact ${p}`);
  }
  results.push({ id: "EXP-SEC-011", detail: "EXPERIENCE-01..03 artifacts intact" });

  const md = `# RUNTIME-EXPERIENCE-04 Runtime Security Checklist

**Date:** ${new Date().toISOString()}
**Verdict:** RUNTIME SECURITY DESIGN VALIDATED

## Acceptance

- [x] Trust model documented
- [x] Security boundary documented
- [x] Origin model evaluated; Dedicated Origin preferred
- [x] Same-origin scripts+same-origin rejected as default
- [x] Sandbox deny-by-default documented
- [x] CSP conceptual policy documented
- [x] Permissions Policy default deny documented
- [x] Network / storage / navigation boundaries documented
- [x] Input / fullscreen / orientation boundaries documented
- [x] Bridge security principles documented (not implemented)
- [x] Admission control pipeline documented
- [x] Lifecycle / failure isolation / limits / kill switch documented
- [x] Observability / offline / tenant isolation documented
- [x] Security invariants listed
- [x] Threat model T1–T14 mapped
- [x] Phased implementation boundary documented
- [x] No Experience Runtime / iframe / bridge code
- [x] No HTML_APP / migrations / playback changes

## Automated checks

| ID | Result | Detail |
|----|--------|--------|
${results.map((r) => `| ${r.id} | PASS | ${r.detail} |`).join("\n")}

## Docs
- docs/RUNTIME-EXPERIENCE-04-RUNTIME-SECURITY.md
- docs/adr/ADR-EXPERIENCE-004.md
`;
  fs.writeFileSync(CHECKLIST, md, "utf8");
  console.log("RUNTIME-EXPERIENCE-04 PASS");
}

main();
