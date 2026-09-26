import type { DeviceManifest } from "@/services/manifest";
import {
  getConfig,
  getCurrentManifest,
  hasAsset,
  putAssetBlob,
  setMeta,
  cleanStaleAssets,
  prepareNextManifest,
  activateNextManifest,
  type LocalManifest,
} from "@/player/cache/indexed-db";
import {
  assetsRequiringDownload,
  checksumMatches,
  shouldAttachDeviceBearer,
} from "@/player/sync/atomic";
import { applyServerDeviceConfig } from "@/player/runtime/device-config";
import {
  runtimeStateForHeartbeat,
  updateRuntimeState,
} from "@/player/runtime/state";
import { getPlayerSessionStore } from "@/player/session/player-session-store";

const PLAYER_VERSION = "0.1.2-smarttv";

function noteSyncState(
  syncState: "IDLE" | "SYNCING" | "READY" | "ERROR",
): void {
  try {
    updateRuntimeState({ syncState });
  } catch {
    /* observational — never break sync */
  }
  try {
    getPlayerSessionStore().noteSync(syncState, syncState === "READY");
  } catch {
    /* telemetry failure isolation */
  }
}

async function authHeaders() {
  const config = await getConfig();
  if (!config?.deviceToken) return null;
  return {
    Authorization: `Bearer ${config.deviceToken}`,
    "Content-Type": "application/json",
  };
}

export async function sendHeartbeat(extra?: {
  playlistId?: string;
  contentId?: string;
  playerState?: string;
  resolution?: string;
  sessionId?: string;
  /** Compact observed playback — never treated as command authority. */
  playback?: Record<string, unknown>;
  runtimeState?: Record<string, unknown>;
  policy?: {
    policySource?: string;
    requested?: Record<string, unknown>;
    resolved?: Record<string, unknown>;
  };
  diagnostics?: Array<{
    code: string;
    severity?: "INFO" | "WARNING" | "ERROR";
    message?: string;
  }>;
  observedAt?: string;
}) {
  const headers = await authHeaders();
  if (!headers) return null;
  try {
    let policy = extra?.policy;
    let diagnostics = extra?.diagnostics;
    if (typeof window !== "undefined" && (!policy || !diagnostics)) {
      try {
        const snap = (
          window as unknown as {
            __v360_runtime_state?: {
              policy?: {
                policySource?: string;
                requested?: Record<string, unknown>;
                resolved?: Record<string, unknown>;
              };
              policyActualDiagnostics?: Array<{
                code: string;
                severity?: "INFO" | "WARNING" | "ERROR";
                message?: string;
              }>;
            };
          }
        ).__v360_runtime_state;
        if (!policy && snap?.policy) {
          policy = {
            policySource: snap.policy.policySource,
            requested: snap.policy.requested,
            resolved: snap.policy.resolved,
          };
        }
        if (!diagnostics && snap?.policyActualDiagnostics) {
          diagnostics = snap.policyActualDiagnostics;
        }
      } catch {
        /* ignore */
      }
    }
    const res = await fetch("/api/device/heartbeat", {
      method: "POST",
      headers,
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        playerVersion: PLAYER_VERSION,
        runtimeState: extra?.runtimeState ?? runtimeStateForHeartbeat(),
        observedAt: extra?.observedAt ?? new Date().toISOString(),
        ...(policy ? { policy } : {}),
        ...(diagnostics ? { diagnostics } : {}),
        ...extra,
      }),
    });
    if (!res.ok) {
      if (res.status === 401) throw new Error("UNAUTHORIZED");
      return null;
    }
    const data = (await res.json()) as {
      manifestVersion: number;
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
    if (data.deviceConfig) {
      await applyServerDeviceConfig(data.deviceConfig);
    }
    return data;
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") throw e;
    return null;
  }
}

export async function fetchSync(clientVersion: number) {
  const headers = await authHeaders();
  if (!headers) return null;
  try {
    const res = await fetch(`/api/device/sync?version=${clientVersion}`, {
      headers,
    });
    if (!res.ok) {
      if (res.status === 401) throw new Error("UNAUTHORIZED");
      return null;
    }
    return (await res.json()) as {
      upToDate: boolean;
      manifest: DeviceManifest | null;
      changedAssetIds: string[];
    };
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") throw e;
    return null;
  }
}

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Download asset with device auth. Validates checksum when present.
 * Large files skip IndexedDB (stream from URL) to avoid OOM on mobile/TV
 * during playlist updates — playback still works via remote/presigned URL.
 */
const MAX_OFFLINE_CACHE_BYTES = 12 * 1024 * 1024;

export async function downloadAsset(asset: {
  id: string;
  url: string;
  offlineUrl?: string;
  checksum: string;
}): Promise<{ cached: boolean; skipped?: boolean }> {
  if (await hasAsset(asset.id, asset.checksum)) {
    return { cached: true };
  }

  const headers = await authHeaders();
  // Signed R2/S3 URLs reject an extra Authorization header; only attach Bearer for app media routes.
  const origin =
    typeof window !== "undefined" ? window.location.origin : undefined;
  const downloadUrl = asset.offlineUrl ?? asset.url;
  const res = await fetch(downloadUrl, {
    headers:
      shouldAttachDeviceBearer(downloadUrl, origin) && headers
        ? { Authorization: headers.Authorization }
        : undefined,
  });
  if (!res.ok) throw new Error(`Failed download ${asset.id} (${res.status})`);

  const declared = Number(res.headers.get("content-length") || 0);
  if (declared > MAX_OFFLINE_CACHE_BYTES) {
    return { cached: false, skipped: true };
  }

  const blob = await res.blob();
  if (blob.size > MAX_OFFLINE_CACHE_BYTES) {
    return { cached: false, skipped: true };
  }

  const buffer = await blob.arrayBuffer();
  const actual = await sha256Hex(buffer);

  if (!checksumMatches(asset.checksum, actual)) {
    throw new Error(`Checksum mismatch for ${asset.id}`);
  }

  await putAssetBlob(asset.id, blob, asset.checksum);
  return { cached: true };
}

