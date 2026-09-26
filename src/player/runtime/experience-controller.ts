/**
 * RUNTIME-EXPERIENCE-11 — Experience Playback Controller (Device Runtime adapter).
 *
 * Orchestrates: admit → Runtime Core handle → stop/cleanup.
 * Does NOT import sandbox/bridge/registry internals or storage providers.
 * Playback Engine talks only to this adapter + ExperienceRuntimeShell.
 */

import type {
  ExperienceAdmissionDecision,
  ExperienceAdmissionGranted,
} from "@/domain/experience-admission";
import {
  ExperienceRuntimeController,
  type ExperienceRuntimePhase,
  type ExperienceRuntimeSnapshot,
} from "@/domain/experience-runtime";
import type { ExperienceOriginConfig } from "@/domain/experience-origin";

export type ExperiencePlaybackInput = {
  granted: ExperienceAdmissionGranted;
  experienceOrigin: ExperienceOriginConfig;
  enableBridge?: boolean;
  loadTimeoutMs?: number;
};

export type ExperienceRuntimeHandle = {
  snapshot: () => ExperienceRuntimeSnapshot;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  dispose: () => void;
};

export type ExperienceRuntimeState = {
  phase: ExperienceRuntimePhase;
  running: boolean;
  experienceId: string | null;
  version: string | null;
  errorCode: string | null;
};

/**
 * Single-instance Experience host for Player playback.
 * Ensures at most one Runtime Core controller is active.
 */
export class ExperiencePlaybackController {
  private core: ExperienceRuntimeController | null = null;
  private granted: ExperienceAdmissionGranted | null = null;

  isRunning(): boolean {
    const phase = this.core?.getSnapshot().phase;
    return (
      phase === "LOADING" ||
      phase === "INIT" ||
      phase === "READY" ||
      phase === "ACTIVE" ||
      phase === "PAUSED"
    );
  }

  getState(): ExperienceRuntimeState {
    const snap = this.core?.getSnapshot();
    return {
      phase: snap?.phase ?? "IDLE",
      running: this.isRunning(),
      experienceId: snap?.experienceId ?? this.granted?.experienceId ?? null,
      version: snap?.version ?? this.granted?.version ?? null,
      errorCode: snap?.error?.code ?? null,
    };
  }

  async start(input: ExperiencePlaybackInput): Promise<ExperienceRuntimeHandle> {
    if (this.core && this.isRunning()) {
      await this.stop();
    }

    this.granted = input.granted;
    const core = new ExperienceRuntimeController();
    this.core = core;

    const snap = core.start({
      granted: input.granted,
      experienceOrigin: input.experienceOrigin,
      enableBridge: input.enableBridge,
      loadTimeoutMs: input.loadTimeoutMs,
    });

    if (snap.phase === "ERROR" || snap.error) {
      const code = snap.error?.code ?? "RUNTIME_INTERNAL";
      const message = snap.error?.message ?? "Experience runtime failed to start";
      this.core = null;
      this.granted = null;
      core.dispose();
      throw new Error(`${code}: ${message}`);
    }

    core.markInit();

    return {
      snapshot: () => core.getSnapshot(),
      stop: () => {
        core.stop();
      },
      pause: () => {
        core.pause();
      },
      resume: () => {
        core.resume();
      },
      dispose: () => {
        core.stop();
        core.dispose();
        if (this.core === core) {
          this.core = null;
          this.granted = null;
        }
      },
    };
  }

  async stop(): Promise<void> {
    if (!this.core) return;
    this.core.stop();
    this.core.dispose();
    this.core = null;
    this.granted = null;
  }

  async pause(): Promise<void> {
    this.core?.pause();
  }

  async resume(): Promise<void> {
    this.core?.resume();
  }
}

/** Map admission decision to a player-safe status code. */
export function playbackStatusFromAdmission(
  decision: ExperienceAdmissionDecision,
): { ok: true; granted: ExperienceAdmissionGranted } | { ok: false; code: string; message: string } {
  if (decision.outcome === "ADMIT") {
    return { ok: true, granted: decision.granted };
  }
  return {
    ok: false,
    code: decision.code,
    message: decision.message,
  };
}

/** Parse EXPERIENCE pin from playback payload. */
export function parsePlaybackExperiencePin(
  payload: Record<string, unknown> | null | undefined,
): { experienceId: string; version: string } | null {
  const exp = payload?.experience;
  if (!exp || typeof exp !== "object") return null;
  const o = exp as Record<string, unknown>;
  const experienceId = typeof o.experienceId === "string" ? o.experienceId.trim() : "";
  const version = typeof o.version === "string" ? o.version.trim() : "";
  if (!experienceId || !version) return null;
  return { experienceId, version };
}
