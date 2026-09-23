/**
 * RUNTIME-EXPERIENCE-05 — Package serving resolution + security headers.
 *
 * Serves package *bytes* only. Does not execute HTML/JS/CSS on the server.
 * Does not create iframes or bridges.
 */

import {
  normalizePackagePath,
  type PackageEntry,
  type PackageInventory,
} from "@/domain/experience-validator";
import type { ExperienceManifestV1 } from "@/domain/experience-manifest";
import type {
  ExperiencePackageVersionRecord,
} from "@/domain/experience-registry";
import { isAssignablePublication } from "@/domain/experience-registry";

export type StoredExperiencePackage = {
  record: ExperiencePackageVersionRecord;
  inventory: PackageInventory;
  /** path → entry (files only) */
  files: Map<string, PackageEntry>;
};

export type ServeResolution =
  | {
      ok: true;
      path: string;
      bytes: Uint8Array;
      contentType: string;
      packageSha256: string;
      manifest: ExperienceManifestV1;
    }
  | {
      ok: false;
      status: 400 | 403 | 404 | 409;
      code: string;
      message: string;
    };

export type ServeAdmissionInput = {
  tenantId: string;
  experienceId: string;
  version: string;
  assetPath: string;
  stored: StoredExperiencePackage | null;
};

/**
 * Fail-closed admission for *serving* (not Player execution).
 * Requires VALID + PUBLISHED registry record and tenant match.
 */
export function admitPackageServe(
  input: ServeAdmissionInput,
): { ok: true; stored: StoredExperiencePackage } | { ok: false; status: 403 | 404 | 409; code: string; message: string } {
  const { stored, tenantId, experienceId, version } = input;
  if (!stored) {
    return {
      ok: false,
      status: 404,
      code: "EXPERIENCE_ASSET_MISSING",
      message: "Package not found",
    };
  }
  if (stored.record.tenantId !== tenantId) {
    return {
      ok: false,
      status: 403,
      code: "EXPERIENCE_BLOCKED",
      message: "Cross-tenant serve denied",
    };
  }
  if (stored.record.experienceId !== experienceId) {
    return {
      ok: false,
      status: 404,
      code: "EXPERIENCE_ASSET_MISSING",
      message: "Experience mismatch",
    };
  }
  if (stored.record.version !== version) {
    return {
      ok: false,
      status: 404,
      code: "EXPERIENCE_ASSET_MISSING",
      message: "Version mismatch",
    };
  }
  if (stored.record.validationState !== "VALID") {
    return {
      ok: false,
      status: 409,
      code: "EXPERIENCE_BLOCKED",
      message: `validationState=${stored.record.validationState}`,
    };
  }
  if (stored.record.publicationState === "BLOCKED") {
    return {
      ok: false,
      status: 403,
      code: "EXPERIENCE_BLOCKED",
      message: "Package blocked",
    };
  }
  if (!isAssignablePublication(stored.record.publicationState)) {
    return {
      ok: false,
      status: 403,
      code: "EXPERIENCE_BLOCKED",
      message: `publicationState=${stored.record.publicationState} not serveable`,
    };
  }
  if (!stored.record.manifestSnapshot) {
    return {
      ok: false,
      status: 409,
      code: "EXPERIENCE_INVALID_MANIFEST",
      message: "Missing manifest snapshot",
    };
  }
  return { ok: true, stored };
}

function guessMime(path: string, declared?: string): string {
  if (declared && declared.includes("/")) return declared;
  const lower = path.toLowerCase();
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "text/html; charset=utf-8";
  if (lower.endsWith(".js") || lower.endsWith(".mjs")) return "text/javascript; charset=utf-8";
  if (lower.endsWith(".css")) return "text/css; charset=utf-8";
  if (lower.endsWith(".json")) return "application/json; charset=utf-8";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".webm")) return "video/webm";
  if (lower.endsWith(".woff2")) return "font/woff2";
  return "application/octet-stream";
}

/**
 * Resolve which package member to serve. Empty assetPath → manifest entrypoint.
 */
export function resolvePackageMember(
  stored: StoredExperiencePackage,
  assetPath: string,
): ServeResolution {
  const manifest = stored.record.manifestSnapshot!;
  let rel = assetPath.replace(/^\/+/, "");
  if (!rel) {
    rel = manifest.entrypoint;
  }
  const norm = normalizePackagePath(rel);
  if (!norm) {
    return {
      ok: false,
      status: 400,
      code: "EXPERIENCE_PATH_INVALID",
      message: `Invalid path: ${assetPath}`,
    };
  }
  // Never serve outside package; never serve as path escape
  const file = stored.files.get(norm);
  if (!file?.bytes) {
    return {
      ok: false,
      status: 404,
      code: "EXPERIENCE_ASSET_MISSING",
      message: `Missing member: ${norm}`,
    };
  }
  const declared = manifest.assets.find((a) => a.path === norm)?.type;
  return {
    ok: true,
    path: norm,
    bytes: file.bytes,
    contentType: guessMime(norm, declared),
    packageSha256: stored.record.packageSha256,
    manifest,
  };
}

export function resolveServeRequest(input: ServeAdmissionInput): ServeResolution {
  const admitted = admitPackageServe(input);
  if (!admitted.ok) {
    return {
      ok: false,
      status: admitted.status,
      code: admitted.code,
      message: admitted.message,
    };
  }
  return resolvePackageMember(admitted.stored, input.assetPath);
}

/**
 * Conceptual Experience CSP for served responses (defence in depth).
 * Connect/network locked to 'none' by default — FULL_NETWORK not applied here.
 */
export function buildExperienceServeHeaders(opts: {
  contentType: string;
  packageSha256: string;
  /** When true, HTML documents get document-oriented headers. */
  isDocument: boolean;
  /**
   * CSP frame-ancestors value (e.g. "'self' https://app.example.com").
   * When set, X-Frame-Options is omitted so cross-origin app embedding can work.
   */
  frameAncestors?: string;
}): Record<string, string> {
  const frameAncestors = opts.frameAncestors?.trim() || "'self'";
  const csp = [
    "default-src 'none'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data:",
    "media-src 'self'",
    "font-src 'self'",
    "connect-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-src 'none'",
    "worker-src 'none'",
    `frame-ancestors ${frameAncestors}`,
  ].join("; ");

  const permissions = [
    "camera=()",
    "microphone=()",
    "geolocation=()",
    "payment=()",
    "usb=()",
    "interest-cohort=()",
    "fullscreen=()",
  ].join(", ");

  const headers: Record<string, string> = {
    "Content-Type": opts.contentType,
    "Content-Security-Policy": csp,
    "Permissions-Policy": permissions,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Cache-Control": "private, max-age=300",
    "X-Vitrine360-Experience-Package-Sha256": opts.packageSha256,
    "X-Vitrine360-Serve": "experience-package",
  };

  // X-Frame-Options only when ancestors are self-only (legacy); otherwise CSP alone.
  if (opts.isDocument && frameAncestors === "'self'") {
    headers["X-Frame-Options"] = "SAMEORIGIN";
  }

  return headers;
}

export function filesMapFromInventory(
  inventory: PackageInventory,
): Map<string, PackageEntry> {
  const map = new Map<string, PackageEntry>();
  for (const e of inventory.entries) {
    if (e.isDirectory) continue;
    const n = normalizePackagePath(e.path);
    if (n) map.set(n, { ...e, path: n });
  }
  return map;
}
