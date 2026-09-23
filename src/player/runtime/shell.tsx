"use client";

import { useEffect, useRef, useState } from "react";
import { CursorIdleController } from "@/player/runtime/cursor-idle";
import {
  CAPABILITIES_GLOBAL_KEY,
  probeRuntimeCapabilities,
} from "@/player/runtime/capabilities";
import {
  DEVICE_CONFIG_UPDATED_EVENT,
  localConfigToDevicePolicyInput,
  readLocalConfigSync,
} from "@/player/runtime/device-config";
import {
  RUNTIME_POLICY_GLOBAL_KEY,
  resolvePlayerRuntimePolicy,
  resolvedCursorPolicy,
  type RuntimePolicyBundle,
} from "@/player/runtime/resolve-policy";
import {
  FullscreenController,
  getFullscreenController,
  setFullscreenController,
} from "@/player/runtime/fullscreen";
import {
  OrientationController,
  getOrientationController,
  setOrientationController,
} from "@/player/runtime/orientation";
import {
  getRuntimeStateStore,
  subscribeRuntimeState,
  updateRuntimeState,
} from "@/player/runtime/state";
import { publishRuntimeStateGlobal } from "@/player/runtime/state-diagnostics";
import type { RuntimeNetworkState } from "@/domain/runtime-policy";

function readNetworkState(): RuntimeNetworkState {
  try {
    if (typeof navigator === "undefined" || typeof navigator.onLine !== "boolean") {
      return "UNKNOWN";
    }
    return navigator.onLine ? "ONLINE" : "OFFLINE";
  } catch {
    return "UNKNOWN";
  }
}

function fullscreenApiCalledFlag(): boolean {
  const snap = getFullscreenController()?.snapshot();
  return Boolean(snap && snap.requestCount > 0);
}

function orientationLockCalledFlag(): boolean {
  const snap = getOrientationController()?.snapshot();
  return Boolean(snap && snap.lockCount > 0);
}

function publishPolicyGlobals(
  probed: ReturnType<typeof probeRuntimeCapabilities>,
  bundle: RuntimePolicyBundle,
) {
  (window as unknown as Record<string, unknown>)[CAPABILITIES_GLOBAL_KEY] = {
    capabilities: probed.capabilities,
    environment: probed.environment,
    probedAt: probed.probedAt,
    ok: probed.ok,
    error: probed.error,
  };
  (window as unknown as Record<string, unknown>)[RUNTIME_POLICY_GLOBAL_KEY] = {
    requested: bundle.requested,
    resolved: {
      presentation: bundle.resolved.presentation,
      cursor: bundle.resolved.cursor,
      input: bundle.resolved.input,
      interaction: bundle.resolved.interaction,
      orientation: bundle.resolved.orientation,
    },
    fallbacks: bundle.fallbacks,
    diagnostics: bundle.diagnostics,
    policySource: bundle.policySource,
    capabilities: bundle.capabilities,
    environment: bundle.environment,
    deviceId: bundle.deviceId,
    tenantId: bundle.tenantId,
    resolvedAt: bundle.resolvedAt,
    ok: bundle.ok,
    error: bundle.error,
    fullscreenApiCalled: fullscreenApiCalledFlag(),
    orientationLockCalled: orientationLockCalledFlag(),
  };
  publishRuntimeStateGlobal({
    requested: bundle.requested,
    resolved: bundle.resolved,
    policySource: bundle.policySource,
    capabilities: bundle.capabilities,
    fallbacks: bundle.fallbacks,
    diagnostics: bundle.diagnostics,
    tenantId: bundle.tenantId,
    deviceId: bundle.deviceId,
  });
}

