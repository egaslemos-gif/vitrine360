/**
 * RUNTIME-EXPERIENCE-10 — Experience Runtime Core + Lifecycle (pure domain).
 *
 * Turns ADMITTED → LOADING → … → ACTIVE / ERROR / STOPPED / KILLED.
 * EXECUTION ≠ PRIVILEGE. No playback/device/playlist/schedule mutation.
 * No tokens, network proxy, storage API, fullscreen/orientation CONTROL.
 */

import type { ExperienceAdmissionGranted } from "@/domain/experience-admission";
import {
  buildExperienceServeUrl,
  type ExperienceOriginConfig,
} from "@/domain/experience-origin";
import { assertSafeExperienceIframeSrc } from "@/domain/experience-sandbox";

/** Host-side Experience instance lifecycle (EXPERIENCE-04 §16). */
export const EXPERIENCE_RUNTIME_PHASES = [
  "IDLE",
  "ADMITTED",
  "LOADING",
  "INIT",
  "READY",
  "ACTIVE",
  "PAUSED",
  "STOPPING",
  "STOPPED",
  "ERROR",
  "KILLED",
] as const;
export type ExperienceRuntimePhase = (typeof EXPERIENCE_RUNTIME_PHASES)[number];

export const EXPERIENCE_RUNTIME_ERROR_CODES = [
  "RUNTIME_NOT_ADMITTED",
  "RUNTIME_INVALID_SRC",
  "RUNTIME_ORIGIN_REJECTED",
  "RUNTIME_LOAD_TIMEOUT",
  "RUNTIME_LOAD_FAILED",
  "RUNTIME_FATAL",
  "RUNTIME_BRIDGE_FAILED",
  "RUNTIME_ALREADY_RUNNING",
  "RUNTIME_NOT_RUNNING",
  "RUNTIME_STOPPED",
  "RUNTIME_KILLED",
  "RUNTIME_INTERNAL",
] as const;
export type ExperienceRuntimeErrorCode =
  (typeof EXPERIENCE_RUNTIME_ERROR_CODES)[number];

/** Hard load watchdog — documented; fail closed to ERROR then stoppable. */
export const EXPERIENCE_RUNTIME_LOAD_TIMEOUT_MS = 15_000;

/**
 * Privilege matrix for this runtime phase — all DENY / DEFERRED.
 * Execution never upgrades these.
 */
export const EXPERIENCE_RUNTIME_PRIVILEGES = {
  NETWORK: "DENY",
  STORAGE: "DENY",
  CAMERA: "DENY",
  MICROPHONE: "DENY",
  GEOLOCATION: "DENY",
  DISPLAY_CAPTURE: "DENY",
  BLUETOOTH: "DENY",
  USB: "DENY",
  SERIAL: "DENY",
  FULLSCREEN: "DEFERRED",
  ORIENTATION: "DEFERRED",
  DEVICE_CONTROL: "DENY",
  PLAYBACK_CONTROL: "DENY",
  AUTH: "DENY",
  ADMIN_API: "DENY",
} as const;

export type ExperienceRuntimePrivileges =
  typeof EXPERIENCE_RUNTIME_PRIVILEGES;

const TRANSITIONS: Record<
  ExperienceRuntimePhase,
  readonly ExperienceRuntimePhase[]
> = {
  IDLE: ["ADMITTED", "ERROR"],
  ADMITTED: ["LOADING", "STOPPED", "KILLED", "ERROR"],
  LOADING: ["INIT", "ERROR", "STOPPING", "KILLED"],
  INIT: ["READY", "ERROR", "STOPPING", "KILLED"],
  READY: ["ACTIVE", "PAUSED", "STOPPING", "ERROR", "KILLED"],
  ACTIVE: ["PAUSED", "STOPPING", "ERROR", "KILLED"],
  PAUSED: ["ACTIVE", "STOPPING", "ERROR", "KILLED"],
  STOPPING: ["STOPPED", "KILLED", "ERROR"],
  STOPPED: ["IDLE", "ADMITTED"],
  ERROR: ["STOPPING", "STOPPED", "KILLED", "IDLE"],
  KILLED: ["IDLE"],
};

export function canTransitionRuntime(
  from: ExperienceRuntimePhase,
  to: ExperienceRuntimePhase,
): boolean {
  return TRANSITIONS[from].includes(to);
}

