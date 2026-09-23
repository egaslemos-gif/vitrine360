/**
 * RUNTIME-POLICY-08B — Single Orientation controller.
 *
 * Observation (type / viewport) is always separate from lock control.
 * Only authorized site for screen.orientation.lock / unlock.
 * Does NOT call requestFullscreen — FullscreenController owns that.
 * No automatic retry loops. No vendor prefixes.
 */

import {
  assertNoAuthTokenExposure,
  observeOrientationActual,
  type OrientationControlStatus,
  type OrientationPolicy,
  type RuntimeOrientationActual,
  type RuntimePolicyActualDiagnostic,
} from "@/domain/runtime-policy";
import { getRuntimeState, updateRuntimeState } from "@/player/runtime/state";

export type OrientationLockTarget = "landscape" | "portrait";

export type OrientationApiSurface = {
  observationAvailable: boolean;
  lockAvailable: boolean;
  getType: () => string | null;
  lock: (target: OrientationLockTarget) => Promise<void>;
  unlock: () => void;
  addChangeListener: (listener: EventListener) => void;
  removeChangeListener: (listener: EventListener) => void;
  addResizeListener: (listener: EventListener) => void;
  removeResizeListener: (listener: EventListener) => void;
  getViewport: () => { innerWidth: number; innerHeight: number };
};

export type OrientationControllerOptions = {
  api?: OrientationApiSurface | null;
  /** DetectedRuntimeCapabilities.orientation (observation hint). */
  capabilityOrientation?: boolean;
  /**
   * Player paints into the viewport — prefer aspect for actual (POLICY-06).
   * Spec type-first path available when false (unit / API verification).
   */
  preferViewportForActual?: boolean;
  onDiagnostic?: (d: RuntimePolicyActualDiagnostic) => void;
};

export type OrientationSnapshot = {
  status: OrientationControlStatus;
  locked: boolean;
  lockedTarget: OrientationLockTarget | null;
  observationAvailable: boolean;
  lockAvailable: boolean;
  capability: boolean;
  actual: RuntimeOrientationActual;
  lastDiagnosticCode: string | null;
  requestInFlight: boolean;
  lockCount: number;
  requiresFullscreen: boolean;
};

export function mapPolicyToLockTarget(
  orientation: OrientationPolicy,
): OrientationLockTarget | null {
  if (orientation === "LANDSCAPE") return "landscape";
  if (orientation === "PORTRAIT") return "portrait";
  return null;
}

function browserApi(): OrientationApiSurface | null {
  if (typeof window === "undefined" || typeof screen === "undefined") {
    return null;
  }
  const orient = screen.orientation as ScreenOrientation | null | undefined;
  if (!orient) {
    return {
      observationAvailable: false,
      lockAvailable: false,
      getType: () => null,
      lock: async () => {
        throw Object.assign(new Error("Orientation API unavailable"), {
          name: "TypeError",
        });
      },
      unlock: () => undefined,
      addChangeListener: () => undefined,
      removeChangeListener: () => undefined,
      addResizeListener: (listener) =>
        window.addEventListener("resize", listener),
      removeResizeListener: (listener) =>
        window.removeEventListener("resize", listener),
      getViewport: () => ({
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
      }),
    };
  }
  const lockFn = (orient as ScreenOrientation & {
    lock?: (o: string) => Promise<void>;
  }).lock;
  const unlockFn = (orient as ScreenOrientation & {
    unlock?: () => void;
  }).unlock;
  return {
    observationAvailable: typeof orient.type === "string",
    lockAvailable: typeof lockFn === "function",
    getType: () => {
      try {
        return orient.type ?? null;
      } catch {
        return null;
      }
    },
    lock: async (target) => {
      if (typeof lockFn !== "function") {
        throw Object.assign(new Error("orientation.lock unavailable"), {
          name: "TypeError",
        });
      }
      await lockFn.call(orient, target);
    },
    unlock: () => {
      if (typeof unlockFn === "function") {
        unlockFn.call(orient);
      }
    },
    addChangeListener: (listener) => {
      try {
        orient.addEventListener("change", listener);
      } catch {
        /* ignore */
      }
    },
    removeChangeListener: (listener) => {
      try {
        orient.removeEventListener("change", listener);
      } catch {
        /* ignore */
      }
    },
    addResizeListener: (listener) =>
      window.addEventListener("resize", listener),
    removeResizeListener: (listener) =>
      window.removeEventListener("resize", listener),
    getViewport: () => ({
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
    }),
  };
}

