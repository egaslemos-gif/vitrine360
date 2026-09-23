/**
 * RUNTIME-CACHE-02 — Live warm-cache validation (Chromium + Playwright).
 *
 * Environment note: with MEDIA_STORAGE_PROVIDER=r2, /api/device/media may 502
 * if upstream signed URLs fail in lab. This script therefore:
 *   1) pairs a real Device + assigns playlist with assets A/B/C (server sync OK)
 *   2) warms IDB from the sync manifest + local PNG bytes (simulates prior successful download)
 *   3) hard-refreshes and measures Network — expect 0 media HTTP, blob playback
 *
 * Usage:
 *   BASE_URL=http://127.0.0.1:3000 npx tsx scripts/live-warm-cache-validate.ts
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { chromium, type Page, type Request } from "playwright";

const BASE = (process.env.BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const DEVICE_CODE =
  process.env.DEVICE_CODE ?? `TV-WC-${Date.now().toString(36).toUpperCase()}`;

const PNG_A = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const PNG_B = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);
const PNG_C = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPj/HwADBwIAMCbHYQAAAABJRU5ErkJggg==",
  "base64",
);

type IdbProbe = {
  config: unknown;
  manifestVersion: number | null;
  assetIds: string[];
  blobCount: number;
  assetMetaCount: number;
  error?: string;
};

const PROBE_IDB_JS = `(() => {
  const ls = localStorage.getItem("v360-player-config");
  let config = null;
  try { config = ls ? JSON.parse(ls) : null; } catch (e) { config = ls; }
  const open = () => new Promise((resolve, reject) => {
    const req = indexedDB.open("vitrine360-player", 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta");
      if (!db.objectStoreNames.contains("assets")) db.createObjectStore("assets");
      if (!db.objectStoreNames.contains("blobs")) db.createObjectStore("blobs");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return (async () => {
    try {
      const db = await open();
      const get = (store, key) => new Promise((resolve, reject) => {
        const tx = db.transaction(store, "readonly");
        const r = tx.objectStore(store).get(key);
        r.onsuccess = () => resolve(r.result ?? null);
        r.onerror = () => reject(r.error);
      });
      const count = (store) => new Promise((resolve, reject) => {
        const tx = db.transaction(store, "readonly");
        const r = tx.objectStore(store).count();
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
      const manifest = await get("meta", "CURRENT_MANIFEST");
      const blobCount = await count("blobs");
      const assetMetaCount = await count("assets");
      db.close();
      return {
        config,
        manifestVersion: manifest && manifest.manifestVersion != null ? manifest.manifestVersion : null,
        assetIds: (manifest && manifest.assetIds) ? manifest.assetIds : [],
        blobCount,
        assetMetaCount,
      };
    } catch (e) {
      return { config, manifestVersion: null, assetIds: [], blobCount: 0, assetMetaCount: 0, error: String(e) };
    }
  })();
})()`;

async function probeIdb(page: Page): Promise<IdbProbe> {
  return page.evaluate(PROBE_IDB_JS) as Promise<IdbProbe>;
}

async function loginCookie(): Promise<string> {
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "admin@vitrine360.local",
      password: "Admin123!",
    }),
  });
  assert.equal(loginRes.status, 200, "login failed — run db:seed?");
  return (loginRes.headers.getSetCookie?.() ?? [])
    .map((c) => c.split(";")[0])
    .join("; ");
}

async function uploadPng(cookie: string, buf: Buffer, name: string) {
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(buf)], { type: "image/png" }), name);
  const res = await fetch(`${BASE}/api/admin/media`, {
    method: "POST",
    headers: { Cookie: cookie },
    body: form,
  });
  const text = await res.text();
  assert.equal(res.status, 200, text);
  return JSON.parse(text) as { id: string; checksum?: string };
}

async function createImageContent(cookie: string, title: string, mediaAssetId: string) {
  const res = await fetch(`${BASE}/api/admin/contents`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      type: "IMAGE",
      title,
      durationMs: 5000,
      payload: {},
      status: "ACTIVE",
      mediaAssetId,
    }),
  });
  const body = (await res.json()) as { id?: string };
  assert.equal(res.status, 200, JSON.stringify(body));
  assert.ok(body.id);
  return body.id!;
}

async function waitForActivationCode(page: Page): Promise<string> {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const probe = (await page.evaluate(`(() => {
      const text = (document.body && document.body.innerText ? document.body.innerText : "").replace(/\\s+/g, " ");
      const m = text.match(/\\b(\\d{6})\\b/);
      return { text: text.slice(0, 400), code: m ? m[1] : null };
    })()`)) as { text: string; code: string | null } | null;
    if (probe?.code) return probe.code;
    await page.waitForTimeout(500);
  }
  throw new Error("Activation code not found");
}

function checksumOf(buf: Buffer) {
  return `sha256:${createHash("sha256").update(buf).digest("hex")}`;
}

async function main() {
  console.log("BASE", BASE);
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext()).newPage();

  await page.goto(`${BASE}/player`, { waitUntil: "domcontentloaded" });
  const activationCode = await waitForActivationCode(page);
  console.log("activationCode", activationCode);

  const cookie = await loginCookie();
  const jsonHeaders = {
    "Content-Type": "application/json",
    Cookie: cookie,
  };

  assert.equal(
    (
      await fetch(`${BASE}/api/admin/devices`, {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({
          activationCode,
          name: "Warm Cache Live Validation",
          location: "Lab",
          deviceCode: DEVICE_CODE,
        }),
      })
    ).status,
    200,
  );

  const claimDeadline = Date.now() + 60_000;
  while (Date.now() < claimDeadline) {
    const cfg = (await page.evaluate(`(() => {
      try { return JSON.parse(localStorage.getItem("v360-player-config") || "null"); }
      catch (e) { return null; }
    })()`)) as { deviceToken?: string } | null;
    if (cfg?.deviceToken) break;
    await page.waitForTimeout(400);
  }

  const mediaA = await uploadPng(cookie, PNG_A, `warm-a-${Date.now()}.png`);
  const mediaB = await uploadPng(cookie, PNG_B, `warm-b-${Date.now()}.png`);
  const mediaC = await uploadPng(cookie, PNG_C, `warm-c-${Date.now()}.png`);
  const contentA = await createImageContent(cookie, "Warm A", mediaA.id);
  const contentB = await createImageContent(cookie, "Warm B", mediaB.id);
  const contentC = await createImageContent(cookie, "Warm C", mediaC.id);

  const plRes = await fetch(`${BASE}/api/admin/playlists`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ name: `Warm ${DEVICE_CODE}` }),
  });
  const pl = (await plRes.json()) as { id: string };
  assert.ok(pl.id);

  for (const contentId of [contentA, contentB, contentC]) {
    const add = await fetch(`${BASE}/api/admin/playlists`, {
      method: "PATCH",
      headers: jsonHeaders,
      body: JSON.stringify({ action: "add_item", playlistId: pl.id, contentId }),
    });
    assert.ok(add.ok, await add.text());
  }

  const devicesRes = await fetch(`${BASE}/api/admin/devices`, {
    headers: { Cookie: cookie },
  });
  const devicesBody = await devicesRes.json();
  const devicesList = (devicesBody.devices ?? []) as {
    id: string;
    deviceCode?: string | null;
  }[];
  const device = devicesList.find((d) => d.deviceCode === DEVICE_CODE);
  assert.ok(device);

  assert.ok(
    (
      await fetch(`${BASE}/api/admin/devices/${device.id}/assign`, {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ playlistId: pl.id }),
      })
    ).ok,
  );
  console.log("assigned", { deviceId: device.id, playlistId: pl.id });

  const cfg = (await page.evaluate(`(() => {
    try { return JSON.parse(localStorage.getItem("v360-player-config") || "null"); }
    catch (e) { return null; }
  })()`)) as { deviceToken: string };
  assert.ok(cfg?.deviceToken);

  const syncRes = await fetch(`${BASE}/api/device/sync?version=-1`, {
    headers: { Authorization: `Bearer ${cfg.deviceToken}` },
  });
  const syncBody = await syncRes.json();
  assert.equal(syncRes.status, 200);
  assert.equal(syncBody.upToDate, false);
  assert.ok(syncBody.manifest?.playlist?.items?.length >= 3);
  const remoteAssets = (syncBody.manifest.playlist.items as { assets: { id: string; checksum: string }[] }[])
    .flatMap((i) => i.assets ?? []);
  assert.ok(remoteAssets.length >= 3, "manifest must list ≥3 assets");
  console.log("server manifest", {
    version: syncBody.manifest.manifestVersion,
    assets: remoteAssets.map((a) => a.id),
  });

  // Map remote asset ids to local PNG bytes (by upload order / content titles not needed —
  // match by checksum when server returns sha256, else by id order mediaA/B/C).
  const localByChecksum = new Map([
    [checksumOf(PNG_A), PNG_A],
    [checksumOf(PNG_B), PNG_B],
    [checksumOf(PNG_C), PNG_C],
  ]);
  const localById = new Map([
    [mediaA.id, PNG_A],
    [mediaB.id, PNG_B],
    [mediaC.id, PNG_C],
  ]);

  const warmPayload = {
    manifest: {
      manifestVersion: syncBody.manifest.manifestVersion as number,
      playlist: syncBody.manifest.playlist,
      schedules: syncBody.manifest.schedules ?? [],
      generatedAt: syncBody.manifest.generatedAt ?? new Date().toISOString(),
      assetIds: remoteAssets.map((a) => a.id),
    },
    blobs: remoteAssets.map((a) => {
      const buf =
        localById.get(a.id) ??
        localByChecksum.get(a.checksum) ??
        localByChecksum.get(`sha256:${a.checksum}`) ??
        PNG_A;
      return {
        id: a.id,
        checksum: a.checksum || checksumOf(buf),
        bytes: [...buf],
      };
    }),
  };

  // Warm IDB (simulates Device that already completed atomic sync successfully)
  const warmResult = await page.evaluate(`(async (payload) => {
    const open = () => new Promise((resolve, reject) => {
      const req = indexedDB.open("vitrine360-player", 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta");
        if (!db.objectStoreNames.contains("assets")) db.createObjectStore("assets");
        if (!db.objectStoreNames.contains("blobs")) db.createObjectStore("blobs");
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const db = await open();
    await new Promise((resolve, reject) => {
      const tx = db.transaction("meta", "readwrite");
      tx.objectStore("meta").put(payload.manifest, "CURRENT_MANIFEST");
      tx.objectStore("meta").put(null, "NEXT_MANIFEST");
      tx.objectStore("meta").put(null, "LAST_SYNC_ERROR");
      tx.oncomplete = () => resolve(null);
      tx.onerror = () => reject(tx.error);
    });
    for (const b of payload.blobs) {
      const bytes = new Uint8Array(b.bytes);
      const blob = new Blob([bytes], { type: "image/png" });
      await new Promise((resolve, reject) => {
        const tx = db.transaction(["blobs", "assets"], "readwrite");
        tx.objectStore("blobs").put(blob, b.id);
        tx.objectStore("assets").put({ id: b.id, checksum: b.checksum, size: bytes.length }, b.id);
        tx.oncomplete = () => resolve(null);
        tx.onerror = () => reject(tx.error);
      });
    }
    db.close();
    return { ok: true, blobs: payload.blobs.length, version: payload.manifest.manifestVersion };
  })(${JSON.stringify(warmPayload)})`);

  console.log("IDB warmed", warmResult);
  const warm = await probeIdb(page);
  assert.ok(warm.blobCount >= 3, JSON.stringify(warm));
  assert.ok(warm.manifestVersion != null);
  console.log("WARM_STATE", warm);

  // --- Critical refresh measurement ---
  const mediaProxyHits: string[] = [];
  const imageHttp: string[] = [];
  const syncHits: string[] = [];

  const onRequest = (req: Request) => {
    const url = req.url();
    if (url.includes("/api/device/media/") || url.includes("/api/media/")) {
      mediaProxyHits.push(url);
    }
    if (url.includes("/api/device/sync")) syncHits.push(url);
    if (
      req.resourceType() === "image" &&
      !url.startsWith("blob:") &&
      !url.startsWith("data:") &&
      (url.includes("/api/") || url.includes("r2.") || url.includes("amazonaws"))
    ) {
      imageHttp.push(url);
    }
  };
  page.on("request", onRequest);

  const t0 = Date.now();
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(8000);
  page.off("request", onRequest);

  const after = await probeIdb(page);
  const playback = (await page.evaluate(`(() => {
    const img = document.querySelector("img.player-media, img");
    const video = document.querySelector("video");
    const src = (img && (img.currentSrc || img.src)) || (video && (video.currentSrc || video.src)) || "";
    const text = (document.body && document.body.innerText ? document.body.innerText.slice(0, 300) : "") || "";
    return {
      mediaSrcKind: src.indexOf("blob:") === 0 ? "blob" : src.indexOf("http") === 0 ? "http" : src ? "other" : "none",
      mediaSrcPrefix: String(src).slice(0, 80),
      bodySample: text.replace(/\\s+/g, " ").trim(),
    };
  })()`)) as {
    mediaSrcKind: string;
    mediaSrcPrefix: string;
    bodySample: string;
  };

  const report = {
    base: BASE,
    deviceCode: DEVICE_CODE,
    warmBeforeRefresh: warm,
    afterRefresh: after,
    refreshObserveMs: Date.now() - t0,
    syncRequests: syncHits.length,
    mediaProxyDownloads: mediaProxyHits.length,
    remoteImageHttp: imageHttp.length,
    mediaProxyUrls: mediaProxyHits,
    playback,
    notes: [
      "IDB seeded from server manifest + local PNG bytes for isolated warm-refresh measurement.",
      "Cold download through /api/device/media is validated separately by test:cold-path-live.",
      "Refresh measurement validates local-first playback + zero media redownload when cache is warm.",
    ],
    verdict: {
      localManifest:
        after.manifestVersion != null &&
        after.manifestVersion === warm.manifestVersion,
      localAssets: after.blobCount >= 3,
      mediaDownloadsZero: mediaProxyHits.length === 0 && imageHttp.length === 0,
      playbackFromBlob: playback.mediaSrcKind === "blob",
      syncControlPlaneOnly: syncHits.length >= 0, // allowed
    },
  };

  console.log("\n=== LIVE WARM-CACHE REPORT ===");
  console.log(JSON.stringify(report, null, 2));

  assert.equal(report.verdict.localManifest, true, "manifest from IDB");
  assert.equal(report.verdict.localAssets, true, "blobs from IDB");
  assert.equal(
    report.verdict.mediaDownloadsZero,
    true,
    `media HTTP must be 0 (proxy=${mediaProxyHits.length} img=${imageHttp.length})`,
  );
  assert.equal(
    report.verdict.playbackFromBlob,
    true,
    `expected blob: got ${playback.mediaSrcKind}`,
  );

  console.log("\nLIVE WARM-CACHE VALIDATION PASS");
  await browser.close();
}

main().catch((e) => {
  console.error("LIVE WARM-CACHE VALIDATION FAIL", e);
  process.exit(1);
});
