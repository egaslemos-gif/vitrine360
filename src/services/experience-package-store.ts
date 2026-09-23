/**
 * RUNTIME-EXPERIENCE-05 — In-process Experience package store.
 *
 * No Drizzle tables / migrations. Intended for serving validated packages
 * after registry-style admission. Not an Experience Runtime.
 */

import type { ExperiencePackageVersionRecord } from "@/domain/experience-registry";
import {
  filesMapFromInventory,
  type StoredExperiencePackage,
} from "@/domain/experience-serving";
import {
  validateExperiencePackage,
  type PackageInventory,
} from "@/domain/experience-validator";

function keyOf(tenantId: string, experienceId: string, version: string): string {
  return `${tenantId}::${experienceId}::${version}`;
}

const store = new Map<string, StoredExperiencePackage>();

export function clearExperiencePackageStore(): void {
  store.clear();
}

export function getStoredExperiencePackage(
  tenantId: string,
  experienceId: string,
  version: string,
): StoredExperiencePackage | null {
  return store.get(keyOf(tenantId, experienceId, version)) ?? null;
}

export function listStoredExperiencePackages(): StoredExperiencePackage[] {
  return [...store.values()];
}

export type PutPackageInput = {
  record: ExperiencePackageVersionRecord;
  inventory: PackageInventory;
  /** When true (default), re-validate inventory before store. */
  revalidate?: boolean;
};

/**
 * Store a package for serving. Fail-closed: rejects unless validationState VALID
 * (and optional revalidation passes).
 */
export function putExperiencePackage(
  input: PutPackageInput,
): { ok: true } | { ok: false; reason: string } {
  const { record, inventory } = input;
  if (record.validationState !== "VALID") {
    return { ok: false, reason: `validationState=${record.validationState}` };
  }
  if (input.revalidate !== false) {
    const result = validateExperiencePackage(inventory);
    if (result.state !== "VALID") {
      return {
        ok: false,
        reason: `revalidate failed: ${result.issues.map((i) => i.code).join(",")}`,
      };
    }
  }
  if (!record.manifestSnapshot) {
    return { ok: false, reason: "manifestSnapshot required" };
  }
  const files = filesMapFromInventory(inventory);
  store.set(keyOf(record.tenantId, record.experienceId, record.version), {
    record: { ...record },
    inventory,
    files,
  });
  return { ok: true };
}

export function deleteExperiencePackage(
  tenantId: string,
  experienceId: string,
  version: string,
): boolean {
  return store.delete(keyOf(tenantId, experienceId, version));
}
