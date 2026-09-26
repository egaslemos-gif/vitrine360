/**
 * RUNTIME-EXPERIENCE-08 — Experience Runtime Admission Control.
 *
 * Fail-closed gate before any future sandboxed load / bridge activation.
 * Pure domain: no DOM, no Player wire, no DB, no tokens, no fetch.
 *
 * VALID ≠ PUBLISHED ≠ ASSIGNED ≠ ADMITTED ≠ EXECUTABLE (runtime still required).
 *
 * Pipeline:
 *   Registry → Tenant → Version → Integrity → Publication → Blocked?
 *   → Device scope → Capabilities → Permissions → Network → Storage
 *   → Device Runtime Policy → ADMIT | DENY
 */

import {
  CAPABILITY_TO_PERMISSION,
  DEFAULT_EXPERIENCE_PERMISSIONS,
  type ExperienceCapabilityId,
  type ExperienceErrorCode,
  type ExperienceManifestV1,
  type ExperienceNetworkPolicy,
  type ExperiencePermissions,
  type ExperiencePermissionKey,
  type ExperienceStoragePolicy,
  type NetworkPolicyMode,
  type StoragePolicyMode,
} from "@/domain/experience-manifest";
import type { ExperiencePackageVersionRecord } from "@/domain/experience-registry";
import { isAssignablePublication } from "@/domain/experience-registry";
import type {
  DetectedRuntimeCapabilities,
  DomainRuntimePolicy,
  OrientationPolicy,
} from "@/domain/runtime-policy";

/** Stable admission deny / stage codes (safe for logs / diagnostics). */
export const ADMISSION_DENY_CODES = [
  "ADMISSION_NOT_FOUND",
  "ADMISSION_TENANT_MISMATCH",
  "ADMISSION_VERSION_MISMATCH",
  "ADMISSION_IDENTITY_MISMATCH",
  "ADMISSION_INVALID_VALIDATION",
  "ADMISSION_NOT_PUBLISHED",
  "ADMISSION_BLOCKED",
  "ADMISSION_DEPRECATED",
  "ADMISSION_INTEGRITY_FAILED",
  "ADMISSION_MISSING_MANIFEST",
  "ADMISSION_DEVICE_DISABLED",
  "ADMISSION_DEVICE_TENANT_MISMATCH",
  "ADMISSION_ASSIGNMENT_MISSING",
  "ADMISSION_ASSIGNMENT_REVOKED",
  "ADMISSION_CAPABILITY_DENIED",
  "ADMISSION_PERMISSION_DENIED",
  "ADMISSION_NETWORK_DENIED",
  "ADMISSION_STORAGE_DENIED",
  "ADMISSION_RUNTIME_INCOMPATIBLE",
  "ADMISSION_ORIENTATION_INCOMPATIBLE",
  "ADMISSION_POLICY_DENIED",
  "ADMISSION_KILL_SWITCH",
] as const;
export type AdmissionDenyCode = (typeof ADMISSION_DENY_CODES)[number];

export const ADMISSION_PIPELINE_STAGES = [
  "REGISTRY",
  "TENANT",
  "VERSION",
  "INTEGRITY",
  "PUBLICATION",
  "BLOCKED",
  "ASSIGNMENT",
  "DEVICE",
  "CAPABILITIES",
  "PERMISSIONS",
  "NETWORK",
  "STORAGE",
  "RUNTIME_POLICY",
  "DECIDE",
] as const;
export type AdmissionPipelineStage = (typeof ADMISSION_PIPELINE_STAGES)[number];

/**
 * Conceptual device assignment of an Experience version.
 * No persistence in this phase — callers supply the record.
 */
export type ExperienceDeviceAssignment = {
  tenantId: string;
  deviceId: string;
  experienceId: string;
  version: string;
  /** Admin-granted permissions for this assignment (deny-by-default keys). */
  grantedPermissions: Partial<ExperiencePermissions>;
  /** Explicit revoke / kill without blocking the package globally. */
  revoked: boolean;
  /** Optional audited exception for FULL_NETWORK. */
  allowFullNetwork?: boolean;
};

