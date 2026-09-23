import { canActivateAssetSet } from "@/player/sync/atomic";
import { isFragileSmartTvBrowser } from "@/player/device/fragile-tv";

/** IndexedDB cache for offline-first player */

const DB_NAME = "vitrine360-player";
const DB_VERSION = 1;
const IDB_TIMEOUT_MS = 4_000;
const CONFIG_LS_KEY = "v360-player-config";

export type LocalConfig = {
  deviceId: string;
  deviceToken: string;
  deviceCode?: string | null;
  clientId?: string;
  activationCode?: string;
  /** ISO expiry from pair_start — player must refresh when past this. */
  expiresAt?: string | null;
  /** Ephemeral secret from pair_start; cleared after successful claim */
  pairingSecret?: string;
  /** Tenant scope from server Device row (policy enrichment). */
  tenantId?: string | null;
  /** Server Device.displayType — hardware context, not presentation. */
  displayType?: string;
  /** Server Device.interactionMode */
  interactionMode?: string;
  /** Server Device.orientation (landscape|portrait|auto) */
  orientation?: string;
  /**
   * Server Device.timezone — Schedule/Runtime clock only.
   * Must NOT be copied into DomainRuntimePolicy.
   */
  timezone?: string | null;
  /** True once displayType/interactionMode/orientation came from server. */
  hasDevicePolicy?: boolean;
};

export type LocalManifest = {
  manifestVersion: number;
  playlist: unknown;
  schedules: unknown;
  generatedAt: string;
  assetIds: string[];
};

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = window.setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms,
    );
    promise.then(
      (v) => {
        window.clearTimeout(t);
        resolve(v);
      },
      (e) => {
        window.clearTimeout(t);
        reject(e);
      },
    );
  });
}

function readConfigFromLocalStorage(): LocalConfig | null {
  try {
    const raw = window.localStorage.getItem(CONFIG_LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as LocalConfig;
  } catch {
    return null;
  }
}

function writeConfigToLocalStorage(config: LocalConfig | null): void {
  try {
    if (!config) {
      window.localStorage.removeItem(CONFIG_LS_KEY);
      return;
    }
    window.localStorage.setItem(CONFIG_LS_KEY, JSON.stringify(config));
  } catch {
    /* private mode / quota — ignore */
  }
}

function openDb(): Promise<IDBDatabase> {
  if (isFragileSmartTvBrowser()) {
    return Promise.reject(new Error("indexedDB skipped on Smart TV browser"));
  }
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("indexedDB unavailable"));
  }
  const open = new Promise<IDBDatabase>((resolve, reject) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("meta")) {
          db.createObjectStore("meta");
        }
        if (!db.objectStoreNames.contains("assets")) {
          db.createObjectStore("assets");
        }
        if (!db.objectStoreNames.contains("blobs")) {
          db.createObjectStore("blobs");
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error("indexedDB open failed"));
      req.onblocked = () => reject(new Error("indexedDB open blocked"));
    } catch (e) {
      reject(e);
    }
  });
  return withTimeout(open, IDB_TIMEOUT_MS, "indexedDB.open");
}

function idbReq<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getMeta<T>(key: string): Promise<T | null> {
  const db = await openDb();
  const tx = db.transaction("meta", "readonly");
  const val = await idbReq(tx.objectStore("meta").get(key));
  db.close();
  return (val as T) ?? null;
}

export async function setMeta<T>(key: string, value: T): Promise<void> {
  const db = await openDb();
  const tx = db.transaction("meta", "readwrite");
  await idbReq(tx.objectStore("meta").put(value, key));
  db.close();
}

