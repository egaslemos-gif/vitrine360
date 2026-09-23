/**
 * RUNTIME-EXPERIENCE-03 — Experience Package Validator.
 *
 * Pure / deterministic validation of package inventories + manifest JSON.
 * Reads bytes and JSON only — never executes HTML/CSS/JS from packages.
 *
 * Pipeline:
 * RAW → STRUCTURAL → MANIFEST → SCHEMA → PATH → ENTRYPOINT →
 * ASSETS → INTEGRITY → DEPENDENCIES → POLICY → COMPATIBILITY → RESULT
 */

import { createHash } from "node:crypto";
import { inflateRawSync } from "node:zlib";

import {
  CAPABILITY_TO_PERMISSION,
  DEFAULT_EXPERIENCE_PERMISSIONS,
  EXPERIENCE_CAPABILITY_IDS,
  EXPERIENCE_MANIFEST_SCHEMA_VERSION,
  EXPERIENCE_PERMISSION_KEYS,
  NETWORK_POLICY_MODES,
  OFFLINE_REQUIREMENT_MODES,
  STORAGE_POLICY_MODES,
  type ExperienceAsset,
  type ExperienceCapabilityId,
  type ExperienceCompatibility,
  type ExperienceDependency,
  type ExperienceErrorCode,
  type ExperienceManifestV1,
  type ExperienceNetworkPolicy,
  type ExperienceOfflineRequirements,
  type ExperiencePermissionKey,
  type ExperiencePermissions,
  type ExperienceRuntimeLimits,
  type ExperienceStoragePolicy,
  type LimitValue,
  type PackageValidationState,
} from "@/domain/experience-manifest";

export type PackageEntry = {
  /** Normalized relative path using `/` separators, no leading `./`. */
  path: string;
  size: number;
  bytes?: Uint8Array;
  isDirectory?: boolean;
  isSymlink?: boolean;
};

export type PackageInventory = {
  entries: PackageEntry[];
  /** Optional whole-package SHA-256 (hex). */
  packageSha256?: string;
};

export type ValidationIssue = {
  code: ExperienceErrorCode;
  message: string;
  path?: string;
  stage: ValidationStage;
};

export type ValidationStage =
  | "STRUCTURAL"
  | "MANIFEST"
  | "SCHEMA"
  | "PATH"
  | "ENTRYPOINT"
  | "ASSET_INVENTORY"
  | "ASSET_INTEGRITY"
  | "DEPENDENCY"
  | "POLICY"
  | "COMPATIBILITY";

export type CompatibilityContext = {
  /** Host Experience Runtime generation, e.g. "1.0.0". Optional. */
  runtimeVersion?: string;
  /** Device-detected capabilities (probe). */
  deviceCapabilities?:
    | ReadonlySet<ExperienceCapabilityId>
    | ExperienceCapabilityId[];
  /**
   * Admin/product permissions for this Experience assignment.
   * When omitted, permission evaluation is skipped (package-only validation).
   */
  permissions?: Partial<ExperiencePermissions>;
  /** When true, FULL_NETWORK is accepted as audited exception. */
  allowFullNetwork?: boolean;
};

export type PackageValidationResult = {
  state: PackageValidationState;
  issues: ValidationIssue[];
  manifest: ExperienceManifestV1 | null;
  packageSha256: string | null;
  stagesCompleted: ValidationStage[];
  /** Effective = Device ∩ Requested ∩ Permission (when context provided). */
  effectiveCapabilities: ExperienceCapabilityId[];
};

const MAX_PATH_DEPTH = 8;
const SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/;
const SHA256_HEX = /^[a-f0-9]{64}$/;
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const FORBIDDEN_EXT = /\.(exe|dll|so|dylib|apk|bat|cmd|msi|scr)$/i;
const NESTED_ARCHIVE = /\.(zip|jar|war|7z|rar|tar|tgz|gz)$/i;
const EXECUTABLE_LIKE = /\.(js|mjs|cjs|wasm)$/i;
const HIDDEN_OR_META =
  /(?:^|\/)(?:__MACOSX|\.git|\.svn|\.DS_Store|Thumbs\.db)(?:\/|$)/i;

const CRITICAL_UNKNOWN_KEYS = new Set([
  "execute",
  "eval",
  "bridgeSecrets",
  "hostTokens",
  "adminApi",
]);

export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function normalizePackagePath(raw: string): string | null {
  if (typeof raw !== "string" || raw.length === 0) return null;
  let p = raw.replace(/\\/g, "/").trim();
  if (p.startsWith("./")) p = p.slice(2);
  if (p.startsWith("/")) return null;
  if (/^[a-zA-Z]:/.test(p)) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(p)) return null;
  if (p.includes("\0") || /[\u0000-\u001f]/.test(p)) return null;
  const parts = p.split("/").filter((s) => s.length > 0);
  if (parts.some((s) => s === ".." || s === ".")) return null;
  if (parts.length > MAX_PATH_DEPTH) return null;
  return parts.join("/");
}

export function isSafePathSegments(path: string): boolean {
  return path.split("/").every((s) => SAFE_SEGMENT.test(s));
}

function issue(
  code: ExperienceErrorCode,
  message: string,
  stage: ValidationStage,
  path?: string,
): ValidationIssue {
  return { code, message, stage, path };
}

function asSet(
  caps?: ReadonlySet<ExperienceCapabilityId> | ExperienceCapabilityId[],
): Set<ExperienceCapabilityId> {
  if (!caps) return new Set();
  return caps instanceof Set ? caps : new Set(caps);
}