export type ExperienceRuntimeError = {
  code: ExperienceRuntimeErrorCode;
  message: string;
  at: number;
};

/** Safe host diagnostics — never tokens/cookies/secrets. */
export type ExperienceRuntimeSnapshot = {
  phase: ExperienceRuntimePhase;
  tenantId: string | null;
  deviceId: string | null;
  experienceId: string | null;
  version: string | null;
  packageSha256: string | null;
  entrypointUrl: string | null;
  expectedOrigin: string | null;
  bridgeEnabled: boolean;
  privileges: ExperienceRuntimePrivileges;
  error: ExperienceRuntimeError | null;
  startedAt: number | null;
  updatedAt: number;
  loadTimeoutMs: number;
};

export function createIdleRuntimeSnapshot(
  now = Date.now(),
): ExperienceRuntimeSnapshot {
  return {
    phase: "IDLE",
    tenantId: null,
    deviceId: null,
    experienceId: null,
    version: null,
    packageSha256: null,
    entrypointUrl: null,
    expectedOrigin: null,
    bridgeEnabled: false,
    privileges: EXPERIENCE_RUNTIME_PRIVILEGES,
    error: null,
    startedAt: null,
    updatedAt: now,
    loadTimeoutMs: EXPERIENCE_RUNTIME_LOAD_TIMEOUT_MS,
  };
}

export type ExperienceRuntimeStartInput = {
  granted: ExperienceAdmissionGranted;
  experienceOrigin: ExperienceOriginConfig;
  /**
   * Absolute entrypoint URL override (tests). Must still pass src safety.
   * Default: dedicated-origin `/x/{tenant}/{id}/{version}` (+ entrypoint path).
   */
  entrypointUrl?: string;
  /** When false, sandbox loads without Controlled Bridge (not recommended). */
  enableBridge?: boolean;
  loadTimeoutMs?: number;
  now?: number;
};

export type ExperienceRuntimeStartPlan =
  | {
      ok: true;
      entrypointUrl: string;
      expectedOrigin: string;
      enableBridge: boolean;
      loadTimeoutMs: number;
      bridgePermissions: ["RUNTIME_READ"];
      bridgeCapabilities: string[];
      snapshotBase: Omit<
        ExperienceRuntimeSnapshot,
        "phase" | "error" | "updatedAt" | "startedAt" | "bridgeEnabled"
      >;
    }
  | {
      ok: false;
      code: ExperienceRuntimeErrorCode;
      message: string;
    };

/**
 * Build fail-closed start plan from an admission grant.
 * Does not mutate Player / Device / Playlist.
 */
export function planExperienceRuntimeStart(
  input: ExperienceRuntimeStartInput,
): ExperienceRuntimeStartPlan {
  const g = input.granted;
  const entry =
    input.entrypointUrl ??
    buildExperienceServeUrl(
      {
        tenantId: g.tenantId,
        experienceId: g.experienceId,
        version: g.version,
        assetPath: g.manifest.entrypoint,
      },
      input.experienceOrigin,
    );

  const safe = assertSafeExperienceIframeSrc(entry, input.experienceOrigin);
  if (!safe.ok) {
    return {
      ok: false,
      code: "RUNTIME_INVALID_SRC",
      message: safe.reason,
    };
  }

  let expectedOrigin: string;
  try {
    expectedOrigin = new URL(entry, input.experienceOrigin.origin ?? undefined)
      .origin;
  } catch {
    return {
      ok: false,
      code: "RUNTIME_ORIGIN_REJECTED",
      message: "Cannot resolve Experience origin from entrypoint URL",
    };
  }

  if (
    input.experienceOrigin.origin &&
    expectedOrigin !== input.experienceOrigin.origin
  ) {
    return {
      ok: false,
      code: "RUNTIME_ORIGIN_REJECTED",
      message: "Entrypoint origin does not match EXPERIENCE_ORIGIN",
    };
  }

  const loadTimeoutMs =
    input.loadTimeoutMs ?? EXPERIENCE_RUNTIME_LOAD_TIMEOUT_MS;
  const enableBridge = input.enableBridge !== false;

  return {
    ok: true,
    entrypointUrl: entry,
    expectedOrigin,
    enableBridge,
    loadTimeoutMs,
    bridgePermissions: ["RUNTIME_READ"],
    bridgeCapabilities: [...g.effectiveCapabilities],
    snapshotBase: {
      tenantId: g.tenantId,
      deviceId: g.deviceId,
      experienceId: g.experienceId,
      version: g.version,
      packageSha256: g.packageSha256,
      entrypointUrl: entry,
      expectedOrigin,
      privileges: EXPERIENCE_RUNTIME_PRIVILEGES,
      loadTimeoutMs,
    },
  };
}