export function classifyOrientationLockError(err: unknown): {
  code: string;
  severity: "INFO" | "WARNING";
  message: string;
} {
  const name =
    err && typeof err === "object" && "name" in err
      ? String((err as { name?: string }).name)
      : "";
  const msg =
    err instanceof Error
      ? err.message.slice(0, 160)
      : String(err).slice(0, 160);
  if (/fullscreen/i.test(msg)) {
    return {
      code: "ORIENTATION_REQUIRES_FULLSCREEN",
      severity: "INFO",
      message:
        "Orientation lock requires fullscreen — use FullscreenController first",
    };
  }
  if (name === "NotAllowedError" || /not.?allowed|permission/i.test(msg)) {
    return {
      code: "ORIENTATION_LOCK_NOT_ALLOWED",
      severity: "WARNING",
      message: "Orientation lock not allowed in this context",
    };
  }
  if (
    name === "TypeError" ||
    name === "NotSupportedError" ||
    /unavailable|not supported|not a function/i.test(msg)
  ) {
    return {
      code: "ORIENTATION_LOCK_UNAVAILABLE",
      severity: "WARNING",
      message: "Orientation lock API unavailable",
    };
  }
  return {
    code: "ORIENTATION_LOCK_FAILED",
    severity: "WARNING",
    message: `Orientation lock failed${name ? ` (${name})` : ""}`,
  };
}

export class OrientationController {
  private readonly api: OrientationApiSurface | null;
  private readonly capability: boolean;
  private readonly preferViewportForActual: boolean;
  private readonly onDiagnostic?: (
    d: RuntimePolicyActualDiagnostic,
  ) => void;
  private status: OrientationControlStatus = "IDLE";
  private lastDiagnosticCode: string | null = null;
  private requestInFlight = false;
  private lockCount = 0;
  private attached = false;
  private resolvedOrientation: OrientationPolicy = "AUTO";
  private lockedTarget: OrientationLockTarget | null = null;
  private requiresFullscreen = false;
  private readonly onChange: EventListener;
  private readonly onResize: EventListener;

  constructor(options: OrientationControllerOptions = {}) {
    this.api =
      options.api === undefined ? browserApi() : options.api;
    this.capability = options.capabilityOrientation !== false;
    this.preferViewportForActual = options.preferViewportForActual !== false;
    this.onDiagnostic = options.onDiagnostic;
    this.onChange = () => this.syncObservation("change");
    this.onResize = () => this.syncObservation("resize");
    if (!this.lockCapable()) {
      this.status = this.observationCapable() ? "IDLE" : "UNAVAILABLE";
      if (!this.lockCapable() && !this.observationCapable()) {
        this.status = "UNAVAILABLE";
      }
    }
  }

  start(): void {
    if (!this.api || this.attached) return;
    this.api.addChangeListener(this.onChange);
    this.api.addResizeListener(this.onResize);
    this.attached = true;
    this.syncObservation("start");
  }

  dispose(): void {
    if (this.api && this.attached) {
      this.api.removeChangeListener(this.onChange);
      this.api.removeResizeListener(this.onResize);
    }
    this.attached = false;
    this.requestInFlight = false;
  }

  setResolvedOrientation(orientation: OrientationPolicy): void {
    const prev = this.resolvedOrientation;
    this.resolvedOrientation = orientation;
    if (orientation === "AUTO" && this.lockedTarget != null) {
      void this.unlock();
    } else if (
      prev !== orientation &&
      (orientation === "LANDSCAPE" || orientation === "PORTRAIT")
    ) {
      // Policy changed — do not auto-lock; wait for evaluate / explicit / fullscreen.
      this.publishState();
    } else {
      this.publishState();
    }
  }

  /** Called when FullscreenController reports active change — never requests FS. */
  onFullscreenActiveChange(active: boolean): void {
    if (!active) {
      // Browser may auto-unlock; reflect observation only — no reaction loops.
      this.syncObservation("fullscreen-exit");
      this.publishState();
      return;
    }
    // Fullscreen became active: re-evaluate; may attempt lock if eligible.
    void this.tryLockIfEligible({ source: "fullscreen", userActivation: true });
  }

  snapshot(): OrientationSnapshot {
    return {
      status: this.status,
      locked: this.status === "LOCKED" && this.lockedTarget != null,
      lockedTarget: this.lockedTarget,
      observationAvailable: this.observationCapable(),
      lockAvailable: this.lockCapable(),
      capability: this.capability,
      actual: this.readActual(),
      lastDiagnosticCode: this.lastDiagnosticCode,
      requestInFlight: this.requestInFlight,
      lockCount: this.lockCount,
      requiresFullscreen: this.requiresFullscreen,
    };
  }

  observationCapable(): boolean {
    return Boolean(this.api?.observationAvailable) || Boolean(this.api);
  }

  lockCapable(): boolean {
    return Boolean(this.api?.lockAvailable) && this.capability;
  }

