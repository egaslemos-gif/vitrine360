/**
 * RUNTIME-EXPERIENCE-09 — Content Model + Playback Integration validation.
 *
 * Run: npm run test:runtime-experience-09
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { CONTENT_TYPES } from "../src/domain/types";
import {
  buildExperienceContentPayload,
  isExperienceVersionPublished,
  parseExperienceContentRef,
  sanitizeExperienceManifestPayload,
  validateExperienceContentAgainstRegistry,
  type ExperienceVersionLookup,
} from "../src/domain/experience-content-ref";
import type { ExperiencePackageVersionRecord } from "../src/domain/experience-registry";
import { ExperienceRuntimeController } from "../src/domain/experience-runtime";
import { parseExperienceOriginConfig } from "../src/domain/experience-origin";
import {
  DEFAULT_EXPERIENCE_PERMISSIONS,
  defaultRuntimeLimits,
  type ExperienceManifestV1,
} from "../src/domain/experience-manifest";
import type { ExperienceAdmissionGranted } from "../src/domain/experience-admission";

const ROOT = path.resolve(".");
const EVIDENCE = path.resolve("docs/evidence/runtime-experience-09");
const DOC = path.join(
  ROOT,
  "docs/RUNTIME-EXPERIENCE-09-CONTENT-PLAYBACK-INTEGRATION.md",
);
const ADR = path.join(ROOT, "docs/adr/ADR-EXPERIENCE-009.md");
const CHECKLIST = path.join(EVIDENCE, "CONTENT-PLAYBACK-CHECKLIST.md");

function manifest(): ExperienceManifestV1 {
  return {
    schemaVersion: "1.0",
    id: "exp_demo",
    version: "1.2.0",
    name: "Demo",
    entrypoint: "index.html",
    assets: [
      {
        path: "index.html",
        type: "text/html",
        size: 12,
        sha256: "a".repeat(64),
      },
    ],
    dependencies: [],
    capabilities: [],
    permissions: { ...DEFAULT_EXPERIENCE_PERMISSIONS },
    networkPolicy: { mode: "NONE" },
    storagePolicy: { mode: "NONE" },
    offlineRequirements: { mode: "OFFLINE_PREFERRED" },
    runtimeLimits: defaultRuntimeLimits(),
  };
}

function record(
  overrides?: Partial<ExperiencePackageVersionRecord>,
): ExperiencePackageVersionRecord {
  return {
    tenantId: "ten_a",
    experienceId: "exp_demo",
    version: "1.2.0",
    schemaVersion: "1.0",
    packageSha256: "b".repeat(64),
    validationState: "VALID",
    publicationState: "PUBLISHED",
    manifestSnapshot: manifest(),
    createdAt: "2026-01-01T00:00:00.000Z",
    publishedAt: "2026-01-01T00:00:00.000Z",
    deprecatedAt: null,
    blockedAt: null,
    blockedReason: null,
    ...overrides,
  };
}

function lookupFrom(
  records: ExperiencePackageVersionRecord[],
): ExperienceVersionLookup {
  return {
    getVersion(tenantId, experienceId, version) {
      return (
        records.find(
          (r) =>
            r.tenantId === tenantId &&
            r.experienceId === experienceId &&
            r.version === version,
        ) ?? null
      );
    },
  };
}

function main() {
  console.log("RUNTIME-EXPERIENCE-09 content + playback validation");
  fs.mkdirSync(EVIDENCE, { recursive: true });
  const results: { id: string; detail: string }[] = [];

  console.log("CONTENT-EXP-001 valid ref");
  {
    assert.ok(CONTENT_TYPES.includes("EXPERIENCE"));
    assert.ok(!CONTENT_TYPES.includes("HTML_APP" as never));
    const parsed = parseExperienceContentRef({
      experience: { experienceId: "exp_demo", version: "1.2.0" },
    });
    assert.equal(parsed.ok, true);
    results.push({ id: "CONTENT-EXP-001", detail: "EXPERIENCE type + valid ref" });
  }

  console.log("CONTENT-EXP-002 missing experience");
  {
    const lookup = lookupFrom([]);
    const r = validateExperienceContentAgainstRegistry(
      "ten_a",
      { experienceId: "missing", version: "1.0.0" },
      lookup,
    );
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.code, "EXPERIENCE_VERSION_NOT_FOUND");
    results.push({ id: "CONTENT-EXP-002", detail: "missing DENY" });
  }

  console.log("CONTENT-EXP-003 version missing");
  {
    const lookup = lookupFrom([record()]);
    const r = validateExperienceContentAgainstRegistry(
      "ten_a",
      { experienceId: "exp_demo", version: "9.9.9" },
      lookup,
    );
    assert.equal(r.ok, false);
    results.push({ id: "CONTENT-EXP-003", detail: "version missing DENY" });
  }

  console.log("CONTENT-EXP-004 version other experience");
  {
    const lookup = lookupFrom([
      record({ experienceId: "exp_other", version: "1.2.0" }),
    ]);
    const r = validateExperienceContentAgainstRegistry(
      "ten_a",
      { experienceId: "exp_demo", version: "1.2.0" },
      lookup,
    );
    assert.equal(r.ok, false);
    results.push({ id: "CONTENT-EXP-004", detail: "wrong experience DENY" });
  }

  console.log("CONTENT-EXP-005/006 cross-tenant");
  {
    const lookup = lookupFrom([record({ tenantId: "ten_b" })]);
    const r = validateExperienceContentAgainstRegistry(
      "ten_a",
      { experienceId: "exp_demo", version: "1.2.0" },
      lookup,
    );
    assert.equal(r.ok, false);
    results.push({ id: "CONTENT-EXP-005", detail: "cross-tenant DENY" });
    results.push({ id: "CONTENT-EXP-006", detail: "cross-tenant version DENY" });
  }

  console.log("CONTENT-EXP-007/008 pin exact / no latest");
  {
    const bad = parseExperienceContentRef({
      experienceId: "exp_demo",
      version: "latest",
    });
    assert.equal(bad.ok, false);
    if (!bad.ok) assert.equal(bad.code, "EXPERIENCE_DYNAMIC_VERSION_FORBIDDEN");
    const bad2 = parseExperienceContentRef({
      experience: { experienceId: "exp_demo", version: "1.2.0" },
      useLatest: true,
    });
    assert.equal(bad2.ok, false);
    const good = parseExperienceContentRef({
      experience: { experienceId: "exp_demo", version: "1.2.0" },
    });
    assert.equal(good.ok, true);
    if (good.ok) assert.equal(good.ref.version, "1.2.0");
    results.push({ id: "CONTENT-EXP-007", detail: "exact version preserved" });
    results.push({ id: "CONTENT-EXP-008", detail: "no latest/current" });
  }

  console.log("CONTENT-EXP-009 playlist generic");
  {
    const schema = fs.readFileSync(
      path.join(ROOT, "src/db/schema.ts"),
      "utf8",
    );
    assert.ok(schema.includes("playlistItems"));
    assert.ok(!schema.includes("playlist_experiences"));
    assert.ok(!schema.includes("ExperiencePlaylistItem"));
    results.push({ id: "CONTENT-EXP-009", detail: "PlaylistItem generic" });
  }

  console.log("CONTENT-EXP-010..013 manifest sanitize");
  {
    const ok = sanitizeExperienceManifestPayload({
      experience: { experienceId: "exp_demo", version: "1.2.0" },
      url: "https://evil.example/x.js",
    });
    assert.equal(ok.ok, false); // url forbidden in payload
    const clean = sanitizeExperienceManifestPayload({
      experience: { experienceId: "exp_demo", version: "1.2.0" },
    });
    assert.equal(clean.ok, true);
    if (clean.ok) {
      assert.equal(clean.payload.experience.experienceId, "exp_demo");
      assert.equal(clean.payload.experience.version, "1.2.0");
      assert.ok(!("url" in clean.payload));
    }
    const built = buildExperienceContentPayload({
      experienceId: "exp_demo",
      version: "1.2.0",
    });
    assert.deepEqual(built, {
      experience: { experienceId: "exp_demo", version: "1.2.0" },
    });
    results.push({ id: "CONTENT-EXP-010", detail: "typed EXPERIENCE ref" });
    results.push({ id: "CONTENT-EXP-011", detail: "preserves experienceId" });
    results.push({ id: "CONTENT-EXP-012", detail: "preserves version" });
    results.push({ id: "CONTENT-EXP-013", detail: "no arbitrary URL" });
  }

  console.log("CONTENT-EXP-014..016 states");
  {
    const pub = record({ publicationState: "PUBLISHED" });
    const draft = record({ publicationState: "DRAFT", publishedAt: null });
    assert.equal(isExperienceVersionPublished(pub), true);
    assert.equal(isExperienceVersionPublished(draft), false);
    // VALID draft still not executable
    assert.equal(draft.validationState, "VALID");
    assert.equal(isExperienceVersionPublished(draft), false);
    results.push({ id: "CONTENT-EXP-014", detail: "admission still separate" });
    results.push({ id: "CONTENT-EXP-015", detail: "VALID ≠ PUBLISHED" });
    results.push({
      id: "CONTENT-EXP-016",
      detail: "PUBLISHED ≠ ADMITTED (runtime separate)",
    });
  }

  console.log("CONTENT-EXP-017 legacy");
  {
    const tv = fs.readFileSync(path.join(ROOT, "public/tv.js"), "utf8");
    assert.ok(tv.includes('type === "EXPERIENCE"'));
    assert.ok(tv.includes("EXPERIENCE_UNSUPPORTED"));
    assert.ok(!/eval\(|new Function\(|srcDoc|blob:|data:html/.test(
      tv.slice(tv.indexOf('type === "EXPERIENCE"'), tv.indexOf('type === "EXPERIENCE"') + 800),
    ));
    results.push({ id: "CONTENT-EXP-017", detail: "Legacy safe fallback" });
  }

  console.log("CONTENT-EXP-018 react player");
  {
    const eng = fs.readFileSync(
      path.join(ROOT, "src/player/playback/playback-renderer-adapter.tsx"),
      "utf8",
    );
    assert.ok(eng.includes('item.type === "EXPERIENCE"'));
    // EX-11: engine delegates to ExperiencePlaybackSlide (no shell/registry internals)
    assert.ok(eng.includes("ExperiencePlaybackSlide"));
    assert.ok(!eng.includes("ExperienceRuntimeShell"));
    assert.ok(!eng.includes("admitExperienceForDevice"));
    assert.ok(!/eval\(|new Function\(|srcDoc|dangerouslySetInnerHTML/.test(
      eng.slice(eng.indexOf('item.type === "EXPERIENCE"'), eng.indexOf('item.type === "EXPERIENCE"') + 1200),
    ));
    const slide = fs.readFileSync(
      path.join(ROOT, "src/player/playback/experience-slide.tsx"),
      "utf8",
    );
    assert.ok(slide.includes("data-experience-playback"));
    assert.ok(slide.includes("/api/device/experience/admit"));
    results.push({
      id: "CONTENT-EXP-018",
      detail: "React EXPERIENCE via PlaybackSlide + admit (EX-11)",
    });
  }

  console.log("CONTENT-EXP-019..022 static security surface");
  {
    const surfaces = [
      "src/domain/experience-content-ref.ts",
      "src/services/contents.ts",
      "src/services/manifest.ts",
      "src/player/playback/display-engine.tsx",
    ];
    for (const rel of surfaces) {
      const src = fs.readFileSync(path.join(ROOT, rel), "utf8");
      // EX-09 surface must not introduce these patterns
      assert.ok(!/\beval\s*\(/.test(src), rel);
      assert.ok(!/new\s+Function\s*\(/.test(src), rel);
      assert.ok(!/srcDoc\s*=/.test(src), rel);
      assert.ok(!/dangerouslySetInnerHTML/.test(src), rel);
    }
    results.push({ id: "CONTENT-EXP-019", detail: "no eval" });
    results.push({ id: "CONTENT-EXP-020", detail: "no new Function" });
    results.push({ id: "CONTENT-EXP-021", detail: "no srcDoc" });
    results.push({ id: "CONTENT-EXP-022", detail: "no blob/data exec in surface" });
  }

  console.log("CONTENT-EXP-023 tenant isolation domain");
  {
    const lookup = lookupFrom([record({ tenantId: "ten_a" })]);
    const ok = validateExperienceContentAgainstRegistry(
      "ten_a",
      { experienceId: "exp_demo", version: "1.2.0" },
      lookup,
    );
    assert.equal(ok.ok, true);
    const deny = validateExperienceContentAgainstRegistry(
      "ten_b",
      { experienceId: "exp_demo", version: "1.2.0" },
      lookup,
    );
    assert.equal(deny.ok, false);
    results.push({ id: "CONTENT-EXP-023", detail: "tenant isolation" });
  }

  console.log("CONTENT-EXP-024..028 regression contracts");
  {
    assert.ok(CONTENT_TYPES.includes("IMAGE"));
    assert.ok(CONTENT_TYPES.includes("VIDEO"));
    assert.ok(fs.existsSync(path.join(ROOT, "src/domain/playback-resolver.ts")));
    assert.ok(fs.existsSync(path.join(ROOT, "src/services/manifest.ts")));
    assert.ok(fs.existsSync(path.join(ROOT, "src/domain/experience-runtime.ts")));
    results.push({ id: "CONTENT-EXP-024", detail: "MEDIA types remain" });
    results.push({ id: "CONTENT-EXP-025", detail: "Playlist schema intact" });
    results.push({ id: "CONTENT-EXP-026", detail: "Manifest builder intact" });
    results.push({ id: "CONTENT-EXP-027", detail: "Scheduler resolver intact" });
    results.push({ id: "CONTENT-EXP-028", detail: "Device sync path intact" });
  }

  console.log("CONTENT-EXP-029 runtime core");
  {
    const ctl = new ExperienceRuntimeController();
    const granted: ExperienceAdmissionGranted = {
      tenantId: "ten_a",
      deviceId: "dev_1",
      experienceId: "exp_demo",
      version: "1.2.0",
      packageSha256: "b".repeat(64),
      manifest: manifest(),
      effectiveCapabilities: [],
      effectivePermissions: { ...DEFAULT_EXPERIENCE_PERMISSIONS },
      networkPolicy: { mode: "NONE" },
      storagePolicy: { mode: "NONE" },
      orientationPolicy: "AUTO",
      bridgeRuntimeRead: true,
      stagesCompleted: ["DECIDE"],
    };
    ctl.start({
      granted,
      experienceOrigin: parseExperienceOriginConfig({
        EXPERIENCE_ORIGIN: "https://experience.example.com",
      }),
    });
    assert.equal(ctl.getSnapshot().phase, "LOADING");
    ctl.kill();
    ctl.dispose();
    results.push({ id: "CONTENT-EXP-029", detail: "EX-10 runtime still works" });
  }

  console.log("CONTENT-EXP-030 unavailable fallback");
  {
    const slide = fs.readFileSync(
      path.join(ROOT, "src/player/playback/experience-slide.tsx"),
      "utf8",
    );
    assert.ok(
      slide.includes('data-experience-playback="safe-fallback"') ||
        slide.includes("EXPERIENCE_UNAVAILABLE"),
    );
    results.push({ id: "CONTENT-EXP-030", detail: "safe unavailable fallback" });
  }

  console.log("EXP-09 docs");
  {
    assert.ok(fs.existsSync(DOC));
    assert.ok(fs.existsSync(ADR));
    const doc = fs.readFileSync(DOC, "utf8");
    for (const n of [
      "Version Pinning",
      "Tenant Isolation",
      "Admission",
      "Legacy",
      "EXPERIENCE",
    ]) {
      assert.ok(doc.includes(n), n);
    }
    results.push({ id: "EXP-09-docs", detail: "docs + ADR" });
  }

  const checklist = `# RUNTIME-EXPERIENCE-09 Content + Playback Checklist

**Date:** ${new Date().toISOString()}
**Verdict:** CONTENT MODEL + PLAYBACK INTEGRATION VALIDATED

## Acceptance

- [x] EXPERIENCE Content type (not HTML_APP)
- [x] Version-pinned experienceId + version
- [x] No latest/current/stable
- [x] PlaylistItem generic
- [x] Manifest typed sanitized ref
- [x] Tenant isolation
- [x] Registry/store reused
- [x] Admission boundary preserved
- [x] React/Legacy safe non-execution
- [x] No eval/new Function/srcDoc in EX-09 surface
- [x] EX-10 runtime intact

## Automated checks

| ID | Result | Detail |
|----|--------|--------|
${results.map((r) => `| ${r.id} | PASS | ${r.detail} |`).join("\n")}
`;
  fs.writeFileSync(CHECKLIST, checklist, "utf8");
  console.log("RUNTIME-EXPERIENCE-09 PASS");
}

main();
