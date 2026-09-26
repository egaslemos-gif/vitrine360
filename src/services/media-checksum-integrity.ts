/**
 * PLATFORM-IDENTITY-10L — media_assets (tenant_id, checksum) unique integrity.
 *
 * Does NOT delete historical duplicates. Surfaces observability for ensureSchema.
 */
import { client } from "@/db/client";

export type ChecksumUniqueIntegrity = {
  indexPresent: boolean;
  indexUnique: boolean;
  duplicateGroupCount: number;
  duplicateRowCount: number;
  status: "OK" | "DUPLICATES_PRESENT" | "INDEX_MISSING" | "ERROR";
  detail?: string;
};

/** Diagnose duplicate (tenant_id, checksum) groups without mutating data. */
export async function diagnoseMediaChecksumDuplicates(): Promise<{
  groupCount: number;
  rowCount: number;
  samples: Array<{ tenantId: string; checksum: string; n: number }>;
}> {
  const rows = await client.execute(
    `SELECT tenant_id AS tenantId, checksum, COUNT(*) AS n
     FROM media_assets
     GROUP BY tenant_id, checksum
     HAVING COUNT(*) > 1
     LIMIT 50`,
  );
  const samples = (rows.rows as Array<Record<string, unknown>>).map((r) => ({
    tenantId: String(r.tenantId ?? r.tenant_id ?? ""),
    checksum: String(r.checksum ?? ""),
    n: Number(r.n ?? 0),
  }));
  const groupCount = samples.length;
  const rowCount = samples.reduce((a, s) => a + s.n, 0);
  // If we hit the LIMIT, re-count groups accurately
  const countRes = await client.execute(
    `SELECT COUNT(*) AS c FROM (
       SELECT 1 FROM media_assets GROUP BY tenant_id, checksum HAVING COUNT(*) > 1
     )`,
  );
  const exactGroups = Number(
    (countRes.rows[0] as { c?: unknown } | undefined)?.c ?? groupCount,
  );
  return { groupCount: exactGroups, rowCount, samples };
}

export async function isMediaChecksumUniqueIndexPresent(): Promise<{
  present: boolean;
  unique: boolean;
}> {
  const idx = await client.execute(
    "PRAGMA index_list('media_assets')",
  );
  const row = (idx.rows as Array<Record<string, unknown>>).find(
    (r) => String(r.name) === "media_assets_tenant_checksum_uidx",
  );
  if (!row) return { present: false, unique: false };
  const unique = Number(row.unique) === 1;
  const cols = await client.execute(
    "PRAGMA index_info('media_assets_tenant_checksum_uidx')",
  );
  const names = (cols.rows as Array<Record<string, unknown>>)
    .sort((a, b) => Number(a.seqno) - Number(b.seqno))
    .map((c) => String(c.name));
  const okCols =
    names.length === 2 &&
    names[0] === "tenant_id" &&
    names[1] === "checksum";
  return { present: okCols, unique: unique && okCols };
}

/**
 * Ensure unique index when safe. Never deletes duplicates.
 * Returns integrity status for observability (PI10L-SEC-010).
 */
export async function ensureMediaChecksumUniqueIntegrity(): Promise<ChecksumUniqueIntegrity> {
  try {
    const dup = await diagnoseMediaChecksumDuplicates();
    if (dup.groupCount > 0) {
      console.error(
        `[ensureSchema] media_assets_tenant_checksum_uidx NOT applied: ${dup.groupCount} duplicate group(s) (rows≈${dup.rowCount}). Unique integrity NOT guaranteed. Do not auto-delete.`,
      );
      return {
        indexPresent: false,
        indexUnique: false,
        duplicateGroupCount: dup.groupCount,
        duplicateRowCount: dup.rowCount,
        status: "DUPLICATES_PRESENT",
        detail: `duplicate groups=${dup.groupCount}`,
      };
    }

    await client.execute(
      "CREATE UNIQUE INDEX IF NOT EXISTS media_assets_tenant_checksum_uidx ON media_assets (tenant_id, checksum)",
    );

    const idx = await isMediaChecksumUniqueIndexPresent();
    if (!idx.present || !idx.unique) {
      console.error(
        "[ensureSchema] media_assets_tenant_checksum_uidx missing after CREATE — schema integrity NOT guaranteed",
      );
      return {
        indexPresent: idx.present,
        indexUnique: idx.unique,
        duplicateGroupCount: 0,
        duplicateRowCount: 0,
        status: "INDEX_MISSING",
        detail: "index not observable after create",
      };
    }

    return {
      indexPresent: true,
      indexUnique: true,
      duplicateGroupCount: 0,
      duplicateRowCount: 0,
      status: "OK",
    };
  } catch (err) {
    const msg = String(err);
    console.error(
      "[ensureSchema] media_assets_tenant_checksum_uidx failed:",
      msg,
    );
    return {
      indexPresent: false,
      indexUnique: false,
      duplicateGroupCount: -1,
      duplicateRowCount: -1,
      status: "ERROR",
      detail: msg,
    };
  }
}