function isLimitValue(v: unknown): v is LimitValue {
  return (
    v === "UNSPECIFIED" ||
    (typeof v === "number" && Number.isFinite(v) && v >= 0)
  );
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function validateStructure(
  inventory: PackageInventory,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seen = new Set<string>();

  if (!inventory.entries.length) {
    issues.push(
      issue("EXPERIENCE_INVALID_MANIFEST", "Package has no entries", "STRUCTURAL"),
    );
    return issues;
  }

  let hasManifest = false;
  for (const entry of inventory.entries) {
    if (entry.isSymlink) {
      issues.push(
        issue(
          "EXPERIENCE_FORBIDDEN_ENTRY",
          "Symlinks are forbidden",
          "STRUCTURAL",
          entry.path,
        ),
      );
      continue;
    }
    const norm = normalizePackagePath(entry.path);
    if (!norm) {
      issues.push(
        issue(
          "EXPERIENCE_PATH_INVALID",
          `Invalid path: ${entry.path}`,
          "PATH",
          entry.path,
        ),
      );
      continue;
    }
    if (!isSafePathSegments(norm)) {
      issues.push(
        issue(
          "EXPERIENCE_PATH_INVALID",
          `Unsafe path segments: ${norm}`,
          "PATH",
          norm,
        ),
      );
    }
    if (HIDDEN_OR_META.test(norm)) {
      issues.push(
        issue(
          "EXPERIENCE_FORBIDDEN_ENTRY",
          `Hidden/metadata entry forbidden: ${norm}`,
          "STRUCTURAL",
          norm,
        ),
      );
    }
    if (FORBIDDEN_EXT.test(norm)) {
      issues.push(
        issue(
          "EXPERIENCE_FORBIDDEN_ENTRY",
          `Forbidden file type: ${norm}`,
          "STRUCTURAL",
          norm,
        ),
      );
    }
    if (NESTED_ARCHIVE.test(norm)) {
      issues.push(
        issue(
          "EXPERIENCE_FORBIDDEN_ENTRY",
          `Nested archives forbidden: ${norm}`,
          "STRUCTURAL",
          norm,
        ),
      );
    }
    if (seen.has(norm)) {
      issues.push(
        issue(
          "EXPERIENCE_PATH_INVALID",
          `Duplicate entry path: ${norm}`,
          "STRUCTURAL",
          norm,
        ),
      );
    }
    seen.add(norm);
    if (norm === "manifest.json" && !entry.isDirectory) hasManifest = true;
  }

  if (!hasManifest) {
    issues.push(
      issue(
        "EXPERIENCE_INVALID_MANIFEST",
        "manifest.json missing at package root",
        "MANIFEST",
      ),
    );
  }

  return issues;
}

export function extractManifestJson(
  inventory: PackageInventory,
): { json: string; bytes: Uint8Array } | { error: ValidationIssue } {
  const entry = inventory.entries.find(
    (e) => normalizePackagePath(e.path) === "manifest.json" && !e.isDirectory,
  );
  if (!entry?.bytes) {
    return {
      error: issue(
        "EXPERIENCE_INVALID_MANIFEST",
        "manifest.json bytes unavailable",
        "MANIFEST",
      ),
    };
  }
  try {
    const json = new TextDecoder("utf-8", { fatal: true }).decode(entry.bytes);
    return { json, bytes: entry.bytes };
  } catch {
    return {
      error: issue(
        "EXPERIENCE_INVALID_MANIFEST",
        "manifest.json is not valid UTF-8",
        "MANIFEST",
      ),
    };
  }
}

function parsePermissions(
  raw: unknown,
  issues: ValidationIssue[],
): ExperiencePermissions | null {
  if (!isObject(raw)) {
    issues.push(
      issue(
        "EXPERIENCE_INVALID_MANIFEST",
        "permissions object required",
        "POLICY",
      ),
    );
    return null;
  }
  const out = { ...DEFAULT_EXPERIENCE_PERMISSIONS };
  for (const key of EXPERIENCE_PERMISSION_KEYS) {
    if (raw[key] === undefined) continue;
    if (typeof raw[key] !== "boolean") {
      issues.push(
        issue(
          "EXPERIENCE_INVALID_MANIFEST",
          `permissions.${key} must be boolean`,
          "POLICY",
        ),
      );
      return null;
    }
    out[key] = raw[key] as boolean;
  }
  return out;
}

function parseNetworkPolicy(
  raw: unknown,
  issues: ValidationIssue[],
): ExperienceNetworkPolicy | null {
  if (!isObject(raw) || typeof raw.mode !== "string") {
    issues.push(
      issue(
        "EXPERIENCE_NETWORK_DENIED",
        "networkPolicy.mode required",
        "POLICY",
      ),
    );
    return null;
  }
  if (!(NETWORK_POLICY_MODES as readonly string[]).includes(raw.mode)) {
    issues.push(
      issue(
        "EXPERIENCE_NETWORK_DENIED",
        `invalid networkPolicy.mode: ${raw.mode}`,
        "POLICY",
      ),
    );
    return null;
  }
  const mode = raw.mode as ExperienceNetworkPolicy["mode"];
  if (mode === "ALLOWLIST") {
    if (
      !Array.isArray(raw.allowlist) ||
      !raw.allowlist.every((h) => typeof h === "string")
    ) {
      issues.push(
        issue(
          "EXPERIENCE_NETWORK_DENIED",
          "ALLOWLIST requires string[] allowlist",
          "POLICY",
        ),
      );
      return null;
    }
    for (const host of raw.allowlist as string[]) {
      if (!/^https:\/\//i.test(host) && !/^[a-z0-9.-]+$/i.test(host)) {
        issues.push(
          issue(
            "EXPERIENCE_NETWORK_DENIED",
            `allowlist entry must be https URL or hostname: ${host}`,
            "POLICY",
          ),
        );
        return null;
      }
    }
    return { mode, allowlist: raw.allowlist as string[] };
  }
  return { mode };
}

function parseStoragePolicy(
  raw: unknown,
  issues: ValidationIssue[],
): ExperienceStoragePolicy | null {
  if (!isObject(raw) || typeof raw.mode !== "string") {
    issues.push(
      issue(
        "EXPERIENCE_STORAGE_DENIED",
        "storagePolicy.mode required",
        "POLICY",
      ),
    );
    return null;
  }
  if (!(STORAGE_POLICY_MODES as readonly string[]).includes(raw.mode)) {
    issues.push(
      issue(
        "EXPERIENCE_STORAGE_DENIED",
        `invalid storagePolicy.mode: ${raw.mode}`,
        "POLICY",
      ),
    );
    return null;
  }
  return { mode: raw.mode as ExperienceStoragePolicy["mode"] };
}

function parseOffline(
  raw: unknown,
  issues: ValidationIssue[],
): ExperienceOfflineRequirements | null {
  if (!isObject(raw) || typeof raw.mode !== "string") {
    issues.push(
      issue(
        "EXPERIENCE_INVALID_MANIFEST",
        "offlineRequirements.mode required",
        "POLICY",
      ),
    );
    return null;
  }
  if (!(OFFLINE_REQUIREMENT_MODES as readonly string[]).includes(raw.mode)) {
    issues.push(
      issue(
        "EXPERIENCE_INVALID_MANIFEST",
        `invalid offlineRequirements.mode: ${raw.mode}`,
        "POLICY",
      ),
    );
    return null;
  }
  return { mode: raw.mode as ExperienceOfflineRequirements["mode"] };
}

function parseLimits(
  raw: unknown,
  issues: ValidationIssue[],
): ExperienceRuntimeLimits | null {
  if (!isObject(raw)) {
    issues.push(
      issue(
        "EXPERIENCE_INVALID_MANIFEST",
        "runtimeLimits object required",
        "SCHEMA",
      ),
    );
    return null;
  }
  const keys = [
    "packageSizeBytes",
    "assetCount",
    "memoryMb",
    "cpuTimeMs",
    "networkRequests",
    "storageBytes",
    "maxSessionSeconds",
  ] as const;
  const out = {} as ExperienceRuntimeLimits;
  for (const k of keys) {
    if (!isLimitValue(raw[k])) {
      issues.push(
        issue(
          "EXPERIENCE_INVALID_MANIFEST",
          `runtimeLimits.${k} must be number|UNSPECIFIED`,
          "SCHEMA",
        ),
      );
      return null;
    }
    out[k] = raw[k] as LimitValue;
  }
  return out;
}

function parseAssets(
  raw: unknown,
  issues: ValidationIssue[],
): ExperienceAsset[] | null {
  if (!Array.isArray(raw)) return null;
  const assets: ExperienceAsset[] = [];
  const paths = new Set<string>();
  for (const item of raw) {
    if (!isObject(item)) {
      issues.push(
        issue(
          "EXPERIENCE_INVALID_MANIFEST",
          "asset must be object",
          "ASSET_INVENTORY",
        ),
      );
      return null;
    }
    if (typeof item.path !== "string" || typeof item.type !== "string") {
      issues.push(
        issue(
          "EXPERIENCE_INVALID_MANIFEST",
          "asset path/type required",
          "ASSET_INVENTORY",
        ),
      );
      return null;
    }
    if (
      typeof item.size !== "number" ||
      !Number.isFinite(item.size) ||
      item.size < 0
    ) {
      issues.push(
        issue(
          "EXPERIENCE_INVALID_MANIFEST",
          "asset size invalid",
          "ASSET_INVENTORY",
        ),
      );
      return null;
    }
    if (
      typeof item.sha256 !== "string" ||
      !SHA256_HEX.test(item.sha256.toLowerCase())
    ) {
      issues.push(
        issue(
          "EXPERIENCE_ASSET_INTEGRITY_FAILED",
          "asset sha256 must be 64 hex chars",
          "ASSET_INTEGRITY",
        ),
      );
      return null;
    }
    const norm = normalizePackagePath(item.path);
    if (!norm) {
      issues.push(
        issue(
          "EXPERIENCE_PATH_INVALID",
          `asset path invalid: ${item.path}`,
          "PATH",
        ),
      );
      return null;
    }
    if (paths.has(norm)) {
      issues.push(
        issue(
          "EXPERIENCE_PATH_INVALID",
          `duplicate asset path: ${norm}`,
          "ASSET_INVENTORY",
          norm,
        ),
      );
      return null;
    }
    paths.add(norm);
    if (!item.type.includes("/")) {
      issues.push(
        issue(
          "EXPERIENCE_INVALID_MANIFEST",
          `invalid MIME declaration: ${String(item.type)}`,
          "ASSET_INVENTORY",
        ),
      );
      return null;
    }
    assets.push({
      path: norm,
      type: item.type,
      size: item.size,
      sha256: item.sha256.toLowerCase(),
    });
  }
  return assets;
}

function parseDependencies(
  raw: unknown,
  issues: ValidationIssue[],
): ExperienceDependency[] | null {
  if (!Array.isArray(raw)) return null;
  const deps: ExperienceDependency[] = [];
  for (const item of raw) {
    if (!isObject(item) || typeof item.id !== "string") {
      issues.push(
        issue(
          "EXPERIENCE_DEPENDENCY_INVALID",
          "dependency.id required",
          "DEPENDENCY",
        ),
      );
      return null;
    }
    if (item.kind === "bundled") {
      if (typeof item.path !== "string" || typeof item.sha256 !== "string") {
        issues.push(
          issue(
            "EXPERIENCE_DEPENDENCY_INVALID",
            "bundled dependency needs path+sha256",
            "DEPENDENCY",
          ),
        );
        return null;
      }
      const norm = normalizePackagePath(item.path);
      if (!norm) {
        issues.push(
          issue(
            "EXPERIENCE_DEPENDENCY_INVALID",
            `bundled path invalid: ${item.path}`,
            "DEPENDENCY",
          ),
        );
        return null;
      }
      deps.push({
        id: item.id,
        kind: "bundled",
        path: norm,
        sha256: item.sha256.toLowerCase(),
      });
    } else if (item.kind === "remote") {
      if (typeof item.url !== "string" || typeof item.sha256 !== "string") {
        issues.push(
          issue(
            "EXPERIENCE_DEPENDENCY_INVALID",
            "remote dependency needs url+sha256",
            "DEPENDENCY",
          ),
        );
        return null;
      }
      if (!/^https:\/\//i.test(item.url)) {
        issues.push(
          issue(
            "EXPERIENCE_DEPENDENCY_INVALID",
            "remote dependency URL must be https",
            "DEPENDENCY",
          ),
        );
        return null;
      }
      deps.push({
        id: item.id,
        kind: "remote",
        url: item.url,
        sha256: item.sha256.toLowerCase(),
      });
    } else {
      issues.push(
        issue(
          "EXPERIENCE_DEPENDENCY_INVALID",
          `unknown dependency kind: ${String(item.kind)}`,
          "DEPENDENCY",
        ),
      );
      return null;
    }
  }
  return deps;
}

function parseCapabilities(
  raw: unknown,
  issues: ValidationIssue[],
): ExperienceCapabilityId[] | null {
  if (!Array.isArray(raw)) return null;
  const out: ExperienceCapabilityId[] = [];
  for (const c of raw) {
    if (
      typeof c !== "string" ||
      !(EXPERIENCE_CAPABILITY_IDS as readonly string[]).includes(c)
    ) {
      issues.push(
        issue(
          "EXPERIENCE_CAPABILITY_UNSUPPORTED",
          `unknown capability: ${String(c)}`,
          "COMPATIBILITY",
        ),
      );
      return null;
    }
    out.push(c as ExperienceCapabilityId);
  }
  return out;
}

function parseCompatibility(
  raw: unknown,
  issues: ValidationIssue[],
): ExperienceCompatibility | undefined {
  if (raw === undefined) return undefined;
  if (!isObject(raw)) {
    issues.push(
      issue(
        "EXPERIENCE_RUNTIME_INCOMPATIBLE",
        "compatibility must be object",
        "COMPATIBILITY",
      ),
    );
    return undefined;
  }
  const c: ExperienceCompatibility = {};
  if (raw.minimumRuntimeVersion !== undefined) {
    if (typeof raw.minimumRuntimeVersion !== "string") {
      issues.push(
        issue(
          "EXPERIENCE_RUNTIME_INCOMPATIBLE",
          "minimumRuntimeVersion invalid",
          "COMPATIBILITY",
        ),
      );
    } else c.minimumRuntimeVersion = raw.minimumRuntimeVersion;
  }
  if (raw.maximumRuntimeVersion !== undefined) {
    if (typeof raw.maximumRuntimeVersion !== "string") {
      issues.push(
        issue(
          "EXPERIENCE_RUNTIME_INCOMPATIBLE",
          "maximumRuntimeVersion invalid",
          "COMPATIBILITY",
        ),
      );
    } else c.maximumRuntimeVersion = raw.maximumRuntimeVersion;
  }
  if (raw.requiredCapabilities !== undefined) {
    if (!Array.isArray(raw.requiredCapabilities)) {
      issues.push(
        issue(
          "EXPERIENCE_RUNTIME_INCOMPATIBLE",
          "requiredCapabilities invalid",
          "COMPATIBILITY",
        ),
      );
    } else {
      c.requiredCapabilities =
        raw.requiredCapabilities as ExperienceCapabilityId[];
    }
  }
  if (raw.requiredPermissions !== undefined) {
    if (!Array.isArray(raw.requiredPermissions)) {
      issues.push(
        issue(
          "EXPERIENCE_RUNTIME_INCOMPATIBLE",
          "requiredPermissions invalid",
          "COMPATIBILITY",
        ),
      );
    } else {
      c.requiredPermissions =
        raw.requiredPermissions as ExperiencePermissionKey[];
    }
  }
  return c;
}

export function parseManifestJson(
  raw: string,
): { manifest: ExperienceManifestV1 } | { issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      issues: [
        issue(
          "EXPERIENCE_INVALID_MANIFEST",
          "manifest.json is not valid JSON",
          "MANIFEST",
        ),
      ],
    };
  }
  if (!isObject(parsed)) {
    return {
      issues: [
        issue(
          "EXPERIENCE_INVALID_MANIFEST",
          "manifest root must be an object",
          "SCHEMA",
        ),
      ],
    };
  }

  for (const key of Object.keys(parsed)) {
    if (CRITICAL_UNKNOWN_KEYS.has(key)) {
      issues.push(
        issue(
          "EXPERIENCE_RUNTIME_INCOMPATIBLE",
          `Critical unknown field: ${key}`,
          "SCHEMA",
        ),
      );
    }
  }

  if (parsed.schemaVersion !== EXPERIENCE_MANIFEST_SCHEMA_VERSION) {
    issues.push(
      issue(
        "EXPERIENCE_UNSUPPORTED_SCHEMA",
        `Unsupported schemaVersion: ${String(parsed.schemaVersion)}`,
        "SCHEMA",
      ),
    );
  }

  if (typeof parsed.id !== "string" || parsed.id.trim().length === 0) {
    issues.push(
      issue("EXPERIENCE_INVALID_MANIFEST", "id required", "SCHEMA", "id"),
    );
  }
  if (typeof parsed.version !== "string" || !SEMVER.test(parsed.version)) {
    issues.push(
      issue(
        "EXPERIENCE_INVALID_MANIFEST",
        "version must be MAJOR.MINOR.PATCH semver",
        "SCHEMA",
        "version",
      ),
    );
  }
  if (typeof parsed.name !== "string" || parsed.name.trim().length === 0) {
    issues.push(
      issue("EXPERIENCE_INVALID_MANIFEST", "name required", "SCHEMA", "name"),
    );
  }
  if (
    parsed.description !== undefined &&
    typeof parsed.description !== "string"
  ) {
    issues.push(
      issue(
        "EXPERIENCE_INVALID_MANIFEST",
        "description must be string",
        "SCHEMA",
      ),
    );
  }
  if (typeof parsed.entrypoint !== "string") {
    issues.push(
      issue(
        "EXPERIENCE_ENTRYPOINT_INVALID",
        "entrypoint required",
        "ENTRYPOINT",
      ),
    );
  }

  if (!Array.isArray(parsed.assets)) {
    issues.push(
      issue("EXPERIENCE_INVALID_MANIFEST", "assets must be array", "SCHEMA"),
    );
  }
  if (!Array.isArray(parsed.dependencies)) {
    issues.push(
      issue(
        "EXPERIENCE_INVALID_MANIFEST",
        "dependencies must be array",
        "SCHEMA",
      ),
    );
  }
  if (!Array.isArray(parsed.capabilities)) {
    issues.push(
      issue(
        "EXPERIENCE_INVALID_MANIFEST",
        "capabilities must be array",
        "SCHEMA",
      ),
    );
  }

  const permissions = parsePermissions(parsed.permissions, issues);
  const networkPolicy = parseNetworkPolicy(parsed.networkPolicy, issues);
  const storagePolicy = parseStoragePolicy(parsed.storagePolicy, issues);
  const offlineRequirements = parseOffline(parsed.offlineRequirements, issues);
  const runtimeLimits = parseLimits(parsed.runtimeLimits, issues);
  const assets = parseAssets(parsed.assets, issues);
  const dependencies = parseDependencies(parsed.dependencies, issues);
  const capabilities = parseCapabilities(parsed.capabilities, issues);
  const compatibility = parseCompatibility(parsed.compatibility, issues);

  if (parsed.schemaVersion !== EXPERIENCE_MANIFEST_SCHEMA_VERSION) {
    return { issues };
  }

  if (
    typeof parsed.id !== "string" ||
    typeof parsed.version !== "string" ||
    !SEMVER.test(parsed.version) ||
    typeof parsed.name !== "string" ||
    typeof parsed.entrypoint !== "string" ||
    !permissions ||
    !networkPolicy ||
    !storagePolicy ||
    !offlineRequirements ||
    !runtimeLimits ||
    !assets ||
    !dependencies ||
    !capabilities
  ) {
    return {
      issues: issues.length
        ? issues
        : [
            issue(
              "EXPERIENCE_INVALID_MANIFEST",
              "manifest incomplete",
              "SCHEMA",
            ),
          ],
    };
  }

  // Critical unknown fields alone → INCOMPATIBLE (no manifest acceptance)
  if (issues.some((i) => i.code === "EXPERIENCE_RUNTIME_INCOMPATIBLE")) {
    return { issues };
  }

  if (issues.length > 0) {
    return { issues };
  }

  const manifest: ExperienceManifestV1 = {
    schemaVersion: EXPERIENCE_MANIFEST_SCHEMA_VERSION,
    id: parsed.id.trim(),
    version: parsed.version,
    name: parsed.name.trim(),
    entrypoint: parsed.entrypoint,
    assets,
    dependencies,
    capabilities,
    permissions,
    networkPolicy,
    storagePolicy,
    offlineRequirements,
    runtimeLimits,
  };
  if (typeof parsed.description === "string") {
    manifest.description = parsed.description;
  }
  if (compatibility) manifest.compatibility = compatibility;

  return { manifest };
}

