/**
 * RUNTIME-EXPERIENCE-07 — Experience Bridge Host (per-iframe instance).
 *
 * One instance ↔ one iframe.contentWindow + exact expectedOrigin.
 * Never uses targetOrigin "*". Never dynamic dispatch.
 */

import {
  BRIDGE_MAX_MESSAGE_BYTES,
  BRIDGE_MAX_PENDING,
  BRIDGE_METHOD_REGISTRY,
  BRIDGE_PROTOCOL_VERSION,
  BRIDGE_RATE_LIMIT_MAX,
  BRIDGE_RATE_LIMIT_WINDOW_MS,
  assertJsonSafeResult,
  buildBridgeErrorResponse,
  buildBridgeOkResponse,
  isBridgeMethodV1,
  originsEqual,
  parseBridgeRequest,
  type BridgeErrorCode,
  type BridgeLifecycle,
  type BridgeMessageLike,
  type BridgeMethodV1,
  type BridgeObservability,
  type BridgePermission,
  type BridgeRuntimeInfo,
  type BridgeViewport,
  type ExperienceBridgeResponse,
} from "@/domain/experience-bridge";

export type ExperienceBridgeHostServices = {
  getRuntimeInfo: () => BridgeRuntimeInfo;
  getViewport: () => BridgeViewport;
  getOrientation: () => BridgeViewport["orientation"];
  getTime: () => { iso: string; epochMs: number };
  now?: () => number;
};

export type ExperienceBridgeHostOptions = {
  tenantId: string;
  experienceId: string;
  version: string;
  /** Exact Experience origin, e.g. https://experience.example.com */
  expectedOrigin: string;
  /** Must be the iframe's contentWindow (identity comparison). */
  iframeWindow: Window;
  /** Granted permissions — missing ⇒ DENY. */
  permissions: ReadonlySet<BridgePermission> | BridgePermission[];
  /** Optional capability set; unused by V1 read methods unless specified. */
  capabilities?: ReadonlySet<string> | string[];
  services: ExperienceBridgeHostServices;
  maxMessageBytes?: number;
  rateLimitMax?: number;
  rateLimitWindowMs?: number;
  /** Where to attach the message listener (defaults to window). */
  listenTarget?: Window & typeof globalThis;
};

function toSet<T extends string>(
  v: ReadonlySet<T> | T[] | undefined,
): Set<T> {
  if (!v) return new Set();
  return v instanceof Set ? new Set(v) : new Set(v);
}

export class ExperienceBridgeHost {
  readonly tenantId: string;
  readonly experienceId: string;
  readonly version: string;
  readonly expectedOrigin: string;

  private iframeWindow: Window | null;
  private readonly permissions: Set<BridgePermission>;
  private readonly capabilities: Set<string>;
  private readonly services: ExperienceBridgeHostServices;
  private readonly maxBytes: number;
  private readonly rateMax: number;
  private readonly rateWindow: number;
  private readonly listenTarget: Window & typeof globalThis;

  private lifecycle: BridgeLifecycle = "CREATED";
  private readonly pendingIds = new Set<string>();
  private readonly completedIds = new Set<string>();
  private readonly rateTimestamps: number[] = [];
  private readonly obs: BridgeObservability = {
    requests: 0,
    accepted: 0,
    denied: 0,
    rateLimited: 0,
    timeouts: 0,
    errors: 0,
  };
  private readonly boundHandler: (event: MessageEvent) => void;
  private listening = false;

  constructor(opts: ExperienceBridgeHostOptions) {
    this.tenantId = opts.tenantId;
    this.experienceId = opts.experienceId;
    this.version = opts.version;
    this.expectedOrigin = opts.expectedOrigin;
    this.iframeWindow = opts.iframeWindow;
    this.permissions = toSet(opts.permissions);
    this.capabilities = toSet(opts.capabilities);
    this.services = opts.services;
    this.maxBytes = opts.maxMessageBytes ?? BRIDGE_MAX_MESSAGE_BYTES;
    this.rateMax = opts.rateLimitMax ?? BRIDGE_RATE_LIMIT_MAX;
    this.rateWindow = opts.rateLimitWindowMs ?? BRIDGE_RATE_LIMIT_WINDOW_MS;
    this.listenTarget =
      opts.listenTarget ??
      (typeof window !== "undefined"
        ? window
        : (globalThis as unknown as Window & typeof globalThis));
    this.boundHandler = (event: MessageEvent) => {
      this.handleMessage(event);
    };
  }

