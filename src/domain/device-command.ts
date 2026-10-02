/**
 * RUNTIME-PLAYBACK-07 — DeviceCommand domain (pure).
 *
 * COMMAND ≠ TRANSPORT ≠ PLAYBACK ACTION.
 * No network, DB, DOM, or PlaybackController imports.
 */

import {
  REPEAT_MODES,
  type RepeatMode,
  isRepeatMode,
} from "@/domain/playback-state";

export const DEVICE_COMMAND_TYPES = [
  "PLAY",
  "PAUSE",
  "STOP",
  "NEXT",
  "PREVIOUS",
  "RESTART",
  "SEEK",
  "SET_VOLUME",
  "SET_MUTED",
  "SET_REPEAT_MODE",
] as const;
export type DeviceCommandType = (typeof DEVICE_COMMAND_TYPES)[number];

export const COMMAND_RESULT_STATUSES = [
  "APPLIED",
  "REJECTED",
  "EXPIRED",
  "DUPLICATE",
  "STALE_SESSION",
] as const;
export type CommandResultStatus = (typeof COMMAND_RESULT_STATUSES)[number];

export const COMMAND_REJECT_REASONS = [
  "INVALID_STRUCTURE",
  "UNSUPPORTED_COMMAND",
  "INVALID_PAYLOAD",
  "WRONG_TENANT",
  "UNKNOWN_DEVICE",
  "DEVICE_MISMATCH",
  "STALE_SESSION",
  "EXPIRED",
  "UNAUTHORIZED",
  "COMMAND_TOO_LARGE",
  "NOT_AUTHORIZED",
  /**
   * The command is valid but the CURRENT content cannot honour it (e.g. PAUSE/STOP on a
   * sandboxed EXPERIENCE, which has no suspend capability). Not applied; not a failure of
   * the command itself. Additive: the ACK wire carries `reason` as a free string.
   */
  "NOT_SUPPORTED",
] as const;
export type CommandRejectReason = (typeof COMMAND_REJECT_REASONS)[number];

/** TTL bounds (ms). No infinite TTL. */
export const COMMAND_TTL = {
  MIN_MS: 1_000,
  DEFAULT_MS: 10_000,
  MAX_MS: 60_000,
} as const;

export const MAX_COMMAND_BYTES = 8 * 1024;

export type CommandBinding = "DEVICE_BOUND" | "SESSION_BOUND";

export type DeviceCommandPayload =
  | Record<string, never>
  | { positionMs: number }
  | { volume: number }
  | { muted: boolean }
  | { repeatMode: RepeatMode };

export type DeviceCommand = {
  commandId: string;
  tenantId: string;
  deviceId: string;
  /** When set, command is SESSION_BOUND to this PlayerSession. */
  sessionId?: string;
  type: DeviceCommandType;
  payload: DeviceCommandPayload;
  issuedAt: number;
  expiresAt: number;
  correlationId?: string;
  binding: CommandBinding;
};

export type CommandResult = {
  commandId: string;
  status: CommandResultStatus;
  deviceId: string;
  sessionId: string | null;
  action: DeviceCommandType | null;
  appliedAt?: number;
  reason?: CommandRejectReason;
  correlationId?: string;
};

export function isDeviceCommandType(v: unknown): v is DeviceCommandType {
  return (
    typeof v === "string" &&
    (DEVICE_COMMAND_TYPES as readonly string[]).includes(v)
  );
}