function entryMap(inventory: PackageInventory): Map<string, PackageEntry> {
  const map = new Map<string, PackageEntry>();
  for (const e of inventory.entries) {
    const n = normalizePackagePath(e.path);
    if (n && !e.isDirectory) map.set(n, { ...e, path: n });
  }
  return map;
}

export function validateEntrypoint(
  manifest: ExperienceManifestV1,
  files: Map<string, PackageEntry>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const ep = normalizePackagePath(manifest.entrypoint);
  if (!ep) {
    issues.push(
      issue(
        "EXPERIENCE_ENTRYPOINT_INVALID",
        `entrypoint path invalid: ${manifest.entrypoint}`,
        "ENTRYPOINT",
      ),
    );
    return issues;
  }
  if (!files.has(ep)) {
    issues.push(
      issue(
        "EXPERIENCE_ENTRYPOINT_INVALID",
        `entrypoint missing in package: ${ep}`,
        "ENTRYPOINT",
        ep,
      ),
    );
  }
  return issues;
}

export function validateAssetInventory(
  manifest: ExperienceManifestV1,
  files: Map<string, PackageEntry>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const asset of manifest.assets) {
    if (!files.has(asset.path)) {
      issues.push(
        issue(
          "EXPERIENCE_ASSET_MISSING",
          `asset missing: ${asset.path}`,
          "ASSET_INVENTORY",
          asset.path,
        ),
      );
    }
  }

  const declared = new Set(manifest.assets.map((a) => a.path));
  const ep = normalizePackagePath(manifest.entrypoint);
  for (const path of files.keys()) {
    if (path === "manifest.json") continue;
    if (ep && path === ep) continue;
    if (EXECUTABLE_LIKE.test(path) && !declared.has(path)) {
      const bundled = manifest.dependencies.some(
        (d) => d.kind === "bundled" && d.path === path,
      );
      if (!bundled) {
        issues.push(
          issue(
            "EXPERIENCE_FORBIDDEN_ENTRY",
            `undeclared executable-like file: ${path}`,
            "ASSET_INVENTORY",
            path,
          ),
        );
      }
    }
  }
  return issues;
}

