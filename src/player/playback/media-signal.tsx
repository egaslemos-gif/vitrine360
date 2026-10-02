/**
 * PLAYER-PRO-02 — Presentation-only signals observed from the media element.
 *
 * NOT playback state: the PlaybackController stays the only source of truth for status,
 * index, position, volume and mute *intent*. This store only reports what the browser
 * actually did (audio blocked by policy, element silent, buffering) so the UI never claims
 * more than what is observable, and routes a user gesture back to the same element.
 */

"use client";

import { createContext, useContext, useState, useSyncExternalStore, type ReactNode } from "react";

export type MediaSignals = {
  /** Browser/element is silent although the user did not ask for mute. */
  audioBlocked: boolean;
  /** Effective element mute (null = no AV element). */
  effectiveMuted: boolean | null;
  /** Network/decoder is starving the element while it should be playing. */
  buffering: boolean;
  /** Playback is wanted but the element is paused (autoplay policy) — needs a gesture. */
  playBlocked: boolean;
  /** Observable error kind of the last native failure (no URLs/tokens). */
  errorKind: "network" | "decode" | "unsupported" | "load" | "unknown" | null;
};

export const INITIAL_MEDIA_SIGNALS: MediaSignals = {
  audioBlocked: false,
  effectiveMuted: null,
  buffering: false,
  playBlocked: false,
  errorKind: null,
};

export class MediaSignalStore {
  private snapshot: MediaSignals = INITIAL_MEDIA_SIGNALS;
  private readonly listeners = new Set<() => void>();
  private gestureHandler: (() => void) | null = null;

  get = (): MediaSignals => this.snapshot;
  subscribe = (l: () => void): (() => void) => {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  };

  patch(p: Partial<MediaSignals>): void {
    let changed = false;
    for (const k of Object.keys(p) as (keyof MediaSignals)[]) {
      if (this.snapshot[k] !== p[k]) changed = true;
    }
    if (!changed) return;
    this.snapshot = { ...this.snapshot, ...p };
    for (const l of this.listeners) l();
  }

  reset(): void {
    this.patch({ ...INITIAL_MEDIA_SIGNALS });
  }

  /** Adapter registers how to act on the current element inside a user gesture. */
  setGestureHandler(h: (() => void) | null): void {
    this.gestureHandler = h;
  }

  /** UI → adapter: user gesture (click on "enable sound"/play). Same element, no rebuild. */
  requestEnableSound(): void {
    this.gestureHandler?.();
  }
}

const Ctx = createContext<MediaSignalStore | null>(null);

export function MediaSignalProvider({ store, children }: { store: MediaSignalStore; children: ReactNode }) {
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useMediaSignalStore(): MediaSignalStore | null {
  return useContext(Ctx);
}

const FALLBACK = new MediaSignalStore();

export function useMediaSignals(): MediaSignals {
  const store = useContext(Ctx) ?? FALLBACK;
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

export function useCreateMediaSignalStore(): MediaSignalStore {
  const [store] = useState(() => new MediaSignalStore());
  return store;
}