export function createCommandId(now: number): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `cmd_${crypto.randomUUID()}`;
  }
  return `cmd_${now.toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

export function resolveExpiresAt(
  issuedAt: number,
  ttlMs?: number,
): { ok: true; expiresAt: number; ttlMs: number } | { ok: false; reason: CommandRejectReason } {
  const ttl = ttlMs ?? COMMAND_TTL.DEFAULT_MS;
  if (!Number.isFinite(ttl) || ttl <= 0) {
    return { ok: false, reason: "INVALID_PAYLOAD" };
  }
  if (ttl < COMMAND_TTL.MIN_MS || ttl > COMMAND_TTL.MAX_MS) {
    return { ok: false, reason: "INVALID_PAYLOAD" };
  }
  return { ok: true, expiresAt: issuedAt + ttl, ttlMs: ttl };
}

export function emptyPayload(): Record<string, never> {
  return {};
}

export type CreateDeviceCommandInput = {
  tenantId: string;
  deviceId: string;
  type: DeviceCommandType;
  payload?: DeviceCommandPayload;
  sessionId?: string;
  /** Prefer SESSION_BOUND when sessionId provided. */
  binding?: CommandBinding;
  issuedAt?: number;
  ttlMs?: number;
  commandId?: string;
  correlationId?: string;
};

export function createDeviceCommand(
  input: CreateDeviceCommandInput,
):
  | { ok: true; command: DeviceCommand }
  | { ok: false; reason: CommandRejectReason } {
  const issuedAt = input.issuedAt ?? Date.now();
  if (!input.tenantId || typeof input.tenantId !== "string") {
    return { ok: false, reason: "WRONG_TENANT" };
  }
  if (!input.deviceId || typeof input.deviceId !== "string") {
    return { ok: false, reason: "UNKNOWN_DEVICE" };
  }
  if (input.deviceId === "*") {
    return { ok: false, reason: "INVALID_PAYLOAD" };
  }
  if (!isDeviceCommandType(input.type)) {
    return { ok: false, reason: "UNSUPPORTED_COMMAND" };
  }

  const ttl = resolveExpiresAt(issuedAt, input.ttlMs);
  if (!ttl.ok) return ttl;

  const binding: CommandBinding =
    input.binding ??
    (input.sessionId ? "SESSION_BOUND" : "DEVICE_BOUND");

  if (binding === "SESSION_BOUND" && !input.sessionId) {
    return { ok: false, reason: "STALE_SESSION" };
  }

  const payload = input.payload ?? emptyPayload();
  const payloadCheck = validateCommandPayload(input.type, payload);
  if (!payloadCheck.ok) return payloadCheck;

  const command: DeviceCommand = {
    commandId: input.commandId ?? createCommandId(issuedAt),
    tenantId: input.tenantId,
    deviceId: input.deviceId,
    sessionId: input.sessionId,
    type: input.type,
    payload: payloadCheck.payload,
    issuedAt,
    expiresAt: ttl.expiresAt,
    correlationId: input.correlationId,
    binding,
  };

  const size = measureCommandBytes(command);
  if (size > MAX_COMMAND_BYTES) {
    return { ok: false, reason: "COMMAND_TOO_LARGE" };
  }

  return { ok: true, command };
}

export function validateCommandPayload(
  type: DeviceCommandType,
  payload: unknown,
):
  | { ok: true; payload: DeviceCommandPayload }
  | { ok: false; reason: CommandRejectReason } {
  if (payload == null || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, reason: "INVALID_PAYLOAD" };
  }
  const p = payload as Record<string, unknown>;

  switch (type) {
    case "PLAY":
    case "PAUSE":
    case "STOP":
    case "NEXT":
    case "PREVIOUS":
    case "RESTART": {
      if (Object.keys(p).length > 0) {
        return { ok: false, reason: "INVALID_PAYLOAD" };
      }
      return { ok: true, payload: {} };
    }
    case "SEEK": {
      if (!("positionMs" in p) || Object.keys(p).length !== 1) {
        return { ok: false, reason: "INVALID_PAYLOAD" };
      }
      const positionMs = p.positionMs;
      if (
        typeof positionMs !== "number" ||
        !Number.isFinite(positionMs) ||
        positionMs < 0
      ) {
        return { ok: false, reason: "INVALID_PAYLOAD" };
      }
      return { ok: true, payload: { positionMs } };
    }
    case "SET_VOLUME": {
      if (!("volume" in p) || Object.keys(p).length !== 1) {
        return { ok: false, reason: "INVALID_PAYLOAD" };
      }
      const volume = p.volume;
      if (
        typeof volume !== "number" ||
        !Number.isFinite(volume) ||
        volume < 0 ||
        volume > 1
      ) {
        return { ok: false, reason: "INVALID_PAYLOAD" };
      }
      return { ok: true, payload: { volume } };
    }
    case "SET_MUTED": {
      if (!("muted" in p) || Object.keys(p).length !== 1) {
        return { ok: false, reason: "INVALID_PAYLOAD" };
      }
      if (typeof p.muted !== "boolean") {
        return { ok: false, reason: "INVALID_PAYLOAD" };
      }
      return { ok: true, payload: { muted: p.muted } };
    }
    case "SET_REPEAT_MODE": {
      if (!("repeatMode" in p) || Object.keys(p).length !== 1) {
        return { ok: false, reason: "INVALID_PAYLOAD" };
      }
      if (!isRepeatMode(p.repeatMode)) {
        return { ok: false, reason: "INVALID_PAYLOAD" };
      }
      return { ok: true, payload: { repeatMode: p.repeatMode } };
    }
    default:
      return { ok: false, reason: "UNSUPPORTED_COMMAND" };
  }
}

export function measureCommandBytes(command: DeviceCommand): number {
  return new TextEncoder().encode(serializeDeviceCommand(command)).length;
}

/** Deterministic JSON serialization (sorted keys at top level via fixed order). */
export function serializeDeviceCommand(command: DeviceCommand): string {
  const ordered: Record<string, unknown> = {
    commandId: command.commandId,
    tenantId: command.tenantId,
    deviceId: command.deviceId,
    type: command.type,
    payload: command.payload,
    issuedAt: command.issuedAt,
    expiresAt: command.expiresAt,
    binding: command.binding,
  };
  if (command.sessionId != null) ordered.sessionId = command.sessionId;
  if (command.correlationId != null) {
    ordered.correlationId = command.correlationId;
  }
  return JSON.stringify(ordered);
}

export function parseDeviceCommand(
  raw: string,
):
  | { ok: true; command: DeviceCommand }
  | { ok: false; reason: CommandRejectReason } {
  if (typeof raw !== "string" || raw.length > MAX_COMMAND_BYTES) {
    return { ok: false, reason: "COMMAND_TOO_LARGE" };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "INVALID_STRUCTURE" };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, reason: "INVALID_STRUCTURE" };
  }
  const o = parsed as Record<string, unknown>;
  if (typeof o.commandId !== "string" || !o.commandId) {
    return { ok: false, reason: "INVALID_STRUCTURE" };
  }
  if (typeof o.tenantId !== "string" || typeof o.deviceId !== "string") {
    return { ok: false, reason: "INVALID_STRUCTURE" };
  }
  if (o.deviceId === "*") {
    return { ok: false, reason: "INVALID_PAYLOAD" };
  }
  if (!isDeviceCommandType(o.type)) {
    return { ok: false, reason: "UNSUPPORTED_COMMAND" };
  }
  if (typeof o.issuedAt !== "number" || !Number.isFinite(o.issuedAt)) {
    return { ok: false, reason: "INVALID_STRUCTURE" };
  }
  if (typeof o.expiresAt !== "number" || !Number.isFinite(o.expiresAt)) {
    return { ok: false, reason: "INVALID_STRUCTURE" };
  }
  if (o.expiresAt <= o.issuedAt) {
    return { ok: false, reason: "INVALID_PAYLOAD" };
  }
  const ttl = o.expiresAt - o.issuedAt;
  if (ttl < COMMAND_TTL.MIN_MS || ttl > COMMAND_TTL.MAX_MS) {
    return { ok: false, reason: "INVALID_PAYLOAD" };
  }
  const payloadCheck = validateCommandPayload(o.type, o.payload ?? {});
  if (!payloadCheck.ok) return payloadCheck;

  const binding: CommandBinding =
    o.binding === "DEVICE_BOUND" || o.binding === "SESSION_BOUND"
      ? o.binding
      : o.sessionId
        ? "SESSION_BOUND"
        : "DEVICE_BOUND";

  if (binding === "SESSION_BOUND") {
    if (typeof o.sessionId !== "string" || !o.sessionId) {
      return { ok: false, reason: "STALE_SESSION" };
    }
  }

  const command: DeviceCommand = {
    commandId: o.commandId,
    tenantId: o.tenantId,
    deviceId: o.deviceId,
    sessionId: typeof o.sessionId === "string" ? o.sessionId : undefined,
    type: o.type,
    payload: payloadCheck.payload,
    issuedAt: o.issuedAt,
    expiresAt: o.expiresAt,
    correlationId:
      typeof o.correlationId === "string" ? o.correlationId : undefined,
    binding,
  };

  // Security: reject credential-like fields if smuggled
  const blob = JSON.stringify(command);
  if (/Bearer\s+\S+|AUTH_SECRET|deviceToken|R2_|AWS_SECRET/i.test(blob)) {
    return { ok: false, reason: "INVALID_PAYLOAD" };
  }

  return { ok: true, command };
}

export function isCommandExpired(
  command: DeviceCommand,
  now: number,
): boolean {
  return now >= command.expiresAt;
}

/** Re-export for docs/tests. */
export { REPEAT_MODES };
