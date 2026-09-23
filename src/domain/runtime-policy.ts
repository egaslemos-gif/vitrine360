/**
 * RUNTIME-POLICY-01 — Display Runtime Policy contracts (architecture hardening).
 *
 * Pure domain: no DOM, no DB, no Player wiring.
 * Distinguishes Device Configuration vs Domain Policy vs Detected Capabilities
 * vs Resolved Policy vs Runtime State vs Telemetry.
 *
 * Naming note: `src/player/runtime/passive.ts` exports a different
 * `RuntimeCapabilities` (product flavour flags). Prefer
 * `DetectedRuntimeCapabilities` for browser facts.
 */

import type { DisplayType, InteractionMode } from "@/domain/types";

/** Desired presentation chrome — not the same as PWA manifest `display`. */
export const PRESENTATION_MODES = ["FULLSCREEN", "WINDOWED", "AUTO"] as const;
export type PresentationMode = (typeof PRESENTATION_MODES)[number];

export const CURSOR_POLICIES = ["HIDDEN", "AUTO_HIDE", "VISIBLE"] as const;
export type CursorPolicy = (typeof CURSOR_POLICIES)[number];

/**
 * Input classes. Remote IR often surfaces as keydown — when indistinguishable,
 * classify as KEYBOARD_LIKE rather than inventing REMOTE detection.
 */
export const INPUT_CLASSES = [
  "REMOTE",
  "KEYBOARD",
  "MOUSE",
  "TOUCH",
  "KEYBOARD_LIKE",
] as const;
export type InputClass = (typeof INPUT_CLASSES)[number];

/** Policy-level interaction (ADR-006 Interactive Runtime remains deferred). */
export const INTERACTION_POLICIES = ["PASSIVE", "INTERACTIVE"] as const;
export type InteractionPolicy = (typeof INTERACTION_POLICIES)[number];

export const ORIENTATION_POLICIES = ["AUTO", "LANDSCAPE", "PORTRAIT"] as const;
export type OrientationPolicy = (typeof ORIENTATION_POLICIES)[number];

/** Admin-stable Device fields relevant to runtime (not ephemeral state). */
export type DeviceConfigurationSlice = {
  tenantId: string;
  deviceId: string;
  displayType: DisplayType;
  interactionMode: InteractionMode;
  orientationStored: "landscape" | "portrait" | string;
  timezone: string | null;
  status: string;
};

/**
 * Wire shape returned by bootstrap claim / heartbeat for policy enrichment.
 * No tokens, secrets, or hashes.
 */
export type DevicePolicyConfigWire = {
  tenantId: string | null;
  deviceId: string;
  displayType: string;
  interactionMode: string;
  orientation: string;
  timezone: string | null;
  status: string;
};

export function toDevicePolicyConfigWire(device: {
  id: string;
  tenantId: string | null;
  displayType: string;
  interactionMode: string;
  orientation: string;
  timezone: string | null;
  status: string;
}): DevicePolicyConfigWire {
  return {
    tenantId: device.tenantId,
    deviceId: device.id,
    displayType: device.displayType,
    interactionMode: device.interactionMode,
    orientation: device.orientation,
    timezone: device.timezone,
    status: device.status,
  };
}

/**
 * Desired behaviour — Domain Runtime Policy.
 * Not persisted as DeviceRuntimeConfig in POLICY-01 (no new table).
 */
export type DomainRuntimePolicy = {
  presentation: PresentationMode;
  cursor: CursorPolicy;
  /** Allowed / expected input classes for this device policy. */
  input: InputClass[];
  interaction: InteractionPolicy;
  orientation: OrientationPolicy;
};

/** Browser/runtime facts — “detected support”, not admin desire. */
export type DetectedRuntimeCapabilities = {
  video: boolean;
  image: boolean;
  gif: boolean;
  touch: boolean;
  pointer: boolean;
  keyboard: boolean;
  /** True only with positive evidence of distinct remote; else false. */
  remote: boolean;
  fullscreen: boolean;
  orientation: boolean;
  network: boolean;
  serviceWorker: boolean;
  indexedDB: boolean;
};

export type PolicyFallback = {
  field: keyof DomainRuntimePolicy;
  requested: string;
  resolved: string;
  reason: string;
};

/** Observable result of resolveRuntimePolicy(). */
export type ResolvedRuntimePolicy = DomainRuntimePolicy & {
  tenantId: string;
  deviceId: string;
  fallbacks: PolicyFallback[];
  diagnostics: string[];
};

/** Ephemeral player facts — not admin configuration. */
export const RUNTIME_SYNC_STATES = [
  "IDLE",
  "SYNCING",
  "READY",
  "ERROR",
] as const;
export type RuntimeSyncState = (typeof RUNTIME_SYNC_STATES)[number];