  readActual(): RuntimeOrientationActual {
    if (!this.api) {
      // Even without Orientation API, viewport observation may still work.
      if (typeof window !== "undefined") {
        return observeOrientationActual({
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight,
        });
      }
      return "UNKNOWN";
    }
    const vp = this.api.getViewport();
    const type = this.api.getType();
    if (this.preferViewportForActual) {
      const fromVp = observeOrientationActual({
        innerWidth: vp.innerWidth,
        innerHeight: vp.innerHeight,
      });
      if (fromVp !== "UNKNOWN") return fromVp;
      return observeOrientationActual({ orientationType: type });
    }
    const fromType = observeOrientationActual({ orientationType: type });
    if (fromType !== "UNKNOWN") return fromType;
    return observeOrientationActual({
      innerWidth: vp.innerWidth,
      innerHeight: vp.innerHeight,
    });
  }

  canLockOrientation(params?: {
    fullscreenActive?: boolean;
  }): {
    ok: boolean;
    code: string | null;
    requiresFullscreen: boolean;
  } {
    if (this.resolvedOrientation === "AUTO") {
      return { ok: false, code: "ORIENTATION_POLICY_AUTO", requiresFullscreen: false };
    }
    const target = mapPolicyToLockTarget(this.resolvedOrientation);
    if (!target) {
      return { ok: false, code: "ORIENTATION_POLICY_AUTO", requiresFullscreen: false };
    }
    if (!this.lockCapable() || !this.api) {
      return {
        ok: false,
        code: "ORIENTATION_LOCK_UNAVAILABLE",
        requiresFullscreen: false,
      };
    }
    if (this.requestInFlight) {
      return {
        ok: false,
        code: "ORIENTATION_REQUEST_IN_FLIGHT",
        requiresFullscreen: this.requiresFullscreen,
      };
    }
    if (this.lockedTarget === target && this.status === "LOCKED") {
      return { ok: false, code: "ORIENTATION_ALREADY_LOCKED", requiresFullscreen: false };
    }
    const fs =
      params?.fullscreenActive ??
      (() => {
        try {
          return getRuntimeState().fullscreenActive;
        } catch {
          return false;
        }
      })();
    // Do not invent a universal "fullscreen required" rule — only hint when
    // a prior browser rejection indicated it, or when not fullscreen yet
    // (soft eligibility note — still allow attempt; browser decides).
    if (this.requiresFullscreen && !fs) {
      return {
        ok: false,
        code: "ORIENTATION_REQUIRES_FULLSCREEN",
        requiresFullscreen: true,
      };
    }
    return { ok: true, code: null, requiresFullscreen: false };
  }

  /**
   * Boot — observe only; never force lock without eligibility / activation path.
   */
  evaluateBoot(): void {
    this.syncObservation("boot");
    if (!this.lockCapable()) {
      if (this.resolvedOrientation === "LANDSCAPE" ||
        this.resolvedOrientation === "PORTRAIT") {
        if (this.lastDiagnosticCode !== "ORIENTATION_LOCK_UNAVAILABLE") {
          this.emitDiagnostic({
            code: "ORIENTATION_LOCK_UNAVAILABLE",
            severity: "WARNING",
            message:
              "Orientation lock unavailable — observation continues; playback unaffected",
          });
        }
        this.status = "UNAVAILABLE";
      }
      this.publishState();
      return;
    }
    if (
      (this.resolvedOrientation === "LANDSCAPE" ||
        this.resolvedOrientation === "PORTRAIT") &&
      this.status !== "LOCKED"
    ) {
      const elig = this.canLockOrientation();
      if (elig.code === "ORIENTATION_REQUIRES_FULLSCREEN") {
        if (this.lastDiagnosticCode !== "ORIENTATION_REQUIRES_FULLSCREEN") {
          this.emitDiagnostic({
            code: "ORIENTATION_REQUIRES_FULLSCREEN",
            severity: "INFO",
            message:
              "É necessário entrar em ecrã inteiro para bloquear a orientação.",
          });
        }
      }
      // Boot does not call lock — wait for fullscreen active or explicit user lock.
    }
    this.publishState();
  }

  async lock(params: {
    userActivation: boolean;
    source?: "boot" | "user" | "fullscreen" | "test";
  }): Promise<{ ok: boolean; code: string | null }> {
    return this.tryLockIfEligible(params);
  }

