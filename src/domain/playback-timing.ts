/**
 * RUNTIME-PLAYBACK-03 — Presentation timing helpers.
 *
 * Single timing owner for IMAGE / GIF / explicit-duration VIDEO|AUDIO /
 * TEXT / CLOCK / EXPERIENCE slides.
 *
 * Natural VIDEO/AUDIO (durationMs===0) do NOT use this timer —
 * native media `ended` is authoritative.
 */

import type { PlaybackPlaylistItem } from "@/domain/playback-state";
import { resolveItemDurationMs } from "@/domain/playback-state";

export type TimingCategory =
  | "NATIVE_ENDED"
  | "PRESENTATION_TIMER"
  | "EXPERIENCE_HOSTED";

/**
 * Effective presentation duration for a playlist item.
 *
 * Manifest already resolves `durationOverrideMs ?? content.durationMs`
 * into PlaybackItem.durationMs before the Player sees it.
 * Therefore effectiveDurationMs === item.durationMs at runtime.
 *
 * Returns:
 * - null → natural media (VIDEO/AUDIO duration unknown until metadata)
 * - >0   → presentation duration (slides / explicit video window)
 */
export function effectiveDurationMs(
  item: PlaybackPlaylistItem,
): number | null {
  return resolveItemDurationMs(item);
}

export function classifyTiming(item: {
  type: string;
  durationMs: number;
}): TimingCategory {
  const t = item.type.toUpperCase();
  if ((t === "VIDEO" || t === "AUDIO") && item.durationMs === 0) {
    return "NATIVE_ENDED";
  }
  if (t === "EXPERIENCE") {
    // Experience Runtime has no end signal in current Player integration —
    // presentation timer ends the slide using item duration (hosted).
    return "EXPERIENCE_HOSTED";
  }
  return "PRESENTATION_TIMER";
}

export function usesNativeMediaEnded(item: {
  type: string;
  durationMs: number;
}): boolean {
  return classifyTiming(item) === "NATIVE_ENDED";
}

export function usesPresentationTimer(item: {
  type: string;
  durationMs: number;
}): boolean {
  const c = classifyTiming(item);
  return c === "PRESENTATION_TIMER" || c === "EXPERIENCE_HOSTED";
}

/**
 * Generation-scoped presentation timer.
 * Uses wall-clock elapsed (now - startedAt) to avoid setInterval drift.
 */
export class PresentationTimer {
  private handle: ReturnType<typeof setTimeout> | null = null;
  private cancelled = true;
  private generation = -1;
  private startedAt = 0;
  private durationMs = 0;
  private now: () => number = () => Date.now();
  private onTick: ((elapsedMs: number, generation: number) => void) | null =
    null;
  private intervalMs = 250;

  get active(): boolean {
    return !this.cancelled && this.handle != null;
  }

  get boundGeneration(): number {
    return this.generation;
  }

  start(opts: {
    generation: number;
    durationMs: number;
    /** Elapsed presentation position to resume from. */
    startPositionMs?: number;
    now?: () => number;
    intervalMs?: number;
    onTick: (elapsedMs: number, generation: number) => void;
  }): void {
    this.stop();
    if (!(opts.durationMs > 0)) return;

    this.cancelled = false;
    this.generation = opts.generation;
    this.durationMs = opts.durationMs;
    this.now = opts.now ?? (() => Date.now());
    this.intervalMs = opts.intervalMs ?? 250;
    this.onTick = opts.onTick;
    const startPos = Math.max(0, opts.startPositionMs ?? 0);
    this.startedAt = this.now() - startPos;
    this.schedule();
  }

  /** Pause: cancel schedule; caller keeps positionMs from last tick. */
  pause(): void {
    this.clearHandle();
    this.cancelled = true;
  }

  stop(): void {
    this.clearHandle();
    this.cancelled = true;
    this.generation = -1;
    this.onTick = null;
  }

  /** Invalidate if generation no longer matches. */
  matches(generation: number): boolean {
    return !this.cancelled && this.generation === generation;
  }

  private schedule(): void {
    this.clearHandle();
    if (this.cancelled) return;
    this.handle = setTimeout(() => this.tick(), this.intervalMs);
  }

  private tick(): void {
    this.handle = null;
    if (this.cancelled || !this.onTick) return;
    const elapsed = this.now() - this.startedAt;
    const gen = this.generation;
    this.onTick(elapsed, gen);
    if (!this.cancelled && elapsed < this.durationMs) {
      this.schedule();
    }
  }

  private clearHandle(): void {
    if (this.handle != null) {
      clearTimeout(this.handle);
      this.handle = null;
    }
  }
}