/**
 * Pure lifecycle controller — no DOM. Host wires iframe/bridge events in.
 */
export class ExperienceRuntimeController {
  private snapshot: ExperienceRuntimeSnapshot;
  private loadTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly onChange?: (s: ExperienceRuntimeSnapshot) => void;
  private readonly nowFn: () => number;

  constructor(opts?: {
    onChange?: (s: ExperienceRuntimeSnapshot) => void;
    now?: () => number;
  }) {
    this.onChange = opts?.onChange;
    this.nowFn = opts?.now ?? Date.now;
    this.snapshot = createIdleRuntimeSnapshot(this.nowFn());
  }

  getSnapshot(): ExperienceRuntimeSnapshot {
    return { ...this.snapshot, privileges: EXPERIENCE_RUNTIME_PRIVILEGES };
  }

  /**
   * Bind an admission grant and move IDLE → ADMITTED → LOADING.
   */
  start(input: ExperienceRuntimeStartInput): ExperienceRuntimeSnapshot {
    if (
      this.snapshot.phase !== "IDLE" &&
      this.snapshot.phase !== "STOPPED" &&
      this.snapshot.phase !== "KILLED" &&
      this.snapshot.phase !== "ERROR"
    ) {
      return this.fail("RUNTIME_ALREADY_RUNNING", "Runtime already running");
    }

    // Reset from terminal states
    if (
      this.snapshot.phase === "STOPPED" ||
      this.snapshot.phase === "KILLED" ||
      this.snapshot.phase === "ERROR"
    ) {
      this.clearLoadTimer();
      this.snapshot = createIdleRuntimeSnapshot(this.nowFn());
      this.emit();
    }

    const plan = planExperienceRuntimeStart(input);
    if (!plan.ok) {
      return this.fail(plan.code, plan.message);
    }

    const now = this.nowFn();
    this.snapshot = {
      ...createIdleRuntimeSnapshot(now),
      ...plan.snapshotBase,
      phase: "ADMITTED",
      bridgeEnabled: plan.enableBridge,
      startedAt: now,
      updatedAt: now,
      error: null,
    };
    this.emit();

    this.transition("LOADING");
    this.armLoadTimeout(plan.loadTimeoutMs);
    return this.getSnapshot();
  }

  /** Iframe element created / about to navigate. */
  markInit(): ExperienceRuntimeSnapshot {
    if (this.snapshot.phase === "LOADING") this.transition("INIT");
    return this.getSnapshot();
  }

  /** iframe onLoad success. */
  markReady(): ExperienceRuntimeSnapshot {
    if (this.snapshot.phase === "INIT" || this.snapshot.phase === "LOADING") {
      this.clearLoadTimer();
      if (this.snapshot.phase === "LOADING") this.transition("INIT");
      this.transition("READY");
      this.transition("ACTIVE");
    }
    return this.getSnapshot();
  }

  markLoadFailed(message = "Entrypoint failed to load"): ExperienceRuntimeSnapshot {
    this.clearLoadTimer();
    return this.fail("RUNTIME_LOAD_FAILED", message);
  }

  markFatal(message = "Fatal Experience error"): ExperienceRuntimeSnapshot {
    this.clearLoadTimer();
    return this.fail("RUNTIME_FATAL", message);
  }

  pause(): ExperienceRuntimeSnapshot {
    if (this.snapshot.phase === "ACTIVE") this.transition("PAUSED");
    return this.getSnapshot();
  }

  resume(): ExperienceRuntimeSnapshot {
    if (this.snapshot.phase === "PAUSED") this.transition("ACTIVE");
    return this.getSnapshot();
  }

