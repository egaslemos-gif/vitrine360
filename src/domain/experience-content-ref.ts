/**
 * RUNTIME-EXPERIENCE-09 — Experience Content reference (domain).
 *
 * Content EXPERIENCE → pinned { experienceId, version }.
 * Not a MediaAsset. No latest/current/stable resolution.
 * Registry existence checks are injected (store / tests).
 */

import type { ExperiencePackageVersionRecord } from "@/domain/experience-registry";
import { isAssignablePublication } from "@/domain/experience-registry";

export const EXPERIENCE_CONTENT_ERROR_CODES = [
  "EXPERIENCE_NOT_FOUND",
  "EXPERIENCE_VERSION_NOT_FOUND",
  "EXPERIENCE_TENANT_MISMATCH",
  "EXPERIENCE_VERSION_MISMATCH",
  "EXPERIENCE_REFERENCE_INVALID",
  "EXPERIENCE_NOT_EXECUTABLE",
  "EXPERIENCE_MEDIA_FORBIDDEN",
  "EXPERIENCE_DYNAMIC_VERSION_FORBIDDEN",
] as const;
export type ExperienceContentErrorCode =
  (typeof EXPERIENCE_CONTENT_ERROR_CODES)[number];

export type ExperienceContentRef = {
  experienceId: string;
  version: string;
};

const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const ID_SAFE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

const FORBIDDEN_DYNAMIC_KEYS = [
  "latest",
  "current",
  "stable",
  "channel",
  "useLatest",
  "autoUpdate",
] as const;

const FORBIDDEN_PAYLOAD_KEYS = [
  "url",
  "src",
  "href",
  "html",
  "script",
  "zip",
  "bytes",
  "packageUrl",
  "iframeSrc",
  "srcDoc",
] as const;

export type ExperienceVersionLookup = {
  getVersion: (
    tenantId: string,
    experienceId: string,
    version: string,
  ) => ExperiencePackageVersionRecord | null;
};

export function isPinnedSemver(version: string): boolean {
  return SEMVER.test(version);
}

/**
 * Extract + structurally validate experience ref from Content.payload.
 * Accepts either payload.experience.{id,version} or top-level experienceId/version.
 */
export function parseExperienceContentRef(
  payload: Record<string, unknown> | null | undefined,
):
  | { ok: true; ref: ExperienceContentRef }
  | { ok: false; code: ExperienceContentErrorCode; message: string } {
  if (!payload || typeof payload !== "object") {
    return {
      ok: false,
      code: "EXPERIENCE_REFERENCE_INVALID",
      message: "Experience payload required",
    };
  }

  for (const key of FORBIDDEN_DYNAMIC_KEYS) {
    if (key in payload) {
      return {
        ok: false,
        code: "EXPERIENCE_DYNAMIC_VERSION_FORBIDDEN",
        message: `Forbidden dynamic version field: ${key}`,
      };
    }
  }

  for (const key of FORBIDDEN_PAYLOAD_KEYS) {
    if (key in payload) {
      return {
        ok: false,
        code: "EXPERIENCE_REFERENCE_INVALID",
        message: `Forbidden Experience payload field: ${key}`,
      };
    }
  }

  const nested =
    payload.experience && typeof payload.experience === "object"
      ? (payload.experience as Record<string, unknown>)
      : null;

  if (nested) {
    for (const key of FORBIDDEN_DYNAMIC_KEYS) {
      if (key in nested) {
        return {
          ok: false,
          code: "EXPERIENCE_DYNAMIC_VERSION_FORBIDDEN",
          message: `Forbidden dynamic version field: experience.${key}`,
        };
      }
    }
  }

  const experienceId = String(
    nested?.experienceId ?? payload.experienceId ?? "",
  ).trim();
  const version = String(nested?.version ?? payload.version ?? "").trim();

  if (!experienceId || !version) {
    return {
      ok: false,
      code: "EXPERIENCE_REFERENCE_INVALID",
      message: "experienceId and version are required",
    };
  }

  const lowered = version.toLowerCase();
  if (
    lowered === "latest" ||
    lowered === "current" ||
    lowered === "stable" ||
    lowered === "*"
  ) {
    return {
      ok: false,
      code: "EXPERIENCE_DYNAMIC_VERSION_FORBIDDEN",
      message: "Version must be an exact semver pin",
    };
  }

  if (!ID_SAFE.test(experienceId)) {
    return {
      ok: false,
      code: "EXPERIENCE_REFERENCE_INVALID",
      message: "Invalid experienceId format",
    };
  }
  if (!isPinnedSemver(version)) {
    return {
      ok: false,
      code: "EXPERIENCE_REFERENCE_INVALID",
      message: "version must be exact semver (e.g. 1.2.0)",
    };
  }

  return { ok: true, ref: { experienceId, version } };
}