/** Safe device slice for admission — never tokens / secrets. */
export type AdmissionDeviceContext = {
  tenantId: string;
  deviceId: string;
  /** Device lifecycle status (e.g. ACTIVE, DISABLED, PENDING). */
  status: string;
  /** Domain runtime policy already resolved for the device. */
  domainPolicy: DomainRuntimePolicy;
  /** Browser / probe facts. */
  detected: DetectedRuntimeCapabilities;
  /** Optional host Experience Runtime version (semver-ish). */
  runtimeVersion?: string;
};

export type ExperienceAdmissionInput = {
  tenantId: string;
  experienceId: string;
  version: string;
  /** Registry / store record (null = not found). */
  record: ExperiencePackageVersionRecord | null;
  /**
   * Expected package SHA-256 from assignment / sync.
   * When provided, must equal record.packageSha256.
   */
  expectedPackageSha256?: string | null;
  assignment: ExperienceDeviceAssignment | null;
  device: AdmissionDeviceContext;
  /**
   * Global kill switch (ops). When true → DENY regardless of package state.
   */
  killSwitch?: boolean;
};

export type ExperienceAdmissionGranted = {
  tenantId: string;
  deviceId: string;
  experienceId: string;
  version: string;
  packageSha256: string;
  /** Manifest snapshot used for decision (read-only). */
  manifest: ExperienceManifestV1;
  /** Effective = DeviceDetected ∩ Requested ∩ AdminGranted. */
  effectiveCapabilities: ExperienceCapabilityId[];
  /** Resolved permission map after deny-by-default merge. */
  effectivePermissions: ExperiencePermissions;
  /** Network mode allowed after admission clamps. */
  networkPolicy: ExperienceNetworkPolicy;
  storagePolicy: ExperienceStoragePolicy;
  /** Device orientation policy snapshot (observational for host). */
  orientationPolicy: OrientationPolicy;
  /** Whether bridge RUNTIME_READ is authorized (always true on ADMIT v1). */
  bridgeRuntimeRead: true;
  stagesCompleted: AdmissionPipelineStage[];
};

export type ExperienceAdmissionDecision =
  | {
      outcome: "ADMIT";
      granted: ExperienceAdmissionGranted;
    }
  | {
      outcome: "DENY";
      code: AdmissionDenyCode;
      /** Maps to experience error family when applicable. */
      experienceCode?: ExperienceErrorCode;
      message: string;
      stage: AdmissionPipelineStage;
      stagesCompleted: AdmissionPipelineStage[];
    };

function deny(
  code: AdmissionDenyCode,
  message: string,
  stage: AdmissionPipelineStage,
  stagesCompleted: AdmissionPipelineStage[],
  experienceCode?: ExperienceErrorCode,
): ExperienceAdmissionDecision {
  return {
    outcome: "DENY",
    code,
    experienceCode,
    message,
    stage,
    stagesCompleted: [...stagesCompleted],
  };
}

function compareLooseVersion(a: string, b: string): number {
  const pa = a.split(".").map((x) => parseInt(x, 10) || 0);
  const pb = b.split(".").map((x) => parseInt(x, 10) || 0);
  const n = Math.max(pa.length, pb.length);
  for (let i = 0; i < n; i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da < db) return -1;
    if (da > db) return 1;
  }
  return 0;
}

/**
 * Map DetectedRuntimeCapabilities → Experience capability IDs.
 * Browser support alone does NOT grant Experience privilege — used only as ∩ input.
 */
export function detectedToExperienceCapabilities(
  detected: DetectedRuntimeCapabilities,
): Set<ExperienceCapabilityId> {
  const set = new Set<ExperienceCapabilityId>();
  if (detected.touch) set.add("TOUCH");
  if (detected.keyboard) set.add("KEYBOARD");
  if (detected.pointer) set.add("MOUSE");
  if (detected.fullscreen) set.add("FULLSCREEN");
  if (detected.orientation) set.add("ORIENTATION");
  if (detected.network) set.add("NETWORK");
  if (detected.indexedDB) set.add("OFFLINE_STORAGE");
  // CAMERA / MICROPHONE: never inferred from generic probe in v1
  return set;
}

