"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import {
  clearAllPlayerData,
  getConfig,
  getCurrentManifest,
  saveConfig,
  type LocalConfig,
} from "@/player/cache/indexed-db";
import { runSyncCycle, sendHeartbeat, PLAYER_VERSION } from "@/player/sync/engine";
import {
  DisplayEngine,
  type PlaybackItem,
} from "@/player/playback/display-engine";
import {
  ACTIVE_PLAYER_RUNTIME,
  getPassiveRuntimeCapabilities,
} from "@/player/runtime/passive";
import { isFragileSmartTvBrowser } from "@/player/device/fragile-tv";
import {
  CAPABILITIES_GLOBAL_KEY,
  formatCapabilitiesDiagnostics,
  type CapabilityProbeResult,
} from "@/player/runtime/capabilities";
import {
  RUNTIME_POLICY_GLOBAL_KEY,
  formatPolicyDiagnostics,
  type RuntimePolicyBundle,
} from "@/player/runtime/resolve-policy";
import {
  DEVICE_CONFIG_UPDATED_EVENT,
  withServerDeviceConfig,
} from "@/player/runtime/device-config";
import { updateRuntimeState } from "@/player/runtime/state";
import type { DetectedRuntimeCapabilities } from "@/domain/runtime-policy";

type Phase = "boot" | "pairing" | "claiming" | "playing" | "error";

/** Inline styles — Smart TV browsers (Sraf/webOS/Tizen) often ignore Tailwind. */
const bootShellStyle: CSSProperties = {
  display: "flex",
  height: "100%",
  width: "100%",
  alignItems: "center",
  justifyContent: "center",
  flexDirection: "column",
  background: "#070b14",
  color: "rgba(255,255,255,0.55)",
  fontFamily: "system-ui, sans-serif",
  margin: 0,
  textAlign: "center",
  padding: 24,
  boxSizing: "border-box",
};

const BOOT_WATCHDOG_MS = 5_000;
const PAIR_FETCH_MS = 10_000;
const PAIR_CLIENT_ID_KEY = "v360-pairing-client-id";
const PAIR_SECRET_KEY = "v360-pairing-secret";

function randomPairingValue(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getPairingIdentity() {
  const read = (key: string) => {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  };
  const write = (key: string, value: string) => {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // The player can still attempt a one-shot pairing if storage is unavailable.
    }
  };
  const clientId = read(PAIR_CLIENT_ID_KEY) ?? randomPairingValue("tv");
  const pairingSecret = read(PAIR_SECRET_KEY) ?? randomPairingValue("pair");
  write(PAIR_CLIENT_ID_KEY, clientId);
  write(PAIR_SECRET_KEY, pairingSecret);
  return { clientId, pairingSecret };
}

async function fetchJson(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  // Avoid AbortController — missing or broken on some Smart TV browsers
  const fetchPromise = fetch(url, init);
  let timer: number | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = window.setTimeout(
      () => reject(new Error(`fetch timed out after ${timeoutMs}ms`)),
      timeoutMs,
    );
  });
  try {
    const res = await Promise.race([fetchPromise, timeoutPromise]);
    if (res.status === 401) {
      throw new Error("UNAUTHORIZED");
    }
    return res;
  } finally {
    if (timer !== undefined) window.clearTimeout(timer);
  }
}

