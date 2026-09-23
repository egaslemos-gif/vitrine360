/**
 * RUNTIME-EXPERIENCE-03 — Experience Package Registry (conceptual model).
 *
 * Pure domain types + publication state transitions.
 * No database tables, migrations, upload API, or execution.
 *
 * VALID ≠ PUBLISHED ≠ ASSIGNABLE ≠ EXECUTABLE
 */

import type {
  ExperienceManifestV1,
  PackageValidationState,
  RegistryPublicationState,
} from "@/domain/experience-manifest";
import { REGISTRY_PUBLICATION_STATES } from "@/domain/experience-manifest";

/** Logical Experience identity scoped to a tenant (future persistence). */
export type ExperienceRegistryIdentity = {
  tenantId: string;
  experienceId: string;
};

/** One immutable package version under a logical Experience. */
export type ExperiencePackageVersionRecord = {
  tenantId: string;
  experienceId: string;
  version: string; // semver
  schemaVersion: string;
  packageSha256: string;
  validationState: PackageValidationState;
  publicationState: RegistryPublicationState;
  manifestSnapshot: ExperienceManifestV1 | null;
  createdAt: string; // ISO
  publishedAt: string | null;
  deprecatedAt: string | null;
  blockedAt: string | null;
  blockedReason: string | null;
};

/** Audit event (conceptual). */
export type ExperienceRegistryAuditEvent = {
  tenantId: string;
  experienceId: string;
  version: string | null;
  action:
    | "RECEIVED"
    | "VALIDATED"
    | "VALIDATION_FAILED"
    | "PUBLISHED"
    | "DEPRECATED"
    | "BLOCKED"
    | "ARCHIVED"
    | "UNBLOCKED";
  actorUserId: string | null;
  at: string;
  detail?: string;
};

const PUBLICATION_TRANSITIONS: Record<
  RegistryPublicationState,
  readonly RegistryPublicationState[]
> = {
  DRAFT: ["VALIDATED", "BLOCKED", "ARCHIVED"],
  VALIDATED: ["PUBLISHED", "DEPRECATED", "BLOCKED", "ARCHIVED", "DRAFT"],
  PUBLISHED: ["DEPRECATED", "BLOCKED", "ARCHIVED"],
  DEPRECATED: ["BLOCKED", "ARCHIVED", "PUBLISHED"],
  BLOCKED: ["ARCHIVED", "VALIDATED"],
  ARCHIVED: [],
};

export function canTransitionPublication(
  from: RegistryPublicationState,
  to: RegistryPublicationState,
): boolean {
  return PUBLICATION_TRANSITIONS[from].includes(to);
}

export function assertPublicationTransition(
  from: RegistryPublicationState,
  to: RegistryPublicationState,
): void {
  if (!canTransitionPublication(from, to)) {
    throw new Error(`Invalid publication transition ${from} → ${to}`);
  }
}

/**
 * Publish requires validationState === VALID.
 * Still does NOT imply executable / assigned to devices.
 */
export function canPublish(record: {
  validationState: PackageValidationState;
  publicationState: RegistryPublicationState;
}): boolean {
  return (
    record.validationState === "VALID" &&
    canTransitionPublication(record.publicationState, "PUBLISHED")
  );
}

/**
 * Tenant isolation guard: identities must match before any registry mutation.
 */
export function assertSameTenant(
  left: ExperienceRegistryIdentity,
  right: ExperienceRegistryIdentity,
): void {
  if (left.tenantId !== right.tenantId) {
    throw new Error("EXPERIENCE_BLOCKED: cross-tenant registry access denied");
  }
  if (left.experienceId !== right.experienceId) {
    throw new Error("Experience identity mismatch");
  }
}

export function isAssignablePublication(
  state: RegistryPublicationState,
): boolean {
  return state === "PUBLISHED";
}

export function isExecutableCandidate(record: {
  validationState: PackageValidationState;
  publicationState: RegistryPublicationState;
}): boolean {
  // Architecture only: future runtime still required.
  return (
    record.validationState === "VALID" &&
    isAssignablePublication(record.publicationState)
  );
}

export function listPublicationStates(): readonly RegistryPublicationState[] {
  return REGISTRY_PUBLICATION_STATES;
}