/**
 * Effective capability:
 *   BrowserDetected ∩ ManifestRequested ∩ AdminGrantedPermission
 *
 * Required capabilities that fail the intersection → DENY.
 * Optional requested caps that fail → omitted from effective (soft).
 */
export function computeAdmissionEffectiveCapabilities(params: {
  manifest: ExperienceManifestV1;
  detected: DetectedRuntimeCapabilities;
  grantedPermissions: ExperiencePermissions;
}): {
  effective: ExperienceCapabilityId[];
  deniedRequired: ExperienceCapabilityId[];
  deniedOptional: ExperienceCapabilityId[];
} {
  const deviceCaps = detectedToExperienceCapabilities(params.detected);
  const required = new Set(
    params.manifest.compatibility?.requiredCapabilities ?? [],
  );
  const effective: ExperienceCapabilityId[] = [];
  const deniedRequired: ExperienceCapabilityId[] = [];
  const deniedOptional: ExperienceCapabilityId[] = [];

  for (const cap of params.manifest.capabilities) {
    const permKey = CAPABILITY_TO_PERMISSION[cap];
    const deviceOk = deviceCaps.has(cap);
    const permOk = params.grantedPermissions[permKey] === true;
    if (deviceOk && permOk) {
      effective.push(cap);
      continue;
    }
    if (required.has(cap)) deniedRequired.push(cap);
    else deniedOptional.push(cap);
  }

  // Required listed only in compatibility, not in capabilities[]
  for (const cap of required) {
    if (effective.includes(cap)) continue;
    if (deniedRequired.includes(cap)) continue;
    const permKey = CAPABILITY_TO_PERMISSION[cap];
    const deviceOk = deviceCaps.has(cap);
    const permOk = params.grantedPermissions[permKey] === true;
    if (!(deviceOk && permOk)) deniedRequired.push(cap);
  }

  return { effective, deniedRequired, deniedOptional };
}

function mergePermissions(
  admin: Partial<ExperiencePermissions> | undefined,
): ExperiencePermissions {
  return {
    ...DEFAULT_EXPERIENCE_PERMISSIONS,
    ...admin,
  };
}

function clampNetworkPolicy(
  declared: ExperienceNetworkPolicy,
  allowFullNetwork: boolean,
): { ok: true; policy: ExperienceNetworkPolicy } | { ok: false; reason: string } {
  if (declared.mode === "FULL_NETWORK" && !allowFullNetwork) {
    return {
      ok: false,
      reason: "FULL_NETWORK requires audited allowFullNetwork on assignment",
    };
  }
  if (declared.mode === "ALLOWLIST") {
    const list = declared.allowlist ?? [];
    if (list.length === 0) {
      return { ok: false, reason: "ALLOWLIST network policy has empty allowlist" };
    }
  }
  // Permission gate: network capability must be granted for non-NONE
  return { ok: true, policy: { ...declared } };
}

function clampStoragePolicy(
  declared: ExperienceStoragePolicy,
  permissions: ExperiencePermissions,
): { ok: true; policy: ExperienceStoragePolicy } | { ok: false; reason: string } {
  if (declared.mode === "PERSISTENT" && !permissions.offlineStorage) {
    return {
      ok: false,
      reason: "PERSISTENT storage requires offlineStorage permission",
    };
  }
  return { ok: true, policy: { ...declared } };
}

function orientationCompatible(
  supported: string[] | undefined,
  deviceOrientation: OrientationPolicy,
): boolean {
  if (!supported || supported.length === 0) return true;
  const normalized = supported.map((s) => s.trim().toUpperCase());
  if (normalized.includes("ANY") || normalized.includes("AUTO")) return true;
  if (deviceOrientation === "AUTO") return true;
  return normalized.includes(deviceOrientation);
}

/**
 * Fail-closed admission decision for a single device + experience version.
 * Does NOT load iframes, start bridges, or mutate Player state.
 */
