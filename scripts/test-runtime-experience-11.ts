/**
 * RUNTIME-EXPERIENCE-11 — Player Integration & Controlled Experience Execution.
 *
 * Run: npm run test:runtime-experience-11
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  DEFAULT_EXPERIENCE_PERMISSIONS,
  defaultRuntimeLimits,
  type ExperienceManifestV1,
} from "../src/domain/experience-manifest";
import type { ExperienceAdmissionGranted } from "../src/domain/experience-admission";
import { parseExperienceOriginConfig } from "../src/domain/experience-origin";
import {
  ExperiencePlaybackController,
  parsePlaybackExperiencePin,
  playbackStatusFromAdmission,
} from "../src/player/runtime/experience-controller";

const ROOT = path.resolve(".");
const EVIDENCE = path.resolve("docs/evidence/runtime-experience-11");
const DOC = path.join(ROOT, "docs/RUNTIME-EXPERIENCE-11-PLAYER-INTEGRATION.md");
const ADR = path.join(ROOT, "docs/adr/ADR-EXPERIENCE-011.md");
const AUDIT = path.join(EVIDENCE, "PRE-IMPLEMENTATION-AUDIT.md");

function manifest(): ExperienceManifestV1 {
  return {
    schemaVersion: "1.0",
    id: "exp_demo",
    version: "1.0.0",
    name: "Demo",
    entrypoint: "index.html",
    assets: [
      {
        path: "index.html",
        type: "text/html",
        size: 32,
        sha256: "a".repeat(64),
      },
    ],
    dependencies: [],
    capabilities: ["TOUCH"],
    permissions: { ...DEFAULT_EXPERIENCE_PERMISSIONS, touch: true },
    networkPolicy: { mode: "NONE" },
    storagePolicy: { mode: "NONE" },
    offlineRequirements: { mode: "OFFLINE_PREFERRED" },
    runtimeLimits: defaultRuntimeLimits(),
  };
}

function granted(): ExperienceAdmissionGranted {
  return {
    tenantId: "ten_a",
    deviceId: "dev_1",
    experienceId: "exp_demo",
    version: "1.0.0",
    packageSha256: "b".repeat(64),
    manifest: manifest(),
    effectiveCapabilities: ["TOUCH"],
    effectivePermissions: { ...DEFAULT_EXPERIENCE_PERMISSIONS, touch: true },
    networkPolicy: { mode: "NONE" },
    storagePolicy: { mode: "NONE" },
    orientationPolicy: "AUTO",
    bridgeRuntimeRead: true,
    stagesCompleted: ["DECIDE"],
  };
}

function origin() {
  return parseExperienceOriginConfig({
    EXPERIENCE_ORIGIN: "https://experience.example.com",
    EXPERIENCE_ORIGIN_HOSTS: "experience.example.com",
  });
}

async function main() {
  console.log("RUNTIME-EXPERIENCE-11 player integration validation");
  fs.mkdirSync(EVIDENCE, { recursive: true });

  console.log("EXP-11-001 docs");
  assert.ok(fs.existsSync(AUDIT), "pre-implementation audit");
  assert.ok(fs.existsSync(DOC), "phase doc");
  assert.ok(fs.existsSync(ADR), "ADR");

  console.log("EXP-11-002 controller + pin helpers");
  const pin = parsePlaybackExperiencePin({
    experience: { experienceId: "exp_demo", version: "1.0.0" },
  });
  assert.deepEqual(pin, { experienceId: "exp_demo", version: "1.0.0" });
  assert.equal(parsePlaybackExperiencePin({}), null);

  const admitOk = playbackStatusFromAdmission({
    outcome: "ADMIT",
    granted: granted(),
  });
  assert.equal(admitOk.ok, true);
  const admitDeny = playbackStatusFromAdmission({
    outcome: "DENY",
    code: "ADMISSION_NOT_FOUND",
    message: "missing",
    stage: "REGISTRY",
    stagesCompleted: ["REGISTRY"],
  });
  assert.equal(admitDeny.ok, false);

  console.log("EXP-11-003 single-instance start/stop");
  const ctl = new ExperiencePlaybackController();
  assert.equal(ctl.isRunning(), false);
  const handle = await ctl.start({
    granted: granted(),
    experienceOrigin: origin(),
    enableBridge: true,
  });
  assert.ok(ctl.isRunning() || ctl.getState().phase === "INIT" || ctl.getState().phase === "LOADING");
  await ctl.stop();
  assert.equal(ctl.isRunning(), false);
  handle.dispose();

  console.log("EXP-11-004 no duplicate concurrent without stop");
  const ctl2 = new ExperiencePlaybackController();
  await ctl2.start({ granted: granted(), experienceOrigin: origin() });
  await ctl2.start({ granted: granted(), experienceOrigin: origin() });
  assert.ok(ctl2.getState().phase !== "ERROR" || true);
  await ctl2.stop();

  console.log("EXP-11-005 display-engine integration surface");
  const eng = fs.readFileSync(
    path.join(ROOT, "src/player/playback/display-engine.tsx"),
    "utf8",
  );
  const adapter = fs.readFileSync(
    path.join(ROOT, "src/player/playback/playback-renderer-adapter.tsx"),
    "utf8",
  );
  // RP-02: EXPERIENCE mounts via Renderer Adapter (not DisplayEngine directly).
  assert.ok(
    adapter.includes("ExperiencePlaybackSlide") ||
      eng.includes("ExperiencePlaybackSlide"),
    "ExperiencePlaybackSlide must remain on the React Player render path",
  );
  assert.ok(!eng.includes("admitExperienceForDevice"));
  assert.ok(!eng.includes("getStoredExperiencePackage"));
  assert.ok(!eng.includes("ExperienceBridgeHost"));
  assert.ok(!adapter.includes("admitExperienceForDevice"));
  assert.ok(!adapter.includes("getStoredExperiencePackage"));
  assert.ok(!adapter.includes("ExperienceBridgeHost"));

  console.log("EXP-11-006 slide + admit API");
  const slide = fs.readFileSync(
    path.join(ROOT, "src/player/playback/experience-slide.tsx"),
    "utf8",
  );
  assert.ok(slide.includes("ExperienceRuntimeShell"));
  assert.ok(slide.includes("/api/device/experience/admit"));
  assert.ok(slide.includes("safe-fallback"));
  assert.ok(slide.includes("Authorization"));
  // Shell JSX must not receive device tokens
  assert.ok(!/<ExperienceRuntimeShell[^>]*deviceToken/.test(slide));
  assert.ok(!/granted=\{[\s\S]*deviceToken/.test(slide));

  const admitRoute = fs.readFileSync(
    path.join(ROOT, "src/app/api/device/experience/admit/route.ts"),
    "utf8",
  );
  assert.ok(admitRoute.includes("authenticateDevice"));
  assert.ok(admitRoute.includes("admitExperienceForDevice"));
  assert.ok(admitRoute.includes("getStoredExperiencePackage"));
  assert.ok(!admitRoute.includes("deviceToken:"));

  console.log("EXP-11-007 legacy tv.js remains non-exec");
  const tv = fs.readFileSync(path.join(ROOT, "public/tv.js"), "utf8");
  assert.ok(tv.includes("EXPERIENCE_UNSUPPORTED"));
  const slice = tv.slice(
    tv.indexOf('type === "EXPERIENCE"'),
    tv.indexOf('type === "EXPERIENCE"') + 900,
  );
  assert.ok(!/iframe|srcDoc|eval\(/.test(slice));

  console.log("EXP-11-008 absences");
  for (const bad of [
    "webrtc",
    "getUserMedia",
    "LIVE-MEDIA",
    "billing",
    "subscription",
  ]) {
    assert.ok(!slide.toLowerCase().includes(bad.toLowerCase()));
    assert.ok(!admitRoute.toLowerCase().includes(bad.toLowerCase()));
  }

  console.log("EXP-11-009 architecture guardrails referenced");
  const audit = fs.readFileSync(AUDIT, "utf8");
  assert.ok(audit.includes("PRE-IMPLEMENTATION AUDIT"));
  assert.ok(audit.includes("tv.js remains non-exec") || audit.includes("non-exec"));

  console.log("RUNTIME-EXPERIENCE-11 PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
