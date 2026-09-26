/**
 * RUNTIME-EXPERIENCE-06 — Sandbox host + CSP / Permissions-Policy validation.
 *
 * Does not implement postMessage bridge or Player playback wiring.
 *
 * Run: npm run test:runtime-experience-06
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { CONTENT_TYPES } from "../src/domain/types";
import {
  assertSafeExperienceIframeSrc,
  buildExperienceSandboxPolicy,
  buildHostEmbedCspFragment,
  buildServeFrameAncestors,
} from "../src/domain/experience-sandbox";
import { parseExperienceOriginConfig } from "../src/domain/experience-origin";
import { buildExperienceServeHeaders } from "../src/domain/experience-serving";

const ROOT = path.resolve(".");
const EVIDENCE = path.resolve("docs/evidence/runtime-experience-06");
const DOC = path.join(ROOT, "docs/RUNTIME-EXPERIENCE-06-SANDBOX-HOST.md");
const ADR = path.join(ROOT, "docs/adr/ADR-EXPERIENCE-006.md");
const CHECKLIST = path.join(EVIDENCE, "SANDBOX-HOST-CHECKLIST.md");
const FRAME = path.join(
  ROOT,
  "src/features/experience-sandbox/sandbox-frame.tsx",
);

function main() {
  console.log("RUNTIME-EXPERIENCE-06 sandbox host validation");
  fs.mkdirSync(EVIDENCE, { recursive: true });
  const results: { id: string; detail: string }[] = [];

  console.log("EXP-SBX-001 docs");
  assert.ok(fs.existsSync(DOC));
  assert.ok(fs.existsSync(ADR));
  const doc = fs.readFileSync(DOC, "utf8");
  const adr = fs.readFileSync(ADR, "utf8");
  for (const n of [
    "allow-scripts",
    "allow-same-origin",
    "Permissions-Policy",
    "frame-ancestors",
    "postMessage bridge",
    "ExperienceSandboxFrame",
  ]) {
    assert.ok(doc.includes(n), `doc missing ${n}`);
  }
  assert.ok(adr.includes("Sandbox Host"));
  results.push({ id: "EXP-SBX-001", detail: "docs present" });

  console.log("EXP-SBX-002 sandbox policy dedicated");
  const dedicated = parseExperienceOriginConfig({
    EXPERIENCE_ORIGIN: "https://experience.example.com",
  });
  const pol = buildExperienceSandboxPolicy({
    experienceOrigin: dedicated,
    appOrigin: "https://app.example.com",
  });
  assert.ok(pol.sandbox.includes("allow-scripts"));
  assert.ok(pol.sandbox.includes("allow-same-origin"));
  assert.ok(!pol.sandbox.includes("allow-popups"));
  assert.ok(!pol.sandbox.includes("allow-top-navigation"));
  assert.ok(pol.allow.includes("fullscreen 'none'"));
  assert.ok(pol.allow.includes("camera 'none'"));
  assert.equal(pol.referrerPolicy, "no-referrer");
  assert.equal(pol.dedicatedOriginRequired, false);
  results.push({ id: "EXP-SBX-002", detail: "dedicated origin sandbox policy" });

  console.log("EXP-SBX-003 no same-origin on app host");
  const same = parseExperienceOriginConfig({
    EXPERIENCE_ORIGIN: "https://app.example.com",
  });
  const polApp = buildExperienceSandboxPolicy({
    experienceOrigin: same,
    appOrigin: "https://app.example.com",
  });
  assert.ok(polApp.sandbox.includes("allow-scripts"));
  assert.ok(!polApp.sandbox.includes("allow-same-origin"));
  assert.equal(polApp.dedicatedOriginRequired, true);

  const empty = parseExperienceOriginConfig({});
  const polEmpty = buildExperienceSandboxPolicy({
    experienceOrigin: empty,
    appOrigin: "https://app.example.com",
  });
  assert.ok(!polEmpty.sandbox.includes("allow-same-origin"));
  results.push({
    id: "EXP-SBX-003",
    detail: "allow-same-origin denied on privileged origin",
  });

  console.log("EXP-SBX-004 src safety");
  assert.ok(
    assertSafeExperienceIframeSrc("/x/t/e/1.0.0", dedicated).ok,
  );
  assert.ok(
    assertSafeExperienceIframeSrc(
      "https://experience.example.com/x/t/e/1.0.0",
      dedicated,
    ).ok,
  );
  assert.ok(
    !assertSafeExperienceIframeSrc("javascript:alert(1)", dedicated).ok,
  );
  assert.ok(!assertSafeExperienceIframeSrc("data:text/html,x", dedicated).ok);
  assert.ok(
    !assertSafeExperienceIframeSrc(
      "https://evil.example/x/t/e/1.0.0",
      dedicated,
    ).ok,
  );
  assert.ok(
    !assertSafeExperienceIframeSrc(
      "https://experience.example.com/admin",
      dedicated,
    ).ok,
  );
  results.push({ id: "EXP-SBX-004", detail: "iframe src allowlist" });

  console.log("EXP-SBX-005 frame-ancestors + headers");
  const ancestors = buildServeFrameAncestors({
    appOrigin: "https://app.example.com",
  });
  assert.ok(ancestors.includes("'self'"));
  assert.ok(ancestors.includes("https://app.example.com"));
  const headers = buildExperienceServeHeaders({
    contentType: "text/html",
    packageSha256: "ab",
    isDocument: true,
    frameAncestors: ancestors,
  });
  assert.ok(
    headers["Content-Security-Policy"]?.includes(
      "frame-ancestors 'self' https://app.example.com",
    ),
  );
  assert.ok(!("X-Frame-Options" in headers));
  assert.ok(headers["Permissions-Policy"]?.includes("fullscreen=()"));
  const hostCsp = buildHostEmbedCspFragment("https://experience.example.com");
  assert.ok(hostCsp.includes("frame-src https://experience.example.com"));
  results.push({ id: "EXP-SBX-005", detail: "CSP frame-ancestors for embed" });

  console.log("EXP-SBX-006 component");
  assert.ok(fs.existsSync(FRAME));
  const frame = fs.readFileSync(FRAME, "utf8");
  assert.ok(frame.includes("ExperienceSandboxFrame"));
  assert.ok(frame.includes("sandbox={policy.sandbox}"));
  assert.ok(frame.includes("allow={policy.allow}"));
  assert.ok(frame.includes('referrerPolicy={policy.referrerPolicy}'));
  assert.ok(!/addEventListener\s*\(\s*["']message["']/.test(frame));
  assert.ok(!frame.includes("Authorization"));
  assert.ok(!frame.includes("Bearer"));
  assert.ok(!frame.includes("@/player"));
  results.push({ id: "EXP-SBX-006", detail: "SandboxFrame without bridge" });

  console.log("EXP-SBX-007 absences");
  assert.ok(!(CONTENT_TYPES as readonly string[]).includes("HTML_APP"));
  assert.ok((CONTENT_TYPES as readonly string[]).includes("EXPERIENCE")); // EXPERIENCE-09
  assert.ok(!fs.existsSync(path.join(ROOT, "src/player/experience")));
  const playerApp = fs.readFileSync(
    path.join(ROOT, "src/features/player/player-app.tsx"),
    "utf8",
  );
  assert.ok(!playerApp.includes("ExperienceSandboxFrame"));
  assert.ok(!playerApp.includes("experience-sandbox"));
  const schema = fs.readFileSync(path.join(ROOT, "src/db/schema.ts"), "utf8");
  assert.ok(!/experiences\s*=\s*sqliteTable/.test(schema));
  results.push({
    id: "EXP-SBX-007",
    detail: "no Player wire / HTML_APP / migrations",
  });

  console.log("EXP-SBX-008 prior phases");
  for (const p of [
    "docs/RUNTIME-EXPERIENCE-05-ORIGIN-SERVING.md",
    "src/domain/experience-origin.ts",
    "src/app/x/[tenantId]/[experienceId]/[version]/[[...path]]/route.ts",
  ]) {
    assert.ok(fs.existsSync(path.join(ROOT, p)), p);
  }
  const route = fs.readFileSync(
    path.join(
      ROOT,
      "src/app/x/[tenantId]/[experienceId]/[version]/[[...path]]/route.ts",
    ),
    "utf8",
  );
  assert.ok(route.includes("buildServeFrameAncestors"));
  results.push({ id: "EXP-SBX-008", detail: "serve route uses frame-ancestors" });

  const md = `# RUNTIME-EXPERIENCE-06 Sandbox Host Checklist

**Date:** ${new Date().toISOString()}
**Verdict:** SANDBOX HOST VALIDATED

## Acceptance

- [x] Sandbox deny-by-default documented + implemented
- [x] allow-same-origin only on dedicated origin
- [x] iframe allow Permissions-Policy deny defaults
- [x] frame-ancestors includes app origin
- [x] ExperienceSandboxFrame without postMessage bridge
- [x] Safe src checks
- [x] No Player playback wire
- [x] No HTML_APP / migrations

## Automated checks

| ID | Result | Detail |
|----|--------|--------|
${results.map((r) => `| ${r.id} | PASS | ${r.detail} |`).join("\n")}
`;
  fs.writeFileSync(CHECKLIST, md, "utf8");
  console.log("RUNTIME-EXPERIENCE-06 PASS");
}

main();
