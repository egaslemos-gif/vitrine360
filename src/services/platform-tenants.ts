/**
 * PLATFORM-IDENTITY-06B — Platform Control Plane tenant directory (metadata only).
 * Call only from routes gated by requirePlatformPermission("platform.tenants.read").
 */
import { and, asc, eq, gt, or } from "drizzle-orm";
import { db, ensureSchema } from "@/db";
import { tenants } from "@/db/schema";

export const PLATFORM_TENANTS_DEFAULT_LIMIT = 20;
export const PLATFORM_TENANTS_MAX_LIMIT = 100;

export type PlatformTenantMetadata = {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
};

export type PlatformTenantsPage = {
  tenants: PlatformTenantMetadata[];
  page: {
    limit: number;
    nextCursor: string | null;
    hasMore: boolean;
  };
};

type CursorPayload = { createdAt: string; id: string };

export function encodePlatformTenantsCursor(row: CursorPayload): string {
  return Buffer.from(JSON.stringify(row), "utf8").toString("base64url");
}

export function decodePlatformTenantsCursor(
  raw: string,
): CursorPayload | null {
  try {
    const json = Buffer.from(raw, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as Partial<CursorPayload>;
    if (
      typeof parsed.createdAt !== "string" ||
      !parsed.createdAt ||
      typeof parsed.id !== "string" ||
      !parsed.id
    ) {
      return null;
    }
    return { createdAt: parsed.createdAt, id: parsed.id };
  } catch {
    return null;
  }
}

export function parsePlatformTenantsLimit(
  raw: string | null,
): { ok: true; limit: number } | { ok: false; error: string } {
  if (raw === null || raw === undefined || raw === "") {
    return { ok: true, limit: PLATFORM_TENANTS_DEFAULT_LIMIT };
  }
  if (!/^\d+$/.test(raw)) {
    return { ok: false, error: "limit must be a positive integer" };
  }
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) {
    return { ok: false, error: "limit must be a positive integer" };
  }
  if (n > PLATFORM_TENANTS_MAX_LIMIT) {
    return {
      ok: false,
      error: `limit must be <= ${PLATFORM_TENANTS_MAX_LIMIT}`,
    };
  }
  return { ok: true, limit: n };
}

export function parsePlatformTenantsCursorParam(
  raw: string | null,
): { ok: true; cursor: CursorPayload | null } | { ok: false; error: string } {
  if (raw === null || raw === undefined || raw === "") {
    return { ok: true, cursor: null };
  }
  const decoded = decodePlatformTenantsCursor(raw);
  if (!decoded) return { ok: false, error: "invalid cursor" };
  return { ok: true, cursor: decoded };
}

/** Reject unknown query keys to reduce abuse / smuggling. */
export function parsePlatformTenantsListQuery(url: URL):
  | { ok: true; limit: number; cursor: CursorPayload | null }
  | { ok: false; error: string; status: number } {
  const allowed = new Set(["limit", "cursor"]);
  for (const key of url.searchParams.keys()) {
    if (!allowed.has(key)) {
      return { ok: false, error: `unknown query parameter: ${key}`, status: 400 };
    }
  }
  const limitParsed = parsePlatformTenantsLimit(url.searchParams.get("limit"));
  if (!limitParsed.ok) {
    return { ok: false, error: limitParsed.error, status: 400 };
  }
  const cursorParsed = parsePlatformTenantsCursorParam(
    url.searchParams.get("cursor"),
  );
  if (!cursorParsed.ok) {
    return { ok: false, error: cursorParsed.error, status: 400 };
  }
  return {
    ok: true,
    limit: limitParsed.limit,
    cursor: cursorParsed.cursor,
  };
}

function toMeta(row: {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
}): PlatformTenantMetadata {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    createdAt: row.createdAt,
  };
}

export async function listPlatformTenantsMetadata(params: {
  limit: number;
  cursor?: CursorPayload | null;
}): Promise<PlatformTenantsPage> {
  await ensureSchema();
  const limit = Math.min(
    Math.max(1, params.limit),
    PLATFORM_TENANTS_MAX_LIMIT,
  );
  const take = limit + 1;

  const base = db
    .select({
      id: tenants.id,
      name: tenants.name,
      slug: tenants.slug,
      status: tenants.status,
      createdAt: tenants.createdAt,
    })
    .from(tenants);

  const rows = params.cursor
    ? await base
        .where(
          or(
            gt(tenants.createdAt, params.cursor.createdAt),
            and(
              eq(tenants.createdAt, params.cursor.createdAt),
              gt(tenants.id, params.cursor.id),
            ),
          ),
        )
        .orderBy(asc(tenants.createdAt), asc(tenants.id))
        .limit(take)
    : await base.orderBy(asc(tenants.createdAt), asc(tenants.id)).limit(take);

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const last = pageRows[pageRows.length - 1];
  return {
    tenants: pageRows.map(toMeta),
    page: {
      limit,
      hasMore,
      nextCursor: hasMore && last
        ? encodePlatformTenantsCursor({
            createdAt: last.createdAt,
            id: last.id,
          })
        : null,
    },
  };
}

export async function getPlatformTenantMetadata(
  tenantId: string,
): Promise<PlatformTenantMetadata | null> {
  await ensureSchema();
  if (!tenantId || tenantId.length > 128) return null;
  // Reject path traversal / odd ids early
  if (!/^[a-zA-Z0-9_-]+$/.test(tenantId)) return null;

  const [row] = await db
    .select({
      id: tenants.id,
      name: tenants.name,
      slug: tenants.slug,
      status: tenants.status,
      createdAt: tenants.createdAt,
    })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  return row ? toMeta(row) : null;
}

/** Explicit allowlist serializer — never leak extra columns. */
export function serializePlatformTenantMetadata(
  row: PlatformTenantMetadata,
): PlatformTenantMetadata {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    createdAt: row.createdAt,
  };
}