export function admitExperienceForDevice(
  input: ExperienceAdmissionInput,
): ExperienceAdmissionDecision {
  const stages: AdmissionPipelineStage[] = [];

  if (input.killSwitch) {
    return deny(
      "ADMISSION_KILL_SWITCH",
      "Global Experience kill switch active",
      "DECIDE",
      stages,
      "EXPERIENCE_BLOCKED",
    );
  }

  // --- REGISTRY ---
  stages.push("REGISTRY");
  const { record } = input;
  if (!record) {
    return deny(
      "ADMISSION_NOT_FOUND",
      "Experience package not found in registry",
      "REGISTRY",
      stages,
      "EXPERIENCE_ASSET_MISSING",
    );
  }

  // --- TENANT ---
  stages.push("TENANT");
  if (record.tenantId !== input.tenantId) {
    return deny(
      "ADMISSION_TENANT_MISMATCH",
      "Registry tenant does not match request tenant",
      "TENANT",
      stages,
      "EXPERIENCE_BLOCKED",
    );
  }
  if (record.experienceId !== input.experienceId) {
    return deny(
      "ADMISSION_IDENTITY_MISMATCH",
      "Experience identity mismatch",
      "TENANT",
      stages,
      "EXPERIENCE_BLOCKED",
    );
  }

  // --- VERSION ---
  stages.push("VERSION");
  if (record.version !== input.version) {
    return deny(
      "ADMISSION_VERSION_MISMATCH",
      "Version mismatch",
      "VERSION",
      stages,
      "EXPERIENCE_ASSET_MISSING",
    );
  }

  // --- INTEGRITY ---
  stages.push("INTEGRITY");
  if (!record.packageSha256 || !/^[a-f0-9]{64}$/.test(record.packageSha256)) {
    return deny(
      "ADMISSION_INTEGRITY_FAILED",
      "Missing or invalid packageSha256",
      "INTEGRITY",
      stages,
      "EXPERIENCE_ASSET_INTEGRITY_FAILED",
    );
  }
  if (
    input.expectedPackageSha256 &&
    input.expectedPackageSha256 !== record.packageSha256
  ) {
    return deny(
      "ADMISSION_INTEGRITY_FAILED",
      "Package SHA-256 does not match expected",
      "INTEGRITY",
      stages,
      "EXPERIENCE_ASSET_INTEGRITY_FAILED",
    );
  }

  // --- PUBLICATION ---
  stages.push("PUBLICATION");
  if (record.validationState !== "VALID") {
    return deny(
      "ADMISSION_INVALID_VALIDATION",
      `validationState=${record.validationState}`,
      "PUBLICATION",
      stages,
      "EXPERIENCE_BLOCKED",
    );
  }
  if (record.publicationState === "BLOCKED") {
    stages.push("BLOCKED");
    return deny(
      "ADMISSION_BLOCKED",
      "Package blocked",
      "BLOCKED",
      stages,
      "EXPERIENCE_BLOCKED",
    );
  }
  if (record.publicationState === "DEPRECATED") {
    return deny(
      "ADMISSION_DEPRECATED",
      "Deprecated packages are not newly admitted",
      "PUBLICATION",
      stages,
      "EXPERIENCE_BLOCKED",
    );
  }
  if (!isAssignablePublication(record.publicationState)) {
    return deny(
      "ADMISSION_NOT_PUBLISHED",
      `publicationState=${record.publicationState}`,
      "PUBLICATION",
      stages,
      "EXPERIENCE_BLOCKED",
    );
  }

  if (!record.manifestSnapshot) {
    return deny(
      "ADMISSION_MISSING_MANIFEST",
      "Missing manifest snapshot",
      "PUBLICATION",
      stages,
      "EXPERIENCE_INVALID_MANIFEST",
    );
  }
  const manifest = record.manifestSnapshot;

  // --- ASSIGNMENT ---
  stages.push("ASSIGNMENT");
  const { assignment } = input;
  if (!assignment) {
    return deny(
      "ADMISSION_ASSIGNMENT_MISSING",
      "No device assignment for this Experience",
      "ASSIGNMENT",
      stages,
      "EXPERIENCE_BLOCKED",
    );
  }
  if (assignment.revoked) {
    return deny(
      "ADMISSION_ASSIGNMENT_REVOKED",
      "Assignment revoked",
      "ASSIGNMENT",
      stages,
      "EXPERIENCE_BLOCKED",
    );
  }
  if (
    assignment.tenantId !== input.tenantId ||
    assignment.experienceId !== input.experienceId ||
    assignment.version !== input.version
  ) {
    return deny(
      "ADMISSION_IDENTITY_MISMATCH",
      "Assignment identity does not match request",
      "ASSIGNMENT",
      stages,
      "EXPERIENCE_BLOCKED",
    );
  }
  if (assignment.deviceId !== input.device.deviceId) {
    return deny(
      "ADMISSION_IDENTITY_MISMATCH",
      "Assignment deviceId does not match device context",
      "ASSIGNMENT",
      stages,
      "EXPERIENCE_BLOCKED",
    );
  }

  // --- DEVICE ---
  stages.push("DEVICE");
  const { device } = input;
  if (device.tenantId !== input.tenantId) {
    return deny(
      "ADMISSION_DEVICE_TENANT_MISMATCH",
      "Device tenant does not match Experience tenant",
      "DEVICE",
      stages,
      "EXPERIENCE_BLOCKED",
    );
  }
  const status = device.status.trim().toUpperCase();
  if (
    status === "DISABLED" ||
    status === "REVOKED" ||
    status === "DELETED" ||
    status === "BLOCKED"
  ) {
    return deny(
      "ADMISSION_DEVICE_DISABLED",
      `Device status=${device.status}`,
      "DEVICE",
      stages,
      "EXPERIENCE_BLOCKED",
    );
  }

  const effectivePermissions = mergePermissions(assignment.grantedPermissions);

  // --- CAPABILITIES ---
  stages.push("CAPABILITIES");
  const caps = computeAdmissionEffectiveCapabilities({
    manifest,
    detected: device.detected,
    grantedPermissions: effectivePermissions,
  });
  if (caps.deniedRequired.length > 0) {
    return deny(
      "ADMISSION_CAPABILITY_DENIED",
      `Required capabilities unavailable: ${caps.deniedRequired.join(",")}`,
      "CAPABILITIES",
      stages,
      "EXPERIENCE_CAPABILITY_UNSUPPORTED",
    );
  }

  // --- PERMISSIONS (requiredPermissions on compatibility) ---
  stages.push("PERMISSIONS");
  const requiredPerms = manifest.compatibility?.requiredPermissions ?? [];
  for (const key of requiredPerms) {
    if (!effectivePermissions[key as ExperiencePermissionKey]) {
      return deny(
        "ADMISSION_PERMISSION_DENIED",
        `Required permission missing: ${key}`,
        "PERMISSIONS",
        stages,
        "EXPERIENCE_PERMISSION_DENIED",
      );
    }
  }

  // --- NETWORK ---
  stages.push("NETWORK");
  if (
    manifest.networkPolicy.mode !== "NONE" &&
    !effectivePermissions.network
  ) {
    return deny(
      "ADMISSION_NETWORK_DENIED",
      "Non-NONE network policy requires network permission",
      "NETWORK",
      stages,
      "EXPERIENCE_NETWORK_DENIED",
    );
  }
  const net = clampNetworkPolicy(
    manifest.networkPolicy,
    assignment.allowFullNetwork === true,
  );
  if (!net.ok) {
    return deny(
      "ADMISSION_NETWORK_DENIED",
      net.reason,
      "NETWORK",
      stages,
      "EXPERIENCE_NETWORK_DENIED",
    );
  }

  // --- STORAGE ---
  stages.push("STORAGE");
  const stor = clampStoragePolicy(manifest.storagePolicy, effectivePermissions);
  if (!stor.ok) {
    return deny(
      "ADMISSION_STORAGE_DENIED",
      stor.reason,
      "STORAGE",
      stages,
      "EXPERIENCE_STORAGE_DENIED",
    );
  }

  // --- RUNTIME POLICY / device policy ---
  stages.push("RUNTIME_POLICY");
  if (manifest.compatibility?.minimumRuntimeVersion && device.runtimeVersion) {
    if (
      compareLooseVersion(
        device.runtimeVersion,
        manifest.compatibility.minimumRuntimeVersion,
      ) < 0
    ) {
      return deny(
        "ADMISSION_RUNTIME_INCOMPATIBLE",
        `runtime ${device.runtimeVersion} < minimum ${manifest.compatibility.minimumRuntimeVersion}`,
        "RUNTIME_POLICY",
        stages,
        "EXPERIENCE_RUNTIME_INCOMPATIBLE",
      );
    }
  }
  if (manifest.compatibility?.maximumRuntimeVersion && device.runtimeVersion) {
    if (
      compareLooseVersion(
        device.runtimeVersion,
        manifest.compatibility.maximumRuntimeVersion,
      ) > 0
    ) {
      return deny(
        "ADMISSION_RUNTIME_INCOMPATIBLE",
        `runtime ${device.runtimeVersion} > maximum ${manifest.compatibility.maximumRuntimeVersion}`,
        "RUNTIME_POLICY",
        stages,
        "EXPERIENCE_RUNTIME_INCOMPATIBLE",
      );
    }
  }
  if (
    !orientationCompatible(
      manifest.compatibility?.supportedOrientation,
      device.domainPolicy.orientation,
    )
  ) {
    return deny(
      "ADMISSION_ORIENTATION_INCOMPATIBLE",
      `Device orientation ${device.domainPolicy.orientation} not in supportedOrientation`,
      "RUNTIME_POLICY",
      stages,
      "EXPERIENCE_RUNTIME_INCOMPATIBLE",
    );
  }

  // FULLSCREEN / ORIENTATION CONTROL remain deferred at bridge — admission may
  // still grant observational capability bits when ∩ succeeds. No CONTROL API.

  stages.push("DECIDE");
  return {
    outcome: "ADMIT",
    granted: {
      tenantId: input.tenantId,
      deviceId: device.deviceId,
      experienceId: input.experienceId,
      version: input.version,
      packageSha256: record.packageSha256,
      manifest,
      effectiveCapabilities: caps.effective,
      effectivePermissions,
      networkPolicy: net.policy,
      storagePolicy: stor.policy,
      orientationPolicy: device.domainPolicy.orientation,
      bridgeRuntimeRead: true,
      stagesCompleted: [...stages],
    },
  };
}

