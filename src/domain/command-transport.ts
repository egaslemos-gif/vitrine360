/**
 * RUNTIME-PLAYBACK-09 — HTTP polling transport constants.
 * Remote inbox cadence / TTL (distinct from local RP-07 lab defaults).
 */

import { COMMAND_TTL, MAX_COMMAND_BYTES } from "@/domain/device-command";

export const COMMAND_TRANSPORT = {
  /** Device poll interval for React Player. */
  POLL_INTERVAL_MS: 5_000,
  /** Server-side remote enqueue default TTL (≥ 2× poll + lease + margin). */
  DEFAULT_TTL_MS: 30_000,
  MIN_TTL_MS: COMMAND_TTL.MIN_MS,
  MAX_TTL_MS: COMMAND_TTL.MAX_MS,
  /** Claim lease before redelivery. */
  LEASE_MS: 15_000,
  /** Max commands returned per poll. */
  MAX_PER_POLL: 10,
  /** Soft retention after ACK/EXPIRED before lazy delete (ms). */
  RETENTION_MS: 24 * 60 * 60 * 1_000,
  MAX_PAYLOAD_BYTES: MAX_COMMAND_BYTES,
} as const;

export const INBOX_STATUSES = [
  "QUEUED",
  "DELIVERED",
  "ACKED",
  "REJECTED",
  "EXPIRED",
] as const;
export type InboxStatus = (typeof INBOX_STATUSES)[number];

export const ACK_RESULT_STATUSES = [
  "APPLIED",
  "REJECTED",
  "DUPLICATE",
  "EXPIRED",
  "STALE_SESSION",
] as const;
export type AckResultStatus = (typeof ACK_RESULT_STATUSES)[number];

export function isAckResultStatus(v: unknown): v is AckResultStatus {
  return (
    typeof v === "string" &&
    (ACK_RESULT_STATUSES as readonly string[]).includes(v)
  );
}
