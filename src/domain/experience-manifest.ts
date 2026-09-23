/**
 * RUNTIME-EXPERIENCE-03 — Experience Manifest types (schemaVersion 1.0).
 *
 * Operational types implementing the EXPERIENCE-02 contract.
 * No execution, no DOM, no Player wiring.
 */

export const EXPERIENCE_MANIFEST_SCHEMA_VERSION = "1.0" as const;

export const EXPERIENCE_CAPABILITY_IDS = [
  "TOUCH",
  "KEYBOARD",
  "MOUSE",
  "CAMERA",
  "MICROPHONE",
  "NETWORK",
  "OFFLINE_STORAGE",
  "FULLSCREEN",
  "ORIENTATION",
] as const;
export type ExperienceCapabilityId = (typeof EXPERIENCE_CAPABILITY_IDS)[number];

export const EXPERIENCE_PERMISSION_KEYS = [
  "touch",
  "keyboard",
  "mouse",
  "camera",
  "microphone",
  "network",
  "offlineStorage",
  "fullscreen",
  "orientation",
] as const;
export type ExperiencePermissionKey = (typeof EXPERIENCE_PERMISSION_KEYS)[number];

export type ExperiencePermissions = Record<ExperiencePermissionKey, boolean>;

export const NETWORK_POLICY_MODES = [
  "NONE",
  "SAME_ORIGIN",
  "ALLOWLIST",
  "FULL_NETWORK",
] as const;
export type NetworkPolicyMode = (typeof NETWORK_POLICY_MODES)[number];

export type ExperienceNetworkPolicy = {
  mode: NetworkPolicyMode;
  allowlist?: string[];
};

export const STORAGE_POLICY_MODES = ["NONE", "EPHEMERAL", "PERSISTENT"] as const;
export type StoragePolicyMode = (typeof STORAGE_POLICY_MODES)[number];

export type ExperienceStoragePolicy = {
  mode: StoragePolicyMode;
};

export const OFFLINE_REQUIREMENT_MODES = [
  "OFFLINE_REQUIRED",
  "OFFLINE_PREFERRED",
  "ONLINE_REQUIRED",
] as const;
export type OfflineRequirementMode = (typeof OFFLINE_REQUIREMENT_MODES)[number];

export type ExperienceOfflineRequirements = {
  mode: OfflineRequirementMode;
};

export type LimitValue = number | "UNSPECIFIED";

export type ExperienceRuntimeLimits = {
  packageSizeBytes: LimitValue;
  assetCount: LimitValue;
  memoryMb: LimitValue;
  cpuTimeMs: LimitValue;
  networkRequests: LimitValue;
  storageBytes: LimitValue;
  maxSessionSeconds: LimitValue;
};

export type ExperienceAsset = {
  path: string;
  type: string;
  size: number;
  sha256: string;
};

export type ExperienceDependency =
  | {
      id: string;
      kind: "bundled";
      path: string;
      sha256: string;
    }
  | {
      id: string;
      kind: "remote";
      url: string;
      sha256: string;
    };

export type ExperienceCompatibility = {
  minimumRuntimeVersion?: string;
  maximumRuntimeVersion?: string;
  requiredCapabilities?: ExperienceCapabilityId[];
  requiredPermissions?: ExperiencePermissionKey[];
  supportedOrientation?: string[];
  supportedInput?: string[];
  supportedOfflineMode?: OfflineRequirementMode[];
};

/** Manifest schemaVersion 1.0 */
export type ExperienceManifestV1 = {
  schemaVersion: typeof EXPERIENCE_MANIFEST_SCHEMA_VERSION;
  id: string;
  version: string;
  name: string;
  description?: string;
  entrypoint: string;
  assets: ExperienceAsset[];
  dependencies: ExperienceDependency[];
  capabilities: ExperienceCapabilityId[];
  permissions: ExperiencePermissions;
  networkPolicy: ExperienceNetworkPolicy;
  storagePolicy: ExperienceStoragePolicy;
  offlineRequirements: ExperienceOfflineRequirements;
  runtimeLimits: ExperienceRuntimeLimits;
  compatibility?: ExperienceCompatibility;
};

export const EXPERIENCE_ERROR_CODES = [
  "EXPERIENCE_INVALID_MANIFEST",
  "EXPERIENCE_UNSUPPORTED_SCHEMA",
  "EXPERIENCE_ENTRYPOINT_INVALID",
  "EXPERIENCE_ASSET_MISSING",
  "EXPERIENCE_ASSET_INTEGRITY_FAILED",
  "EXPERIENCE_PACKAGE_TOO_LARGE",
  "EXPERIENCE_CAPABILITY_UNSUPPORTED",
  "EXPERIENCE_PERMISSION_DENIED",
  "EXPERIENCE_NETWORK_DENIED",
  "EXPERIENCE_STORAGE_DENIED",
  "EXPERIENCE_RUNTIME_INCOMPATIBLE",
  "EXPERIENCE_BLOCKED",
  "EXPERIENCE_PATH_INVALID",
  "EXPERIENCE_FORBIDDEN_ENTRY",
  "EXPERIENCE_DEPENDENCY_INVALID",
] as const;
export type ExperienceErrorCode = (typeof EXPERIENCE_ERROR_CODES)[number];

export const PACKAGE_VALIDATION_STATES = [
  "UNVALIDATED",
  "VALIDATING",
  "VALID",
  "INVALID",
  "INCOMPATIBLE",
  "BLOCKED",
] as const;
export type PackageValidationState = (typeof PACKAGE_VALIDATION_STATES)[number];

/** Registry publication lifecycle (conceptual — no persistence in this phase). */
export const REGISTRY_PUBLICATION_STATES = [
  "DRAFT",
  "VALIDATED",
  "PUBLISHED",
  "DEPRECATED",
  "BLOCKED",
  "ARCHIVED",
] as const;
export type RegistryPublicationState =
  (typeof REGISTRY_PUBLICATION_STATES)[number];

export const DEFAULT_EXPERIENCE_PERMISSIONS: ExperiencePermissions = {
  touch: false,
  keyboard: false,
  mouse: false,
  camera: false,
  microphone: false,
  network: false,
  offlineStorage: false,
  fullscreen: false,
  orientation: false,
};

export function defaultRuntimeLimits(): ExperienceRuntimeLimits {
  return {
    packageSizeBytes: "UNSPECIFIED",
    assetCount: "UNSPECIFIED",
    memoryMb: "UNSPECIFIED",
    cpuTimeMs: "UNSPECIFIED",
    networkRequests: "UNSPECIFIED",
    storageBytes: "UNSPECIFIED",
    maxSessionSeconds: "UNSPECIFIED",
  };
}

/** Map capability ID → permission key for effective-capability evaluation. */
export const CAPABILITY_TO_PERMISSION: Record<
  ExperienceCapabilityId,
  ExperiencePermissionKey
> = {
  TOUCH: "touch",
  KEYBOARD: "keyboard",
  MOUSE: "mouse",
  CAMERA: "camera",
  MICROPHONE: "microphone",
  NETWORK: "network",
  OFFLINE_STORAGE: "offlineStorage",
  FULLSCREEN: "fullscreen",
  ORIENTATION: "orientation",
};