export const RUNTIME_NETWORK_STATES = [
  "ONLINE",
  "OFFLINE",
  "UNKNOWN",
] as const;
export type RuntimeNetworkState = (typeof RUNTIME_NETWORK_STATES)[number];

export const RUNTIME_ORIENTATION_ACTUALS = [
  "LANDSCAPE",
  "PORTRAIT",
  "UNKNOWN",
] as const;
export type RuntimeOrientationActual =
  (typeof RUNTIME_ORIENTATION_ACTUALS)[number];

export const FULLSCREEN_CONTROL_STATUSES = [
  "IDLE",
  "REQUESTING",
  "ACTIVE",
  "FAILED",
  "UNAVAILABLE",
] as const;
export type FullscreenControlStatus =
  (typeof FULLSCREEN_CONTROL_STATUSES)[number];

export const ORIENTATION_CONTROL_STATUSES = [
  "IDLE",
  "REQUESTING",
  "LOCKED",
  "FAILED",
  "UNAVAILABLE",
] as const;
export type OrientationControlStatus =
  (typeof ORIENTATION_CONTROL_STATUSES)[number];

export type RuntimeStateContract = {
  isPlaying: boolean;
  currentContentId: string | null;
  currentManifestVersion: number | null;
  syncState: RuntimeSyncState;
  networkState: RuntimeNetworkState;
  cursorVisible: boolean;
  fullscreenActive: boolean;
  /** Fullscreen controller status (POLICY-08A). */
  fullscreenStatus: FullscreenControlStatus;
  /** Last safe diagnostic code for fullscreen control. */
  fullscreenDiagnosticCode: string | null;
  orientationActual: RuntimeOrientationActual;
  /** Orientation lock controller status (POLICY-08B). */
  orientationStatus: OrientationControlStatus;
  /** Last safe diagnostic code for orientation lock. */
  orientationDiagnosticCode: string | null;
  /** Epoch ms of last classified input; null if never. */
  lastInputAt: number | null;
  lastInputClass: InputClass | null;
  updatedAt: number;
};

export const INITIAL_RUNTIME_STATE: RuntimeStateContract = {
  isPlaying: false,
  currentContentId: null,
  currentManifestVersion: null,
  syncState: "IDLE",
  networkState: "UNKNOWN",
  cursorVisible: false,
  fullscreenActive: false,
  fullscreenStatus: "IDLE",
  fullscreenDiagnosticCode: null,
  orientationActual: "UNKNOWN",
  orientationStatus: "IDLE",
  orientationDiagnosticCode: null,
  lastInputAt: null,
  lastInputClass: null,
  updatedAt: 0,
};

export type RuntimeDiagnosticSeverity = "INFO" | "WARNING" | "ERROR";

export type RuntimePolicyActualDiagnostic = {
  code: string;
  severity: RuntimeDiagnosticSeverity;
  message: string;
};

/**
 * Compare resolved policy desire vs observational actual state.
 * Divergences are INFO/WARNING — not hard failures.
 */
export function diagnosePolicyVsActual(params: {
  resolvedPresentation: PresentationMode;
  resolvedOrientation: OrientationPolicy;
  fullscreenActive: boolean;
  orientationActual: RuntimeOrientationActual;
  /** Why fullscreen is not active when resolved wants FULLSCREEN. */
  fullscreenReason?: string | null;
}): RuntimePolicyActualDiagnostic[] {
  const out: RuntimePolicyActualDiagnostic[] = [];
  if (
    params.resolvedPresentation === "FULLSCREEN" &&
    !params.fullscreenActive
  ) {
    const reason =
      params.fullscreenReason?.trim() ||
      "fullscreen is not currently active";
    out.push({
      code: "PRESENTATION_NOT_ACTUALLY_FULLSCREEN",
      severity: "INFO",
      message: `Resolved presentation FULLSCREEN but fullscreen is not active because ${reason}`,
    });
  }
  if (
    (params.resolvedOrientation === "LANDSCAPE" ||
      params.resolvedOrientation === "PORTRAIT") &&
    params.orientationActual !== "UNKNOWN" &&
    params.orientationActual !== params.resolvedOrientation
  ) {
    out.push({
      code: "ORIENTATION_MISMATCH",
      severity: "WARNING",
      message: `Resolved orientation ${params.resolvedOrientation} but actual is ${params.orientationActual}`,
    });
  }
  return out;
}

/** Map screen.orientation.type / viewport aspect → actual orientation. */
export function observeOrientationActual(params: {
  orientationType?: string | null;
  innerWidth?: number;
  innerHeight?: number;
}): RuntimeOrientationActual {
  const t = (params.orientationType ?? "").toLowerCase();
  if (t.includes("landscape")) return "LANDSCAPE";
  if (t.includes("portrait")) return "PORTRAIT";
  const w = params.innerWidth;
  const h = params.innerHeight;
  if (typeof w === "number" && typeof h === "number") {
    if (w > h) return "LANDSCAPE";
    if (h > w) return "PORTRAIT";
  }
  return "UNKNOWN";
}

