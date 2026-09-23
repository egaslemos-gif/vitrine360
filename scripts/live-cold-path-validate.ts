/**
 * RUNTIME-CACHE-02 — Real cold-path + partial failure + asset recovery.
 *
 * Does NOT pre-warm IndexedDB. Downloads go through /api/device/media/*.
 *
 * Usage:
 *   BASE_URL=http://127.0.0.1:3000 npx tsx scripts/live-cold-path-validate.ts
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { chromium, type Page, type Request } from "playwright";

const BASE = (process.env.BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const EVIDENCE_DIR = path.resolve("docs/evidence/runtime-cache-02");
const DEVICE_CODE =
  process.env.DEVICE_CODE ?? `TV-COLD-${Date.now().toString(36).toUpperCase()}`;

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
/** Distinct “B-new” checksum for partial-failure / recovery tests. */
const PNG_B_NEW = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR42mP8z8BQz0AEYBxVSF+FAP5FDvcfRYWgAAAAAElFTkSuQmCC",
  "base64",
);

type IdbProbe = {
  manifestVersion: number | null;
  assetIds: string[];
  blobCount: number;
  assetMetaCount: number;
  hasNext: boolean;
  lastError: unknown;
  blobIds: string[];
};

function sha256(buf: Buffer) {
  return `sha256:${createHash("sha256").update(buf).digest("hex")}`;
}

function writeEvidence(name: string, body: string) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  fs.writeFileSync(path.join(EVIDENCE_DIR, name), body, "utf8");
}

const PROBE_JS = `(() => {
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
      const keys = (store) => new Promise((resolve, reject) => {
        const tx = db.transaction(store, "readonly");
        const r = tx.objectStore(store).getAllKeys();
        r.onsuccess = () => resolve(r.result || []);
        r.onerror = () => reject(r.error);
      });
      const count = (store) => new Promise((resolve, reject) => {
        const tx = db.transaction(store, "readonly");
        const r = tx.objectStore(store).count();
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
      const current = await get("meta", "CURRENT_MANIFEST");
      const next = await get("meta", "NEXT_MANIFEST");
      const lastError = await get("meta", "LAST_SYNC_ERROR");
      const blobIds = await keys("blobs");
      const blobCount = await count("blobs");
      const assetMetaCount = await count("assets");
      db.close();
      return {
        manifestVersion: current && current.manifestVersion != null ? current.manifestVersion : null,
        assetIds: (current && current.assetIds) ? current.assetIds : [],
        blobCount,
        assetMetaCount,
        hasNext: !!next,
        lastError,
        blobIds,
      };
    } catch (e) {
      return {
        manifestVersion: null,
        assetIds: [],
        blobCount: 0,
        assetMetaCount: 0,
        hasNext: false,
        lastError: String(e),
        blobIds: [],
      };
    }
  })();
})()`;

async function probeIdb(page: Page): Promise<IdbProbe> {
  return page.evaluate(PROBE_JS) as Promise<IdbProbe>;
}

async function loginCookie() {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "admin@vitrine360.local",
      password: "Admin123!",
    }),
  });
  assert.equal(res.status, 200);
  return (res.headers.getSetCookie?.() ?? [])
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
  assert.equal(res.status, 200, text.slice(0, 300));
  return JSON.parse(text) as { id: string; checksum: string; storageKey?: string };
}

async function createImage(cookie: string, title: string, mediaAssetId: string) {
  const res = await fetch(`${BASE}/api/admin/contents`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      type: "IMAGE",
      title,
      durationMs: 4000,
      payload: {},
      status: "ACTIVE",
      mediaAssetId,
    }),
  });
  const body = (await res.json()) as { id?: string };
  assert.ok(body.id, JSON.stringify(body));
  return body.id!;
}

async function waitCode(page: Page) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const code = (await page.evaluate(`(() => {
      const t = (document.body && document.body.innerText) || "";
      const m = t.replace(/\\s+/g," ").match(/\\b(\\d{6})\\b/);
      return m ? m[1] : null;
    })()`)) as string | null;
    if (code) return code;
    await page.waitForTimeout(400);
  }
  throw new Error("no activation code");
}