/** Canonical payload stored on Content / Manifest — only the pinned ref. */
export function buildExperienceContentPayload(
  ref: ExperienceContentRef,
): { experience: ExperienceContentRef } {
  return {
    experience: {
      experienceId: ref.experienceId,
      version: ref.version,
    },
  };
}

export function validateExperienceContentAgainstRegistry(
  tenantId: string,
  ref: ExperienceContentRef,
  lookup: ExperienceVersionLookup,
):
  | { ok: true; record: ExperiencePackageVersionRecord }
  | { ok: false; code: ExperienceContentErrorCode; message: string } {
  const record = lookup.getVersion(tenantId, ref.experienceId, ref.version);
  if (!record) {
    // Ambiguous miss — do not reveal other tenants
    return {
      ok: false,
      code: "EXPERIENCE_VERSION_NOT_FOUND",
      message: "Experience version not found",
    };
  }
  if (record.tenantId !== tenantId) {
    return {
      ok: false,
      code: "EXPERIENCE_TENANT_MISMATCH",
      message: "Experience tenant mismatch",
    };
  }
  if (record.experienceId !== ref.experienceId) {
    return {
      ok: false,
      code: "EXPERIENCE_VERSION_MISMATCH",
      message: "Version does not belong to experienceId",
    };
  }
  if (record.version !== ref.version) {
    return {
      ok: false,
      code: "EXPERIENCE_VERSION_MISMATCH",
      message: "Version mismatch",
    };
  }
  return { ok: true, record };
}

/**
 * Content may reference a non-PUBLISHED version (exists in registry/store).
 * Execution requires PUBLISHED (+ later admission). This helper is the
 * Manifest/Player gate before Runtime Core.
 */
export function isExperienceVersionPublished(
  record: ExperiencePackageVersionRecord,
): boolean {
  return (
    record.validationState === "VALID" &&
    isAssignablePublication(record.publicationState)
  );
}

export type ExperienceManifestItemView = {
  type: "EXPERIENCE";
  experience: ExperienceContentRef;
  /** Never a browsable arbitrary URL for execution. */
  assets: [];
};

/**
 * Sanitize Manifest payload for EXPERIENCE items — pin only, no URL substitute.
 */
export function sanitizeExperienceManifestPayload(
  payload: Record<string, unknown>,
):
  | { ok: true; payload: { experience: ExperienceContentRef } }
  | { ok: false; code: ExperienceContentErrorCode; message: string } {
  const parsed = parseExperienceContentRef(payload);
  if (!parsed.ok) return parsed;
  return { ok: true, payload: buildExperienceContentPayload(parsed.ref) };
}

/**
 * Lookup adapter over the in-process package store (EX-05).
 * Does not create a second registry.
 */
export function packageStoreExperienceLookup(getStored: {
  (
    tenantId: string,
    experienceId: string,
    version: string,
  ): { record: ExperiencePackageVersionRecord } | null;
}): ExperienceVersionLookup {
  return {
    getVersion(tenantId, experienceId, version) {
      const stored = getStored(tenantId, experienceId, version);
      return stored?.record ?? null;
    },
  };
}