/** Observability signals — not configuration, not capabilities. */
export type RuntimeTelemetryContract = {
  lastHeartbeatAt: string | null;
  lastSyncAt: string | null;
  syncDurationMs: number | null;
  assetDownloadFailures: number;
  runtimeErrors: number;
  inputEventCount: number;
  fullscreenFailures: number;
};

/** Fields that must never appear on policy / capability / state surfaces. */
export const RUNTIME_POLICY_FORBIDDEN_KEYS = [
  "deviceToken",
  "deviceTokenHash",
  "pairingSecret",
  "pairingSecretHash",
  "authSecret",
  "AUTH_SECRET",
  "passwordHash",
  "authorization",
  "cookie",
] as const;

export const DEFAULT_DOMAIN_RUNTIME_POLICY: DomainRuntimePolicy = {
  presentation: "AUTO",
  cursor: "AUTO_HIDE",
  input: ["KEYBOARD_LIKE", "MOUSE", "TOUCH"],
  interaction: "PASSIVE",
  orientation: "AUTO",
};

export const UNKNOWN_CAPABILITIES: DetectedRuntimeCapabilities = {
  video: false,
  image: false,
  gif: false,
  touch: false,
  pointer: false,
  keyboard: false,
  remote: false,
  fullscreen: false,
  orientation: false,
  network: false,
  serviceWorker: false,
  indexedDB: false,
};

/** Where DomainRuntimePolicy came from (diagnostics only — not a secret). */
export const RUNTIME_POLICY_SOURCES = [
  "DEVICE_CONFIG",
  "DEFAULT",
  "EXPLICIT",
] as const;
export type RuntimePolicySource = (typeof RUNTIME_POLICY_SOURCES)[number];

/**
 * Normalize Device.orientation (DB: landscape|portrait|auto) → policy enum.
 * Accepts mixed case; unknown → AUTO.
 */
export function orientationStoredToPolicy(
  orientationStored: string | null | undefined,
): OrientationPolicy {
  const o = String(orientationStored ?? "auto")
    .trim()
    .toLowerCase();
  if (o === "portrait") return "PORTRAIT";
  if (o === "landscape") return "LANDSCAPE";
  if (o === "auto") return "AUTO";
  return "AUTO";
}

/**
 * Derive a DomainRuntimePolicy from existing Device configuration
 * without inventing a DeviceRuntimeConfig table.
 *
 * displayType is hardware context only — it must NOT imply FULLSCREEN.
 * Presentation stays AUTO unless an explicit DomainRuntimePolicy overrides it.
 * timezone is intentionally omitted (Schedule/Device concern, not policy).
 */
export function defaultPolicyFromDeviceConfig(
  device: Pick<
    DeviceConfigurationSlice,
    "interactionMode" | "displayType" | "orientationStored"
  >,
): DomainRuntimePolicy {
  void device.displayType; // hardware/context — not presentation chrome
  const interaction: InteractionPolicy =
    device.interactionMode === "PASSIVE" ? "PASSIVE" : "INTERACTIVE";

  return {
    ...DEFAULT_DOMAIN_RUNTIME_POLICY,
    presentation: "AUTO",
    interaction,
    orientation: orientationStoredToPolicy(device.orientationStored),
    cursor: "AUTO_HIDE",
    // input stays DEFAULT (KEYBOARD_LIKE + MOUSE + TOUCH) — no remote invent
  };
}

/**
 * Precedence:
 * 1. Explicit domain policy
 * 2. Runtime capability
 * 3. Environment constraint (injected as capability/env flags)
 * 4. Safe fallback
 */