/** Discrete enter/exit control — only when policy wants FULLSCREEN and API exists. */
function FullscreenControlChrome() {
  const [policyVisible, setPolicyVisible] = useState(false);
  const [chromeVisible, setChromeVisible] = useState(false);
  const [active, setActive] = useState(false);
  const [label, setLabel] = useState("Entrar em ecrã inteiro");
  const [orientHint, setOrientHint] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => {
      const c = getFullscreenController();
      const snap = c?.snapshot();
      const policy = (
        window as unknown as {
          __v360_runtime_policy?: { resolved?: { presentation?: string } };
        }
      ).__v360_runtime_policy;
      const wantsFs = policy?.resolved?.presentation === "FULLSCREEN";
      const apiOk = Boolean(snap?.apiAvailable);
      const isActive = Boolean(snap?.active);
      setActive(isActive);
      setPolicyVisible(Boolean(wantsFs && apiOk));
      setLabel(isActive ? "Sair do ecrã inteiro" : "Entrar em ecrã inteiro");
      const or = getOrientationController()?.snapshot();
      if (
        or?.requiresFullscreen ||
        or?.lastDiagnosticCode === "ORIENTATION_REQUIRES_FULLSCREEN"
      ) {
        setOrientHint(
          "É necessário entrar em ecrã inteiro para bloquear a orientação.",
        );
      } else {
        setOrientHint(null);
      }

      // Reuse CursorIdleController via Runtime State — no second idle timer.
      const cursorOn = getRuntimeStateStore().get().cursorVisible;
      setChromeVisible(Boolean(cursorOn));
    };
    refresh();
    const unsub = subscribeRuntimeState(() => refresh());
    window.addEventListener(DEVICE_CONFIG_UPDATED_EVENT, refresh);
    return () => {
      unsub();
      window.removeEventListener(DEVICE_CONFIG_UPDATED_EVENT, refresh);
    };
  }, []);

  const showButton = policyVisible && chromeVisible;
  const showHint = Boolean(orientHint) && chromeVisible;
  if (!showButton && !showHint) return null;

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 40,
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        gap: 0,
        opacity: chromeVisible ? 1 : 0,
        pointerEvents: chromeVisible ? "auto" : "none",
        transition: "opacity 180ms ease",
        background:
          "linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.35) 70%, transparent 100%)",
        padding: "28px 16px 14px",
      }}
      data-testid="v360-player-controls"
      data-controls-visible={chromeVisible ? "true" : "false"}
    >
      {showHint && orientHint ? (
        <p
          data-testid="v360-orientation-fs-hint"
          style={{
            margin: "0 0 8px auto",
            padding: "6px 10px",
            fontSize: 11,
            fontFamily: "system-ui, sans-serif",
            color: "rgba(255,255,255,0.85)",
            background: "rgba(0,0,0,0.45)",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 6,
            maxWidth: 280,
          }}
        >
          {orientHint}
        </p>
      ) : null}
      {showButton ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 8,
          }}
        >
          <button
            type="button"
            data-testid={active ? "v360-fullscreen-exit" : "v360-fullscreen-enter"}
            aria-label={label}
            title={label}
            onClick={() => {
              const c = getFullscreenController();
              if (!c) return;
              if (active) {
                void c.exit();
              } else {
                void c.request({ userActivation: true, source: "user" });
              }
            }}
            style={{
              padding: "8px 14px",
              fontSize: 12,
              fontFamily: "system-ui, sans-serif",
              fontWeight: 600,
              color: "rgba(255,255,255,0.95)",
              background: "rgba(0,0,0,0.55)",
              border: "1px solid rgba(255,255,255,0.22)",
              borderRadius: 8,
              cursor: "pointer",
            }}
          >
            {label}
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** Marks document as Passive Player Runtime and pins it to the visible viewport. */
export function PlayerRuntimeShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const lastBundleRef = useRef<RuntimePolicyBundle | null>(null);

  useEffect(() => {
    document.documentElement.classList.add("player-runtime");
    const root = rootRef.current;
    const store = getRuntimeStateStore();

    const fit = () => {
      if (!root) return;
      const viewport = window.visualViewport;
      const height = viewport?.height ?? window.innerHeight;
      const top = viewport?.offsetTop ?? 0;
      root.style.position = "fixed";
      root.style.top = `${top}px`;
      root.style.left = "0";
      root.style.width = "100%";
      root.style.height = `${height}px`;
    };

    fit();
    window.addEventListener("resize", fit);
    window.visualViewport?.addEventListener("resize", fit);
    window.visualViewport?.addEventListener("scroll", fit);

    updateRuntimeState({
      networkState: readNetworkState(),
    });

    const onOnline = () => updateRuntimeState({ networkState: "ONLINE" });
    const onOffline = () => updateRuntimeState({ networkState: "OFFLINE" });

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    let cursor: CursorIdleController | null = null;
    let fsController: FullscreenController | null = null;
    let orController: OrientationController | null = null;

    const republish = () => {
      const b = lastBundleRef.current;
      if (!b) return;
      publishRuntimeStateGlobal({
        requested: b.requested,
        resolved: b.resolved,
        policySource: b.policySource,
        capabilities: b.capabilities,
        fallbacks: b.fallbacks,
        diagnostics: b.diagnostics,
        tenantId: b.tenantId,
        deviceId: b.deviceId,
      });
    };

    const unsub = store.subscribe(() => {
      republish();
    });

    const ensureFullscreen = (bundle: RuntimePolicyBundle) => {
      if (!fsController) {
        fsController = new FullscreenController({
          getTarget: () => rootRef.current,
          capabilityFullscreen: bundle.capabilities.fullscreen === true,
          onDiagnostic: () => {
            republish();
          },
        });
        setFullscreenController(fsController);
        fsController.start();
      }
      fsController.setResolvedPresentation(bundle.resolved.presentation);
      fsController.evaluateBoot();
    };

    const ensureOrientation = (bundle: RuntimePolicyBundle) => {
      if (!orController) {
        orController = new OrientationController({
          capabilityOrientation: bundle.capabilities.orientation === true,
          preferViewportForActual: true,
          onDiagnostic: () => {
            republish();
          },
        });
        setOrientationController(orController);
        orController.start();
      }
      orController.setResolvedOrientation(bundle.resolved.orientation);
      orController.evaluateBoot();
    };

    const applyPolicy = () => {
      cursor?.dispose();
      cursor = null;
      try {
        const probed = probeRuntimeCapabilities();
        const device = localConfigToDevicePolicyInput(readLocalConfigSync());
        const bundle = resolvePlayerRuntimePolicy({
          device,
          probe: probed,
        });
        lastBundleRef.current = bundle;
        publishPolicyGlobals(probed, bundle);
        ensureFullscreen(bundle);
        ensureOrientation(bundle);
        cursor = new CursorIdleController(resolvedCursorPolicy(bundle), undefined, {
          onVisibilityChange: (visible) => {
            updateRuntimeState({ cursorVisible: visible });
          },
          onInputClass: (inputClass, at) => {
            updateRuntimeState({
              lastInputClass: inputClass,
              lastInputAt: at,
            });
          },
        });
        cursor.start();
        document.body.style.cursor = "";
      } catch {
        cursor = new CursorIdleController("AUTO_HIDE", undefined, {
          onVisibilityChange: (visible) => {
            updateRuntimeState({ cursorVisible: visible });
          },
          onInputClass: (inputClass, at) => {
            updateRuntimeState({
              lastInputClass: inputClass,
              lastInputAt: at,
            });
          },
        });
        cursor.start();
      }
    };

    applyPolicy();
    window.addEventListener(DEVICE_CONFIG_UPDATED_EVENT, applyPolicy);

    (window as unknown as Record<string, unknown>).__v360_fullscreen_ctl = {
      snapshot: () => getFullscreenController()?.snapshot() ?? null,
      request: (p: { userActivation: boolean; source?: "boot" | "user" | "test" }) =>
        getFullscreenController()?.request(p),
      exit: () => getFullscreenController()?.exit(),
      setPresentation: (p: "FULLSCREEN" | "WINDOWED" | "AUTO") =>
        getFullscreenController()?.setResolvedPresentation(p),
      evaluateBoot: () => getFullscreenController()?.evaluateBoot(),
      installUnavailable: () => {
        fsController?.dispose();
        const bundle = lastBundleRef.current;
        fsController = new FullscreenController({
          getTarget: () => rootRef.current,
          api: null,
          capabilityFullscreen: false,
          onDiagnostic: () => {
            republish();
          },
        });
        setFullscreenController(fsController);
        fsController.start();
        if (bundle) {
          fsController.setResolvedPresentation(bundle.resolved.presentation);
        } else {
          fsController.setResolvedPresentation("FULLSCREEN");
        }
        fsController.evaluateBoot();
        republish();
        return fsController.snapshot();
      },
    };

    (window as unknown as Record<string, unknown>).__v360_orientation_ctl = {
      snapshot: () => getOrientationController()?.snapshot() ?? null,
      lock: (p: {
        userActivation: boolean;
        source?: "boot" | "user" | "fullscreen" | "test";
      }) => getOrientationController()?.lock(p),
      unlock: () => getOrientationController()?.unlock(),
      setOrientation: (p: "AUTO" | "LANDSCAPE" | "PORTRAIT") =>
        getOrientationController()?.setResolvedOrientation(p),
      evaluateBoot: () => getOrientationController()?.evaluateBoot(),
      canLock: () => getOrientationController()?.canLockOrientation(),
      installUnavailable: () => {
        orController?.dispose();
        const bundle = lastBundleRef.current;
        orController = new OrientationController({
          api: null,
          capabilityOrientation: false,
          preferViewportForActual: true,
          onDiagnostic: () => {
            republish();
          },
        });
        setOrientationController(orController);
        orController.start();
        if (bundle) {
          orController.setResolvedOrientation(bundle.resolved.orientation);
        } else {
          orController.setResolvedOrientation("LANDSCAPE");
        }
        orController.evaluateBoot();
        republish();
        return orController.snapshot();
      },
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "f" && e.key !== "F") return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      const c = getFullscreenController();
      const policy = lastBundleRef.current;
      if (!c || !policy || policy.resolved.presentation !== "FULLSCREEN") {
        return;
      }
      e.preventDefault();
      if (c.isActive()) {
        void c.exit();
      } else {
        void c.request({ userActivation: true, source: "user" });
      }
    };
    window.addEventListener("keydown", onKey);

    return () => {
      unsub();
      cursor?.dispose();
      fsController?.dispose();
      orController?.dispose();
      setFullscreenController(null);
      setOrientationController(null);
      window.removeEventListener(DEVICE_CONFIG_UPDATED_EVENT, applyPolicy);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("keydown", onKey);
      try {
        delete (window as unknown as Record<string, unknown>)[
          CAPABILITIES_GLOBAL_KEY
        ];
        delete (window as unknown as Record<string, unknown>)[
          RUNTIME_POLICY_GLOBAL_KEY
        ];
        delete (window as unknown as Record<string, unknown>)[
          "__v360_runtime_state"
        ];
        delete (window as unknown as Record<string, unknown>)[
          "__v360_fullscreen_ctl"
        ];
        delete (window as unknown as Record<string, unknown>)[
          "__v360_orientation_ctl"
        ];
      } catch {
        /* ignore */
      }
      document.documentElement.classList.remove("player-runtime");
      document.documentElement.style.cursor = "";
      window.removeEventListener("resize", fit);
      window.visualViewport?.removeEventListener("resize", fit);
      window.visualViewport?.removeEventListener("scroll", fit);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className="player-runtime-root"
      data-testid="v360-player-runtime-root"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100dvh",
        overflow: "hidden",
        background: "#070b14",
      }}
    >
      {children}
      <FullscreenControlChrome />
    </div>
  );
}
