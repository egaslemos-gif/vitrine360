/**
 * RUNTIME-PLAYBACK-06 — Bounded in-memory telemetry queue.
 * Non-blocking; drop-oldest when full. Never awaits network on enqueue.
 */

import {
  assertTelemetryPayloadSafe,
  buildTelemetryEvent,
  telemetryDedupeKey,
  type PlayerTelemetryEvent,
  type PlayerTelemetryEventType,
} from "@/domain/player-telemetry";

export const DEFAULT_TELEMETRY_QUEUE_CAPACITY = 64;

export type TelemetryQueue = {
  enqueue: (
    partial: Parameters<typeof buildTelemetryEvent>[0],
  ) => PlayerTelemetryEvent | null;
  drain: () => PlayerTelemetryEvent[];
  size: () => number;
  capacity: () => number;
  dropped: () => number;
  clear: () => void;
  peek: () => readonly PlayerTelemetryEvent[];
};

export function createTelemetryQueue(
  capacity = DEFAULT_TELEMETRY_QUEUE_CAPACITY,
): TelemetryQueue {
  const cap = Math.max(1, capacity);
  const items: PlayerTelemetryEvent[] = [];
  const recentKeys = new Map<string, number>();
  let dropped = 0;

  return {
    enqueue(partial) {
      try {
        const ev = buildTelemetryEvent(partial);
        assertTelemetryPayloadSafe(ev as unknown as Record<string, unknown>);
        const key = telemetryDedupeKey(ev);
        const last = recentKeys.get(key);
        // Dedupe identical transition within 2s
        if (last != null && ev.occurredAt - last < 2000) {
          return null;
        }
        recentKeys.set(key, ev.occurredAt);
        if (recentKeys.size > cap * 4) {
          // prune old keys
          const cutoff = ev.occurredAt - 60_000;
          for (const [k, t] of recentKeys) {
            if (t < cutoff) recentKeys.delete(k);
          }
        }
        if (items.length >= cap) {
          items.shift();
          dropped += 1;
        }
        items.push(ev);
        return ev;
      } catch {
        // Failure isolation — never throw into playback path
        dropped += 1;
        return null;
      }
    },
    drain() {
      return items.splice(0, items.length);
    },
    size: () => items.length,
    capacity: () => cap,
    dropped: () => dropped,
    clear() {
      items.length = 0;
      recentKeys.clear();
    },
    peek: () => items,
  };
}

/** Map playback status transition → telemetry type (or null). */
export function telemetryTypeForStatusTransition(
  from: string | null,
  to: string,
): PlayerTelemetryEventType | null {
  if (from === to) return null;
  if (to === "PLAYING") return "PLAYBACK_STARTED";
  if (to === "PAUSED") return "PLAYBACK_PAUSED";
  if (to === "STOPPED") return "PLAYBACK_STOPPED";
  if (to === "ENDED") return "PLAYBACK_ENDED";
  if (to === "ERROR") return "PLAYBACK_ERROR";
  return null;
}
