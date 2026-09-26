/**
 * RUNTIME-PLAYBACK-01 — PlaybackController
 *
 * Pure domain controller: state transitions, playlist navigation,
 * position/volume, media lifecycle coordination via generation tokens.
 *
 * MUST NOT: render DOM/React, access DB, JWT, Device Bearer, R2, Tenant auth,
 * send remote commands, or shuffle (shuffle field reserved only).
 */

import {
  PREVIOUS_RESTART_THRESHOLD_MS,
  canTransition,
  clampPositionMs,
  clampVolume,
  createInitialPlaybackState,
  parseContentType,
  resolveItemDurationMs,
  snapshotPlaybackState,
  type PlaybackAction,
  type PlaybackPlaylistItem,
  type PlaybackState,
  type PlaybackStatus,
  type RepeatMode,
} from "@/domain/playback-state";

export type PlaybackListener = (state: PlaybackState) => void;

export type PlaybackControllerOptions = {
  now?: () => number;
  previousRestartThresholdMs?: number;
};

export class PlaybackController {
  private state: PlaybackState;
  private items: PlaybackPlaylistItem[] = [];
  private readonly listeners = new Set<PlaybackListener>();
  private readonly now: () => number;
  private readonly previousRestartThresholdMs: number;

  constructor(options: PlaybackControllerOptions = {}) {
    this.now = options.now ?? (() => Date.now());
    this.previousRestartThresholdMs =
      options.previousRestartThresholdMs ?? PREVIOUS_RESTART_THRESHOLD_MS;
    // Deterministic initial snapshot (updatedAt=0) so useSyncExternalStore
    // getServerSnapshot === getSnapshot during hydration. Timestamps apply on commit.
    this.state = createInitialPlaybackState(0);
  }

  getState(): PlaybackState {
    return snapshotPlaybackState(this.state);
  }

  getItems(): readonly PlaybackPlaylistItem[] {
    return this.items.slice();
  }

  getGeneration(): number {
    return this.state.generation;
  }

