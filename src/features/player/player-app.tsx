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
  type DisplayEngineHandle,
  type PlaybackItem,
} from "@/player/playback/display-engine";
import { PlaybackChrome } from "@/player/playback/playback-chrome";
import {
  createInitialPlaybackState,
  type PlaybackAction,
  type PlaybackState,
} from "@/domain/playback-state";
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
import { getPlayerSessionStore } from "@/player/session/player-session-store";
import { compactPlaybackObservation } from "@/domain/playback-observation";
import { formatPlayerDiagnostics } from "@/domain/player-session";
import type { DetectedRuntimeCapabilities } from "@/domain/runtime-policy";
import { createCommandDispatcher } from "@/player/command/command-dispatcher";
import { createCommandPoller } from "@/player/command/command-poller";
import { createIdempotencyStore } from "@/player/command/idempotency-store";
import type { PlaybackController } from "@/player/playback/playback-controller";
import { COMMAND_TRANSPORT } from "@/domain/command-transport";

type Phase = "boot" | "pairing" | "claiming" | "playing" | "error";

/** Inline styles — Smart TV browsers (Sraf/webOS/Tizen) often ignore Tailwind. */
const bootShellStyle: CSSProperties = {
  display: "flex",
  height: "100%",
  width: "100%",
  alignItems: "center",
  justifyContent: "center",
  flexDirection: "column",
  background:
    "radial-gradient(900px 520px at 12% -10%, rgba(190,172,255,0.6), transparent 60%), radial-gradient(760px 480px at 100% 0%, rgba(166,205,255,0.5), transparent 60%), #eeebfb",
  color: "rgba(43,37,80,0.6)",
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
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [pairExpiryLabel, setPairExpiryLabel] = useState<string>("");
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [pairingSecret, setPairingSecret] = useState<string | null>(null);
  const refreshingPairRef = useRef(false);
  const [items, setItems] = useState<PlaybackItem[]>([]);
  const [manifestVersion, setManifestVersion] = useState(0);
  const [currentContentId, setCurrentContentId] = useState<string | undefined>();
  const [diag, setDiag] = useState(false);
  const [playbackState, setPlaybackState] = useState<PlaybackState>(() =>
    createInitialPlaybackState(0),
  );
  const engineRef = useRef<DisplayEngineHandle>(null);
  const fragileTv = isFragileSmartTvBrowser();

  const dispatchPlayback = useCallback((action: PlaybackAction) => {
    engineRef.current?.dispatch(action);
    setPlaybackState(
      engineRef.current?.getState() ?? createInitialPlaybackState(0),
    );
  }, []);
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
    setPairExpiryLabel("");
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
      expiresAt?: string | null;
    };
    if (!data.pairingSecret) {
      throw new Error("pair_start missing pairingSecret");
    }
    if (cancelled()) return;
    const nextExpires =
      data.expiresAt ??
      new Date(Date.now() + 15 * 60 * 1000).toISOString();
    setDeviceId(data.deviceId);
    setActivationCode(data.activationCode);
    setPairingSecret(data.pairingSecret);
    setExpiresAt(nextExpires);
    await saveConfig({
      deviceId: data.deviceId,
      deviceToken: "",
      clientId: identity.clientId,
      activationCode: data.activationCode,
      pairingSecret: data.pairingSecret,
      expiresAt: nextExpires,
    });
    bootedRef.current = true;
    refreshingPairRef.current = false;
    setPhase("pairing");
  }, []);

  const refreshExpiredPairing = useCallback(async () => {
    if (refreshingPairRef.current) return;
    refreshingPairRef.current = true;
    setPairExpiryLabel("O código expirou. A gerar novo código…");
    try {
      await saveConfig(null);
      setActivationCode(null);
      setExpiresAt(null);
      setPairingSecret(null);
      setDeviceId(null);
      await startPairing(() => false);
    } catch (e) {
      refreshingPairRef.current = false;
      setBootHint(
        e instanceof Error
          ? `Falha ao renovar código: ${e.message}`
          : "Falha ao renovar código",
      );
      setPhase("error");
    }
  }, [startPairing]);

  useEffect(() => {
    let cancelled = false;
    bootedRef.current = false;

    // Sraf: leave Next/React entirely — static pairing page (no IDB/SW)
    if (isFragileSmartTvBrowser()) {
      window.location.replace("/tv.html?v=055");
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
          const expMs = config.expiresAt
            ? Date.parse(config.expiresAt)
            : NaN;
          // Missing or past expiry → request a fresh (or still-valid reused) code
          if (!Number.isFinite(expMs) || expMs <= Date.now()) {
            await saveConfig(null);
            await startPairing(() => cancelled || bootedRef.current);
            return;
          }
          bootedRef.current = true;
          setDeviceId(config.deviceId);
          setPairingSecret(config.pairingSecret);
          setActivationCode(config.activationCode ?? null);
          setExpiresAt(config.expiresAt ?? null);
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
          expiresAt?: string | null;
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
        if (data.status === "EXPIRED") {
          void refreshExpiredPairing();
          return;
        }
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
          setExpiresAt(null);
          setPhase("playing");
          await syncAndShow();
        } else if (data.status === "ACTIVE_NO_TOKEN" || data.status === "FORBIDDEN") {
          setBootHint("Erro ao receber token. A reiniciar emparelhamento...");
          setPhase("error");
          setTimeout(() => {
            void saveConfig(null);
            setPhase("boot");
            setBootHint("A iniciar…");
            setActivationCode(null);
            setDeviceId(null);
            setPairingSecret(null);
            setBootKey((k) => k + 1);
          }, 3000);
        }
      } catch (e) {
        if (e instanceof Error && e.message === "UNAUTHORIZED") {
          void saveConfig(null);
          setPhase("boot");
          setBootHint("A iniciar…");
          setBootKey((k) => k + 1);
        }
        /* keep pairing UI */
      }
    }, 2500);
    return () => window.clearInterval(id);
  }, [phase, deviceId, pairingSecret, syncAndShow, refreshExpiredPairing]);

  // Countdown + local expiry refresh (parity with public/tv.js)
  useEffect(() => {
    if (phase !== "pairing" || !expiresAt) {
      return;
    }
    const expiresMs = Date.parse(expiresAt);
    if (!Number.isFinite(expiresMs)) {
      return;
    }

    const tick = () => {
      const diff = expiresMs - Date.now();
      if (diff <= 0) {
        setPairExpiryLabel("O código expirou. A gerar novo código…");
        void refreshExpiredPairing();
        return false;
      }
      const m = Math.floor(diff / 60_000);
      const s = Math.floor((diff % 60_000) / 1000);
      setPairExpiryLabel(`Expira em ${m}:${s < 10 ? `0${s}` : s}`);
      return true;
    };

    const id = window.setInterval(() => {
      if (!tick()) window.clearInterval(id);
    }, 1000);
    // First tick deferred so effect does not sync-setState (lint).
    const first = window.setTimeout(() => {
      if (!tick()) window.clearInterval(id);
    }, 0);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(first);
    };
  }, [phase, expiresAt, refreshExpiredPairing]);

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
    void (async () => {
      try {
        const config = await getConfig();
        getPlayerSessionStore().start({
          deviceId: config?.deviceId ?? deviceId ?? null,
          tenantId: config?.tenantId ?? null,
          now: Date.now(),
        });
      } catch {
        /* observational */
      }
    })();
  }, [phase, deviceId]);

  useEffect(() => {
    if (phase !== "playing") return;

    const pulse = () => {
      const store = getPlayerSessionStore();
      const obs = store.getObservation();
      const session = store.getSession();
      return sendHeartbeat({
        playerState: itemsRef.current.length > 0 ? "PLAYING" : "IDLE",
        resolution: `${window.innerWidth}x${window.innerHeight}`,
        contentId: contentIdRef.current ?? itemsRef.current[0]?.contentId,
        playlistId: obs?.playlistId ?? undefined,
        sessionId: session?.sessionId,
        playback: obs ? compactPlaybackObservation(obs) : undefined,
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
            setPhase("boot");
            setBootHint("Sessão expirada — a reemparelhar…");
            setBootKey((k) => k + 1);
          }
        });
    };

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
          setPhase("boot");
          setBootHint("Sessão expirada — a reemparelhar…");
          setBootKey((k) => k + 1);
        }
      });
    }, itemsRef.current.length > 0 ? 20_000 : 10_000);
    const onOnline = () => {
      void syncAndShow().catch((e) => {
        if (e instanceof Error && e.message === "UNAUTHORIZED") {
          void saveConfig(null);
          setPhase("boot");
          setBootHint("Sessão expirada — a reemparelhar…");
          setBootKey((k) => k + 1);
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

  // RUNTIME-PLAYBACK-09 — HTTP command poll → Dispatcher → ACK (React Player only).
  useEffect(() => {
    if (phase !== "playing") return;

    const idempotency = createIdempotencyStore();

    const poller = createCommandPoller({
      intervalMs: COMMAND_TRANSPORT.POLL_INTERVAL_MS,
      getDeviceToken: async () => (await getConfig())?.deviceToken ?? null,
      dispatcher: {
        getIdempotencyStore: () => idempotency,
        dispatch: (command) => {
          const d = createCommandDispatcher({
            controller: {
              dispatch: (action) => {
                const handle = engineRef.current;
                if (!handle) return createInitialPlaybackState(0);
                const next = handle.dispatch(action);
                setPlaybackState(next);
                try {
                  getPlayerSessionStore().observePlayback(next);
                } catch {
                  /* observational */
                }
                return next;
              },
              getState: () =>
                engineRef.current?.getState() ?? createInitialPlaybackState(0),
            } as PlaybackController,
            getSession: () => {
              const sess = getPlayerSessionStore().getSession();
              if (!sess) return null;
              return {
                sessionId: sess.sessionId,
                deviceId: sess.deviceId,
                tenantId: sess.tenantId,
              };
            },
            auth: {
              authorized: true,
              tenantId: command.tenantId,
              deviceTenantId: command.tenantId,
              deviceId: command.deviceId,
              role: "OPERATOR",
            },
            idempotency,
          });
          return d.dispatch(command);
        },
      },
      onError: () => {
        /* never block playback */
      },
    });

    poller.start();
    return () => poller.stop();
  }, [phase, deviceId]);

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
        <p style={{ fontSize: 28, margin: 0, color: "#2b2550", fontWeight: 700 }}>
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
            padding: "14px 30px",
            fontSize: 18,
            fontWeight: 600,
            background: "#7057dc",
            color: "#fff",
            border: "none",
            borderRadius: 999,
            boxShadow: "0 10px 24px rgba(112,87,220,0.35)",
            cursor: "pointer",
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
    const codeChars = (activationCode ?? "").split("");
    const expired = Boolean(pairExpiryLabel && pairExpiryLabel.includes("expirou"));
    return (
      <div style={bootShellStyle}>
        <div
          style={{
            width: "min(640px, 100%)",
            boxSizing: "border-box",
            padding: "clamp(24px, 5vw, 48px)",
            background: "rgba(255,255,255,0.8)",
            border: "1px solid rgba(255,255,255,0.95)",
            borderRadius: 40,
            boxShadow: "0 30px 70px -24px rgba(88,64,180,0.4)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
          }}
        >
          <p
            style={{
              fontSize: "clamp(28px, 5vw, 40px)",
              fontWeight: 700,
              margin: 0,
              color: "#7057dc",
              fontFamily: "var(--font-fraunces), Georgia, serif",
            }}
          >
            Vitrine360
          </p>
          <p style={{ marginTop: 12, color: "rgba(43,37,80,0.6)", fontSize: 18 }}>
            Código de activação
          </p>
          <div
            data-activation-code={activationCode ?? ""}
            aria-label={`Código de activação ${activationCode ?? ""}`}
            style={{
              marginTop: 24,
              display: "flex",
              justifyContent: "center",
              gap: "clamp(6px, 1.4vw, 14px)",
            }}
          >
            {codeChars.map((ch, i) => (
              <span
                key={i}
                style={{
                  width: "clamp(40px, 9vw, 72px)",
                  height: "clamp(56px, 12vw, 96px)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 20,
                  background: "#fff",
                  border: "1px solid rgba(112,87,220,0.18)",
                  boxShadow: "0 8px 20px -8px rgba(88,64,180,0.35)",
                  color: "#2b2550",
                  fontFamily: "ui-monospace, monospace",
                  fontWeight: 700,
                  fontSize: "clamp(26px, 6vw, 48px)",
                }}
              >
                {ch}
              </span>
            ))}
          </div>
          {pairExpiryLabel ? (
            <p
              style={{
                display: "inline-block",
                marginTop: 24,
                padding: "8px 18px",
                borderRadius: 999,
                background: expired ? "rgba(239,68,68,0.1)" : "rgba(112,87,220,0.1)",
                color: expired ? "#c92a4a" : "#553fb8",
                fontSize: 16,
                fontWeight: 600,
              }}
            >
              {pairExpiryLabel}
            </p>
          ) : null}
          <p
            style={{
              margin: "28px auto 0",
              maxWidth: 420,
              color: "rgba(43,37,80,0.6)",
              fontSize: 16,
              lineHeight: 1.5,
            }}
          >
            Introduza este código no Admin Console para associar este dispositivo.
          </p>
        </div>
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
      {(() => {
        const engine = (
          <DisplayEngine
            ref={engineRef}
            items={items}
            playlistId="device-playlist"
            manifestVersion={manifestVersion}
            onItemChange={(item) => {
              setCurrentContentId(item?.contentId);
            }}
            onPlaybackStateChange={(pb) => {
              setPlaybackState(pb);
              try {
                updateRuntimeState({
                  currentContentId: pb.currentContentId,
                  isPlaying: pb.status === "PLAYING",
                });
              } catch {
                /* observational — RuntimeState is not playback SoT */
              }
              try {
                getPlayerSessionStore().observePlayback(pb);
              } catch {
                /* observational — never block playback */
              }
            }}
          />
        );
        if (fragileTv) return engine;
        const current = items[playbackState.currentItemIndex];
        return (
          <PlaybackChrome
            state={playbackState}
            dispatch={dispatchPlayback}
            itemCount={items.length}
            itemTitle={current?.title ?? null}
            autoHide
            style={{ height: "100%", width: "100%" }}
          >
            {engine}
          </PlaybackChrome>
        );
      })()}
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
          <div className="mt-1 opacity-70">
            {(() => {
              try {
                const s = getPlayerSessionStore().getSession();
                if (!s) return "session: (none)";
                return formatPlayerDiagnostics(s);
              } catch {
                return "session: (error)";
              }
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