export async function getConfig(): Promise<LocalConfig | null> {
  // Smart TV browsers (Sraf/webOS/Tizen) can freeze the JS event loop on
  // indexedDB.open — timeouts never fire. Always prefer localStorage.
  const fromLs = readConfigFromLocalStorage();
  if (fromLs) return fromLs;
  // Desktop: repair LS from IDB mirror when LS was wiped but cache remains.
  if (isFragileSmartTvBrowser()) return null;
  try {
    const fromIdb = await withTimeout(
      getMeta<LocalConfig>("config"),
      IDB_TIMEOUT_MS,
      "getConfigIdb",
    );
    if (fromIdb) {
      writeConfigToLocalStorage(fromIdb);
      return fromIdb;
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** Background IDB hydrate — never call on the boot critical path. */
export function hydrateConfigFromIdbInBackground(): void {
  if (isFragileSmartTvBrowser()) return;
  void (async () => {
    try {
      const fromIdb = await withTimeout(
        getMeta<LocalConfig>("config"),
        IDB_TIMEOUT_MS,
        "hydrateConfig",
      );
      if (fromIdb && !readConfigFromLocalStorage()) {
        writeConfigToLocalStorage(fromIdb);
      }
    } catch {
      /* ignore */
    }
  })();
}

export async function saveConfig(config: LocalConfig | null): Promise<void> {
  writeConfigToLocalStorage(config);
  if (!config) return;
  if (isFragileSmartTvBrowser()) return;
  // Fire-and-forget IDB — must not block pairing UI on Smart TV
  void withTimeout(setMeta("config", config), IDB_TIMEOUT_MS, "saveConfig").catch(
    () => undefined,
  );
}

export async function getCurrentManifest() {
  return getMeta<LocalManifest>("CURRENT_MANIFEST");
}

export async function getNextManifest() {
  return getMeta<LocalManifest>("NEXT_MANIFEST");
}

export async function prepareNextManifest(manifest: LocalManifest) {
  return setMeta("NEXT_MANIFEST", manifest);
}

export async function putAssetBlob(
  assetId: string,
  blob: Blob,
  checksum: string,
) {
  const db = await openDb();
  const tx = db.transaction(["blobs", "assets"], "readwrite");
  await idbReq(tx.objectStore("blobs").put(blob, assetId));
  await idbReq(
    tx.objectStore("assets").put({ id: assetId, checksum, size: blob.size }, assetId),
  );
  db.close();
}

export async function getAssetBlob(assetId: string): Promise<Blob | null> {
  const db = await openDb();
  const tx = db.transaction("blobs", "readonly");
  const blob = await idbReq(tx.objectStore("blobs").get(assetId));
  db.close();
  return (blob as Blob) ?? null;
}

export async function hasAsset(
  assetId: string,
  checksum: string,
): Promise<boolean> {
  const db = await openDb();
  const tx = db.transaction("assets", "readonly");
  const meta = await idbReq(tx.objectStore("assets").get(assetId));
  db.close();
  if (!meta) return false;
  return (meta as { checksum: string }).checksum === checksum;
}

/**
 * Activate NEXT only if every listed asset exists with matching checksum.
 * On failure, leaves CURRENT unchanged and clears incomplete NEXT.
 */
export async function activateNextManifest() {
  const next = await getNextManifest();
  if (!next) return null;

  type AssetRow = { id: string; checksum?: string };
  const items =
    next.playlist && typeof next.playlist === "object"
      ? ((next.playlist as { items?: { assets?: AssetRow[] }[] }).items ?? [])
      : [];
  const fromPlaylist = items.flatMap((item) => item.assets ?? []);
  const required: AssetRow[] =
    fromPlaylist.length > 0
      ? fromPlaylist
      : next.assetIds.map((id) => ({ id, checksum: "" }));

  const present = new Set<string>();
  for (const asset of required) {
    if (!asset.id) continue;
    if (asset.checksum) {
      if (await hasAsset(asset.id, asset.checksum)) present.add(asset.id);
      continue;
    }
    const blob = await getAssetBlob(asset.id);
    if (blob) present.add(asset.id);
  }

  const requiredIds = [...new Set(required.map((a) => a.id).filter(Boolean))];
  if (!canActivateAssetSet(requiredIds, present)) {
    await setMeta("NEXT_MANIFEST", null);
    throw new Error("Incomplete sync: missing assets — keeping current manifest");
  }

  await setMeta("CURRENT_MANIFEST", next);
  await setMeta("NEXT_MANIFEST", null);
  return next;
}

export async function createObjectUrl(assetId: string): Promise<string | null> {
  const blob = await getAssetBlob(assetId);
  if (!blob) return null;
  return URL.createObjectURL(blob);
}

export async function cleanStaleAssets(): Promise<void> {
  const current = await getCurrentManifest();
  if (!current) return;

  const requiredIds = new Set(current.assetIds);

  const db = await openDb();
  const tx = db.transaction(["assets", "blobs"], "readwrite");
  const assetsStore = tx.objectStore("assets");
  const blobsStore = tx.objectStore("blobs");

  const allKeys = await idbReq(assetsStore.getAllKeys());
  if (!allKeys) {
    db.close();
    return;
  }

  let cleaned = 0;
  for (const key of allKeys) {
    const assetId = key as string;
    if (!requiredIds.has(assetId)) {
      assetsStore.delete(assetId);
      blobsStore.delete(assetId);
      cleaned++;
    }
  }

  db.close();
  if (cleaned > 0) {
    console.log(`[v360-gc] Cleaned ${cleaned} stale assets from IndexedDB`);
  }
}

/** Diagnostic: wipe local player state (pairing + cache). */
export async function clearAllPlayerData(): Promise<void> {
  writeConfigToLocalStorage(null);
  try {
    window.sessionStorage.clear();
  } catch {
    /* ignore */
  }
  if (isFragileSmartTvBrowser() || typeof indexedDB === "undefined") return;
  // Cap wait — deleteDatabase can hang forever on Smart TV browsers
  await new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    try {
      const req = indexedDB.deleteDatabase(DB_NAME);
      req.onsuccess = finish;
      req.onerror = finish;
      req.onblocked = finish;
    } catch {
      finish();
    }
    window.setTimeout(finish, 400);
  });
}