export function validateAssetIntegrity(
  manifest: ExperienceManifestV1,
  files: Map<string, PackageEntry>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const asset of manifest.assets) {
    const file = files.get(asset.path);
    if (!file?.bytes) {
      issues.push(
        issue(
          "EXPERIENCE_ASSET_INTEGRITY_FAILED",
          `cannot hash asset (bytes missing): ${asset.path}`,
          "ASSET_INTEGRITY",
          asset.path,
        ),
      );
      continue;
    }
    if (file.bytes.byteLength !== asset.size) {
      issues.push(
        issue(
          "EXPERIENCE_ASSET_INTEGRITY_FAILED",
          `size mismatch for ${asset.path}: declared ${asset.size}, actual ${file.bytes.byteLength}`,
          "ASSET_INTEGRITY",
          asset.path,
        ),
      );
    }
    const hash = sha256Hex(file.bytes);
    if (hash !== asset.sha256) {
      issues.push(
        issue(
          "EXPERIENCE_ASSET_INTEGRITY_FAILED",
          `sha256 mismatch for ${asset.path}`,
          "ASSET_INTEGRITY",
          asset.path,
        ),
      );
    }
  }
  return issues;
}

export function validateDependencies(
  manifest: ExperienceManifestV1,
  files: Map<string, PackageEntry>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const dep of manifest.dependencies) {
    if (dep.kind === "bundled") {
      const file = files.get(dep.path);
      if (!file) {
        issues.push(
          issue(
            "EXPERIENCE_DEPENDENCY_INVALID",
            `bundled dependency missing: ${dep.path}`,
            "DEPENDENCY",
            dep.path,
          ),
        );
        continue;
      }
      if (file.bytes) {
        const hash = sha256Hex(file.bytes);
        if (hash !== dep.sha256) {
          issues.push(
            issue(
              "EXPERIENCE_DEPENDENCY_INVALID",
              `bundled dependency hash mismatch: ${dep.path}`,
              "DEPENDENCY",
              dep.path,
            ),
          );
        }
      }
    } else if (dep.kind === "remote") {
      if (!manifest.permissions.network) {
        issues.push(
          issue(
            "EXPERIENCE_PERMISSION_DENIED",
            "remote dependency requires permissions.network=true",
            "DEPENDENCY",
          ),
        );
      }
      if (manifest.networkPolicy.mode === "NONE") {
        issues.push(
          issue(
            "EXPERIENCE_NETWORK_DENIED",
            "remote dependency forbidden under networkPolicy NONE",
            "DEPENDENCY",
          ),
        );
      }
    }
  }
  return issues;
}

