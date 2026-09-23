/**
 * RUNTIME-EXPERIENCE-01 — Architecture validation (no Experience Runtime).
 *
 * Asserts that this phase did NOT ship:
 * - HTML_APP content enum
 * - Experience executor / sandbox host
 * - Functional postMessage experience bridge
 * - Experience DB migrations
 *
 * Run: npm run test:runtime-experience-01
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { CONTENT_TYPES } from "../src/domain/types";

const ROOT = path.resolve(".");
const EVIDENCE = path.resolve("docs/evidence/runtime-experience-01");

function walkTsFiles(dir: string, acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    if (
      name === "node_modules" ||
      name === ".next" ||
      name === "dist" ||
      name === ".git"
    ) {
      continue;
    }
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walkTsFiles(full, acc);
    else if (/\.(ts|tsx|js|jsx)$/.test(name)) acc.push(full);
  }
  return acc;
}

function read(p: string): string {
  return fs.readFileSync(p, "utf8");
}

function main() {
  console.log("RUNTIME-EXPERIENCE-01 architecture validation");
  fs.mkdirSync(EVIDENCE, { recursive: true });

  const checklist: { id: string; ok: boolean; detail: string }[] = [];

  // EXP-ARCH-001 — no HTML_APP in CONTENT_TYPES
  console.log("EXP-ARCH-001 CONTENT_TYPES");
  assert.ok(!CONTENT_TYPES.includes("HTML_APP" as never));
  assert.ok(!(CONTENT_TYPES as readonly string[]).includes("EXPERIENCE"));
  checklist.push({
    id: "EXP-ARCH-001",
    ok: true,
    detail: `CONTENT_TYPES=${CONTENT_TYPES.join(",")}`,
  });

  // EXP-ARCH-002 — architecture docs exist
  console.log("EXP-ARCH-002 docs");
  const archDoc = path.join(ROOT, "docs/RUNTIME-EXPERIENCE-01-ARCHITECTURE.md");
  const adrDoc = path.join(ROOT, "docs/adr/ADR-EXPERIENCE-001.md");
  assert.ok(fs.existsSync(archDoc), "architecture doc missing");
  assert.ok(fs.existsSync(adrDoc), "ADR missing");
  const arch = read(archDoc);
  const adr = read(adrDoc);
  assert.ok(/Trust Model/i.test(arch));
  assert.ok(/Threat Model|T1/i.test(arch));
  assert.ok(/allow-scripts/i.test(arch));
  assert.ok(/allow-same-origin/i.test(arch));
  assert.ok(/UNTRUSTED|SEMI-TRUSTED/i.test(adr));
  assert.ok(/sandboxed iframe/i.test(adr + arch));
  checklist.push({
    id: "EXP-ARCH-002",
    ok: true,
    detail: "ADR + architecture docs present with trust/sandbox/threat coverage",
  });

  // EXP-ARCH-003 — no Experience Runtime module / iframe executor
  console.log("EXP-ARCH-003 no executor");
  const forbiddenPathHints = [
    "src/player/experience",
    "src/player/runtime/experience",
    "src/features/experience",
    "src/services/experience",
  ];
  for (const rel of forbiddenPathHints) {
    assert.ok(
      !fs.existsSync(path.join(ROOT, rel)),
      `forbidden path exists: ${rel}`,
    );
  }
  const srcFiles = walkTsFiles(path.join(ROOT, "src"));
  const executorHits: string[] = [];
  for (const file of srcFiles) {
    const text = read(file);
    // Functional Experience sandbox host / bridge — not mere documentation strings in comments of this audit
    if (
      /sandbox=["']allow-scripts/.test(text) ||
      /createExperienceRuntime|ExperienceSandboxHost|ExperienceIframeExecutor/.test(
        text,
      ) ||
      /postMessage\([^)]*EXPERIENCE_|method:\s*["']REQUEST_FULLSCREEN["']/.test(
        text,
      )
    ) {
      executorHits.push(path.relative(ROOT, file));
    }
  }
  assert.equal(
    executorHits.length,
    0,
    `executor/bridge hits: ${executorHits.join(", ")}`,
  );
  checklist.push({
    id: "EXP-ARCH-003",
    ok: true,
    detail: "No Experience Runtime / sandbox executor under src/",
  });

  // EXP-ARCH-004 — no Experience migration
  console.log("EXP-ARCH-004 no migration");
  const drizzleDir = path.join(ROOT, "drizzle");
  const migrationHits: string[] = [];
  if (fs.existsSync(drizzleDir)) {
    for (const name of fs.readdirSync(drizzleDir)) {
      if (!/\.(sql|json)$/i.test(name)) continue;
      const text = read(path.join(drizzleDir, name));
      if (/create\s+table\s+experiences?/i.test(text) || /experience_versions/i.test(text)) {
        migrationHits.push(name);
      }
    }
  }
  // Also scan schema.ts for experiences table
  const schemaPath = path.join(ROOT, "src/db/schema.ts");
  if (fs.existsSync(schemaPath)) {
    const schema = read(schemaPath);
    assert.ok(
      !/\bexperiences\b\s*=\s*sqliteTable|\bexperienceVersions\b/.test(schema),
      "Experience tables must not appear in schema yet",
    );
  }
  assert.equal(migrationHits.length, 0, `migration hits: ${migrationHits}`);
  checklist.push({
    id: "EXP-ARCH-004",
    ok: true,
    detail: "No Experience tables/migrations",
  });

  // EXP-ARCH-005 — Device Bearer / AUTH_SECRET not wired into Experience bridge
  console.log("EXP-ARCH-005 no token bridge");
  for (const file of srcFiles) {
    const text = read(file);
    if (
      /experience.*deviceToken|deviceToken.*experience|postMessage\([^)]*Bearer/i.test(
        text,
      )
    ) {
      assert.fail(`possible token exposure path: ${file}`);
    }
  }
  checklist.push({
    id: "EXP-ARCH-005",
    ok: true,
    detail: "No Experience token bridge patterns in src/",
  });

  // EXP-ARCH-006 — media content types unchanged (playback contract)
  console.log("EXP-ARCH-006 media types stable");
  const expected = [
    "IMAGE",
    "VIDEO",
    "TEXT",
    "NOTICE",
    "EVENT",
    "NEWS",
    "QR_CODE",
    "CLOCK",
  ];
  assert.deepEqual([...CONTENT_TYPES], expected);
  checklist.push({
    id: "EXP-ARCH-006",
    ok: true,
    detail: "CONTENT_TYPES unchanged",
  });

  // EXP-ARCH-007 — threat model + contracts mentioned
  console.log("EXP-ARCH-007 contracts");
  for (const needle of [
    "networkPolicy",
    "DENY",
    "postMessage",
    "SHA-256",
    "LOAD",
    "GET_CONTEXT",
    "T14",
  ]) {
    assert.ok(
      arch.includes(needle) || adr.includes(needle),
      `missing contract keyword: ${needle}`,
    );
  }
  checklist.push({
    id: "EXP-ARCH-007",
    ok: true,
    detail: "Manifest/network/bridge/lifecycle/threat keywords present",
  });

  const md = `# RUNTIME-EXPERIENCE-01 Architecture Checklist

**Date:** ${new Date().toISOString()}
**Verdict:** ARCHITECTURE VALIDATED

| ID | Result | Detail |
|----|--------|--------|
${checklist.map((c) => `| ${c.id} | ${c.ok ? "PASS" : "FAIL"} | ${c.detail} |`).join("\n")}

## Confirmed absences
- HTML_APP / EXPERIENCE not in CONTENT_TYPES
- No src/player/experience* executor
- No Experience DB migration
- No functional Experience postMessage bridge

## Docs
- docs/RUNTIME-EXPERIENCE-01-ARCHITECTURE.md
- docs/adr/ADR-EXPERIENCE-001.md

## Note
This phase is design-only. Implementation of HTML_APP / sandbox / bridge is deferred.
`;
  fs.writeFileSync(path.join(EVIDENCE, "ARCHITECTURE-CHECKLIST.md"), md, "utf8");

  console.log("RUNTIME-EXPERIENCE-01 PASS");
}

main();