  getLifecycle(): BridgeLifecycle {
    return this.lifecycle;
  }

  getObservability(): BridgeObservability {
    return { ...this.obs };
  }

  /** Transition toward accepting traffic. */
  activate(): void {
    if (this.lifecycle === "STOPPED" || this.lifecycle === "STOPPING") return;
    this.lifecycle = "ACTIVE";
    this.ensureListening();
  }

  markReady(): void {
    if (this.lifecycle === "CREATED" || this.lifecycle === "WAITING") {
      this.lifecycle = "READY";
    }
    this.ensureListening();
  }

  private ensureListening(): void {
    if (this.listening) return;
    this.listenTarget.addEventListener("message", this.boundHandler);
    this.listening = true;
  }

  /**
   * Stop bridge: remove listener, clear state, invalidate window ref.
   * Fail closed afterward.
   */
  stop(): void {
    this.lifecycle = "STOPPING";
    if (this.listening) {
      this.listenTarget.removeEventListener("message", this.boundHandler);
      this.listening = false;
    }
    this.pendingIds.clear();
    this.completedIds.clear();
    this.rateTimestamps.length = 0;
    this.iframeWindow = null;
    this.lifecycle = "STOPPED";
  }

  /** Test / internal entry — same pipeline as the DOM listener. */
  handleMessage(event: BridgeMessageLike): void {
    this.obs.requests += 1;

    if (
      this.lifecycle === "STOPPED" ||
      this.lifecycle === "STOPPING" ||
      this.lifecycle === "ERROR"
    ) {
      this.deny(null, "BRIDGE_STOPPED", "Bridge stopped");
      return;
    }
    if (
      this.lifecycle === "CREATED" ||
      this.lifecycle === "WAITING"
    ) {
      this.deny(null, "BRIDGE_NOT_READY", "Bridge not ready");
      return;
    }

    // Source equality — identity, not duck-typing
    if (!this.iframeWindow || event.source !== this.iframeWindow) {
      this.deny(null, "BRIDGE_INVALID_SOURCE", "Invalid message source");
      return;
    }

    if (!originsEqual(event.origin, this.expectedOrigin)) {
      this.deny(null, "BRIDGE_INVALID_ORIGIN", "Invalid message origin");
      return;
    }

    const parsed = parseBridgeRequest(event.data, this.maxBytes);
    if (!parsed.ok) {
      this.deny(
        typeof (event.data as { requestId?: unknown })?.requestId === "string"
          ? ((event.data as { requestId: string }).requestId)
          : null,
        parsed.code,
        parsed.message,
      );
      return;
    }

    const { request } = parsed;

    if (this.pendingIds.has(request.requestId)) {
      this.deny(
        request.requestId,
        "BRIDGE_DUPLICATE_REQUEST_ID",
        "requestId already in flight",
      );
      return;
    }
    if (this.completedIds.has(request.requestId)) {
      this.deny(
        request.requestId,
        "BRIDGE_DUPLICATE_REQUEST_ID",
        "requestId already completed",
      );
      return;
    }
    if (this.pendingIds.size + this.completedIds.size >= BRIDGE_MAX_PENDING) {
      // prune oldest completed if needed
      if (this.completedIds.size > BRIDGE_MAX_PENDING / 2) {
        const first = this.completedIds.values().next().value;
        if (first) this.completedIds.delete(first);
      }
    }

    if (!this.checkRateLimit()) {
      this.obs.rateLimited += 1;
      this.deny(request.requestId, "BRIDGE_RATE_LIMITED", "Rate limit exceeded");
      return;
    }

    if (!isBridgeMethodV1(request.method)) {
      this.deny(
        request.requestId,
        "BRIDGE_METHOD_NOT_ALLOWED",
        "Method not allowed",
      );
      return;
    }

    const spec = BRIDGE_METHOD_REGISTRY[request.method];
    if (!this.permissions.has(spec.permission)) {
      this.deny(
        request.requestId,
        "BRIDGE_PERMISSION_DENIED",
        "Permission denied",
      );
      return;
    }
    if (spec.capability && !this.capabilities.has(spec.capability)) {
      this.deny(
        request.requestId,
        "BRIDGE_CAPABILITY_DENIED",
        "Capability denied",
      );
      return;
    }

    if (spec.allowParams === false) {
      const keys = request.params ? Object.keys(request.params) : [];
      if (keys.length > 0) {
        this.deny(
          request.requestId,
          "BRIDGE_INVALID_PARAMS",
          "Params not allowed for this method",
        );
        return;
      }
    }

    this.pendingIds.add(request.requestId);
    try {
      const result = this.dispatch(request.method);
      const safe = assertJsonSafeResult(result);
      if (!safe.ok) {
        this.obs.errors += 1;
        this.respond(
          buildBridgeErrorResponse(
            request.requestId,
            "BRIDGE_INTERNAL_ERROR",
            "Unsafe result",
          ),
        );
      } else {
        this.obs.accepted += 1;
        this.respond(buildBridgeOkResponse(request.requestId, result));
      }
    } catch {
      this.obs.errors += 1;
      this.respond(
        buildBridgeErrorResponse(
          request.requestId,
          "BRIDGE_INTERNAL_ERROR",
          "Handler failed",
        ),
      );
    } finally {
      this.pendingIds.delete(request.requestId);
      this.completedIds.add(request.requestId);
      if (this.completedIds.size > BRIDGE_MAX_PENDING) {
        const first = this.completedIds.values().next().value;
        if (first) this.completedIds.delete(first);
      }
    }
  }