export function validatePolicies(
  manifest: ExperienceManifestV1,
  ctx: CompatibilityContext = {},
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (manifest.networkPolicy.mode === "FULL_NETWORK" && !ctx.allowFullNetwork) {
    issues.push(
      issue(
        "EXPERIENCE_NETWORK_DENIED",
        "FULL_NETWORK requires explicit audited allowFullNetwork",
        "POLICY",
      ),
    );
  }

  if (
    manifest.storagePolicy.mode === "PERSISTENT" &&
    !manifest.permissions.offlineStorage
  ) {
    issues.push(
      issue(
        "EXPERIENCE_STORAGE_DENIED",
        "PERSISTENT storage requires permissions.offlineStorage=true",
        "POLICY",
      ),
    );
  }

  if (
    manifest.capabilities.includes("NETWORK") &&
    manifest.networkPolicy.mode === "NONE"
  ) {
    issues.push(
      issue(
        "EXPERIENCE_NETWORK_DENIED",
        "NETWORK capability with networkPolicy NONE is inconsistent",
        "POLICY",
      ),
    );
  }

  return issues;
}

export function evaluateCompatibility(
  manifest: ExperienceManifestV1,
  ctx: CompatibilityContext = {},
): { issues: ValidationIssue[]; effective: ExperienceCapabilityId[] } {
  const issues: ValidationIssue[] = [];
  const device = asSet(ctx.deviceCapabilities);
  const perms: ExperiencePermissions = {
    ...DEFAULT_EXPERIENCE_PERMISSIONS,
    ...ctx.permissions,
  };

  // Effective = Device ∩ Requested ∩ Permission
  const effective: ExperienceCapabilityId[] = [];
  for (const cap of manifest.capabilities) {
    const permKey = CAPABILITY_TO_PERMISSION[cap];
    const deviceAllowed =
      ctx.deviceCapabilities === undefined ? true : device.has(cap);
    if (!deviceAllowed) {
      issues.push(
        issue(
          "EXPERIENCE_CAPABILITY_UNSUPPORTED",
          `device lacks capability ${cap}`,
          "COMPATIBILITY",
        ),
      );
      continue;
    }
    if (ctx.permissions !== undefined && !perms[permKey]) {
      issues.push(
        issue(
          "EXPERIENCE_PERMISSION_DENIED",
          `permission denied for ${cap}`,
          "COMPATIBILITY",
        ),
      );
      continue;
    }
    if (ctx.permissions === undefined || perms[permKey]) {
      if (deviceAllowed) effective.push(cap);
    }
  }

  if (manifest.compatibility?.minimumRuntimeVersion && ctx.runtimeVersion) {
    if (
      compareLooseVersion(
        ctx.runtimeVersion,
        manifest.compatibility.minimumRuntimeVersion,
      ) < 0
    ) {
      issues.push(
        issue(
          "EXPERIENCE_RUNTIME_INCOMPATIBLE",
          `runtime ${ctx.runtimeVersion} < minimum ${manifest.compatibility.minimumRuntimeVersion}`,
          "COMPATIBILITY",
        ),
      );
    }
  }

  if (manifest.compatibility?.requiredCapabilities) {
    for (const cap of manifest.compatibility.requiredCapabilities) {
      if (ctx.deviceCapabilities !== undefined && !device.has(cap)) {
        issues.push(
          issue(
            "EXPERIENCE_CAPABILITY_UNSUPPORTED",
            `required capability unsupported: ${cap}`,
            "COMPATIBILITY",
          ),
        );
      }
    }
  }

  const seen = new Set<string>();
  const deduped = issues.filter((i) => {
    const key = `${i.code}:${i.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { issues: deduped, effective };
}

function compareLooseVersion(a: string, b: string): number {
  const pa = a
    .replace(/^v/i, "")
    .split(".")
    .map((x) => parseInt(x, 10) || 0);
  const pb = b
    .replace(/^v/i, "")
    .split(".")
    .map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

function totalBytes(inventory: PackageInventory): number {
  return inventory.entries.reduce(
    (n, e) => n + (e.isDirectory ? 0 : e.size),
    0,
  );
}

function finalize(
  state: PackageValidationState,
  issues: ValidationIssue[],
  manifest: ExperienceManifestV1 | null,
  packageSha256: string | null,
  stagesCompleted: ValidationStage[],
  effectiveCapabilities: ExperienceCapabilityId[],
): PackageValidationResult {
  return {
    state,
    issues,
    manifest: state === "INVALID" ? null : manifest,
    packageSha256,
    stagesCompleted: [...new Set(stagesCompleted)],
    effectiveCapabilities,
  };
}

/**
 * Full validation pipeline. Deterministic. Does not execute package code.
 *
 * VALID ≠ AUTHORIZED ≠ EXECUTABLE
 */
export function validateExperiencePackage(
  inventory: PackageInventory,
  ctx: CompatibilityContext = {},
): PackageValidationResult {
  const stagesCompleted: ValidationStage[] = [];
  const issues: ValidationIssue[] = [];

  const structural = validateStructure(inventory);
  stagesCompleted.push("STRUCTURAL");
  issues.push(...structural);

  const files = entryMap(inventory);
  let packageSha256: string | null = inventory.packageSha256 ?? null;

  const extracted = extractManifestJson(inventory);
  stagesCompleted.push("MANIFEST");
  if ("error" in extracted) {
    issues.push(extracted.error);
    return finalize(
      "INVALID",
      issues,
      null,
      packageSha256,
      stagesCompleted,
      [],
    );
  }

  const parsed = parseManifestJson(extracted.json);
  stagesCompleted.push("SCHEMA");
  if ("issues" in parsed) {
    issues.push(...parsed.issues);
    const hasHard = parsed.issues.some((i) =>
      [
        "EXPERIENCE_INVALID_MANIFEST",
        "EXPERIENCE_ENTRYPOINT_INVALID",
        "EXPERIENCE_ASSET_MISSING",
        "EXPERIENCE_ASSET_INTEGRITY_FAILED",
        "EXPERIENCE_PATH_INVALID",
        "EXPERIENCE_FORBIDDEN_ENTRY",
        "EXPERIENCE_DEPENDENCY_INVALID",
        "EXPERIENCE_NETWORK_DENIED",
        "EXPERIENCE_STORAGE_DENIED",
      ].includes(i.code),
    );
    const hasIncompat = parsed.issues.some((i) =>
      [
        "EXPERIENCE_UNSUPPORTED_SCHEMA",
        "EXPERIENCE_RUNTIME_INCOMPATIBLE",
        "EXPERIENCE_CAPABILITY_UNSUPPORTED",
      ].includes(i.code),
    );
    const state: PackageValidationState = hasHard
      ? "INVALID"
      : hasIncompat
        ? "INCOMPATIBLE"
        : "INVALID";
    return finalize(
      state,
      issues,
      null,
      packageSha256,
      stagesCompleted,
      [],
    );
  }

  const manifest = parsed.manifest;
  stagesCompleted.push("PATH", "ENTRYPOINT");
  issues.push(...validateEntrypoint(manifest, files));

  stagesCompleted.push("ASSET_INVENTORY");
  issues.push(...validateAssetInventory(manifest, files));

  stagesCompleted.push("ASSET_INTEGRITY");
  issues.push(...validateAssetIntegrity(manifest, files));

  stagesCompleted.push("DEPENDENCY");
  issues.push(...validateDependencies(manifest, files));

  stagesCompleted.push("POLICY");
  issues.push(...validatePolicies(manifest, ctx));

  if (typeof manifest.runtimeLimits.packageSizeBytes === "number") {
    const total = totalBytes(inventory);
    if (total > manifest.runtimeLimits.packageSizeBytes) {
      issues.push(
        issue(
          "EXPERIENCE_PACKAGE_TOO_LARGE",
          `package ${total} bytes exceeds limit ${manifest.runtimeLimits.packageSizeBytes}`,
          "POLICY",
        ),
      );
    }
  }
  if (typeof manifest.runtimeLimits.assetCount === "number") {
    if (manifest.assets.length > manifest.runtimeLimits.assetCount) {
      issues.push(
        issue(
          "EXPERIENCE_PACKAGE_TOO_LARGE",
          `assetCount ${manifest.assets.length} exceeds limit`,
          "POLICY",
        ),
      );
    }
  }

  stagesCompleted.push("COMPATIBILITY");
  const compat = evaluateCompatibility(manifest, ctx);
  issues.push(...compat.issues);

  if (!packageSha256) {
    const parts: string[] = [];
    for (const [path, ent] of [...files.entries()].sort((a, b) =>
      a[0].localeCompare(b[0]),
    )) {
      if (ent.bytes) parts.push(`${path}:${sha256Hex(ent.bytes)}`);
      else parts.push(`${path}:size=${ent.size}`);
    }
    packageSha256 = sha256Hex(new TextEncoder().encode(parts.join("|")));
  }

  // Structural issues collected earlier still count
  const hardInvalid = issues.some((i) =>
    [
      "EXPERIENCE_INVALID_MANIFEST",
      "EXPERIENCE_ENTRYPOINT_INVALID",
      "EXPERIENCE_ASSET_MISSING",
      "EXPERIENCE_ASSET_INTEGRITY_FAILED",
      "EXPERIENCE_PATH_INVALID",
      "EXPERIENCE_FORBIDDEN_ENTRY",
      "EXPERIENCE_DEPENDENCY_INVALID",
      "EXPERIENCE_PACKAGE_TOO_LARGE",
      "EXPERIENCE_NETWORK_DENIED",
      "EXPERIENCE_STORAGE_DENIED",
    ].includes(i.code),
  );
  const incompatible = issues.some((i) =>
    [
      "EXPERIENCE_UNSUPPORTED_SCHEMA",
      "EXPERIENCE_RUNTIME_INCOMPATIBLE",
      "EXPERIENCE_CAPABILITY_UNSUPPORTED",
    ].includes(i.code),
  );
  const blocked = issues.some((i) =>
    ["EXPERIENCE_BLOCKED", "EXPERIENCE_PERMISSION_DENIED"].includes(i.code),
  );

  let state: PackageValidationState = "VALID";
  if (hardInvalid) state = "INVALID";
  else if (incompatible) state = "INCOMPATIBLE";
  else if (blocked) state = "BLOCKED";

  return finalize(
    state,
    issues,
    state === "INVALID" ? null : manifest,
    packageSha256,
    stagesCompleted,
    compat.effective,
  );
}

/**
 * Minimal ZIP reader: lists entries and extracts STORE / DEFLATE payloads.
 * Rejects encrypted entries. Does not execute package content.
 */
export function readZipInventory(buffer: Uint8Array): PackageInventory {
  const view = new DataView(
    buffer.buffer,
    buffer.byteOffset,
    buffer.byteLength,
  );
  const entries: PackageEntry[] = [];

  let eocd = -1;
  for (let i = buffer.byteLength - 22; i >= 0; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) {
    throw new Error("EXPERIENCE_INVALID_MANIFEST: EOCD not found (not a zip)");
  }

  const cdOffset = view.getUint32(eocd + 16, true);
  const cdEntries = view.getUint16(eocd + 10, true);
  let offset = cdOffset;

  for (let n = 0; n < cdEntries; n++) {
    if (view.getUint32(offset, true) !== 0x02014b50) {
      throw new Error("Invalid central directory signature");
    }
    const flags = view.getUint16(offset + 8, true);
    const method = view.getUint16(offset + 10, true);
    const compSize = view.getUint32(offset + 20, true);
    const uncompSize = view.getUint32(offset + 24, true);
    const nameLen = view.getUint16(offset + 28, true);
    const extraLen = view.getUint16(offset + 30, true);
    const commentLen = view.getUint16(offset + 32, true);
    const externalAttrs = view.getUint32(offset + 38, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);
    const nameBytes = buffer.subarray(offset + 46, offset + 46 + nameLen);
    const name = new TextDecoder().decode(nameBytes);
    offset += 46 + nameLen + extraLen + commentLen;

    const isDirectory = name.endsWith("/");
    const isSymlink = ((externalAttrs >>> 16) & 0o170000) === 0o120000;

    if (flags & 0x1) {
      throw new Error(`Encrypted zip entry forbidden: ${name}`);
    }

    let bytes: Uint8Array | undefined;
    if (!isDirectory && !isSymlink) {
      if (view.getUint32(localHeaderOffset, true) !== 0x04034b50) {
        throw new Error(`Invalid local header: ${name}`);
      }
      const lNameLen = view.getUint16(localHeaderOffset + 26, true);
      const lExtraLen = view.getUint16(localHeaderOffset + 28, true);
      const dataStart = localHeaderOffset + 30 + lNameLen + lExtraLen;
      const compressed = buffer.subarray(dataStart, dataStart + compSize);
      if (method === 0) {
        bytes = compressed;
      } else if (method === 8) {
        bytes = new Uint8Array(inflateRawSync(compressed));
      } else {
        throw new Error(
          `Unsupported zip compression method ${method} for ${name}`,
        );
      }
      void uncompSize;
    }

    entries.push({
      path: name.replace(/\\/g, "/"),
      size: isDirectory ? 0 : (bytes?.byteLength ?? uncompSize),
      bytes,
      isDirectory,
      isSymlink,
    });
  }

  return {
    entries,
    packageSha256: sha256Hex(buffer),
  };
}

/** Build in-memory inventory helper for tests (no zip). */
export function inventoryFromFiles(
  files: Record<string, string | Uint8Array>,
): PackageInventory {
  const enc = new TextEncoder();
  const entries: PackageEntry[] = Object.entries(files).map(
    ([path, content]) => {
      const bytes =
        typeof content === "string" ? enc.encode(content) : content;
      return { path, size: bytes.byteLength, bytes };
    },
  );
  return { entries };
}
