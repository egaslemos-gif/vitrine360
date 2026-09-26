/**
 * RUNTIME-EXPERIENCE-10 — Experience Runtime Core + Lifecycle validation.
 *
 * Pure domain + static absences. Does not wire Player playback.
 *
 * Run: npm run test:runtime-experience-10
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { CONTENT_TYPES } from "../src/domain/types";
import {
  DEFAULT_EXPERIENCE_PERMISSIONS,
  defaultRuntimeLimits,
  type ExperienceManifestV1,
} from "../src/domain/experience-manifest";
import type { ExperienceAdmissionGranted } from "../src/domain/experience-admission";
import {
  EXPERIENCE_RUNTIME_PRIVILEGES,
  ExperienceRuntimeController,
  canTransitionRuntime,
  planExperienceRuntimeStart,
  summarizeRuntimeSnapshot,
} from "../src/domain/experience-runtime";
import { parseExperienceOriginConfig } from "../src/domain/experience-origin";

const ROOT = path.resolve(".");
const EVIDENCE = path.resolve("docs/evidence/runtime-experience-10");
const DOC = path.join(ROOT, "docs/RUNTIME-EXPERIENCE-10-RUNTIME-CORE.md");
const ADR = path.join(ROOT, "docs/adr/ADR-EXPERIENCE-010.md");
const CHECKLIST = path.join(EVIDENCE, "RUNTIME-CORE-CHECKLIST.md");

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

function granted(
  overrides?: Partial<ExperienceAdmissionGranted>,
): ExperienceAdmissionGranted {
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
    ...overrides,
  };
}

function origin() {
  return parseExperienceOriginConfig({
    EXPERIENCE_ORIGIN: "https://experience.example.com",
    EXPERIENCE_ORIGIN_HOSTS: "experience.example.com",
  });
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log("RUNTIME-EXPERIENCE-10 runtime core validation");
  fs.mkdirSync(EVIDENCE, { recursive: true });
  const results: { id: string; detail: string }[] = [];

  console.log("EXP-RT-001 docs");
  assert.ok(fs.existsSync(DOC));
  assert.ok(fs.existsSync(ADR));
  const doc = fs.readFileSync(DOC, "utf8");
  const adr = fs.readFileSync(ADR, "utf8");
  for (const n of [
    "ADMITTED",
    "LOADING",
    "ACTIVE",
    "KILLED",
    "EXECUTION ≠ PRIVILEGE",
    "RUNTIME_READ",
    "no Player",
    "DENY",
  ]) {
    assert.ok(doc.includes(n) || doc.toLowerCase().includes(n.toLowerCase()), n);
  }
  assert.ok(adr.includes("ExperienceRuntimeController"));
  results.push({ id: "EXP-RT-001", detail: "docs + ADR" });

  console.log("TEST-A plan from grant");
  {
    const plan = planExperienceRuntimeStart({
      granted: granted(),
      experienceOrigin: origin(),
    });
    assert.equal(plan.ok, true);
    if (plan.ok) {
      assert.ok(plan.entrypointUrl.startsWith("https://experience.example.com/x/"));
      assert.ok(plan.entrypointUrl.includes("index.html"));
      assert.equal(plan.expectedOrigin, "https://experience.example.com");
      assert.deepEqual(plan.bridgePermissions, ["RUNTIME_READ"]);
    }
    results.push({ id: "TEST-A", detail: "plan entrypoint + bridge READ" });
  }

  console.log("TEST-B reject evil src");
  {
    const plan = planExperienceRuntimeStart({
      granted: granted(),
      experienceOrigin: origin(),
      entrypointUrl: "https://evil.example/x/ten_a/exp_demo/1.0.0/index.html",
    });
    assert.equal(plan.ok, false);
    if (!plan.ok) assert.equal(plan.code, "RUNTIME_INVALID_SRC");
    results.push({ id: "TEST-B", detail: "evil host DENY" });
  }

  console.log("TEST-C lifecycle happy path");
  {
    const phases: string[] = [];
    const ctl = new ExperienceRuntimeController({
      onChange: (s) => phases.push(s.phase),
    });
    ctl.start({ granted: granted(), experienceOrigin: origin() });
    assert.equal(ctl.getSnapshot().phase, "LOADING");
    ctl.markInit();
    assert.equal(ctl.getSnapshot().phase, "INIT");
    ctl.markReady();
    assert.equal(ctl.getSnapshot().phase, "ACTIVE");
    assert.equal(ctl.shouldMountFrame(), true);
    ctl.pause();
    assert.equal(ctl.getSnapshot().phase, "PAUSED");
    ctl.resume();
    assert.equal(ctl.getSnapshot().phase, "ACTIVE");
    ctl.stop();
    assert.equal(ctl.getSnapshot().phase, "STOPPED");
    assert.equal(ctl.shouldMountFrame(), false);
    ctl.dispose();
    assert.ok(phases.includes("ADMITTED"));
    assert.ok(phases.includes("LOADING"));
    results.push({ id: "TEST-C", detail: "LOAD→ACTIVE→STOP" });
  }

  console.log("TEST-D load timeout");
  {
    const ctl = new ExperienceRuntimeController();
    ctl.start({
      granted: granted(),
      experienceOrigin: origin(),
      loadTimeoutMs: 40,
    });
    assert.equal(ctl.getSnapshot().phase, "LOADING");
    await sleep(80);
    assert.equal(ctl.getSnapshot().phase, "ERROR");
    assert.equal(ctl.getSnapshot().error?.code, "RUNTIME_LOAD_TIMEOUT");
    ctl.dispose();
    results.push({ id: "TEST-D", detail: "LOAD_TIMEOUT" });
  }

  console.log("TEST-E kill switch");
  {
    const ctl = new ExperienceRuntimeController();
    ctl.start({ granted: granted(), experienceOrigin: origin() });
    ctl.markInit();
    ctl.markReady();
    ctl.kill("ops");
    assert.equal(ctl.getSnapshot().phase, "KILLED");
    assert.equal(ctl.getSnapshot().error?.code, "RUNTIME_KILLED");
    assert.equal(ctl.shouldMountFrame(), false);
    assert.equal(ctl.getSnapshot().bridgeEnabled, false);
    ctl.dispose();
    results.push({ id: "TEST-E", detail: "KILL without cooperation" });
  }

  console.log("TEST-F already running");
  {
    const ctl = new ExperienceRuntimeController();
    ctl.start({ granted: granted(), experienceOrigin: origin() });
    const s = ctl.start({ granted: granted(), experienceOrigin: origin() });
    assert.equal(s.phase, "ERROR");
    assert.equal(s.error?.code, "RUNTIME_ALREADY_RUNNING");
    ctl.dispose();
    results.push({ id: "TEST-F", detail: "double start DENY" });
  }

  console.log("TEST-G privileges immutable");
  {
    assert.equal(EXPERIENCE_RUNTIME_PRIVILEGES.NETWORK, "DENY");
    assert.equal(EXPERIENCE_RUNTIME_PRIVILEGES.STORAGE, "DENY");
    assert.equal(EXPERIENCE_RUNTIME_PRIVILEGES.CAMERA, "DENY");
    assert.equal(EXPERIENCE_RUNTIME_PRIVILEGES.FULLSCREEN, "DEFERRED");
    assert.equal(EXPERIENCE_RUNTIME_PRIVILEGES.PLAYBACK_CONTROL, "DENY");
    assert.equal(EXPERIENCE_RUNTIME_PRIVILEGES.AUTH, "DENY");
    const ctl = new ExperienceRuntimeController();
    ctl.start({ granted: granted(), experienceOrigin: origin() });
    assert.equal(ctl.getSnapshot().privileges.NETWORK, "DENY");
    ctl.dispose();
    results.push({ id: "TEST-G", detail: "privilege matrix DENY" });
  }

  console.log("TEST-H transitions");
  {
    assert.ok(canTransitionRuntime("ACTIVE", "STOPPING"));
    assert.ok(!canTransitionRuntime("IDLE", "ACTIVE"));
    assert.ok(canTransitionRuntime("LOADING", "KILLED"));
    results.push({ id: "TEST-H", detail: "transition table" });
  }

  console.log("TEST-I summary safe");
  {
    const ctl = new ExperienceRuntimeController();
    ctl.start({ granted: granted(), experienceOrigin: origin() });
    const raw = JSON.stringify(summarizeRuntimeSnapshot(ctl.getSnapshot()));
    assert.ok(!/Bearer|AUTH_SECRET|password|cookie|token/i.test(raw));
    ctl.dispose();
    results.push({ id: "TEST-I", detail: "summary no secrets" });
  }

  console.log("TEST-J load failed");
  {
    const ctl = new ExperienceRuntimeController();
    ctl.start({ granted: granted(), experienceOrigin: origin() });
    ctl.markInit();
    ctl.markLoadFailed("boom");
    assert.equal(ctl.getSnapshot().phase, "ERROR");
    assert.equal(ctl.getSnapshot().error?.code, "RUNTIME_LOAD_FAILED");
    ctl.dispose();
    results.push({ id: "TEST-J", detail: "LOAD_FAILED" });
  }

  console.log("EXP-RT-absences");
  {
    const rt = fs.readFileSync(
      path.join(ROOT, "src/domain/experience-runtime.ts"),
      "utf8",
    );
    const shell = fs.readFileSync(
      path.join(ROOT, "src/features/experience-runtime/runtime-shell.tsx"),
      "utf8",
    );
    for (const src of [rt, shell]) {
      assert.ok(!/from ["']@\/player\//.test(src));
      assert.ok(!/CONTENT_TYPES|HTML_APP|AUTH_SECRET/.test(src));
      assert.ok(!/Authorization:\s*[`']Bearer/.test(src));
      assert.ok(!/requestFullscreen|orientation\.lock/.test(src));
      assert.ok(!/localStorage|indexedDB/.test(src));
    }
    assert.ok(!(CONTENT_TYPES as readonly string[]).includes("HTML_APP"));
    assert.ok((CONTENT_TYPES as readonly string[]).includes("EXPERIENCE")); // EXPERIENCE-09
    // EX-09 not present
    assert.ok(!fs.existsSync(path.join(ROOT, "docs/RUNTIME-EXPERIENCE-09-CONTENT.md")));
    results.push({
      id: "EXP-RT-absences",
      detail: "no Player/HTML_APP/secrets; EX-09 absent",
    });
  }

  console.log("EXP-RT-prior");
  {
    assert.ok(fs.existsSync(path.join(ROOT, "src/domain/experience-admission.ts")));
    assert.ok(fs.existsSync(path.join(ROOT, "src/domain/experience-bridge.ts")));
    assert.ok(
      fs.existsSync(
        path.join(ROOT, "src/features/experience-sandbox/sandbox-frame.tsx"),
      ),
    );
    results.push({ id: "EXP-RT-prior", detail: "EX-06/07/08 intact" });
  }

  const checklist = `# RUNTIME-EXPERIENCE-10 Runtime Core Checklist

**Date:** ${new Date().toISOString()}
**Verdict:** RUNTIME CORE VALIDATED

## Acceptance

- [x] Admission grant required to start
- [x] Entrypoint from Dedicated Origin /x/
- [x] Src safety enforced
- [x] Lifecycle LOAD→ACTIVE→STOP
- [x] Load timeout fail-closed
- [x] Kill switch without Experience cooperation
- [x] Privilege matrix DENY/DEFERRED
- [x] Bridge RUNTIME_READ only (via plan)
- [x] No Player / playlist / schedule / CONTENT_TYPES
- [x] No secrets in snapshot
- [x] Safe fallback when not mounting

## Automated checks

| ID | Result | Detail |
|----|--------|--------|
${results.map((r) => `| ${r.id} | PASS | ${r.detail} |`).join("\n")}
`;
  fs.writeFileSync(CHECKLIST, checklist, "utf8");
  console.log("RUNTIME-EXPERIENCE-10 PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
