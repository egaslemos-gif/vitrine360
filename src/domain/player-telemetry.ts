/**
 * RUNTIME-PLAYBACK-06 — Telemetry event model (observation only).
 *
 * Telemetry NEVER controls PlaybackController.
 */

export const PLAYER_TELEMETRY_EVENT_TYPES = [
  "PLAYER_SESSION_STARTED",
  "PLAYER_SESSION_READY",
  "PLAYBACK_STARTED",
  "PLAYBACK_PAUSED",
  "PLAYBACK_STOPPED",
  "PLAYBACK_ITEM_CHANGED",
  "PLAYBACK_ERROR",
  "PLAYBACK_ENDED",
  "SYNC_COMPLETED",
  "SYNC_ERROR",
  "RUNTIME_ERROR",
] as const;

export type PlayerTelemetryEventType =
  (typeof PLAYER_TELEMETRY_EVENT_TYPES)[number];

export type PlayerTelemetryEvent = {
  eventId: string;
  type: PlayerTelemetryEventType;
  sessionId: string;
  occurredAt: number;
  /** Optional generation for dedupe / stale detection. */
  generation?: number;
  contentId?: string | null;
  playlistId?: string | null;
  playlistItemId?: string | null;
  status?: string | null;
  errorCode?: string | null;
  /** Sanitized short message — never URLs/tokens. */
  message?: string | null;
};

const SECRET_RE =
  /(bearer\s+[a-z0-9._\-]+|authorization\s*[:=]\s*\S+|eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]+\.|[?&](X-Amz-|Signature|token|accessKey|secret)=)/i;

const URL_RE = /https?:\/\/[^\s"'<>]+/gi;

/** Strip secrets, signed URLs, and long query strings from telemetry text. */
export function sanitizeTelemetryText(
  input: string | null | undefined,
  maxLen = 160,
): string | null {
  if (input == null || input === "") return null;
  let s = String(input);
  s = s.replace(URL_RE, "[url]");
  s = s.replace(SECRET_RE, "[redacted]");
  s = s.replace(/\/api\/device\/media\/[^\s"'<>]+/gi, "/api/device/media/[id]");
  if (s.length > maxLen) s = `${s.slice(0, maxLen - 1)}…`;
  return s;
}

export function createTelemetryEventId(now: number): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `te_${crypto.randomUUID()}`;
  }
  return `te_${now.toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function buildTelemetryEvent(
  partial: Omit<PlayerTelemetryEvent, "eventId"> & { eventId?: string },
): PlayerTelemetryEvent {
  return {
    eventId: partial.eventId ?? createTelemetryEventId(partial.occurredAt),
    type: partial.type,
    sessionId: partial.sessionId,
    occurredAt: partial.occurredAt,
    generation: partial.generation,
    contentId: partial.contentId ?? null,
    playlistId: partial.playlistId ?? null,
    playlistItemId: partial.playlistItemId ?? null,
    status: partial.status ?? null,
    errorCode: partial.errorCode ?? null,
    message: sanitizeTelemetryText(partial.message ?? null),
  };
}

/** Dedupe key for transition events (same session + type + generation + content). */
export function telemetryDedupeKey(ev: PlayerTelemetryEvent): string {
  return [
    ev.sessionId,
    ev.type,
    ev.generation ?? "",
    ev.contentId ?? "",
    ev.playlistItemId ?? "",
    ev.errorCode ?? "",
  ].join("|");
}

export function assertTelemetryPayloadSafe(
  value: Record<string, unknown>,
): void {
  const blob = JSON.stringify(value);
  if (/Bearer\s+\S+/i.test(blob)) {
    throw new Error("telemetry must not expose Bearer tokens");
  }
  if (/AUTH_SECRET|R2_|AWS_SECRET|deviceToken/i.test(blob)) {
    throw new Error("telemetry must not expose credentials");
  }
}