export function PlayerApp() {
  const [phase, setPhase] = useState<Phase>("boot");
  const [activationCode, setActivationCode] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [pairingSecret, setPairingSecret] = useState<string | null>(null);
  const [items, setItems] = useState<PlaybackItem[]>([]);
  const [manifestVersion, setManifestVersion] = useState(0);
  const [currentContentId, setCurrentContentId] = useState<string | undefined>();
  const [diag, setDiag] = useState(false);
  const [bootKey, setBootKey] = useState(0);
  const [bootHint, setBootHint] = useState("A iniciar…");
  const [bootSec, setBootSec] = useState(0);
  const bootedRef = useRef(false);

  const playlistKeyRef = useRef("");

  const publishItems = useCallback((next: PlaybackItem[], version: number) => {
    const key = `${version}|${next
      .map((item) =>
        [
          item.playlistItemId,
          item.contentId,
          item.durationMs,
          item.type,
          item.fitMode ?? "",
          item.transition,
          item.assets?.[0]?.id ?? "",
        ].join(":"),
      )
      .join("|")}`;
    if (key === playlistKeyRef.current) return next.length > 0;
    playlistKeyRef.current = key;
    setItems(next);
    setManifestVersion(version);
    try {
      updateRuntimeState({
        currentManifestVersion: version,
        isPlaying: next.length > 0,
        currentContentId: next[0]?.contentId ?? null,
      });
    } catch {
      /* observational */
    }
    return next.length > 0;
  }, []);

  const loadFromCache = useCallback(async () => {
    try {
      const manifest = await Promise.race([
        getCurrentManifest(),
        new Promise<"timeout">((resolve) => {
          window.setTimeout(() => resolve("timeout"), 8_000);
        }),
      ]);
      // Slow IDB must not wipe a good in-memory playlist (mobile Chrome / tunnel)
      if (manifest === "timeout") return;
      if (!manifest?.playlist) {
        if (playlistKeyRef.current !== "") {
          playlistKeyRef.current = "";
          setItems([]);
          setManifestVersion(manifest?.manifestVersion ?? 0);
        }
        return;
      }
      const playlist = manifest.playlist as {
        items?: PlaybackItem[];
      };
      publishItems(playlist.items ?? [], manifest.manifestVersion);
    } catch {
      /* keep previous items on transient cache errors */
    }
  }, [publishItems]);

  const applyManifest = useCallback(
    (manifest: Awaited<ReturnType<typeof getCurrentManifest>>) => {
      if (!manifest?.playlist) return false;
      const playlist = manifest.playlist as { items?: PlaybackItem[] };
      return publishItems(playlist.items ?? [], manifest.manifestVersion);
    },
    [publishItems],
  );

  const syncAndShow = useCallback(async () => {
    const syncPromise = runSyncCycle();
    type Soft = { softTimeout: true };
    const raced = await Promise.race([
      syncPromise.then((r) => ({ softTimeout: false as const, r })),
      new Promise<Soft>((resolve) => {
        window.setTimeout(() => resolve({ softTimeout: true }), 15_000);
      }),
    ]);

    if ("softTimeout" in raced && raced.softTimeout) {
      // Keep playing local CURRENT while atomic downloads finish.
      await loadFromCache();
      const final = await syncPromise;
      if (final.manifest && applyManifest(final.manifest)) return final;
      await loadFromCache();
      return final;
    }

    const r = raced.r;
    if (r.manifest && applyManifest(r.manifest)) return r;
    await loadFromCache();
    return r;
  }, [applyManifest, loadFromCache]);

  const startPairing = useCallback(async (cancelled: () => boolean) => {
    setBootHint("A pedir código de activação…");
    const identity = getPairingIdentity();
    const res = await fetchJson(
      "/api/device/bootstrap",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pair_start", ...identity }),
      },
      PAIR_FETCH_MS,
    );
    if (!res.ok) throw new Error("pair_start failed");
    const data = (await res.json()) as {
      deviceId: string;
      activationCode: string;
      pairingSecret?: string;
    };
    if (!data.pairingSecret) {
      throw new Error("pair_start missing pairingSecret");
    }
    if (cancelled()) return;
    setDeviceId(data.deviceId);
    setActivationCode(data.activationCode);
    setPairingSecret(data.pairingSecret);
    await saveConfig({
      deviceId: data.deviceId,
      deviceToken: "",
      clientId: identity.clientId,
      activationCode: data.activationCode,
      pairingSecret: data.pairingSecret,
    });
    bootedRef.current = true;
    setPhase("pairing");
  }, []);

  useEffect(() => {
    let cancelled = false;
    bootedRef.current = false;

    // Sraf: leave Next/React entirely — static pairing page (no IDB/SW)
    if (isFragileSmartTvBrowser()) {
      window.location.replace("/tv.html?v=042");
      return () => {
        cancelled = true;
      };
    }

    const tick = window.setInterval(() => {
      setBootSec((s) => s + 1);
    }, 1000);
    // Reset counter asynchronously to satisfy react-hooks/set-state-in-effect
    const resetSec = window.setTimeout(() => {
      if (!cancelled) setBootSec(0);
    }, 0);

    const watchdog = window.setTimeout(() => {
      if (cancelled || bootedRef.current) return;
      setBootHint("Arranque lento — a forçar pairing…");
      void startPairing(() => cancelled)
        .then(() => {
          bootedRef.current = true;
        })
        .catch(() => {
          if (cancelled || bootedRef.current) return;
          setBootHint("Sem resposta do servidor. Verifique a rede.");
          setPhase("error");
        });
    }, BOOT_WATCHDOG_MS);

    (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        if (params.get("reset") === "1") {
          setBootHint("A limpar dados locais…");
          // Do not await long IDB wipe on Smart TV
          void clearAllPlayerData();
          const url = new URL(window.location.href);
          url.searchParams.delete("reset");
          window.history.replaceState({}, "", url.pathname + url.search);
        }

        setBootHint("A carregar configuração…");
        // localStorage only — never touch IndexedDB on boot (Sraf freezes)
        const config = await getConfig();
        if (cancelled || bootedRef.current) return;

        if (config?.deviceToken) {
          bootedRef.current = true;
          setDeviceId(config.deviceId);
          setPhase("playing");
          await loadFromCache();
          void syncAndShow();
          return;
        }

        if (config?.deviceId && config.pairingSecret && !config.deviceToken) {
          bootedRef.current = true;
          setDeviceId(config.deviceId);
          setPairingSecret(config.pairingSecret);
          setActivationCode(config.activationCode ?? null);
          setPhase("pairing");
          return;
        }

        await startPairing(() => cancelled || bootedRef.current);
      } catch (e) {
        if (cancelled || bootedRef.current) return;
        setBootHint(
          e instanceof Error
            ? `Falha no arranque: ${e.message}`
            : "Falha no arranque",
        );
        setPhase("error");
      }
    })();

    return () => {
      cancelled = true;
      window.clearInterval(tick);
      window.clearTimeout(resetSec);
      window.clearTimeout(watchdog);
    };
  }, [loadFromCache, bootKey, startPairing, syncAndShow]);

  useEffect(() => {
    if (phase !== "pairing" || !deviceId || !pairingSecret) return;
    const id = window.setInterval(async () => {
      try {
        const res = await fetchJson(
          "/api/device/bootstrap",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "claim",
              deviceId,
              pairingSecret,
            }),
          },
          8_000,
        );
        if (!res.ok) return;
        const data = (await res.json()) as {
          status: string;
          deviceToken?: string;
          deviceCode?: string | null;
          deviceConfig?: {
            tenantId: string | null;
            deviceId: string;
            displayType: string;
            interactionMode: string;
            orientation: string;
            timezone: string | null;
            status: string;
          };
        };
        if (data.status === "ACTIVE" && data.deviceToken) {
          const next: LocalConfig = withServerDeviceConfig(
            {
              deviceId,
              deviceToken: data.deviceToken,
              deviceCode: data.deviceCode,
            },
            data.deviceConfig,
          );
          await saveConfig(next);
          try {
            window.dispatchEvent(new Event(DEVICE_CONFIG_UPDATED_EVENT));
          } catch {
            /* ignore */
          }
          setPairingSecret(null);
          setPhase("playing");
          await syncAndShow();
        } else if (data.status === "ACTIVE_NO_TOKEN" || data.status === "FORBIDDEN") {
          setBootHint("Erro ao receber token. A reiniciar emparelhamento...");
          setPhase("error");
          setTimeout(() => {
            void saveConfig(null);
            window.location.reload();
          }, 3000);
        }
      } catch (e) {
        if (e instanceof Error && e.message === "UNAUTHORIZED") {
          void saveConfig(null);
          window.location.reload();
        }
        /* keep pairing UI */
      }
    }, 2500);
    return () => window.clearInterval(id);
  }, [phase, deviceId, pairingSecret, syncAndShow]);

  const itemsRef = useRef(items);
  const contentIdRef = useRef(currentContentId);

  useEffect(() => {
    itemsRef.current = items;
    contentIdRef.current = currentContentId;
  }, [items, currentContentId]);

  useEffect(() => {
    if (phase !== "playing") {
      try {
        if (phase === "boot" || phase === "pairing" || phase === "error") {
          updateRuntimeState({ isPlaying: false });
        }
      } catch {
        /* ignore */
      }
      return;
    }
    try {
      updateRuntimeState({
        isPlaying: items.length > 0,
        currentManifestVersion: manifestVersion || null,
      });
    } catch {
      /* ignore */
    }
  }, [phase, items.length, manifestVersion]);

  useEffect(() => {
    if (phase !== "playing") return;

    const pulse = () =>
      sendHeartbeat({
        playerState: itemsRef.current.length > 0 ? "PLAYING" : "IDLE",
        resolution: `${window.innerWidth}x${window.innerHeight}`,
        contentId: contentIdRef.current ?? itemsRef.current[0]?.contentId,
        playlistId: undefined,
      })
        .then(async (hb) => {
          if (!hb) return;
          const current = await Promise.race([
            getCurrentManifest().catch(() => null),
            new Promise<null>((resolve) => {
              window.setTimeout(() => resolve(null), 3_000);
            }),
          ]);
          const localV = current?.manifestVersion ?? -1;
          if (Number(hb.manifestVersion) > Number(localV)) {
            await syncAndShow();
          }
        })
        .catch((e) => {
          if (e instanceof Error && e.message === "UNAUTHORIZED") {
            void saveConfig(null);
            window.location.reload();
          }
        });

    // Immediate beat so Admin shows ONLINE without waiting 30s (kiosk / HW validation)
    void pulse();
    // Boot already ran syncAndShow — do not fire a duplicate sync at t=0.

    const beat = window.setInterval(() => {
      void pulse();
    }, 30_000);
    // While the screen is empty, retry sooner. Do not restart this timer
    // when the playlist array identity changes — that was reloading the video.
    const sync = window.setInterval(() => {
      void syncAndShow().catch((e) => {
        if (e instanceof Error && e.message === "UNAUTHORIZED") {
          void saveConfig(null);
          window.location.reload();
        }
      });
    }, itemsRef.current.length > 0 ? 20_000 : 10_000);
    const onOnline = () => {
      void syncAndShow().catch((e) => {
        if (e instanceof Error && e.message === "UNAUTHORIZED") {
          void saveConfig(null);
          window.location.reload();
        }
      });
    };
    window.addEventListener("online", onOnline);
    return () => {
      window.clearInterval(beat);
      window.clearInterval(sync);
      window.removeEventListener("online", onOnline);
    };
  }, [phase, syncAndShow]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "d" || e.key === "D") setDiag((v) => !v);
      if (diag && (e.key === "r" || e.key === "R")) {
        void (async () => {
          void clearAllPlayerData();
          setPhase("boot");
          setBootHint("A iniciar…");
          setActivationCode(null);
          setDeviceId(null);
          setPairingSecret(null);
          setItems([]);
          setManifestVersion(0);
          setBootKey((k) => k + 1);
        })();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [diag]);

  if (phase === "boot") {
    return (
      <div style={bootShellStyle}>
        <p style={{ fontSize: 28, margin: 0 }}>{bootHint}</p>
        <p style={{ fontSize: 14, marginTop: 16, opacity: 0.6 }}>
          {bootSec}s · v{PLAYER_VERSION}
        </p>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div style={bootShellStyle}>
        <p style={{ fontSize: 28, margin: 0, color: "#fff" }}>
          Não foi possível iniciar
        </p>
        <p style={{ fontSize: 16, marginTop: 16, maxWidth: 480 }}>{bootHint}</p>
        <p style={{ fontSize: 14, marginTop: 12, opacity: 0.6 }}>
          Smart TV: limpe a cache do browser e abra de novo.
        </p>
        <button
          type="button"
          style={{
            marginTop: 28,
            padding: "12px 24px",
            fontSize: 18,
            background: "#1e3a5f",
            color: "#fff",
            border: "1px solid #3b82f6",
            borderRadius: 6,
          }}
          onClick={() => {
            setPhase("boot");
            setBootHint("A iniciar…");
            setBootKey((k) => k + 1);
          }}
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (phase === "pairing") {
    return (
      <div
        style={{
          ...bootShellStyle,
          color: "#fff",
        }}
      >
        <p
          style={{
            fontSize: 40,
            fontWeight: 600,
            margin: 0,
            fontFamily: "var(--font-fraunces), Georgia, serif",
          }}
        >
          Vitrine360
        </p>
        <p style={{ marginTop: 16, color: "rgba(255,255,255,0.6)" }}>
          Código de activação
        </p>
        <p
          style={{
            marginTop: 24,
            fontFamily: "ui-monospace, monospace",
            fontSize: 64,
            letterSpacing: "0.35em",
          }}
        >
          {activationCode}
        </p>
        <p
          style={{
            marginTop: 40,
            maxWidth: 420,
            color: "rgba(255,255,255,0.5)",
            fontSize: 16,
          }}
        >
          Introduza este código no Admin Console para associar este dispositivo.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        position: "relative",
        height: "100%",
        width: "100%",
        overflow: "hidden",
        background: "#070b14",
      }}
    >
      <DisplayEngine
        items={items}
        onItemChange={(item) => {
          setCurrentContentId(item?.contentId);
          try {
            updateRuntimeState({
              currentContentId: item?.contentId ?? null,
              isPlaying: Boolean(item),
            });
          } catch {
            /* observational */
          }
        }}
      />
      {diag ? (
        <div className="pointer-events-none absolute bottom-4 left-4 max-w-[min(92vw,560px)] rounded bg-black/70 px-3 py-2 font-mono text-[10px] leading-relaxed text-white">
          <div>
            runtime={ACTIVE_PLAYER_RUNTIME} · flavour=
            {getPassiveRuntimeCapabilities().autoplay ? "autoplay" : "—"} ·
            phase={phase} · v{PLAYER_VERSION} · manifest=v{manifestVersion} ·
            items={items.length} · online=
            {typeof navigator !== "undefined" && navigator.onLine ? "1" : "0"}
          </div>
          <div className="mt-1 opacity-90">
            {(() => {
              const policy = (
                window as unknown as Record<
                  string,
                  {
                    requested: RuntimePolicyBundle["requested"];
                    resolved: RuntimePolicyBundle["resolved"];
                    fallbacks: RuntimePolicyBundle["fallbacks"];
                    policySource: RuntimePolicyBundle["policySource"];
                  }
                >
              )[RUNTIME_POLICY_GLOBAL_KEY];
              if (!policy?.resolved) return "policy: (resolving…)";
              return formatPolicyDiagnostics(policy);
            })()}
          </div>
          <div className="mt-1 opacity-80">
            {(() => {
              const snap = (
                window as unknown as Record<string, CapabilityProbeResult>
              )[CAPABILITIES_GLOBAL_KEY];
              if (!snap?.capabilities) return "capabilities: (probe pending)";
              return formatCapabilitiesDiagnostics(
                snap.capabilities as DetectedRuntimeCapabilities,
              );
            })()}
          </div>
          <div className="mt-1 opacity-75">
            {(() => {
              const rs = (
                window as unknown as Record<
                  string,
                  {
                    state?: {
                      isPlaying?: boolean;
                      syncState?: string;
                      networkState?: string;
                      orientationActual?: string;
                      fullscreenActive?: boolean;
                      fullscreenStatus?: string;
                      fullscreenDiagnosticCode?: string | null;
                      orientationStatus?: string;
                      orientationDiagnosticCode?: string | null;
                    };
                    policyActualDiagnostics?: { code: string }[];
                  }
                >
              ).__v360_runtime_state;
              if (!rs?.state) return "runtimeState: (pending)";
              const codes = (rs.policyActualDiagnostics ?? [])
                .map((d) => d.code)
                .join(",");
              return `state play=${rs.state.isPlaying ? 1 : 0} sync=${rs.state.syncState} net=${rs.state.networkState} orient=${rs.state.orientationActual}/${rs.state.orientationStatus ?? "?"}${rs.state.orientationDiagnosticCode ? `:${rs.state.orientationDiagnosticCode}` : ""} fs=${rs.state.fullscreenActive ? 1 : 0}/${rs.state.fullscreenStatus ?? "?"}${rs.state.fullscreenDiagnosticCode ? `:${rs.state.fullscreenDiagnosticCode}` : ""}${codes ? ` · ${codes}` : ""}`;
            })()}
          </div>
          <div className="mt-1 opacity-60">D hide · R reset · F fullscreen</div>
        </div>
      ) : null}
    </div>
  );
}