  /**
   * Graceful stop — Host tear-down. Does not require Experience cooperation.
   */
  stop(): ExperienceRuntimeSnapshot {
    this.clearLoadTimer();
    if (
      this.snapshot.phase === "STOPPED" ||
      this.snapshot.phase === "IDLE" ||
      this.snapshot.phase === "KILLED"
    ) {
      return this.getSnapshot();
    }
    if (this.snapshot.phase !== "STOPPING") {
      if (!canTransitionRuntime(this.snapshot.phase, "STOPPING")) {
        // Force via ERROR path then stop
        this.snapshot = {
          ...this.snapshot,
          phase: "STOPPING",
          updatedAt: this.nowFn(),
        };
        this.emit();
      } else {
        this.transition("STOPPING");
      }
    }
    this.transition("STOPPED");
    // Clear execution identity but keep last error if any
    this.snapshot = {
      ...this.snapshot,
      entrypointUrl: null,
      bridgeEnabled: false,
      updatedAt: this.nowFn(),
    };
    this.emit();
    return this.getSnapshot();
  }

  /**
   * Immediate kill switch — Host authority, no Experience cooperation.
   */
  kill(reason = "Host kill switch"): ExperienceRuntimeSnapshot {
    this.clearLoadTimer();
    const now = this.nowFn();
    this.snapshot = {
      ...this.snapshot,
      phase: "KILLED",
      bridgeEnabled: false,
      entrypointUrl: null,
      error: {
        code: "RUNTIME_KILLED",
        message: reason,
        at: now,
      },
      updatedAt: now,
    };
    this.emit();
    return this.getSnapshot();
  }

  /** True when iframe should be mounted. */
  shouldMountFrame(): boolean {
    return (
      this.snapshot.phase === "LOADING" ||
      this.snapshot.phase === "INIT" ||
      this.snapshot.phase === "READY" ||
      this.snapshot.phase === "ACTIVE" ||
      this.snapshot.phase === "PAUSED"
    );
  }

  private armLoadTimeout(ms: number): void {
    this.clearLoadTimer();
    this.loadTimer = setTimeout(() => {
      if (
        this.snapshot.phase === "LOADING" ||
        this.snapshot.phase === "INIT"
      ) {
        this.fail("RUNTIME_LOAD_TIMEOUT", `Load exceeded ${ms}ms`);
      }
    }, ms);
  }

  private clearLoadTimer(): void {
    if (this.loadTimer) {
      clearTimeout(this.loadTimer);
      this.loadTimer = null;
    }
  }

  private transition(to: ExperienceRuntimePhase): void {
    if (!canTransitionRuntime(this.snapshot.phase, to)) {
      this.fail(
        "RUNTIME_INTERNAL",
        `Illegal transition ${this.snapshot.phase} → ${to}`,
      );
      return;
    }
    this.snapshot = {
      ...this.snapshot,
      phase: to,
      updatedAt: this.nowFn(),
      error: to === "ERROR" ? this.snapshot.error : this.snapshot.error,
    };
    if (to !== "ERROR") {
      // keep error until STOPPED clears optionally — leave as-is for diagnostics
    }
    this.emit();
  }

  private fail(
    code: ExperienceRuntimeErrorCode,
    message: string,
  ): ExperienceRuntimeSnapshot {
    const now = this.nowFn();
    const err: ExperienceRuntimeError = { code, message, at: now };
    if (canTransitionRuntime(this.snapshot.phase, "ERROR")) {
      this.snapshot = {
        ...this.snapshot,
        phase: "ERROR",
        error: err,
        bridgeEnabled: false,
        updatedAt: now,
      };
    } else {
      this.snapshot = {
        ...this.snapshot,
        error: err,
        bridgeEnabled: false,
        updatedAt: now,
      };
    }
    this.emit();
    return this.getSnapshot();
  }

  private emit(): void {
    this.onChange?.(this.getSnapshot());
  }

  /** Test helper — dispose timers. */
  dispose(): void {
    this.clearLoadTimer();
  }
}

/** Safe log line — no secrets. */
export function summarizeRuntimeSnapshot(
  s: ExperienceRuntimeSnapshot,
): Record<string, unknown> {
  return {
    phase: s.phase,
    experienceId: s.experienceId,
    version: s.version,
    deviceId: s.deviceId,
    tenantId: s.tenantId,
    bridgeEnabled: s.bridgeEnabled,
    errorCode: s.error?.code ?? null,
    updatedAt: s.updatedAt,
  };
}