/** True only when outcome is ADMIT — helper for callers. */
export function isAdmitted(
  decision: ExperienceAdmissionDecision,
): decision is Extract<ExperienceAdmissionDecision, { outcome: "ADMIT" }> {
  return decision.outcome === "ADMIT";
}

/**
 * Map admission grant → bridge permission set (v1: RUNTIME_READ only).
 * Never elevates to CONTROL / MUTATION from admission alone.
 */
export function bridgePermissionsFromAdmission(
  decision: ExperienceAdmissionDecision,
): ReadonlySet<"RUNTIME_READ"> {
  if (decision.outcome !== "ADMIT" || !decision.granted.bridgeRuntimeRead) {
    return new Set();
  }
  return new Set(["RUNTIME_READ"]);
}

/**
 * Map admission grant → bridge capability strings (optional gates).
 * V1 read methods do not require capability tags; CONTROL methods deferred.
 */
export function bridgeCapabilitiesFromAdmission(
  decision: ExperienceAdmissionDecision,
): ReadonlySet<string> {
  if (decision.outcome !== "ADMIT") return new Set();
  return new Set(decision.granted.effectiveCapabilities);
}

/** Audit-friendly summary — no secrets / payloads. */
export function summarizeAdmissionDecision(
  decision: ExperienceAdmissionDecision,
): {
  outcome: "ADMIT" | "DENY";
  code?: AdmissionDenyCode;
  stage?: AdmissionPipelineStage;
  experienceId?: string;
  version?: string;
  deviceId?: string;
  effectiveCapabilities?: ExperienceCapabilityId[];
  networkMode?: NetworkPolicyMode;
  storageMode?: StoragePolicyMode;
} {
  if (decision.outcome === "DENY") {
    return {
      outcome: "DENY",
      code: decision.code,
      stage: decision.stage,
    };
  }
  const g = decision.granted;
  return {
    outcome: "ADMIT",
    experienceId: g.experienceId,
    version: g.version,
    deviceId: g.deviceId,
    effectiveCapabilities: g.effectiveCapabilities,
    networkMode: g.networkPolicy.mode,
    storageMode: g.storagePolicy.mode,
  };
}
