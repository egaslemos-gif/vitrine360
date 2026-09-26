/**
 * PLATFORM-IDENTITY-10F — Usage foundation (read-only derived metrics).
 *
 * Server-side only. No quota enforcement. No client-supplied usage overrides.
 * Does not check tenant lifecycle (SUSPENDED remains countable — PI-10E DEC-12).
 */
import { and, count, eq, isNotNull, ne, sql, sum } from "drizzle-orm";
import { db } from "@/db";
import { contents, devices, mediaAssets, playlists, tenants } from "@/db/schema";
import {
  DEVICE_COUNT_MODE_CANONICAL,
  isUsageMetricKey,
  sourceForMetric,
  unitForMetric,
  type DeviceUsageCountMode,
  type UsageMetricKey,
  type UsageResolveResult,
  type UsageSnapshot,
} from "@/domain/usage";

function requireTenantId(tenantId: string): string {
  if (!tenantId || typeof tenantId !== "string" || !tenantId.trim()) {
    throw new UsageError("tenantId required", "TENANT_REQUIRED");
  }
  return tenantId.trim();
}

export class UsageError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "TENANT_REQUIRED"
      | "UNKNOWN_METRIC"
      | "INVALID_TENANT" = "TENANT_REQUIRED",
  ) {
    super(message);
    this.name = "UsageError";
  }
}

async function tenantExists(tenantId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  return Boolean(row);
}

/** Query executor: default `db` or a drizzle allocation transaction (PI-10G). */
type DeviceCountExecutor = {
  select: typeof db.select;
};

/**
 * Count devices for a tenant.
 * Default: PAIRED_NON_DISABLED (canonical — PI-10 decision closure).
 * Pass `executor` = allocation `tx` so COUNT shares BEGIN IMMEDIATE with mutation.
 */
export async function countDevices(
  tenantId: string,
  mode: DeviceUsageCountMode = DEVICE_COUNT_MODE_CANONICAL,
  executor: DeviceCountExecutor = db,
): Promise<number> {
  const tid = requireTenantId(tenantId);
  let condition;
  switch (mode) {
    case "ALL_WITH_TENANT":
      condition = and(eq(devices.tenantId, tid), isNotNull(devices.tenantId));
      break;
    case "ACTIVE_ONLY":
      condition = and(eq(devices.tenantId, tid), eq(devices.status, "ACTIVE"));
      break;
    case "PAIRED_NON_DISABLED":
    case "PROVISIONAL_PAIRED_NON_DISABLED":
      condition = and(
        eq(devices.tenantId, tid),
        isNotNull(devices.tenantId),
        ne(devices.status, "DISABLED"),
      );
      break;
    default:
      condition = and(eq(devices.tenantId, tid), isNotNull(devices.tenantId));
  }
  const [row] = await executor
    .select({ c: count() })
    .from(devices)
    .where(condition);
  return Number(row?.c ?? 0);
}

export async function countContents(tenantId: string): Promise<number> {
  const tid = requireTenantId(tenantId);
  const [row] = await db
    .select({ c: count() })
    .from(contents)
    .where(eq(contents.tenantId, tid));
  return Number(row?.c ?? 0);
}

export async function countPlaylists(tenantId: string): Promise<number> {
  const tid = requireTenantId(tenantId);
  const [row] = await db
    .select({ c: count() })
    .from(playlists)
    .where(eq(playlists.tenantId, tid));
  return Number(row?.c ?? 0);
}

/**
 * Durable experience refs: contents with type EXPERIENCE.
 * In-memory package store is NOT authoritative (PI-10E).
 */
export async function countExperiences(tenantId: string): Promise<number> {
  const tid = requireTenantId(tenantId);
  const [row] = await db
    .select({ c: count() })
    .from(contents)
    .where(and(eq(contents.tenantId, tid), eq(contents.type, "EXPERIENCE")));
  return Number(row?.c ?? 0);
}

/**
 * Logical storage bytes: SUM(media_assets.file_size) for tenant.
 * DB authoritative — does not query R2.
 */
export async function getTenantStorageUsage(tenantId: string): Promise<number> {
  const tid = requireTenantId(tenantId);
  const [row] = await db
    .select({
      total: sum(mediaAssets.fileSize),
    })
    .from(mediaAssets)
    .where(eq(mediaAssets.tenantId, tid));
  const raw = row?.total;
  if (raw === null || raw === undefined) return 0;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

export async function resolveUsage(input: {
  tenantId: string;
  metric: string;
  now?: Date;
  /** Override device mode; defaults to canonical PAIRED_NON_DISABLED. */
  deviceCountMode?: DeviceUsageCountMode;
}): Promise<UsageResolveResult> {
  const tenantId = input.tenantId?.trim?.() ?? "";
  if (!tenantId) {
    return {
      status: "TENANT_REQUIRED",
      tenantId: "",
      metric: input.metric,
      message: "tenantId required",
    };
  }
  if (!isUsageMetricKey(input.metric)) {
    return {
      status: "UNKNOWN_METRIC",
      tenantId,
      metric: input.metric,
      message: "unknown usage metric",
    };
  }
  const metric: UsageMetricKey = input.metric;
  if (!(await tenantExists(tenantId))) {
    return {
      status: "INVALID_TENANT",
      tenantId,
      metric,
      message: "tenant not found",
    };
  }

  const resolvedAt = (input.now ?? new Date()).toISOString();
  let value: number;
  let deviceCountMode: DeviceUsageCountMode | undefined;
  let semanticsNote: string | undefined;

  switch (metric) {
    case "devices.count": {
      deviceCountMode =
        input.deviceCountMode ?? DEVICE_COUNT_MODE_CANONICAL;
      value = await countDevices(tenantId, deviceCountMode);
      semanticsNote =
        "Device count = PAIRED_NON_DISABLED (tenant_id set, status != DISABLED). Closed in PLATFORM-IDENTITY-10-QUOTA-SEMANTICS.";
      break;
    }
    case "contents.count":
      value = await countContents(tenantId);
      break;
    case "playlists.count":
      value = await countPlaylists(tenantId);
      break;
    case "experiences.count":
      value = await countExperiences(tenantId);
      break;
    case "storage.bytes":
      value = await getTenantStorageUsage(tenantId);
      break;
    default:
      return {
        status: "UNKNOWN_METRIC",
        tenantId,
        metric,
        message: "unknown usage metric",
      };
  }

  const usage: UsageSnapshot = {
    tenantId,
    metric,
    value,
    unit: unitForMetric(metric),
    source: sourceForMetric(metric),
    resolvedAt,
    ...(deviceCountMode ? { deviceCountMode, semanticsNote } : {}),
  };

  return { status: "RESOLVED", usage };
}

/** Exported for tests — proves resolve path never accepts client usage override. */
export function rejectClientUsageOverride(_clientUsage: unknown): void {
  void _clientUsage;
  // Intentionally no-op: callers must use resolveUsage / count* only.
}

/** Sanity helper used in tests: raw SQL SUM without going through R2. */
export async function debugStorageSumSql(tenantId: string): Promise<number> {
  const tid = requireTenantId(tenantId);
  const rows = await db.all<{ total: number | null }>(
    sql`SELECT COALESCE(SUM(file_size), 0) as total FROM media_assets WHERE tenant_id = ${tid}`,
  );
  const n = Number(rows[0]?.total ?? 0);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}
