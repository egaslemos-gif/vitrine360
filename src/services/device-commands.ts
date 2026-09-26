/**
 * RUNTIME-PLAYBACK-09 — Durable command inbox service.
 * Enqueue / claim / ACK / expire / cleanup. No SSE/WS/Redis.
 */

import { and, asc, eq, lt, lte, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { deviceCommandInbox, devices } from "@/db/schema";
import {
  createCommandId,
  isDeviceCommandType,
  serializeDeviceCommand,
  validateCommandPayload,
  type CommandBinding,
  type DeviceCommand,
  type DeviceCommandPayload,
  type DeviceCommandType,
} from "@/domain/device-command";
import {
  COMMAND_TRANSPORT,
  isAckResultStatus,
  type AckResultStatus,
  type InboxStatus,
} from "@/domain/command-transport";
import { logActivity } from "@/services/activity-log";
import { isTenantOperable } from "@/services/tenant-lifecycle";

/** Serialize claim transactions per device (in-process; SQLite IMMEDIATE). */
const claimChains = new Map<string, Promise<unknown>>();

async function withDeviceClaimLock<T>(
  deviceId: string,
  fn: () => Promise<T>,
): Promise<T> {
  const prev = claimChains.get(deviceId) ?? Promise.resolve();
  let release!: () => void;
  const hold = new Promise<void>((r) => {
    release = r;
  });
  const tail = prev.then(() => hold);
  claimChains.set(deviceId, tail);
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (claimChains.get(deviceId) === tail) {
      claimChains.delete(deviceId);
    }
  }
}

export class DeviceCommandServiceError extends Error {
  constructor(
    public code:
      | "UNAUTHORIZED"
      | "FORBIDDEN"
      | "DEVICE_NOT_FOUND"
      | "DEVICE_NOT_OPERABLE"
      | "INVALID_COMMAND"
      | "INVALID_PAYLOAD"
      | "COMMAND_EXPIRED"
      | "COMMAND_NOT_FOUND"
      | "WRONG_DEVICE"
      | "COMMAND_TOO_LARGE"
      | "INVALID_ACK",
    message?: string,
  ) {
    super(message ?? code);
    this.name = "DeviceCommandServiceError";
  }
}

export type EnqueueCommandInput = {
  tenantId: string;
  deviceId: string;
  userId?: string | null;
  type: DeviceCommandType;
  payload?: DeviceCommandPayload;
  sessionId?: string | null;
  binding?: CommandBinding;
  ttlMs?: number;
  correlationId?: string;
  now?: number;
};

export type PollCommandWire = {
  commandId: string;
  tenantId: string;
  deviceId: string;
  sessionId: string | null;
  binding: CommandBinding;
  type: DeviceCommandType;
  payload: DeviceCommandPayload;
  issuedAt: number;
  expiresAt: number;
  correlationId?: string;
};