  /**
   * Explicit method map — NEVER service[method](params).
   */
  private dispatch(method: BridgeMethodV1): unknown {
    switch (method) {
      case "runtime.getInfo":
        return this.services.getRuntimeInfo();
      case "runtime.getViewport":
        return this.services.getViewport();
      case "runtime.getOrientation":
        return { orientation: this.services.getOrientation() };
      case "runtime.getTime":
        return this.services.getTime();
      default: {
        // Exhaustiveness — TypeScript should prevent; fail closed
        const _x: never = method;
        void _x;
        throw new Error("unreachable");
      }
    }
  }

  private checkRateLimit(): boolean {
    const now = (this.services.now ?? Date.now)();
    while (
      this.rateTimestamps.length &&
      now - this.rateTimestamps[0]! > this.rateWindow
    ) {
      this.rateTimestamps.shift();
    }
    if (this.rateTimestamps.length >= this.rateMax) return false;
    this.rateTimestamps.push(now);
    return true;
  }

  private deny(
    requestId: string | null,
    code: BridgeErrorCode,
    message: string,
  ): void {
    this.obs.denied += 1;
    if (!requestId || !this.iframeWindow) return;
    // Only respond when we have a correlatable id and live window
    this.respond(buildBridgeErrorResponse(requestId, code, message));
  }

  private respond(response: ExperienceBridgeResponse): void {
    const win = this.iframeWindow;
    if (!win) return;
    // CRITICAL: exact targetOrigin — never "*"
    win.postMessage(response, this.expectedOrigin);
  }
}

export function createReadOnlyBridgeServices(input: {
  experienceOrigin: string;
  experienceId: string;
  version: string;
  runtimeVersion?: string;
  viewport?: BridgeViewport;
}): ExperienceBridgeHostServices {
  const viewport: BridgeViewport = input.viewport ?? {
    width: 1920,
    height: 1080,
    orientation: "LANDSCAPE",
  };
  return {
    getRuntimeInfo: () => ({
      runtimeVersion: input.runtimeVersion ?? "0.0.0-experience-bridge",
      bridgeProtocolVersion: BRIDGE_PROTOCOL_VERSION,
      experienceOrigin: input.experienceOrigin,
      experienceId: input.experienceId,
      version: input.version,
    }),
    getViewport: () => ({ ...viewport }),
    getOrientation: () => viewport.orientation,
    getTime: () => {
      const d = new Date();
      return { iso: d.toISOString(), epochMs: d.getTime() };
    },
  };
}