  private async tryLockIfEligible(params: {
    userActivation: boolean;
    source?: "boot" | "user" | "fullscreen" | "test";
  }): Promise<{ ok: boolean; code: string | null }> {
    if (params.source === "boot" && !params.userActivation) {
      return { ok: false, code: "ORIENTATION_LOCK_NOT_ALLOWED" };
    }
    const elig = this.canLockOrientation();
    if (elig.code === "ORIENTATION_ALREADY_LOCKED") {
      return { ok: true, code: "ORIENTATION_LOCK_ACTIVE" };
    }
    if (elig.code === "ORIENTATION_POLICY_AUTO") {
      return { ok: false, code: "ORIENTATION_POLICY_AUTO" };
    }
    if (elig.code === "ORIENTATION_REQUEST_IN_FLIGHT") {
      return { ok: false, code: "ORIENTATION_REQUEST_IN_FLIGHT" };
    }
    if (elig.code === "ORIENTATION_LOCK_UNAVAILABLE") {
      this.status = "UNAVAILABLE";
      this.emitDiagnostic({
        code: "ORIENTATION_LOCK_UNAVAILABLE",
        severity: "WARNING",
        message: "Orientation lock API unavailable",
      });
      this.publishState();
      return { ok: false, code: "ORIENTATION_LOCK_UNAVAILABLE" };
    }
    if (elig.code === "ORIENTATION_REQUIRES_FULLSCREEN") {
      this.emitDiagnostic({
        code: "ORIENTATION_REQUIRES_FULLSCREEN",
        severity: "INFO",
        message:
          "É necessário entrar em ecrã inteiro para bloquear a orientação.",
      });
      this.publishState();
      return { ok: false, code: "ORIENTATION_REQUIRES_FULLSCREEN" };
    }
    if (!params.userActivation && params.source !== "fullscreen") {
      this.emitDiagnostic({
        code: "ORIENTATION_LOCK_NOT_ALLOWED",
        severity: "INFO",
        message: "Orientation lock not attempted — user activation absent",
      });
      this.publishState();
      return { ok: false, code: "ORIENTATION_LOCK_NOT_ALLOWED" };
    }

    const target = mapPolicyToLockTarget(this.resolvedOrientation);
    if (!target || !this.api) {
      return { ok: false, code: "ORIENTATION_LOCK_UNAVAILABLE" };
    }

    this.requestInFlight = true;
    this.lockCount += 1;
    this.status = "REQUESTING";
    this.publishState();

    try {
      await this.api.lock(target);
      // Promise ≠ actual — re-observe.
      this.lockedTarget = target;
      this.status = "LOCKED";
      this.requiresFullscreen = false;
      this.syncObservation("lock-resolved");
      this.emitDiagnostic({
        code: "ORIENTATION_LOCK_ACTIVE",
        severity: "INFO",
        message: `Orientation lock active (${target})`,
      });
      this.publishState();
      return { ok: true, code: "ORIENTATION_LOCK_ACTIVE" };
    } catch (err) {
      const classified = classifyOrientationLockError(err);
      if (classified.code === "ORIENTATION_REQUIRES_FULLSCREEN") {
        this.requiresFullscreen = true;
      }
      this.status = "FAILED";
      this.lockedTarget = null;
      this.emitDiagnostic({
        code: classified.code,
        severity: classified.severity,
        message: classified.message,
      });
      this.publishState();
      return { ok: false, code: classified.code };
    } finally {
      this.requestInFlight = false;
      if (this.status === "REQUESTING") {
        this.status = "IDLE";
        this.publishState();
      }
    }
  }

  async unlock(): Promise<{ ok: boolean }> {
    if (!this.api) return { ok: false };
    if (this.lockedTarget == null && this.status !== "LOCKED") {
      this.status = this.lockCapable() ? "IDLE" : "UNAVAILABLE";
      this.publishState();
      return { ok: true };
    }
    try {
      this.api.unlock();
      this.lockedTarget = null;
      this.status = "IDLE";
      this.syncObservation("unlock");
      this.emitDiagnostic({
        code: "ORIENTATION_LOCK_EXITED",
        severity: "INFO",
        message: "Orientation lock released",
      });
      this.publishState();
      return { ok: true };
    } catch {
      this.syncObservation("unlock-error");
      this.publishState();
      return { ok: false };
    }
  }

  private syncObservation(_source: string): void {
    void _source;
    const actual = this.readActual();
    try {
      updateRuntimeState({ orientationActual: actual });
    } catch {
      /* observational */
    }
    this.publishState();
  }

  private emitDiagnostic(d: RuntimePolicyActualDiagnostic): void {
    this.lastDiagnosticCode = d.code;
    this.onDiagnostic?.(d);
  }

  private publishState(): void {
    const actual = this.readActual();
    const partial = {
      orientationActual: actual,
      orientationStatus: this.status,
      orientationDiagnosticCode: this.lastDiagnosticCode,
    };
    assertNoAuthTokenExposure(partial as unknown as Record<string, unknown>);
    try {
      updateRuntimeState(partial);
    } catch {
      /* must not break controller */
    }
  }
}

let singleton: OrientationController | null = null;

export function getOrientationController(): OrientationController | null {
  return singleton;
}

export function setOrientationController(
  controller: OrientationController | null,
): void {
  singleton = controller;
}