async function waitWarm(
  page: Page,
  minBlobs: number,
  timeoutMs = 120_000,
  minVersion?: number,
): Promise<IdbProbe> {
  const deadline = Date.now() + timeoutMs;
  let last: IdbProbe | null = null;
  while (Date.now() < deadline) {
    last = await probeIdb(page);
    const versionOk =
      minVersion == null || (last.manifestVersion ?? -1) >= minVersion;
    if (
      last.manifestVersion != null &&
      last.blobCount >= minBlobs &&
      last.assetIds.length >= minBlobs &&
      !last.hasNext &&
      versionOk
    ) {
      return last;
    }
    await page.waitForTimeout(1500);
  }
  throw new Error(`warm timeout ${JSON.stringify(last)}`);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext()).newPage();
  const mediaHits: { url: string; status?: number }[] = [];

  page.on("response", async (res) => {
    const url = res.url();
    if (url.includes("/api/device/media/")) {
      mediaHits.push({ url, status: res.status() });
    }
  });

  console.log("BASE", BASE);
  await page.goto(`${BASE}/player`, { waitUntil: "domcontentloaded" });
  const activationCode = await waitCode(page);

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
          name: "Cold Path Validation",
          deviceCode: DEVICE_CODE,
        }),
      })
    ).status,
    200,
  );

  const claimDeadline = Date.now() + 60_000;
  while (Date.now() < claimDeadline) {
    const cfg = (await page.evaluate(`(() => {
      try { return JSON.parse(localStorage.getItem("v360-player-config")||"null"); }
      catch(e){ return null; }
    })()`)) as { deviceToken?: string } | null;
    if (cfg?.deviceToken) break;
    await page.waitForTimeout(400);
  }

  // Empty IDB assert before downloads
  const empty = await probeIdb(page);
  assert.equal(empty.blobCount, 0, "IDB must start empty (no pre-warm)");

  const mediaA = await uploadPng(cookie, PNG_A, `cold-a-${Date.now()}.png`);
  const mediaB = await uploadPng(cookie, PNG_B, `cold-b-${Date.now()}.png`);
  const mediaC = await uploadPng(cookie, PNG_C, `cold-c-${Date.now()}.png`);
  const contentA = await createImage(cookie, "Cold A", mediaA.id);
  const contentB = await createImage(cookie, "Cold B", mediaB.id);
  const contentC = await createImage(cookie, "Cold C", mediaC.id);

  const pl = (await (
    await fetch(`${BASE}/api/admin/playlists`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ name: `Cold ${DEVICE_CODE}` }),
    })
  ).json()) as { id: string };

  for (const contentId of [contentA, contentB, contentC]) {
    assert.ok(
      (
        await fetch(`${BASE}/api/admin/playlists`, {
          method: "PATCH",
          headers: jsonHeaders,
          body: JSON.stringify({
            action: "add_item",
            playlistId: pl.id,
            contentId,
          }),
        })
      ).ok,
    );
  }

  const devices = (
    (await (await fetch(`${BASE}/api/admin/devices`, { headers: { Cookie: cookie } })).json()) as {
      devices: { id: string; deviceCode?: string | null }[];
    }
  ).devices;
  const device = devices.find((d) => d.deviceCode === DEVICE_CODE);
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

  const cfg = (await page.evaluate(`(() => {
    try { return JSON.parse(localStorage.getItem("v360-player-config")||"null"); }
    catch(e){ return null; }
  })()`)) as { deviceToken: string };

  const sync0 = await fetch(`${BASE}/api/device/sync?version=-1`, {
    headers: { Authorization: `Bearer ${cfg.deviceToken}` },
  });
  const syncBody = await sync0.json();
  assert.equal(sync0.status, 200);
  assert.equal(syncBody.upToDate, false);
  const items = syncBody.manifest?.playlist?.items ?? [];
  assert.ok(items.length >= 3);

  // Direct proxy probe (cold HTTP 200 + checksum)
  mediaHits.length = 0;
  const proxyStatuses: number[] = [];
  const proxyBytes: number[] = [];
  for (const id of [mediaA.id, mediaB.id, mediaC.id]) {
    const res = await fetch(`${BASE}/api/device/media/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${cfg.deviceToken}` },
    });
    proxyStatuses.push(res.status);
    const buf = Buffer.from(await res.arrayBuffer());
    proxyBytes.push(buf.length);
    assert.equal(res.status, 200, `proxy ${id} → ${res.status}`);
    assert.ok(buf.length > 0);
  }

  // Player cold sync → IDB
  mediaHits.length = 0;
  await page.reload({ waitUntil: "domcontentloaded" });
  const warm = await waitWarm(page, 3);
  const coldMedia200 = mediaHits.filter((h) => h.status === 200).length;
  const coldMediaFail = mediaHits.filter((h) => (h.status ?? 0) >= 400).length;

  const playback = (await page.evaluate(`(() => {
    const img = document.querySelector("img.player-media, img");
    const src = img && (img.currentSrc || img.src) || "";
    return src.indexOf("blob:") === 0 ? "blob" : src.indexOf("http") === 0 ? "http" : "other";
  })()`)) as string;

  assert.equal(warm.blobCount >= 3, true);
  assert.equal(warm.hasNext, false);
  assert.equal(playback, "blob");

  writeEvidence(
    "COLD-DOWNLOAD-RESULTS.md",
    `# Cold Download Results

**Date:** ${new Date().toISOString()}  
**Environment:** ${BASE}  
**Device:** ${DEVICE_CODE} (\`${device.id}\`)  
**Manifest version:** ${warm.manifestVersion}  

## Assets
| Label | MediaAsset ID | Checksum |
|-------|---------------|----------|
| A | ${mediaA.id} | ${mediaA.checksum} |
| B | ${mediaB.id} | ${mediaB.checksum} |
| C | ${mediaC.id} | ${mediaC.checksum} |

## Proxy probe (Bearer)
- HTTP statuses: ${proxyStatuses.join(", ")}
- Bytes: ${proxyBytes.join(", ")}

## Player cold sync (empty IDB → CURRENT)
- Media HTTP 200 count (observed): ${coldMedia200}
- Media HTTP ≥400: ${coldMediaFail}
- IDB blobs: ${warm.blobCount}
- CURRENT assetIds: ${warm.assetIds.length}
- NEXT present: ${warm.hasNext}
- Playback: ${playback}

## Result
**PASS**
`,
  );

  // --- Partial failure: replace B with B-new, abort mid sync via IDB sabotage ---
  const mediaBNew = await uploadPng(cookie, PNG_B_NEW, `cold-bnew-${Date.now()}.png`);
  const contentBNew = await createImage(cookie, "Cold B-new", mediaBNew.id);
  const pl2 = (await (
    await fetch(`${BASE}/api/admin/playlists`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ name: `Cold2 ${DEVICE_CODE}` }),
    })
  ).json()) as { id: string };
  for (const contentId of [contentA, contentBNew, contentC]) {
    assert.ok(
      (
        await fetch(`${BASE}/api/admin/playlists`, {
          method: "PATCH",
          headers: jsonHeaders,
          body: JSON.stringify({
            action: "add_item",
            playlistId: pl2.id,
            contentId,
          }),
        })
      ).ok,
    );
  }
  const beforePartial = await probeIdb(page);
  assert.ok(beforePartial.manifestVersion != null);

  // Force B-new media download to fail (in-page fetch wrap — no reload).
  await page.evaluate(`(() => {
    const target = ${JSON.stringify(mediaBNew.id)};
    const orig = window.fetch.bind(window);
    window.__v360_block_media = true;
    window.fetch = function(input, init) {
      const url = typeof input === "string" ? input : (input && input.url) || "";
      if (window.__v360_block_media && url.indexOf("/api/device/media/") !== -1 && url.indexOf(target) !== -1) {
        return Promise.resolve(new Response(JSON.stringify({ error: "forced" }), {
          status: 502,
          headers: { "Content-Type": "application/json" },
        }));
      }
      return orig(input, init);
    };
    window.__v360_restore_fetch = function() {
      window.__v360_block_media = false;
      window.fetch = orig;
    };
  })()`);

  assert.ok(
    (
      await fetch(`${BASE}/api/admin/devices/${device.id}/assign`, {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ playlistId: pl2.id }),
      })
    ).ok,
  );

  await page.evaluate(`(() => { window.dispatchEvent(new Event("online")); })()`);
  await page.waitForTimeout(18_000);
  const afterPartial = await probeIdb(page);
  assert.equal(
    afterPartial.manifestVersion,
    beforePartial.manifestVersion,
    "CURRENT must not change on partial failure",
  );
  assert.equal(afterPartial.hasNext, false, "NEXT must not remain after failed activate");
  assert.ok(
    afterPartial.blobCount >= 3,
    "previous CURRENT blobs must remain",
  );

  writeEvidence(
    "PARTIAL-FAILURE-RESULTS.md",
    `# Partial Failure Results

**Date:** ${new Date().toISOString()}  
**Environment:** ${BASE}  
**Device:** ${DEVICE_CODE}

## Setup
- CURRENT before: v${beforePartial.manifestVersion}, blobs=${beforePartial.blobCount}
- New playlist includes B-new (\`${mediaBNew.id}\`)
- Browser \`fetch\` for B-new media forced to HTTP 502 once

## After failed sync
- CURRENT version: ${afterPartial.manifestVersion} (unchanged: ${afterPartial.manifestVersion === beforePartial.manifestVersion})
- NEXT present: ${afterPartial.hasNext}
- blobCount: ${afterPartial.blobCount}
- lastError: ${JSON.stringify(afterPartial.lastError)}

## Result
**PASS** — CURRENT preserved; NEXT not promoted
`,
  );

  // Restore fetch and allow B-new to download
  await page.evaluate(`(() => {
    if (typeof window.__v360_restore_fetch === "function") window.__v360_restore_fetch();
  })()`);
  // Re-assign to ensure a version bump is visible if the failed sync never bumped client view
  assert.ok(
    (
      await fetch(`${BASE}/api/admin/devices/${device.id}/assign`, {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ playlistId: pl2.id }),
      })
    ).ok,
  );
  await page.evaluate(`(() => { window.dispatchEvent(new Event("online")); })()`);
  const afterRestore = await waitWarm(
    page,
    3,
    120_000,
    (beforePartial.manifestVersion ?? 0) + 1,
  );
  assert.ok(
    (afterRestore.manifestVersion ?? 0) > (beforePartial.manifestVersion ?? 0),
    "CURRENT should advance after successful B-new sync",
  );
  assert.equal(afterRestore.hasNext, false);

  // --- Asset recovery: delete only B from IDB ---
  const recoveryTarget =
    afterRestore.assetIds.find((id) => id === mediaBNew.id) ??
    afterRestore.assetIds[1];
  assert.ok(recoveryTarget);

  await page.evaluate(`(async (assetId) => {
    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open("vitrine360-player", 1);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    await new Promise((resolve, reject) => {
      const tx = db.transaction(["blobs", "assets"], "readwrite");
      tx.objectStore("blobs").delete(assetId);
      tx.objectStore("assets").delete(assetId);
      tx.oncomplete = () => resolve(null);
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  })(${JSON.stringify(recoveryTarget)})`);

  const afterDelete = await probeIdb(page);
  assert.ok(afterDelete.blobCount === afterRestore.blobCount - 1);

  mediaHits.length = 0;
  // Trigger sync without changing server playlist (version same → upToDate idle)
  // Force clientVersion -1 briefly won't work. Instead bump by re-assign same playlist
  // OR call runSyncCycle by reloading after setting meta version lower.
  // Re-assign same playlist bumps version → only missing asset downloads.
  assert.ok(
    (
      await fetch(`${BASE}/api/admin/devices/${device.id}/assign`, {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ playlistId: pl2.id }),
      })
    ).ok,
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  const recovered = await waitWarm(page, 3, 120_000);
  const recoveryDownloads = mediaHits.filter((h) => h.status === 200);
  assert.ok(recovered.blobCount >= 3);
  assert.ok(
    recoveryDownloads.length >= 1 && recoveryDownloads.length <= 3,
    `expected few media downloads, got ${recoveryDownloads.length}`,
  );

  // Warm refresh — expect 0 media
  mediaHits.length = 0;
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(8000);
  const warmAfter = await probeIdb(page);
  const warmMedia = mediaHits.filter((h) => (h.status ?? 0) > 0);
  const warmPlayback = (await page.evaluate(`(() => {
    const img = document.querySelector("img.player-media, img");
    const src = img && (img.currentSrc || img.src) || "";
    return src.indexOf("blob:") === 0 ? "blob" : "other";
  })()`)) as string;

  writeEvidence(
    "ASSET-RECOVERY-RESULTS.md",
    `# Asset Recovery Results

**Date:** ${new Date().toISOString()}  
**Environment:** ${BASE}  
**Device:** ${DEVICE_CODE}

## Steps
1. CURRENT complete (A, B-new, C)
2. Deleted only \`${recoveryTarget}\` from IDB blobs/assets
3. Re-assign playlist (version bump) + reload
4. Observed media HTTP 200 count: ${recoveryDownloads.length}
5. IDB blobs after: ${recovered.blobCount}

## Result
**PASS**
`,
  );

  writeEvidence(
    "WARM-CACHE-RESULTS.md",
    `# Warm Cache Results (post cold-path)

**Date:** ${new Date().toISOString()}  
**Environment:** ${BASE}  
**Device:** ${DEVICE_CODE}  
**Manifest version:** ${warmAfter.manifestVersion}

| Metric | Value |
|--------|-------|
| Media HTTP on refresh | ${warmMedia.length} |
| IDB blobs | ${warmAfter.blobCount} |
| Playback | ${warmPlayback} |

## Result
${warmMedia.length === 0 && warmPlayback === "blob" ? "**PASS**" : "**FAIL**"}
`,
  );

  assert.equal(warmMedia.length, 0, "warm refresh must not download media");
  assert.equal(warmPlayback, "blob");

  console.log("\nCOLD-PATH VALIDATION PASS");
  console.log({
    device: DEVICE_CODE,
    coldProxy: proxyStatuses,
    coldIdb: warm,
    partialKeptVersion: afterPartial.manifestVersion,
    restoredVersion: afterRestore.manifestVersion,
    recoveryDownloads: recoveryDownloads.length,
    warmMedia: warmMedia.length,
  });

  await browser.close();
}

main().catch((e) => {
  console.error("COLD-PATH VALIDATION FAIL", e);
  process.exit(1);
});
