/**
 * RUNTIME-PLAYBACK-10 — Command Observation Correlation
 *
 * Separates Command Status (Authority: Inbox/Dispatcher) from
 * Playback State (Authority: PlayerSession/PlaybackController).
 */

import type { CommandResultStatus, DeviceCommandType } from "@/domain/device-command";
import type { CompactPlaybackObservation } from "@/domain/playback-observation";

export type CommandTimeline = {
  createdAt: number; // ISO string converted to ms, or issuedAt
  queuedAt: number;  // Same as createdAt
  deliveredAt?: number; // from claimedAt
  dispatchedAt?: number; // client-side or omitted if not known
  appliedAt?: number; // from updatedAt when status == APPLIED
  observedAt?: number; // when PlaybackObservation was taken
};

export type CommandLatencyMetrics = {
  /** createdAt -> deliveredAt */
  queueLatencyMs?: number;
  /** deliveredAt -> dispatchedAt */
  deliveryLatencyMs?: number;
  /** dispatchedAt -> appliedAt */
  dispatchLatencyMs?: number;
  /** deliveredAt -> ACK received (simulated if necessary, or just use appliedAt) */
  ackLatencyMs?: number;
  /** appliedAt -> observedAt */
  observationLatencyMs?: number;
  /** createdAt -> observedAt */
  endToEndObservedLatencyMs?: number;
};

export type CommandObservationCorrelation = {
  commandId: string;
  deviceId: string;
  sessionId?: string;
  type: DeviceCommandType;
  status: CommandResultStatus | "QUEUED" | "DELIVERED";
  timeline: CommandTimeline;
  latency: CommandLatencyMetrics;
  /**
   * Playback Observation obtained AFTER the command reached a terminal state (e.g. APPLIED).
   * Note: This implies "Observed after command", not necessarily strict causality.
   */
  observation?: CompactPlaybackObservation;
};

export function calculateCommandLatency(
  timeline: CommandTimeline
): CommandLatencyMetrics {
  return {
    queueLatencyMs: timeline.deliveredAt ? timeline.deliveredAt - timeline.createdAt : undefined,
    deliveryLatencyMs: timeline.deliveredAt && timeline.dispatchedAt ? timeline.dispatchedAt - timeline.deliveredAt : undefined,
    dispatchLatencyMs: timeline.dispatchedAt && timeline.appliedAt ? timeline.appliedAt - timeline.dispatchedAt : undefined,
    ackLatencyMs: timeline.deliveredAt && timeline.appliedAt ? timeline.appliedAt - timeline.deliveredAt : undefined, // simplified
    observationLatencyMs: timeline.appliedAt && timeline.observedAt ? timeline.observedAt - timeline.appliedAt : undefined,
    endToEndObservedLatencyMs: timeline.observedAt ? timeline.observedAt - timeline.createdAt : undefined,
  };
}

export function createCommandObservationCorrelation(params: {
  commandId: string;
  deviceId: string;
  sessionId?: string;
  type: DeviceCommandType;
  status: CommandResultStatus | "QUEUED" | "DELIVERED";
  timeline: CommandTimeline;
  observation?: CompactPlaybackObservation;
}): CommandObservationCorrelation {
  return {
    ...params,
    latency: calculateCommandLatency(params.timeline),
  };
}
