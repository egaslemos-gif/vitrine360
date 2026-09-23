/**
 * RUNTIME-POLICY-08A — Single Fullscreen controller.
 *
 * Only authorized site for requestFullscreen / exitFullscreen.
 * Actual state always derived from document.fullscreenElement.
 * No automatic retry loops. No vendor prefixes without evidence.
 */

import {
  assertNoAuthTokenExposure,
  type FullscreenControlStatus,
  type PresentationMode,
  type RuntimePolicyActualDiagnostic,
} from "@/domain/runtime-policy";
import { getOrientationController } from "@/player/runtime/orientation";
import { updateRuntimeState } from "@/player/runtime/state";

export type FullscreenApiSurface = {
  fullscreenEnabled: boolean;
  getFullscreenElement: () => Element | null;
  requestFullscreen: (el: Element) => Promise<void>;
  exitFullscreen: () => Promise<void>;
  addEventListener: (
    type: "fullscreenchange" | "fullscreenerror",
    listener: EventListener,
  ) => void;
  removeEventListener: (
    type: "fullscreenchange" | "fullscreenerror",
    listener: EventListener,
  ) => void;
};

export type FullscreenControllerOptions = {
  /** Stable PlayerRuntimeShell root. */
  getTarget: () => Element | null;
  /** Injected for tests. */
  api?: FullscreenApiSurface | null;
  /** Whether DetectedRuntimeCapabilities.fullscreen is true. */
  capabilityFullscreen?: boolean;
  onDiagnostic?: (d: RuntimePolicyActualDiagnostic) => void;
};

export type FullscreenSnapshot = {
  status: FullscreenControlStatus;
  active: boolean;
  apiAvailable: boolean;
  capability: boolean;
  lastDiagnosticCode: string | null;
  requestInFlight: boolean;
  requestCount: number;
};

function browserApi(): FullscreenApiSurface | null {
  if (typeof document === "undefined") return null;
  const doc = document as Document & {
    fullscreenEnabled?: boolean;
    exitFullscreen?: () => Promise<void>;
  };
  const proto = Element.prototype as Element & {
    requestFullscreen?: () => Promise<void>;
  };
  if (
    typeof doc.fullscreenEnabled !== "boolean" ||
    typeof proto.requestFullscreen !== "function" ||
    typeof doc.exitFullscreen !== "function"
  ) {
    return null;
  }
  return {
    fullscreenEnabled: doc.fullscreenEnabled === true,
    getFullscreenElement: () => document.fullscreenElement,
    requestFullscreen: (el) => {
      const fn = (
        el as Element & { requestFullscreen: () => Promise<void> }
      ).requestFullscreen;
      return fn.call(el);
    },
    exitFullscreen: () => doc.exitFullscreen!.call(document),
    addEventListener: (type, listener) =>
      document.addEventListener(type, listener),
    removeEventListener: (type, listener) =>
      document.removeEventListener(type, listener),
  };
}

function classifyFullscreenError(err: unknown): {
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
  if (name === "NotAllowedError" || /user.?activation|permission/i.test(msg)) {
    return {
      code: "FULLSCREEN_USER_ACTIVATION_REQUIRED",
      severity: "INFO",
      message:
        "Fullscreen request not allowed — transient user activation required",
    };
  }
  if (name === "TypeError" || /unavailable|not supported/i.test(msg)) {
    return {
      code: "FULLSCREEN_UNAVAILABLE",
      severity: "WARNING",
      message: "Fullscreen API unavailable or not supported in this context",
    };
  }
  return {
    code: "FULLSCREEN_REQUEST_FAILED",
    severity: "WARNING",
    message: `Fullscreen request failed${name ? ` (${name})` : ""}`,
  };
}

export class FullscreenController {
  private readonly getTarget: () => Element | null;
  private readonly api: FullscreenApiSurface | null;
  private readonly capability: boolean;
  private readonly onDiagnostic?: (
    d: RuntimePolicyActualDiagnostic,
  ) => void;
  private status: FullscreenControlStatus = "IDLE";
  private lastDiagnosticCode: string | null = null;
  private requestInFlight = false;
  private requestCount = 0;
  private attached = false;
  private resolvedPresentation: PresentationMode = "AUTO";
  private lastPublishedActive: boolean | null = null;
  private readonly onChange: EventListener;
  private readonly onError: EventListener;

