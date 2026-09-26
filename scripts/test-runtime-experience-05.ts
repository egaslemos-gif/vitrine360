/**
 * RUNTIME-EXPERIENCE-05 — Origin + package serving validation.
 *
 * Does not create iframes, bridges, or execute Experience JS.
 *
 * Run: npm run test:runtime-experience-05
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { CONTENT_TYPES } from "../src/domain/types";
import {
  DEFAULT_EXPERIENCE_PERMISSIONS,
  defaultRuntimeLimits,
} from "../src/domain/experience-manifest";
import {
  buildExperienceServePath,
  buildExperienceServeUrl,
  isAllowedPathOnExperienceOrigin,
  isDedicatedOriginConfigured,
  isExperienceOriginHost,
  parseExperienceOriginConfig,
  parseExperienceServePath,
} from "../src/domain/experience-origin";
import {
  buildExperienceServeHeaders,
  resolveServeRequest,
} from "../src/domain/experience-serving";
import {
  inventoryFromFiles,
  sha256Hex,
  validateExperiencePackage,
} from "../src/domain/experience-validator";
import {
  clearExperiencePackageStore,
  getStoredExperiencePackage,
  putExperiencePackage,
} from "../src/services/experience-package-store";

const ROOT = path.resolve(".");
const EVIDENCE = path.resolve("docs/evidence/runtime-experience-05");
const DOC = path.join(ROOT, "docs/RUNTIME-EXPERIENCE-05-ORIGIN-SERVING.md");
const ADR = path.join(ROOT, "docs/adr/ADR-EXPERIENCE-005.md");
const CHECKLIST = path.join(EVIDENCE, "ORIGIN-SERVING-CHECKLIST.md");

function enc(s: string) {
  return new TextEncoder().encode(s);
}

function main() {
  console.log("RUNTIME-EXPERIENCE-05 origin + serving validation");
  fs.mkdirSync(EVIDENCE, { recursive: true });
  const results: { id: string; detail: string }[] = [];

  console.log("EXP-ORIG-001 docs");
  assert.ok(fs.existsSync(DOC));
  assert.ok(fs.existsSync(ADR));
  const doc = fs.readFileSync(DOC, "utf8");
  const adr = fs.readFileSync(ADR, "utf8");
  for (const n of [
    "EXPERIENCE_ORIGIN",
    "/x/",
    "proxy.ts",
    "VALID + PUBLISHED",
    "Content-Security-Policy",
    "no Player",
  ]) {
    assert.ok(
      doc.includes(n) || doc.toLowerCase().includes(n.toLowerCase()),
      `doc missing ${n}`,
    );
  }
  assert.ok(adr.includes("Dedicated Experience Origin"));
  results.push({ id: "EXP-ORIG-001", detail: "docs + ADR present" });

  console.log("EXP-ORIG-002 origin config");
  const cfg = parseExperienceOriginConfig({
    EXPERIENCE_ORIGIN: "https://experience.example.com/",
    EXPERIENCE_ORIGIN_HOSTS: "experience.localhost",
  });
  assert.equal(cfg.origin, "https://experience.example.com");
  assert.ok(cfg.hosts.includes("experience.example.com"));
  assert.ok(cfg.hosts.includes("experience.localhost"));
  assert.ok(isExperienceOriginHost("experience.example.com", cfg));
  assert.ok(isExperienceOriginHost("experience.example.com:443", cfg));
  assert.ok(!isExperienceOriginHost("vitrine360-psi.vercel.app", cfg));
  assert.ok(
    isDedicatedOriginConfigured(cfg, "https://vitrine360-psi.vercel.app"),
  );
  assert.ok(!isAllowedPathOnExperienceOrigin("/admin"));
  assert.ok(!isAllowedPathOnExperienceOrigin("/api/admin/devices"));
  assert.ok(isAllowedPathOnExperienceOrigin("/x/t/e/1.0.0"));
  results.push({ id: "EXP-ORIG-002", detail: "origin host guard helpers" });

  console.log("EXP-ORIG-003 URL scheme");
  const loc = {
    tenantId: "ten_1",
    experienceId: "exp_demo",
    version: "1.2.0",
    assetPath: "assets/logo.png",
  };
  assert.equal(
    buildExperienceServePath(loc),
    "/x/ten_1/exp_demo/1.2.0/assets/logo.png",
  );
  assert.equal(
    buildExperienceServeUrl(loc, cfg),
    "https://experience.example.com/x/ten_1/exp_demo/1.2.0/assets/logo.png",
  );
  const parsed = parseExperienceServePath(
    "/x/ten_1/exp_demo/1.2.0/assets/logo.png",
  );
  assert.deepEqual(parsed, loc);
  assert.equal(parseExperienceServePath("/admin"), null);
  results.push({ id: "EXP-ORIG-003", detail: "serve URL scheme" });

  console.log("EXP-ORIG-004 store + serve admission");
  clearExperiencePackageStore();
  const html = "<!doctype html><title>exp</title>";
  const htmlBytes = enc(html);
  const htmlHash = sha256Hex(htmlBytes);
  const manifest = {
    schemaVersion: "1.0" as const,
    id: "exp_demo",
    version: "1.0.0",
    name: "Demo",
    entrypoint: "index.html",
    assets: [
      {
        path: "index.html",
        type: "text/html",
        size: htmlBytes.byteLength,
        sha256: htmlHash,
      },
    ],
    dependencies: [],
    capabilities: [],
    permissions: { ...DEFAULT_EXPERIENCE_PERMISSIONS },
    networkPolicy: { mode: "NONE" as const },
    storagePolicy: { mode: "NONE" as const },
    offlineRequirements: { mode: "OFFLINE_PREFERRED" as const },
    runtimeLimits: defaultRuntimeLimits(),
  };
  const inventory = inventoryFromFiles({
    "manifest.json": JSON.stringify(manifest),
    "index.html": html,
  });
  const validated = validateExperiencePackage(inventory);
  assert.equal(validated.state, "VALID");

  const put = putExperiencePackage({
    record: {
      tenantId: "ten_1",
      experienceId: "exp_demo",
      version: "1.0.0",
      schemaVersion: "1.0",
      packageSha256: validated.packageSha256!,
      validationState: "VALID",
      publicationState: "PUBLISHED",
      manifestSnapshot: validated.manifest,
      createdAt: new Date().toISOString(),
      publishedAt: new Date().toISOString(),
      deprecatedAt: null,
      blockedAt: null,
      blockedReason: null,
    },
    inventory,
  });
  assert.ok(put.ok);

  const stored = getStoredExperiencePackage("ten_1", "exp_demo", "1.0.0");
  const entry = resolveServeRequest({
    tenantId: "ten_1",
    experienceId: "exp_demo",
    version: "1.0.0",
    assetPath: "",
    stored,
  });
  assert.ok(entry.ok);
  if (entry.ok) {
    assert.equal(entry.path, "index.html");
    assert.ok(entry.contentType.includes("text/html"));
  }

  const cross = resolveServeRequest({
    tenantId: "ten_OTHER",
    experienceId: "exp_demo",
    version: "1.0.0",
    assetPath: "",
    stored,
  });
  assert.ok(!cross.ok);
  if (!cross.ok) assert.equal(cross.status, 403);

  const trav = resolveServeRequest({
    tenantId: "ten_1",
    experienceId: "exp_demo",
    version: "1.0.0",
    assetPath: "../secret",
    stored,
  });
  assert.ok(!trav.ok);

  // Draft not serveable
  clearExperiencePackageStore();
  putExperiencePackage({
    record: {
      tenantId: "ten_1",
      experienceId: "exp_demo",
      version: "1.0.0",
      schemaVersion: "1.0",
      packageSha256: validated.packageSha256!,
      validationState: "VALID",
      publicationState: "DRAFT",
      manifestSnapshot: validated.manifest,
      createdAt: new Date().toISOString(),
      publishedAt: null,
      deprecatedAt: null,
      blockedAt: null,
      blockedReason: null,
    },
    inventory,
  });
  const draft = resolveServeRequest({
    tenantId: "ten_1",
    experienceId: "exp_demo",
    version: "1.0.0",
    assetPath: "",
    stored: getStoredExperiencePackage("ten_1", "exp_demo", "1.0.0"),
  });
  assert.ok(!draft.ok);
  results.push({ id: "EXP-ORIG-004", detail: "store + fail-closed admission" });

  console.log("EXP-ORIG-005 headers");
  const headers = buildExperienceServeHeaders({
    contentType: "text/html; charset=utf-8",
    packageSha256: "abc",
    isDocument: true,
  });
  assert.ok(headers["Content-Security-Policy"]?.includes("default-src 'none'"));
  assert.ok(headers["Content-Security-Policy"]?.includes("connect-src 'none'"));
  assert.ok(headers["Permissions-Policy"]?.includes("camera=()"));
  assert.equal(headers["X-Content-Type-Options"], "nosniff");
  assert.equal(headers["Referrer-Policy"], "no-referrer");
  assert.ok(!("Set-Cookie" in headers));
  results.push({ id: "EXP-ORIG-005", detail: "security headers deny-by-default" });

  console.log("EXP-ORIG-006 files exist");
  for (const p of [
    "src/domain/experience-origin.ts",
    "src/domain/experience-serving.ts",
    "src/services/experience-package-store.ts",
    "src/proxy.ts",
    "src/app/x/[tenantId]/[experienceId]/[version]/[[...path]]/route.ts",
  ]) {
    assert.ok(fs.existsSync(path.join(ROOT, p)), `missing ${p}`);
  }
  const route = fs.readFileSync(
    path.join(
      ROOT,
      "src/app/x/[tenantId]/[experienceId]/[version]/[[...path]]/route.ts",
    ),
    "utf8",
  );
  assert.ok(!/\biframe\s*</i.test(route));
  assert.ok(!/addEventListener\s*\(\s*["']message["']/i.test(route));
  assert.ok(!/\beval\s*\(/.test(route));
  assert.ok(route.includes("resolveServeRequest"));
  assert.ok(route.includes("buildExperienceServeHeaders"));
  const proxy = fs.readFileSync(path.join(ROOT, "src/proxy.ts"), "utf8");
  assert.ok(proxy.includes("export function proxy"));
  assert.ok(proxy.includes("isAllowedPathOnExperienceOrigin"));
  results.push({ id: "EXP-ORIG-006", detail: "serve route + proxy present" });

  console.log("EXP-ORIG-007 absences");
  assert.ok(!(CONTENT_TYPES as readonly string[]).includes("HTML_APP"));
  assert.ok((CONTENT_TYPES as readonly string[]).includes("EXPERIENCE")); // EXPERIENCE-09
  assert.ok(!fs.existsSync(path.join(ROOT, "src/player/experience")));
  // exact folder src/features/experience forbidden; experience-sandbox/ is EXPERIENCE-06+
  assert.ok(!fs.existsSync(path.join(ROOT, "src/features/experience")));
  const schema = fs.readFileSync(path.join(ROOT, "src/db/schema.ts"), "utf8");
  assert.ok(!/experiences\s*=\s*sqliteTable/.test(schema));
  const drizzleFiles = fs.existsSync(path.join(ROOT, "drizzle"))
    ? fs.readdirSync(path.join(ROOT, "drizzle"))
    : [];
  assert.ok(!drizzleFiles.some((f) => /experience/i.test(f)));
  results.push({
    id: "EXP-ORIG-007",
    detail: "no HTML_APP / Player experience dir / migrations",
  });

  console.log("EXP-ORIG-008 prior phases");
  for (const p of [
    "docs/RUNTIME-EXPERIENCE-04-RUNTIME-SECURITY.md",
    "src/domain/experience-validator.ts",
  ]) {
    assert.ok(fs.existsSync(path.join(ROOT, p)));
  }
  results.push({ id: "EXP-ORIG-008", detail: "prior EXPERIENCE artifacts intact" });

  clearExperiencePackageStore();

  const md = `# RUNTIME-EXPERIENCE-05 Origin + Serving Checklist

**Date:** ${new Date().toISOString()}
**Verdict:** ORIGIN + SERVING VALIDATED

## Acceptance

- [x] Dedicated origin config documented
- [x] Host guard (proxy) only allows /x on Experience origin
- [x] Serve URL scheme /x/{tenant}/{exp}/{version}/…
- [x] Fail-closed admission VALID+PUBLISHED+tenant
- [x] Path traversal rejected
- [x] CSP / Permissions-Policy on responses
- [x] In-process store (no migration)
- [x] No iframe / bridge / Player wire
- [x] No HTML_APP / playback changes

## Automated checks

| ID | Result | Detail |
|----|--------|--------|
${results.map((r) => `| ${r.id} | PASS | ${r.detail} |`).join("\n")}
`;
  fs.writeFileSync(CHECKLIST, md, "utf8");
  console.log("RUNTIME-EXPERIENCE-05 PASS");
}

main();
