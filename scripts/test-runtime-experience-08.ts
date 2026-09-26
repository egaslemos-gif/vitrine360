/**
 * RUNTIME-EXPERIENCE-08 — Admission Control + Device Policy validation.
 *
 * Pure domain tests — no Player, no iframe load, no network.
 *
 * Run: npm run test:runtime-experience-08
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "path";
import { CONTENT_TYPES } from "../src/domain/types";
import {
  DEFAULT_EXPERIENCE_PERMISSIONS,
  defaultRuntimeLimits,
  type ExperienceManifestV1,
} from "../src/domain/experience-manifest";
import type { ExperiencePackageVersionRecord } from "../src/domain/experience-registry";
import {
  admitExperienceForDevice,
  bridgeCapabilitiesFromAdmission,
  bridgePermissionsFromAdmission,
  detectedToExperienceCapabilities,
  isAdmitted,
  summarizeAdmissionDecision,
  type AdmissionDeviceContext,
  type ExperienceDeviceAssignment,
} from "../src/domain/experience-admission";
import {
  DEFAULT_DOMAIN_RUNTIME_POLICY,
  UNKNOWN_CAPABILITIES,
  type DetectedRuntimeCapabilities,
} from "../src/domain/runtime-policy";

const ROOT = path.resolve(".");
const EVIDENCE = path.resolve("docs/evidence/runtime-experience-08");
const DOC = path.join(ROOT, "docs/RUNTIME-EXPERIENCE-08-ADMISSION.md");
const ADR = path.join(ROOT, "docs/adr/ADR-EXPERIENCE-008.md");
const CHECKLIST = path.join(EVIDENCE, "ADMISSION-CHECKLIST.md");

function manifest(partial?: Partial<ExperienceManifestV1>): ExperienceManifestV1 {
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
    ...partial,
  };
}

function record(
  overrides?: Partial<ExperiencePackageVersionRecord>,
): ExperiencePackageVersionRecord {
  const m = overrides?.manifestSnapshot ?? manifest();
  return {
    tenantId: "ten_a",
    experienceId: "exp_demo",
    version: "1.0.0",
    schemaVersion: "1.0",
    packageSha256: "b".repeat(64),
    validationState: "VALID",
    publicationState: "PUBLISHED",
    manifestSnapshot: m,
    createdAt: "2026-01-01T00:00:00.000Z",
    publishedAt: "2026-01-01T00:00:00.000Z",
    deprecatedAt: null,
    blockedAt: null,
    blockedReason: null,
    ...overrides,
  };
}

function assignment(
  overrides?: Partial<ExperienceDeviceAssignment>,
): ExperienceDeviceAssignment {
  return {
    tenantId: "ten_a",
    deviceId: "dev_1",
    experienceId: "exp_demo",
    version: "1.0.0",
    grantedPermissions: { touch: true },
    revoked: false,
    ...overrides,
  };
}

function detected(
  partial?: Partial<DetectedRuntimeCapabilities>,
): DetectedRuntimeCapabilities {
  return {
    ...UNKNOWN_CAPABILITIES,
    touch: true,
    image: true,
    video: true,
    ...partial,
  };
}

function device(
  overrides?: Partial<AdmissionDeviceContext>,
): AdmissionDeviceContext {
  return {
    tenantId: "ten_a",
    deviceId: "dev_1",
    status: "ACTIVE",
    domainPolicy: { ...DEFAULT_DOMAIN_RUNTIME_POLICY },
    detected: detected(),
    runtimeVersion: "1.0.0",
    ...overrides,
  };
}

function baseInput(overrides?: {
  record?: ExperiencePackageVersionRecord | null;
  assignment?: ExperienceDeviceAssignment | null;
  device?: AdmissionDeviceContext;
  killSwitch?: boolean;
  expectedPackageSha256?: string | null;
  tenantId?: string;
  experienceId?: string;
  version?: string;
}) {
  return {
    tenantId: overrides?.tenantId ?? "ten_a",
    experienceId: overrides?.experienceId ?? "exp_demo",
    version: overrides?.version ?? "1.0.0",
    record: overrides?.record === undefined ? record() : overrides.record,
    assignment:
      overrides?.assignment === undefined ? assignment() : overrides.assignment,
    device: overrides?.device ?? device(),
    killSwitch: overrides?.killSwitch,
    expectedPackageSha256: overrides?.expectedPackageSha256,
  };
}

function main() {
  console.log("RUNTIME-EXPERIENCE-08 admission validation");
  fs.mkdirSync(EVIDENCE, { recursive: true });
  const results: { id: string; detail: string }[] = [];

  console.log("EXP-ADM-001 docs");
  assert.ok(fs.existsSync(DOC));
  assert.ok(fs.existsSync(ADR));
  const doc = fs.readFileSync(DOC, "utf8");
  const adr = fs.readFileSync(ADR, "utf8");
  for (const n of [
    "admitExperienceForDevice",
    "fail-closed",
    "Detected",
    "ASSIGNED",
    "ADMITTED",
    "kill switch",
    "RUNTIME_READ",
    "no Player",
  ]) {
    assert.ok(doc.toLowerCase().includes(n.toLowerCase()), `doc missing ${n}`);
  }
  assert.ok(adr.includes("admitExperienceForDevice"));
  results.push({ id: "EXP-ADM-001", detail: "docs + ADR" });

  console.log("TEST-A happy path ADMIT");
  {
    const d = admitExperienceForDevice(baseInput());
    assert.equal(d.outcome, "ADMIT");
    assert.ok(isAdmitted(d));
    if (d.outcome === "ADMIT") {
      assert.ok(d.granted.effectiveCapabilities.includes("TOUCH"));
      assert.equal(d.granted.bridgeRuntimeRead, true);
      assert.equal(d.granted.networkPolicy.mode, "NONE");
    }
    results.push({ id: "TEST-A", detail: "ADMIT touch" });
  }

  console.log("TEST-B not found");
  {
    const d = admitExperienceForDevice(baseInput({ record: null }));
    assert.equal(d.outcome, "DENY");
    if (d.outcome === "DENY") assert.equal(d.code, "ADMISSION_NOT_FOUND");
    results.push({ id: "TEST-B", detail: "NOT_FOUND" });
  }

  console.log("TEST-C tenant mismatch");
  {
    const d = admitExperienceForDevice(
      baseInput({ record: record({ tenantId: "ten_b" }) }),
    );
    assert.equal(d.outcome, "DENY");
    if (d.outcome === "DENY")
      assert.equal(d.code, "ADMISSION_TENANT_MISMATCH");
    results.push({ id: "TEST-C", detail: "TENANT_MISMATCH" });
  }

  console.log("TEST-D not published");
  {
    const d = admitExperienceForDevice(
      baseInput({ record: record({ publicationState: "DRAFT" }) }),
    );
    assert.equal(d.outcome, "DENY");
    if (d.outcome === "DENY") assert.equal(d.code, "ADMISSION_NOT_PUBLISHED");
    results.push({ id: "TEST-D", detail: "NOT_PUBLISHED" });
  }

  console.log("TEST-E blocked");
  {
    const d = admitExperienceForDevice(
      baseInput({ record: record({ publicationState: "BLOCKED" }) }),
    );
    assert.equal(d.outcome, "DENY");
    if (d.outcome === "DENY") assert.equal(d.code, "ADMISSION_BLOCKED");
    results.push({ id: "TEST-E", detail: "BLOCKED" });
  }

  console.log("TEST-F deprecated");
  {
    const d = admitExperienceForDevice(
      baseInput({ record: record({ publicationState: "DEPRECATED" }) }),
    );
    assert.equal(d.outcome, "DENY");
    if (d.outcome === "DENY") assert.equal(d.code, "ADMISSION_DEPRECATED");
    results.push({ id: "TEST-F", detail: "DEPRECATED" });
  }

  console.log("TEST-G integrity");
  {
    const d = admitExperienceForDevice(
      baseInput({ expectedPackageSha256: "c".repeat(64) }),
    );
    assert.equal(d.outcome, "DENY");
    if (d.outcome === "DENY")
      assert.equal(d.code, "ADMISSION_INTEGRITY_FAILED");
    results.push({ id: "TEST-G", detail: "INTEGRITY_FAILED" });
  }

  console.log("TEST-H no assignment");
  {
    const d = admitExperienceForDevice(baseInput({ assignment: null }));
    assert.equal(d.outcome, "DENY");
    if (d.outcome === "DENY")
      assert.equal(d.code, "ADMISSION_ASSIGNMENT_MISSING");
    results.push({ id: "TEST-H", detail: "ASSIGNMENT_MISSING" });
  }

  console.log("TEST-I revoked");
  {
    const d = admitExperienceForDevice(
      baseInput({ assignment: assignment({ revoked: true }) }),
    );
    assert.equal(d.outcome, "DENY");
    if (d.outcome === "DENY")
      assert.equal(d.code, "ADMISSION_ASSIGNMENT_REVOKED");
    results.push({ id: "TEST-I", detail: "ASSIGNMENT_REVOKED" });
  }

  console.log("TEST-J device disabled");
  {
    const d = admitExperienceForDevice(
      baseInput({ device: device({ status: "DISABLED" }) }),
    );
    assert.equal(d.outcome, "DENY");
    if (d.outcome === "DENY")
      assert.equal(d.code, "ADMISSION_DEVICE_DISABLED");
    results.push({ id: "TEST-J", detail: "DEVICE_DISABLED" });
  }

  console.log("TEST-K device tenant mismatch");
  {
    const d = admitExperienceForDevice(
      baseInput({ device: device({ tenantId: "ten_evil" }) }),
    );
    assert.equal(d.outcome, "DENY");
    if (d.outcome === "DENY")
      assert.equal(d.code, "ADMISSION_DEVICE_TENANT_MISMATCH");
    results.push({ id: "TEST-K", detail: "DEVICE_TENANT_MISMATCH" });
  }

  console.log("TEST-L capability required missing");
  {
    const d = admitExperienceForDevice(
      baseInput({
        record: record({
          manifestSnapshot: manifest({
            capabilities: ["CAMERA"],
            compatibility: { requiredCapabilities: ["CAMERA"] },
          }),
        }),
        assignment: assignment({
          grantedPermissions: { camera: true },
        }),
        device: device({ detected: detected({ touch: true }) }),
      }),
    );
    assert.equal(d.outcome, "DENY");
    if (d.outcome === "DENY")
      assert.equal(d.code, "ADMISSION_CAPABILITY_DENIED");
    results.push({ id: "TEST-L", detail: "CAPABILITY_DENIED" });
  }

  console.log("TEST-M permission denied");
  {
    const d = admitExperienceForDevice(
      baseInput({
        assignment: assignment({ grantedPermissions: {} }),
        record: record({
          manifestSnapshot: manifest({
            capabilities: ["TOUCH"],
            compatibility: { requiredPermissions: ["touch"] },
          }),
        }),
      }),
    );
    assert.equal(d.outcome, "DENY");
    if (d.outcome === "DENY")
      assert.equal(d.code, "ADMISSION_PERMISSION_DENIED");
    results.push({ id: "TEST-M", detail: "PERMISSION_DENIED" });
  }

  console.log("TEST-N network FULL without audit");
  {
    const d = admitExperienceForDevice(
      baseInput({
        record: record({
          manifestSnapshot: manifest({
            networkPolicy: { mode: "FULL_NETWORK" },
            permissions: { ...DEFAULT_EXPERIENCE_PERMISSIONS, network: true },
          }),
        }),
        assignment: assignment({
          grantedPermissions: { touch: true, network: true },
          allowFullNetwork: false,
        }),
      }),
    );
    assert.equal(d.outcome, "DENY");
    if (d.outcome === "DENY") assert.equal(d.code, "ADMISSION_NETWORK_DENIED");
    results.push({ id: "TEST-N", detail: "NETWORK_DENIED FULL" });
  }

  console.log("TEST-O storage persistent without perm");
  {
    const d = admitExperienceForDevice(
      baseInput({
        record: record({
          manifestSnapshot: manifest({
            storagePolicy: { mode: "PERSISTENT" },
          }),
        }),
        assignment: assignment({
          grantedPermissions: { touch: true, offlineStorage: false },
        }),
      }),
    );
    assert.equal(d.outcome, "DENY");
    if (d.outcome === "DENY") assert.equal(d.code, "ADMISSION_STORAGE_DENIED");
    results.push({ id: "TEST-O", detail: "STORAGE_DENIED" });
  }

  console.log("TEST-P kill switch");
  {
    const d = admitExperienceForDevice(baseInput({ killSwitch: true }));
    assert.equal(d.outcome, "DENY");
    if (d.outcome === "DENY") assert.equal(d.code, "ADMISSION_KILL_SWITCH");
    results.push({ id: "TEST-P", detail: "KILL_SWITCH" });
  }

  console.log("TEST-Q orientation incompatible");
  {
    const d = admitExperienceForDevice(
      baseInput({
        record: record({
          manifestSnapshot: manifest({
            compatibility: { supportedOrientation: ["PORTRAIT"] },
          }),
        }),
        device: device({
          domainPolicy: {
            ...DEFAULT_DOMAIN_RUNTIME_POLICY,
            orientation: "LANDSCAPE",
          },
        }),
      }),
    );
    assert.equal(d.outcome, "DENY");
    if (d.outcome === "DENY")
      assert.equal(d.code, "ADMISSION_ORIENTATION_INCOMPATIBLE");
    results.push({ id: "TEST-Q", detail: "ORIENTATION_INCOMPATIBLE" });
  }

  console.log("TEST-R runtime version");
  {
    const d = admitExperienceForDevice(
      baseInput({
        record: record({
          manifestSnapshot: manifest({
            compatibility: { minimumRuntimeVersion: "2.0.0" },
          }),
        }),
        device: device({ runtimeVersion: "1.0.0" }),
      }),
    );
    assert.equal(d.outcome, "DENY");
    if (d.outcome === "DENY")
      assert.equal(d.code, "ADMISSION_RUNTIME_INCOMPATIBLE");
    results.push({ id: "TEST-R", detail: "RUNTIME_INCOMPATIBLE" });
  }

  console.log("TEST-S bridge permissions from admit");
  {
    const ok = admitExperienceForDevice(baseInput());
    const perms = bridgePermissionsFromAdmission(ok);
    assert.ok(perms.has("RUNTIME_READ"));
    const caps = bridgeCapabilitiesFromAdmission(ok);
    assert.ok(caps.has("TOUCH"));
    const deny = admitExperienceForDevice(baseInput({ record: null }));
    assert.equal(bridgePermissionsFromAdmission(deny).size, 0);
    results.push({ id: "TEST-S", detail: "bridge RUNTIME_READ only on ADMIT" });
  }

  console.log("TEST-T detected mapping never invents camera");
  {
    const set = detectedToExperienceCapabilities(
      detected({
        touch: true,
        fullscreen: true,
        network: true,
        indexedDB: true,
      }),
    );
    assert.ok(set.has("TOUCH"));
    assert.ok(set.has("FULLSCREEN"));
    assert.ok(!set.has("CAMERA"));
    assert.ok(!set.has("MICROPHONE"));
    results.push({ id: "TEST-T", detail: "no camera invent" });
  }

  console.log("TEST-U soft capability omit still ADMIT");
  {
    // TOUCH requested but not detected; not required → ADMIT with empty effective
    const d = admitExperienceForDevice(
      baseInput({
        device: device({ detected: detected({ touch: false }) }),
        assignment: assignment({ grantedPermissions: { touch: true } }),
      }),
    );
    assert.equal(d.outcome, "ADMIT");
    if (d.outcome === "ADMIT") {
      assert.ok(!d.granted.effectiveCapabilities.includes("TOUCH"));
    }
    results.push({ id: "TEST-U", detail: "optional cap soft omit" });
  }

  console.log("TEST-V invalid validationState");
  {
    const d = admitExperienceForDevice(
      baseInput({ record: record({ validationState: "INVALID" }) }),
    );
    assert.equal(d.outcome, "DENY");
    if (d.outcome === "DENY")
      assert.equal(d.code, "ADMISSION_INVALID_VALIDATION");
    results.push({ id: "TEST-V", detail: "INVALID_VALIDATION" });
  }

  console.log("TEST-W summary safe");
  {
    const d = admitExperienceForDevice(baseInput());
    const s = summarizeAdmissionDecision(d);
    assert.equal(s.outcome, "ADMIT");
    const raw = JSON.stringify(s);
    assert.ok(!/Bearer|AUTH_SECRET|password|cookie/i.test(raw));
    results.push({ id: "TEST-W", detail: "summary no secrets" });
  }

  console.log("EXP-ADM-absences");
  {
    const src = fs.readFileSync(
      path.join(ROOT, "src/domain/experience-admission.ts"),
      "utf8",
    );
    assert.ok(!/CONTENT_TYPES|HTML_APP/.test(src));
    assert.ok(!/fetch\(|axios|DATABASE_URL|AUTH_SECRET|Bearer/.test(src));
    assert.ok(!/localStorage|indexedDB\.|playlist|schedule/.test(src));
    assert.ok(!CONTENT_TYPES.includes("HTML_APP" as never));
    results.push({
      id: "EXP-ADM-absences",
      detail: "no Player/HTML_APP/secrets in admission",
    });
  }

  console.log("EXP-ADM-prior");
  {
    // Serve path still independent — admission module does not replace it
    assert.ok(
      fs.existsSync(
        path.join(ROOT, "src/domain/experience-serving.ts"),
      ),
    );
    assert.ok(
      fs.existsSync(path.join(ROOT, "src/domain/experience-bridge.ts")),
    );
    results.push({ id: "EXP-ADM-prior", detail: "EX-05/07 modules intact" });
  }

  const checklist = `# RUNTIME-EXPERIENCE-08 Admission Checklist

**Date:** ${new Date().toISOString()}
**Verdict:** ADMISSION CONTROL VALIDATED

## Acceptance

- [x] Fail-closed admission pipeline
- [x] Registry + tenant + version + integrity
- [x] VALID + PUBLISHED required
- [x] BLOCKED / DEPRECATED / kill switch deny
- [x] Assignment required + revoked deny
- [x] Device tenant + status checks
- [x] Capability ∩ permission ∩ detected
- [x] Network / storage policy clamps
- [x] Device Runtime Policy orientation compatibility
- [x] Bridge RUNTIME_READ only on ADMIT
- [x] No tokens / DB / Player wire
- [x] Cross-tenant deny

## Automated checks

| ID | Result | Detail |
|----|--------|--------|
${results.map((r) => `| ${r.id} | PASS | ${r.detail} |`).join("\n")}
`;
  fs.writeFileSync(CHECKLIST, checklist, "utf8");

  console.log("RUNTIME-EXPERIENCE-08 PASS");
}

main();