  subscribe(listener: PlaybackListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  dispatch(action: PlaybackAction): PlaybackState {
    switch (action.type) {
      case "LOAD_PLAYLIST":
        this.loadPlaylist(
          action.playlistId,
          action.manifestVersion,
          action.items,
          action.startIndex ?? 0,
        );
        break;
      case "SYNC_PLAYLIST":
        this.syncPlaylist(
          action.playlistId,
          action.manifestVersion,
          action.items,
          action.preferContentId,
        );
        break;
      case "PLAY":
        this.play();
        break;
      case "PAUSE":
        this.pause();
        break;
      case "STOP":
        this.stop();
        break;
      case "NEXT":
        this.next();
        break;
      case "PREVIOUS":
        this.previous();
        break;
      case "RESTART":
        this.restart();
        break;
      case "SEEK":
        this.seek(action.positionMs);
        break;
      case "SET_VOLUME":
        this.setVolume(action.volume);
        break;
      case "SET_MUTED":
        this.setMuted(action.muted);
        break;
      case "SET_REPEAT_MODE":
        this.setRepeatMode(action.mode);
        break;
      case "MEDIA_LOADING":
        this.onMediaLoading();
        break;
      case "MEDIA_READY":
        this.onMediaReady(action.durationMs ?? null, action.generation);
        break;
      case "MEDIA_TIME_UPDATE":
        this.onMediaTimeUpdate(action.positionMs, action.generation);
        break;
      case "MEDIA_ENDED":
        this.onMediaEnded(action.generation);
        break;
      case "MEDIA_ERROR":
        this.onMediaError(
          action.code,
          action.message,
          action.recoverable ?? true,
          action.generation,
        );
        break;
      default: {
        const _exhaustive: never = action;
        void _exhaustive;
      }
    }
    return this.getState();
  }

  /** Convenience aliases */
  play(): void {
    const s = this.state.status;
    if (s === "PAUSED") {
      this.transition("PLAYING");
      return;
    }
    if (s === "STOPPED" || s === "ENDED") {
      this.beginCurrentItem({ resetPosition: true });
      return;
    }
    if (s === "IDLE") {
      if (this.items.length === 0) return;
      this.beginCurrentItem({ resetPosition: true });
      return;
    }
    if (s === "ERROR") {
      this.beginCurrentItem({ resetPosition: true });
      return;
    }
    if (s === "LOADING") {
      // Already loading current item — no-op.
      return;
    }
    if (s === "PLAYING") {
      return;
    }
  }

  pause(): void {
    if (this.state.status !== "PLAYING") return;
    this.transition("PAUSED");
  }

  stop(): void {
    const s = this.state.status;
    if (
      s !== "PLAYING" &&
      s !== "PAUSED" &&
      s !== "LOADING" &&
      s !== "ENDED" &&
      s !== "ERROR"
    ) {
      return;
    }
    this.commit({
      status: "STOPPED",
      positionMs: 0,
      error: null,
      // Preserve playlistId, index, contentId, manifestVersion.
    });
  }

  next(): void {
    if (this.items.length === 0) return;
    const last = this.items.length - 1;
    const atLast = this.state.currentItemIndex >= last;

    if (atLast) {
      if (this.state.repeatMode === "ITEM") {
        this.beginCurrentItem({ resetPosition: true });
        return;
      }
      if (this.state.repeatMode === "NONE") {
        this.commit({
          status: "ENDED",
          positionMs: this.state.durationMs ?? this.state.positionMs,
          error: null,
        });
        return;
      }
      // PLAYLIST: wrap to first
      this.selectIndex(0, { resetPosition: true });
      return;
    }

    this.selectIndex(this.state.currentItemIndex + 1, { resetPosition: true });
  }

  previous(): void {
    if (this.items.length === 0) return;

    if (this.state.positionMs > this.previousRestartThresholdMs) {
      this.restart();
      return;
    }

    if (this.state.currentItemIndex <= 0) {
      if (this.state.repeatMode === "PLAYLIST") {
        this.selectIndex(this.items.length - 1, { resetPosition: true });
        return;
      }
      this.restart();
      return;
    }

    this.selectIndex(this.state.currentItemIndex - 1, { resetPosition: true });
  }

  restart(): void {
    if (this.items.length === 0) return;
    this.beginCurrentItem({ resetPosition: true });
  }

  seek(positionMs: number): void {
    if (!Number.isFinite(positionMs)) return;
    const duration = this.state.durationMs;
    // Unknown duration: allow seek only to non-negative finite positions
    // without inventing a duration. Reject NaN/Infinity via isFinite above.
    if (duration == null) {
      if (positionMs < 0) return;
      // While duration unknown, clamp only lower bound; do not invent upper.
      this.commit({
        positionMs: Math.max(0, positionMs),
      });
      return;
    }
    if (duration < 0) return;
    this.commit({
      positionMs: clampPositionMs(positionMs, duration),
    });
  }

  setVolume(volume: number): void {
    this.commit({ volume: clampVolume(volume) });
  }

  setMuted(muted: boolean): void {
    this.commit({ muted: Boolean(muted) });
  }

  setRepeatMode(mode: RepeatMode): void {
    this.commit({ repeatMode: mode });
  }

  loadPlaylist(
    playlistId: string,
    manifestVersion: number | null,
    items: PlaybackPlaylistItem[],
    startIndex = 0,
  ): void {
    this.items = items.slice();
    const index =
      items.length === 0
        ? 0
        : Math.max(0, Math.min(startIndex, items.length - 1));

    if (items.length === 0) {
      this.commit({
        status: "IDLE",
        playlistId,
        manifestVersion,
        currentItemIndex: 0,
        currentContentId: null,
        currentContentType: null,
        currentPlaylistItemId: null,
        positionMs: 0,
        durationMs: null,
        error: null,
        generation: this.state.generation + 1,
      });
      return;
    }

    this.applyItemAt(index, {
      resetPosition: true,
      playlistId,
      manifestVersion,
      status: "LOADING",
    });
  }

  /**
   * Soft manifest update (RP-03 formalized):
   *
   * 1. Same playlistItemId → remap index only (preserve status/position/generation)
   * 2. Else same contentId → select that item (may LOADING if identity slot changed)
   * 3. Else clamp previous index into new length (deterministic; not forced to 0)
   * 4. Empty → IDLE
   */
  syncPlaylist(
    playlistId: string,
    manifestVersion: number | null,
    items: PlaybackPlaylistItem[],
    preferContentId?: string | null,
  ): void {
    this.items = items.slice();

    if (items.length === 0) {
      this.commit({
        status: "IDLE",
        playlistId,
        manifestVersion,
        currentItemIndex: 0,
        currentContentId: null,
        currentContentType: null,
        currentPlaylistItemId: null,
        positionMs: 0,
        durationMs: null,
        error: null,
        generation: this.state.generation + 1,
      });
      return;
    }

    const byItemId = this.state.currentPlaylistItemId
      ? items.findIndex(
          (entry) => entry.playlistItemId === this.state.currentPlaylistItemId,
        )
      : -1;
    const wantContent =
      preferContentId ?? this.state.currentContentId ?? null;
    const byContent = wantContent
      ? items.findIndex((entry) => entry.contentId === wantContent)
      : -1;

    if (byItemId >= 0) {
      const item = items[byItemId]!;
      // Soft: index may change on reorder; do not bump generation.
      this.commit({
        playlistId,
        manifestVersion,
        currentItemIndex: byItemId,
        currentContentId: item.contentId,
        currentContentType: parseContentType(item.type),
        currentPlaylistItemId: item.playlistItemId,
      });
      return;
    }

    if (byContent >= 0) {
      const wasStoppedOrEnded =
        this.state.status === "STOPPED" || this.state.status === "ENDED";
      this.applyItemAt(byContent, {
        resetPosition: wasStoppedOrEnded || this.state.status === "IDLE",
        playlistId,
        manifestVersion,
        status: wasStoppedOrEnded
          ? this.state.status
          : this.state.status === "PAUSED"
            ? "LOADING"
            : "LOADING",
      });
      return;
    }

    // Current item removed: clamp index (do not jump to 0 unless index was 0).
    const fallback = Math.min(
      Math.max(0, this.state.currentItemIndex),
      items.length - 1,
    );
    this.applyItemAt(fallback, {
      resetPosition: true,
      playlistId,
      manifestVersion,
      status: "LOADING",
    });
  }

  // ── Media lifecycle (renderer → controller) ──────────────────────────

  onMediaLoading(): void {
    if (
      this.state.status === "STOPPED" ||
      this.state.status === "IDLE" ||
      this.state.status === "ENDED"
    ) {
      return;
    }
    this.transition("LOADING");
  }

  onMediaReady(durationMs: number | null, generation: number): void {
    if (generation !== this.state.generation) return;
    const status = this.state.status;
    if (
      status !== "LOADING" &&
      status !== "PLAYING" &&
      status !== "PAUSED"
    ) {
      return;
    }
    const nextDuration =
      durationMs != null && Number.isFinite(durationMs) && durationMs > 0
        ? durationMs
        : this.state.durationMs;
    const target: PlaybackStatus =
      status === "PAUSED" ? "PAUSED" : "PLAYING";
    if (!canTransition(status, target)) return;
    this.commit({
      status: target,
      durationMs: nextDuration,
      error: null,
    });
  }

  onMediaTimeUpdate(positionMs: number, generation: number): void {
    if (generation !== this.state.generation) return;
    if (
      this.state.status !== "PLAYING" &&
      this.state.status !== "PAUSED" &&
      this.state.status !== "LOADING"
    ) {
      return;
    }
    if (!Number.isFinite(positionMs) || positionMs < 0) return;
    this.commit({
      positionMs: clampPositionMs(positionMs, this.state.durationMs),
    });
  }

  onMediaEnded(generation: number): void {
    if (generation !== this.state.generation) return;
    // STOP / PAUSE / ENDED / ERROR / IDLE must not advance playlist.
    if (this.state.status !== "PLAYING") return;

    if (this.state.repeatMode === "ITEM") {
      this.beginCurrentItem({ resetPosition: true });
      return;
    }

    const last = this.items.length - 1;
    const atLast = this.state.currentItemIndex >= last;

    if (atLast && this.state.repeatMode === "NONE") {
      this.commit({
        status: "ENDED",
        positionMs: this.state.durationMs ?? this.state.positionMs,
        error: null,
      });
      return;
    }

    // Default playlist progression (PLAYLIST or not at last)
    this.next();
  }

  onMediaError(
    code: string,
    message: string,
    recoverable: boolean,
    generation: number,
  ): void {
    if (generation !== this.state.generation) return;
    this.commit({
      status: "ERROR",
      error: {
        code,
        message,
        contentId: this.state.currentContentId ?? undefined,
        recoverable,
        occurredAt: this.now(),
      },
    });
  }

  /** Simulate IMAGE/GIF slide timer completing (controller-owned timing). */
  tickImageElapsed(elapsedMs: number, generation: number): void {
    if (generation !== this.state.generation) return;
    if (this.state.status !== "PLAYING") return;
    const duration = this.state.durationMs;
    if (duration == null) return;
    const position = clampPositionMs(elapsedMs, duration);
    this.commit({ positionMs: position });
    if (position >= duration) {
      this.onMediaEnded(generation);
    }
  }

  // ── Internals ────────────────────────────────────────────────────────

  private beginCurrentItem(opts: { resetPosition: boolean }): void {
    if (this.items.length === 0) return;
    this.applyItemAt(this.state.currentItemIndex, {
      resetPosition: opts.resetPosition,
      status: "LOADING",
    });
  }

  private selectIndex(
    index: number,
    opts: { resetPosition: boolean },
  ): void {
    if (this.items.length === 0) return;
    const safe = ((index % this.items.length) + this.items.length) % this.items.length;
    this.applyItemAt(safe, {
      resetPosition: opts.resetPosition,
      status: "LOADING",
    });
  }

  private applyItemAt(
    index: number,
    opts: {
      resetPosition: boolean;
      status: PlaybackStatus;
      playlistId?: string;
      manifestVersion?: number | null;
    },
  ): void {
    const item = this.items[index];
    if (!item) return;
    const durationMs = resolveItemDurationMs(item);
    this.commit({
      status: opts.status,
      playlistId: opts.playlistId ?? this.state.playlistId,
      manifestVersion:
        opts.manifestVersion !== undefined
          ? opts.manifestVersion
          : this.state.manifestVersion,
      currentItemIndex: index,
      currentContentId: item.contentId,
      currentContentType: parseContentType(item.type),
      currentPlaylistItemId: item.playlistItemId,
      positionMs: opts.resetPosition ? 0 : this.state.positionMs,
      durationMs,
      error: null,
      generation: this.state.generation + 1,
    });
  }

  private transition(to: PlaybackStatus): void {
    if (!canTransition(this.state.status, to)) return;
    this.commit({ status: to, error: to === "ERROR" ? this.state.error : null });
  }

  private commit(patch: Partial<PlaybackState>): void {
    if (patch.status && patch.status !== this.state.status) {
      if (!canTransition(this.state.status, patch.status)) {
        return;
      }
    }
    this.state = {
      ...this.state,
      ...patch,
      updatedAt: this.now(),
    };
    const snap = snapshotPlaybackState(this.state);
    for (const listener of this.listeners) {
      listener(snap);
    }
  }
}