export function resolveRuntimePolicy(params: {
  tenantId: string;
  deviceId: string;
  policy: DomainRuntimePolicy;
  capabilities: DetectedRuntimeCapabilities;
  /** Optional environment hints (e.g. fragile TV → treat fullscreen as false). */
  environment?: { fragileSmartTv?: boolean; userActivationAvailable?: boolean };
}): ResolvedRuntimePolicy {
  const fallbacks: PolicyFallback[] = [];
  const diagnostics: string[] = [];
  const env = params.environment ?? {};

  let presentation = params.policy.presentation;
  const fullscreenCapable =
    params.capabilities.fullscreen &&
    env.fragileSmartTv !== true &&
    (env.userActivationAvailable !== false || presentation !== "FULLSCREEN");

  if (presentation === "FULLSCREEN" && !fullscreenCapable) {
    fallbacks.push({
      field: "presentation",
      requested: "FULLSCREEN",
      resolved: "WINDOWED",
      reason: !params.capabilities.fullscreen
        ? "capabilities.fullscreen=false"
        : env.fragileSmartTv
          ? "environment.fragileSmartTv — no Hisense-specific hack; treat as unsupported until evidenced"
          : "environment.userActivation unavailable for Fullscreen API",
    });
    diagnostics.push(
      "Requested FULLSCREEN resolved to WINDOWED (capability/environment). PWA display:fullscreen is a separate mechanism.",
    );
    presentation = "WINDOWED";
  } else if (presentation === "AUTO") {
    presentation = fullscreenCapable ? "FULLSCREEN" : "WINDOWED";
    diagnostics.push(
      `AUTO presentation resolved to ${presentation} from capabilities.fullscreen=${params.capabilities.fullscreen}`,
    );
  }

  let orientation = params.policy.orientation;
  if (
    (orientation === "LANDSCAPE" || orientation === "PORTRAIT") &&
    !params.capabilities.orientation
  ) {
    fallbacks.push({
      field: "orientation",
      requested: orientation,
      resolved: "AUTO",
      reason: "capabilities.orientation=false — do not call screen.orientation.lock",
    });
    diagnostics.push(`Orientation lock ${orientation} unavailable; resolved AUTO`);
    orientation = "AUTO";
  }

  const interaction = params.policy.interaction;
  if (interaction === "INTERACTIVE") {
    diagnostics.push(
      "INTERACTIVE_NOT_IMPLEMENTED — Interactive Runtime not shipped; playback remains PASSIVE",
    );
    if (!params.capabilities.touch && !params.capabilities.pointer) {
      diagnostics.push(
        "INTERACTIVE policy with no touch/pointer capability — UI must remain passive until Interactive Runtime ships",
      );
    }
  }

  const input = [...params.policy.input];
  if (!params.capabilities.remote && input.includes("REMOTE")) {
    const idx = input.indexOf("REMOTE");
    input[idx] = "KEYBOARD_LIKE";
    fallbacks.push({
      field: "input",
      requested: "REMOTE",
      resolved: "KEYBOARD_LIKE",
      reason:
        "capabilities.remote=false — remote IR not evidenced; classify as KEYBOARD_LIKE (not KEYBOARD invent)",
    });
    diagnostics.push(
      "REMOTE → KEYBOARD_LIKE (no vendor remote evidence; key events remain KEYBOARD_LIKE)",
    );
  }

  return {
    tenantId: params.tenantId,
    deviceId: params.deviceId,
    presentation,
    cursor: params.policy.cursor,
    input,
    interaction,
    orientation,
    fallbacks,
    diagnostics,
  };
}

/** Classify DOM-ish events into InputClass without inventing REMOTE. */
export function classifyInputEvent(kind: string): InputClass {
  switch (kind) {
    case "touchstart":
    case "touchend":
    case "touchmove":
      return "TOUCH";
    case "mousemove":
    case "mousedown":
    case "mouseup":
    case "pointermove":
    case "pointerdown":
      return "MOUSE";
    case "keydown":
    case "keyup":
    case "keypress":
      return "KEYBOARD_LIKE";
    default:
      return "KEYBOARD_LIKE";
  }
}

export function assertTenantDeviceScope(
  sessionTenantId: string,
  deviceTenantId: string,
  deviceId: string,
  policyDeviceId: string,
): void {
  if (sessionTenantId !== deviceTenantId) {
    throw new Error("Tenant isolation: policy tenant mismatch");
  }
  if (deviceId !== policyDeviceId) {
    throw new Error("Device isolation: policy device mismatch");
  }
}

/** Reject objects that leak auth/token material into policy surfaces. */
export function assertNoAuthTokenExposure(surface: Record<string, unknown>): void {
  const keys = Object.keys(surface);
  for (const forbidden of RUNTIME_POLICY_FORBIDDEN_KEYS) {
    if (keys.some((k) => k.toLowerCase() === forbidden.toLowerCase())) {
      throw new Error(`Forbidden key on runtime policy surface: ${forbidden}`);
    }
  }
  for (const [k, v] of Object.entries(surface)) {
    if (typeof v === "string" && /bearer\s+[a-z0-9._-]+/i.test(v)) {
      throw new Error(`Possible bearer token in field ${k}`);
    }
  }
}

/**
 * Cursor contract documentation helper — desired AUTO_HIDE behaviour.
 * Does not apply CSS; used by architectural tests.
 */
export function cursorVisibleAfterInput(
  policy: CursorPolicy,
  idleMs: number,
  sinceLastInputMs: number,
): boolean {
  if (policy === "VISIBLE") return true;
  if (policy === "HIDDEN") return false;
  // AUTO_HIDE
  return sinceLastInputMs < idleMs;
}

export const CURSOR_IDLE_MS = 3000;
