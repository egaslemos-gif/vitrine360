/**
 * RUNTIME-PLAYBACK-07 — Bounded in-memory idempotency store (NOT durable).
 * Documented: local/test only — not distributed production idempotency.
 */

import type { CommandResult } from "@/domain/device-command";

export type IdempotencyRecord = {
  commandId: string;
  result: CommandResult;
  expiresAt: number;
};

export type IdempotencyStore = {
  get: (commandId: string, now: number) => CommandResult | null;
  set: (commandId: string, result: CommandResult, expiresAt: number) => void;
  size: () => number;
  prune: (now: number) => void;
  clear: () => void;
};

export const DEFAULT_IDEMPOTENCY_CAPACITY = 256;

export function createIdempotencyStore(
  capacity = DEFAULT_IDEMPOTENCY_CAPACITY,
): IdempotencyStore {
  const cap = Math.max(1, capacity);
  const map = new Map<string, IdempotencyRecord>();

  const prune = (now: number) => {
    for (const [id, rec] of map) {
      if (rec.expiresAt <= now) map.delete(id);
    }
    while (map.size > cap) {
      const first = map.keys().next().value;
      if (first == null) break;
      map.delete(first);
    }
  };

  return {
    get(commandId, now) {
      prune(now);
      const rec = map.get(commandId);
      if (!rec) return null;
      if (rec.expiresAt <= now) {
        map.delete(commandId);
        return null;
      }
      return { ...rec.result, status: "DUPLICATE" };
    },
    set(commandId, result, expiresAt) {
      prune(Date.now());
      if (map.size >= cap && !map.has(commandId)) {
        const first = map.keys().next().value;
        if (first != null) map.delete(first);
      }
      map.set(commandId, {
        commandId,
        result: { ...result },
        expiresAt,
      });
    },
    size: () => map.size,
    prune,
    clear: () => map.clear(),
  };
}