  constructor(options: FullscreenControllerOptions) {
    this.getTarget = options.getTarget;
    this.api =
      options.api === undefined ? browserApi() : options.api;
    this.capability = options.capabilityFullscreen !== false;
    this.onDiagnostic = options.onDiagnostic;
    this.onChange = () => this.syncFromDocument("change");
    this.onError = () => {
      this.emitDiagnostic({
        code: "FULLSCREEN_REQUEST_FAILED",
        severity: "WARNING",
        message: "fullscreenerror event",
      });
      this.syncFromDocument("error");
    };
    if (!this.api || !this.api.fullscreenEnabled || !this.capability) {
      this.status = "UNAVAILABLE";
    }
  }

  start(): void {
    if (!this.api || this.attached) return;
    this.api.addEventListener("fullscreenchange", this.onChange);
    this.api.addEventListener("fullscreenerror", this.onError);
    this.attached = true;
    this.syncFromDocument("start");
  }

  dispose(): void {
    if (this.api && this.attached) {
      this.api.removeEventListener("fullscreenchange", this.onChange);
      this.api.removeEventListener("fullscreenerror", this.onError);
    }
    this.attached = false;
    this.requestInFlight = false;
  }

  setResolvedPresentation(presentation: PresentationMode): void {
    this.resolvedPresentation = presentation;
    if (presentation === "WINDOWED" && this.isActive()) {
      // Policy WINDOWED: do not auto-exit here (user may have entered manually).
      // Automatic exit is only via explicit exit() when UI asks.
    }
    this.publishState();
  }

  snapshot(): FullscreenSnapshot {
    return {
      status: this.status,
      active: this.isActive(),
      apiAvailable: Boolean(this.api?.fullscreenEnabled),
      capability: this.capability,
      lastDiagnosticCode: this.lastDiagnosticCode,
      requestInFlight: this.requestInFlight,
      requestCount: this.requestCount,
    };
  }

  isActive(): boolean {
    try {
      return this.api?.getFullscreenElement() != null;
    } catch {
      return false;
    }
  }

  apiAvailable(): boolean {
    return Boolean(this.api?.fullscreenEnabled) && this.capability;
  }

  /**
   * Boot evaluation — never calls requestFullscreen without activation.
   */
  evaluateBoot(): void {
    if (!this.apiAvailable()) {
      this.status = "UNAVAILABLE";
      if (this.lastDiagnosticCode !== "FULLSCREEN_UNAVAILABLE") {
        this.emitDiagnostic({
          code: "FULLSCREEN_UNAVAILABLE",
          severity: "WARNING",
          message: "Fullscreen API unavailable — runtime stays WINDOWED",
        });
      }
      this.publishState();
      return;
    }
    if (this.resolvedPresentation === "FULLSCREEN" && !this.isActive()) {
      if (this.lastDiagnosticCode !== "FULLSCREEN_USER_ACTIVATION_REQUIRED") {
        this.emitDiagnostic({
          code: "FULLSCREEN_USER_ACTIVATION_REQUIRED",
          severity: "INFO",
          message:
            "Resolved FULLSCREEN deferred until explicit user activation (no automatic request)",
        });
      }
    }
    this.publishState();
  }

  /**
   * Enter fullscreen. Requires:
   * - resolved presentation FULLSCREEN (or force for explicit UI when policy allows)
   * - API available
   * - not already active / in flight
   * - userActivation=true (caller must pass true only from gesture handler)
   */
  async request(params: {
    userActivation: boolean;
    /** Explicit UI may request even if already evaluating; still blocked for WINDOWED. */
    source?: "boot" | "user" | "test";
  }): Promise<{ ok: boolean; code: string | null }> {
    if (this.resolvedPresentation === "WINDOWED") {
      return { ok: false, code: "FULLSCREEN_POLICY_WINDOWED" };
    }
    if (this.resolvedPresentation !== "FULLSCREEN") {
      // AUTO may resolve to FULLSCREEN before setResolvedPresentation; still require FULLSCREEN.
      if (params.source !== "test") {
        return { ok: false, code: "FULLSCREEN_POLICY_NOT_FULLSCREEN" };
      }
    }
    if (!this.apiAvailable() || !this.api) {
      this.status = "UNAVAILABLE";
      this.emitDiagnostic({
        code: "FULLSCREEN_UNAVAILABLE",
        severity: "WARNING",
        message: "Fullscreen API unavailable",
      });
      this.publishState();
      return { ok: false, code: "FULLSCREEN_UNAVAILABLE" };
    }
    if (this.isActive()) {
      this.status = "ACTIVE";
      this.publishState();
      return { ok: true, code: "FULLSCREEN_ACTIVE" };
    }
    if (this.requestInFlight) {
      return { ok: false, code: "FULLSCREEN_REQUEST_IN_FLIGHT" };
    }
    if (!params.userActivation) {
      this.emitDiagnostic({
        code: "FULLSCREEN_USER_ACTIVATION_REQUIRED",
        severity: "INFO",
        message: "Fullscreen not requested — user activation absent",
      });
      this.publishState();
      return { ok: false, code: "FULLSCREEN_USER_ACTIVATION_REQUIRED" };
    }

    const target = this.getTarget();
    if (!target) {
      this.emitDiagnostic({
        code: "FULLSCREEN_REQUEST_FAILED",
        severity: "WARNING",
        message: "Fullscreen target element missing",
      });
      return { ok: false, code: "FULLSCREEN_REQUEST_FAILED" };
    }

    this.requestInFlight = true;
    this.requestCount += 1;
    this.status = "REQUESTING";
    this.publishState();

    try {
      await this.api.requestFullscreen(target);
      // Fact comes from fullscreenchange / fullscreenElement — not Promise alone.
      this.syncFromDocument("request-resolved");
      if (this.isActive()) {
        this.emitDiagnostic({
          code: "FULLSCREEN_ACTIVE",
          severity: "INFO",
          message: "Fullscreen active (document.fullscreenElement set)",
        });
        return { ok: true, code: "FULLSCREEN_ACTIVE" };
      }
      // Promise resolved but element not fullscreen yet — wait for event; stay REQUESTING briefly
      return { ok: true, code: null };
    } catch (err) {
      const classified = classifyFullscreenError(err);
      this.status = "FAILED";
      this.emitDiagnostic({
        code: classified.code,
        severity: classified.severity,
        message: classified.message,
      });
      this.publishState();
      return { ok: false, code: classified.code };
    } finally {
      this.requestInFlight = false;
      if (!this.isActive() && this.status === "REQUESTING") {
        this.status = "IDLE";
        this.publishState();
      }
    }
  }