type ManifestItem = {
  assets: {
    id: string;
    url: string;
    offlineUrl?: string;
    checksum: string;
  }[];
  [key: string]: unknown;
};

function playlistItemCount(manifest: LocalManifest | null) {
  if (!manifest?.playlist || typeof manifest.playlist !== "object") return 0;
  const items = (manifest.playlist as { items?: unknown[] }).items;
  return Array.isArray(items) ? items.length : 0;
}

/**
 * Sync playlist: soft-activate for online playback first (smooth updates),
 * then best-effort offline cache. Never clears CURRENT on download failure.
 */
export async function runSyncCycle(options?: {
  /** Test hook: abort after N successful downloads */
  abortAfterDownloads?: number;
  /** When false, require full offline cache before activate (legacy strict). Default true. */
  softOnlineActivate?: boolean;
}): Promise<{
  activated: boolean;
  manifest: LocalManifest | null;
  error?: string;
}> {
  const softOnline = options?.softOnlineActivate !== false;
  noteSyncState("SYNCING");
  const current = await getCurrentManifest();
  // Empty cache must not look "up to date" at version 0 — that left the
  // player on "Aguardando playlist sincronizada" after pairing.
  const clientVersion =
    playlistItemCount(current) > 0 ? (current?.manifestVersion ?? -1) : -1;
  const delta = await fetchSync(clientVersion);

  // Offline / transport failure → keep last valid CURRENT
  if (!delta) {
    noteSyncState("ERROR");
    return { activated: false, manifest: current, error: "sync unavailable" };
  }

  // Idempotent poll: no manifest body and no asset walk / HTTP
  if (delta.upToDate || !delta.manifest) {
    noteSyncState("READY");
    return { activated: false, manifest: current };
  }

  const remote = delta.manifest;
  const rawItems = (remote.playlist?.items ?? []) as ManifestItem[];
  if (!rawItems.length) {
    const msg = "Sync produced empty playlist";
    await setMeta("LAST_SYNC_ERROR", {
      at: new Date().toISOString(),
      msg,
    }).catch(() => undefined);
    noteSyncState("ERROR");
    return { activated: false, manifest: current, error: msg };
  }

  const assets = rawItems.flatMap((i) => i.assets ?? []);
  const requiredIds = assets.map((a) => a.id);

  const next: LocalManifest = {
    manifestVersion: remote.manifestVersion,
    playlist: remote.playlist
      ? { ...remote.playlist, items: rawItems }
      : { items: rawItems },
    schedules: remote.schedules,
    generatedAt: remote.generatedAt,
    assetIds: requiredIds,
  };

  try {
    await prepareNextManifest(next);

    // Soft promote first so /player keeps presenting while large assets cache.
    let activatedManifest: LocalManifest | null = null;
    if (softOnline) {
      activatedManifest = await activateNextManifest({ allowIncomplete: true });
    }

    const presentSync = new Map<string, boolean>();
    const isPresent = (id: string, checksum: string) => {
      const key = `${id}|${checksum}`;
      return presentSync.get(key) === true;
    };

    for (const asset of assets) {
      const key = `${asset.id}|${asset.checksum}`;
      if (presentSync.has(key)) continue;
      presentSync.set(key, await hasAsset(asset.id, asset.checksum));
    }

    const queue = assetsRequiringDownload(assets, isPresent);

    let downloaded = 0;
    for (const asset of queue) {
      if (
        options?.abortAfterDownloads != null &&
        downloaded >= options.abortAfterDownloads
      ) {
        throw new Error("Simulated download interruption");
      }
      try {
        const result = await downloadAsset(asset);
        if (result.cached) {
          presentSync.set(`${asset.id}|${asset.checksum}`, true);
          downloaded++;
        }
      } catch (err) {
        console.warn("[v360-sync] asset cache skipped", asset.id, err);
      }
    }

    if (!activatedManifest) {
      activatedManifest = await activateNextManifest({
        allowIncomplete: softOnline,
      });
    }

    if (!activatedManifest) {
      throw new Error("Incomplete sync: activation returned null");
    }

    await cleanStaleAssets().catch((err) => console.error("GC failed:", err));
    await setMeta("LAST_SYNC_ERROR", null).catch(() => undefined);

    noteSyncState("READY");
    try {
      updateRuntimeState({
        currentManifestVersion: activatedManifest.manifestVersion,
      });
    } catch {
      /* ignore */
    }
    return { activated: true, manifest: activatedManifest };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "sync failed";
    console.error("Sync failed — keeping current manifest", e);
    await setMeta("NEXT_MANIFEST", null).catch(() => undefined);
    await setMeta("LAST_SYNC_ERROR", {
      at: new Date().toISOString(),
      msg,
    }).catch(() => undefined);
    noteSyncState("ERROR");
    // Prefer whatever is already CURRENT (may be soft-activated).
    const kept = await getCurrentManifest().catch(() => current);
    return { activated: false, manifest: kept ?? current, error: msg };
  }
}

export { PLAYER_VERSION };
