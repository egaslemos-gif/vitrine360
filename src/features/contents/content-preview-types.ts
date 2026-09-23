/** Shared Content Preview types — safe for client and server. No DB imports. */

export type ContentPreviewModel = {
  id: string;
  title: string;
  type: string;
  durationMs: number;
  payload: Record<string, unknown>;
  mediaUrl: string | null;
  status: string;
  validFrom: string | null;
  validTo: string | null;
  mimeType: string | null;
};

/** True when validFrom/validTo window excludes `now` (informational only). */
export function isContentOutsideValidityWindow(
  validFrom: string | null | undefined,
  validTo: string | null | undefined,
  now: Date = new Date(),
): boolean {
  const t = now.getTime();
  if (validFrom) {
    const from = Date.parse(validFrom);
    if (!Number.isNaN(from) && t < from) return true;
  }
  if (validTo) {
    const to = Date.parse(validTo);
    if (!Number.isNaN(to) && t > to) return true;
  }
  return false;
}