  async exit(): Promise<{ ok: boolean }> {
    if (!this.api) return { ok: false };
    if (!this.isActive()) {
      this.status = "IDLE";
      this.publishState();
      return { ok: true };
    }
    try {
      await this.api.exitFullscreen();
      this.syncFromDocument("exit");
      this.emitDiagnostic({
        code: "FULLSCREEN_EXITED",
        severity: "INFO",
        message: "Fullscreen exited",
      });
      return { ok: true };
    } catch {
      this.syncFromDocument("exit-error");
      return { ok: false };
    }
  }

  /** Reason string for PRESENTATION_NOT_ACTUALLY_FULLSCREEN. */
  notActiveReason(): string | null {
    if (this.isActive()) return null;
    if (!this.apiAvailable()) return "Fullscreen API is unavailable";
    if (this.lastDiagnosticCode === "FULLSCREEN_USER_ACTIVATION_REQUIRED") {
      return "user activation is required";
    }
    if (this.lastDiagnosticCode === "FULLSCREEN_REQUEST_FAILED") {
      return "the browser rejected the fullscreen request";
    }
    if (this.status === "FAILED") {
      return "a previous fullscreen request failed";
    }
    return "fullscreen has not been requested yet or is waiting for user activation";
  }

  private syncFromDocument(_source: string): void {
    const active = this.isActive();
    if (active) {
      this.status = "ACTIVE";
    } else if (this.status === "ACTIVE" || this.status === "REQUESTING") {
      this.status = "IDLE";
      if (_source === "change") {
        this.emitDiagnostic({
          code: "FULLSCREEN_EXITED",
          severity: "INFO",
          message: "Fullscreen exited (fullscreenchange)",
        });
      }
    } else if (!this.apiAvailable()) {
      this.status = "UNAVAILABLE";
    }
    this.publishState();
  }

  private emitDiagnostic(d: RuntimePolicyActualDiagnostic): void {
    // Avoid spam: same code consecutively is fine once; still update last code.
    this.lastDiagnosticCode = d.code;
    this.onDiagnostic?.(d);
  }

  private publishState(): void {
    const active = this.isActive();
    const partial = {
      fullscreenActive: active,
      fullscreenStatus: this.status,
      fullscreenDiagnosticCode: this.lastDiagnosticCode,
    };
    assertNoAuthTokenExposure(partial as unknown as Record<string, unknown>);
    try {
      updateRuntimeState(partial);
    } catch {
      /* observational store must not break controller */
    }
    if (this.lastPublishedActive !== active) {
      this.lastPublishedActive = active;
      try {
        getOrientationController()?.onFullscreenActiveChange(active);
      } catch {
        /* orientation must not break fullscreen */
      }
    }
  }
}

/** Singleton accessor for Player shell. */
let singleton: FullscreenController | null = null;

export function getFullscreenController(): FullscreenController | null {
  return singleton;
}

export function setFullscreenController(
  controller: FullscreenController | null,
): void {
  singleton = controller;
}