function nowIso(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

function resolveTtl(ttlMs: number | undefined, now: number): {
  ttlMs: number;
  expiresAt: number;
} {
  const ttl = ttlMs ?? COMMAND_TRANSPORT.DEFAULT_TTL_MS;
  if (
    !Number.isFinite(ttl) ||
    ttl < COMMAND_TRANSPORT.MIN_TTL_MS ||
    ttl > COMMAND_TRANSPORT.MAX_TTL_MS
  ) {
    throw new DeviceCommandServiceError("INVALID_PAYLOAD", "Invalid TTL");
  }
  return { ttlMs: ttl, expiresAt: now + ttl };
}

async function safeActivity(
  params: Parameters<typeof logActivity>[0],
): Promise<void> {
  try {
    await logActivity(params);
  } catch {
    /* observational — never break command path */
  }
}

export async function enqueueDeviceCommand(input: EnqueueCommandInput) {
  const now = input.now ?? Date.now();
  if (!isDeviceCommandType(input.type)) {
    throw new DeviceCommandServiceError("INVALID_COMMAND");
  }
  const payload = input.payload ?? {};
  const payloadCheck = validateCommandPayload(input.type, payload);
  if (!payloadCheck.ok) {
    throw new DeviceCommandServiceError("INVALID_PAYLOAD");
  }

  const binding: CommandBinding =
    input.binding ??
    (input.sessionId ? "SESSION_BOUND" : "DEVICE_BOUND");
  if (binding === "SESSION_BOUND" && !input.sessionId) {
    throw new DeviceCommandServiceError(
      "INVALID_PAYLOAD",
      "SESSION_BOUND requires sessionId",
    );
  }

  const [device] = await db
    .select()
    .from(devices)
    .where(eq(devices.id, input.deviceId))
    .limit(1);
  if (!device || device.tenantId !== input.tenantId) {
    throw new DeviceCommandServiceError("DEVICE_NOT_FOUND");
  }
  if (device.status === "DISABLED" || device.status === "PENDING") {
    throw new DeviceCommandServiceError("DEVICE_NOT_OPERABLE");
  }
  if (!(await isTenantOperable(input.tenantId))) {
    throw new DeviceCommandServiceError("DEVICE_NOT_OPERABLE");
  }

  const { expiresAt } = resolveTtl(input.ttlMs, now);
  const commandId = createCommandId(now);
  const rowId = crypto.randomUUID();
  const wire: DeviceCommand = {
    commandId,
    tenantId: input.tenantId,
    deviceId: input.deviceId,
    sessionId: input.sessionId ?? undefined,
    type: input.type,
    payload: payloadCheck.payload,
    issuedAt: now,
    expiresAt,
    correlationId: input.correlationId,
    binding,
  };
  const serialized = serializeDeviceCommand(wire);
  if (serialized.length > COMMAND_TRANSPORT.MAX_PAYLOAD_BYTES) {
    throw new DeviceCommandServiceError("COMMAND_TOO_LARGE");
  }

  await db.insert(deviceCommandInbox).values({
    id: rowId,
    commandId,
    tenantId: input.tenantId,
    deviceId: input.deviceId,
    sessionId: input.sessionId ?? null,
    binding,
    type: input.type,
    payload: JSON.stringify(payloadCheck.payload),
    issuedAt: now,
    expiresAt,
    status: "QUEUED",
    attempts: 0,
    availableAt: now,
    correlationId: input.correlationId ?? null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });

  await safeActivity({
    userId: input.userId ?? null,
    tenantId: input.tenantId,
    action: "COMMAND_ENQUEUED",
    resource: "device_command",
    resourceId: commandId,
    metadata: { deviceId: input.deviceId, type: input.type },
  });

  return {
    commandId,
    status: "QUEUED" as const,
    deviceId: input.deviceId,
    tenantId: input.tenantId,
    sessionId: input.sessionId ?? null,
    type: input.type,
    issuedAt: now,
    expiresAt,
  };
}

/**
 * Expire queued/delivered past expiresAt; reclaim expired leases into QUEUED
 * when still within command TTL.
 */
export async function expireAndReclaimInbox(
  deviceId: string,
  tenantId: string,
  now = Date.now(),
): Promise<void> {
  await db
    .update(deviceCommandInbox)
    .set({ status: "EXPIRED", updatedAt: nowIso() })
    .where(
      and(
        eq(deviceCommandInbox.deviceId, deviceId),
        eq(deviceCommandInbox.tenantId, tenantId),
        or(
          eq(deviceCommandInbox.status, "QUEUED"),
          eq(deviceCommandInbox.status, "DELIVERED"),
        ),
        lte(deviceCommandInbox.expiresAt, now),
      ),
    );

  // Lease expired but command still valid → requeue
  await db
    .update(deviceCommandInbox)
    .set({
      status: "QUEUED",
      claimedAt: null,
      leaseUntil: null,
      availableAt: now,
      updatedAt: nowIso(),
    })
    .where(
      and(
        eq(deviceCommandInbox.deviceId, deviceId),
        eq(deviceCommandInbox.tenantId, tenantId),
        eq(deviceCommandInbox.status, "DELIVERED"),
        lte(deviceCommandInbox.leaseUntil, now),
        sql`${deviceCommandInbox.expiresAt} > ${now}`,
      ),
    );
}

export async function claimDeviceCommands(params: {
  deviceId: string;
  tenantId: string;
  now?: number;
  limit?: number;
}): Promise<PollCommandWire[]> {
  const now = params.now ?? Date.now();
  const limit = Math.min(
    params.limit ?? COMMAND_TRANSPORT.MAX_PER_POLL,
    COMMAND_TRANSPORT.MAX_PER_POLL,
  );

  return withDeviceClaimLock(params.deviceId, () =>
    db.transaction(async (tx) => {
      await tx
        .update(deviceCommandInbox)
        .set({ status: "EXPIRED", updatedAt: nowIso() })
        .where(
          and(
            eq(deviceCommandInbox.deviceId, params.deviceId),
            eq(deviceCommandInbox.tenantId, params.tenantId),
            or(
              eq(deviceCommandInbox.status, "QUEUED"),
              eq(deviceCommandInbox.status, "DELIVERED"),
            ),
            lte(deviceCommandInbox.expiresAt, now),
          ),
        );

      await tx
        .update(deviceCommandInbox)
        .set({
          status: "QUEUED",
          claimedAt: null,
          leaseUntil: null,
          availableAt: now,
          updatedAt: nowIso(),
        })
        .where(
          and(
            eq(deviceCommandInbox.deviceId, params.deviceId),
            eq(deviceCommandInbox.tenantId, params.tenantId),
            eq(deviceCommandInbox.status, "DELIVERED"),
            lte(deviceCommandInbox.leaseUntil, now),
            sql`${deviceCommandInbox.expiresAt} > ${now}`,
          ),
        );

      const candidates = await tx
        .select()
        .from(deviceCommandInbox)
        .where(
          and(
            eq(deviceCommandInbox.deviceId, params.deviceId),
            eq(deviceCommandInbox.tenantId, params.tenantId),
            eq(deviceCommandInbox.status, "QUEUED"),
            lte(deviceCommandInbox.availableAt, now),
            sql`${deviceCommandInbox.expiresAt} > ${now}`,
          ),
        )
        .orderBy(
          asc(deviceCommandInbox.createdAt),
          asc(deviceCommandInbox.commandId),
        )
        .limit(limit);

      const out: PollCommandWire[] = [];
      const leaseUntil = now + COMMAND_TRANSPORT.LEASE_MS;

      for (const row of candidates) {
        const updated = await tx
          .update(deviceCommandInbox)
          .set({
            status: "DELIVERED",
            claimedAt: now,
            leaseUntil,
            attempts: row.attempts + 1,
            updatedAt: nowIso(),
          })
          .where(
            and(
              eq(deviceCommandInbox.id, row.id),
              eq(deviceCommandInbox.status, "QUEUED"),
            ),
          )
          .returning();

        if (updated.length === 0) continue;

        let payload: DeviceCommandPayload = {};
        try {
          payload = JSON.parse(row.payload) as DeviceCommandPayload;
        } catch {
          continue;
        }
        if (!isDeviceCommandType(row.type)) continue;

        out.push({
          commandId: row.commandId,
          tenantId: row.tenantId,
          deviceId: row.deviceId,
          sessionId: row.sessionId,
          binding: (row.binding as CommandBinding) || "SESSION_BOUND",
          type: row.type,
          payload,
          issuedAt: row.issuedAt,
          expiresAt: row.expiresAt,
          correlationId: row.correlationId ?? undefined,
        });
      }

      return out;
    }),
  );
}

export async function acknowledgeDeviceCommand(params: {
  commandId: string;
  deviceId: string;
  tenantId: string;
  status: AckResultStatus;
  sessionId?: string | null;
  reason?: string | null;
  observedAt?: string | null;
  now?: number;
}) {
  if (!isAckResultStatus(params.status)) {
    throw new DeviceCommandServiceError("INVALID_ACK");
  }
  const now = params.now ?? Date.now();

  const [row] = await db
    .select()
    .from(deviceCommandInbox)
    .where(eq(deviceCommandInbox.commandId, params.commandId))
    .limit(1);

  if (!row || row.tenantId !== params.tenantId) {
    throw new DeviceCommandServiceError("COMMAND_NOT_FOUND");
  }
  if (row.deviceId !== params.deviceId) {
    throw new DeviceCommandServiceError("WRONG_DEVICE");
  }

  // Idempotent ACK
  if (row.status === "ACKED" || row.status === "REJECTED") {
    return {
      commandId: row.commandId,
      status: row.status as InboxStatus,
      resultStatus: (row.resultStatus as AckResultStatus | null) ?? params.status,
      duplicateAck: true,
    };
  }
  if (row.status === "EXPIRED") {
    return {
      commandId: row.commandId,
      status: "EXPIRED" as const,
      resultStatus: "EXPIRED" as const,
      duplicateAck: false,
    };
  }

  // Expired before ACK → mark EXPIRED, no execution credit
  if (row.expiresAt <= now && params.status === "APPLIED") {
    await db
      .update(deviceCommandInbox)
      .set({
        status: "EXPIRED",
        resultStatus: "EXPIRED",
        updatedAt: nowIso(),
      })
      .where(eq(deviceCommandInbox.id, row.id));
    throw new DeviceCommandServiceError("COMMAND_EXPIRED");
  }

  const terminalStatus: InboxStatus =
    params.status === "APPLIED" || params.status === "DUPLICATE"
      ? "ACKED"
      : params.status === "EXPIRED"
        ? "EXPIRED"
        : "REJECTED";

  await db
    .update(deviceCommandInbox)
    .set({
      status: terminalStatus,
      resultStatus: params.status,
      resultReason: params.reason ?? null,
      updatedAt: nowIso(),
    })
    .where(
      and(
        eq(deviceCommandInbox.id, row.id),
        or(
          eq(deviceCommandInbox.status, "DELIVERED"),
          eq(deviceCommandInbox.status, "QUEUED"),
        ),
      ),
    );

  await safeActivity({
    tenantId: params.tenantId,
    action:
      params.status === "APPLIED"
        ? "COMMAND_APPLIED"
        : params.status === "EXPIRED"
          ? "COMMAND_EXPIRED"
          : params.status === "DUPLICATE"
            ? "COMMAND_DUPLICATE"
            : "COMMAND_REJECTED",
    resource: "device_command",
    resourceId: params.commandId,
    metadata: {
      deviceId: params.deviceId,
      resultStatus: params.status,
      sessionId: params.sessionId ?? null,
    },
  });

  return {
    commandId: row.commandId,
    status: terminalStatus,
    resultStatus: params.status,
    duplicateAck: false,
  };
}

/** Lazy cleanup of terminal rows past retention. */
export async function cleanupExpiredCommandInbox(now = Date.now()): Promise<number> {
  const cutoff = now - COMMAND_TRANSPORT.RETENTION_MS;
  // Expire any still-open past expiresAt
  await db
    .update(deviceCommandInbox)
    .set({ status: "EXPIRED", updatedAt: nowIso() })
    .where(
      and(
        or(
          eq(deviceCommandInbox.status, "QUEUED"),
          eq(deviceCommandInbox.status, "DELIVERED"),
        ),
        lte(deviceCommandInbox.expiresAt, now),
      ),
    );

  const deleted = await db
    .delete(deviceCommandInbox)
    .where(
      and(
        or(
          eq(deviceCommandInbox.status, "ACKED"),
          eq(deviceCommandInbox.status, "REJECTED"),
          eq(deviceCommandInbox.status, "EXPIRED"),
        ),
        lt(deviceCommandInbox.expiresAt, cutoff),
      ),
    )
    .returning({ id: deviceCommandInbox.id });

  return deleted.length;
}

export function inboxRowToDeviceCommand(row: {
  commandId: string;
  tenantId: string;
  deviceId: string;
  sessionId: string | null;
  binding: string;
  type: string;
  payload: string;
  issuedAt: number;
  expiresAt: number;
  correlationId: string | null;
}): DeviceCommand | null {
  if (!isDeviceCommandType(row.type)) return null;
  let payload: DeviceCommandPayload = {};
  try {
    payload = JSON.parse(row.payload) as DeviceCommandPayload;
  } catch {
    return null;
  }
  return {
    commandId: row.commandId,
    tenantId: row.tenantId,
    deviceId: row.deviceId,
    sessionId: row.sessionId ?? undefined,
    binding: (row.binding as CommandBinding) || "SESSION_BOUND",
    type: row.type,
    payload,
    issuedAt: row.issuedAt,
    expiresAt: row.expiresAt,
    correlationId: row.correlationId ?? undefined,
  };
}
