/**
 * Diagnose device media proxy 502 without exposing secrets.
 *
 * Usage (server must be running):
 *   BASE_URL=http://127.0.0.1:3000 npx tsx scripts/diagnose-device-media-502.ts
 */
import "dotenv/config";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { R2StorageProvider } from "../src/services/media/r2-provider";
import { getMediaStorage } from "../src/services/media";

const BASE = (process.env.BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function redactUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}?[redacted_query]`;
  } catch {
    return "[invalid_url]";
  }
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
  assert.equal(res.status, 200, "admin login failed");
  return (res.headers.getSetCookie?.() ?? [])
    .map((c) => c.split(";")[0])
    .join("; ");
}

async function main() {
  const report: Record<string, unknown> = {
    base: BASE,
    mediaStorageProviderEnv: process.env.MEDIA_STORAGE_PROVIDER ?? "(unset→local)",
    r2Configured: Boolean(
      process.env.R2_ACCOUNT_ID &&
        process.env.R2_ACCESS_KEY_ID &&
        process.env.R2_SECRET_ACCESS_KEY &&
        process.env.R2_BUCKET_NAME,
    ),
    r2EndpointHost: (() => {
      const ep =
        process.env.R2_ENDPOINT ||
        (process.env.R2_ACCOUNT_ID
          ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
          : "");
      try {
        return ep ? new URL(ep).host : null;
      } catch {
        return "invalid";
      }
    })(),
    r2BucketSet: Boolean(process.env.R2_BUCKET_NAME),
  };

  console.log("=== LAYER 0: env (no secrets) ===");
  console.log(JSON.stringify(report, null, 2));

  const storage = getMediaStorage();
  console.log("=== LAYER 1: getMediaStorage().name ===", storage.name);

  // Direct R2 put + signed GET (bypasses HTTP API)
  if (storage.name === "r2") {
    console.log("=== LAYER 2: R2 put + fetch(presigned) ===");
    const provider = new R2StorageProvider();
    const key = `diag-tenant/diag-${Date.now()}.png`;
    try {
      const stored = await provider.put({
        key,
        data: PNG,
        mimeType: "image/png",
        fileName: "diag.png",
      });
      console.log("put ok", {
        storageKeyPrefix: stored.storageKey.split("/").slice(0, 2).join("/"),
        storageKeySegments: stored.storageKey.split("/").length,
        fileSize: stored.fileSize,
        checksum: stored.checksum,
        urlHost: redactUrl(stored.url),
      });

      const direct = await fetch(stored.url, { cache: "no-store" });
      console.log("presigned fetch", {
        status: direct.status,
        ok: direct.ok,
        contentType: direct.headers.get("content-type"),
        contentLength: direct.headers.get("content-length"),
      });
      if (direct.ok) {
        const buf = Buffer.from(await direct.arrayBuffer());
        const sum = `sha256:${createHash("sha256").update(buf).digest("hex")}`;
        console.log("presigned body", {
          bytes: buf.length,
          checksumMatch: sum === stored.checksum,
        });
      } else {
        const text = await direct.text().catch(() => "");
        console.log("presigned body error snippet", text.slice(0, 200));
      }

      // SDK GetObject path (candidate fix for proxy)
      console.log("=== LAYER 2b: SDK GetObject (if available) ===");
      try {
        // dynamic: method may not exist yet
        const anyP = provider as unknown as {
          getObject?: (k: string) => Promise<{ body: Buffer; contentType?: string }>;
        };
        if (typeof anyP.getObject === "function") {
          const obj = await anyP.getObject(stored.storageKey);
          console.log("getObject ok", {
            bytes: obj.body.length,
            contentType: obj.contentType,
          });
        } else {
          console.log("getObject not implemented yet");
        }
      } catch (e) {
        console.log("getObject failed", e instanceof Error ? e.message : String(e));
      }

      await provider.delete(stored.storageKey).catch(() => undefined);
    } catch (e) {
      console.log("LAYER 2 FAIL", e instanceof Error ? e.message : String(e));
    }
  }

  // HTTP API: upload via admin + device media proxy
  console.log("=== LAYER 3: Admin upload + device media proxy ===");
  const cookie = await loginCookie();

  const clientId = `diag-client-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const pairingSecret = `diag-secret-${Date.now()}-${Math.random().toString(36).slice(2)}xx`;
  const boot = await fetch(`${BASE}/api/device/bootstrap`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "pair_start",
      clientId,
      pairingSecret,
    }),
  });
  const bootBody = await boot.json();
  console.log("pair_start", {
    status: boot.status,
    hasCode: Boolean(bootBody.activationCode),
    hasDeviceId: Boolean(bootBody.deviceId),
    err: bootBody.error ?? null,
  });
  assert.equal(boot.status, 200);

  const pair = await fetch(`${BASE}/api/admin/devices`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      activationCode: bootBody.activationCode,
      name: "Media 502 Diag",
      deviceCode: `TV-DIAG-${Date.now().toString(36).toUpperCase()}`,
    }),
  });
  console.log("admin pair", { status: pair.status });
  assert.equal(pair.status, 200);

  const claim = await fetch(`${BASE}/api/device/bootstrap`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "claim",
      deviceId: bootBody.deviceId,
      pairingSecret,
    }),
  });
  const claimBody = await claim.json();
  console.log("claim", {
    status: claim.status,
    claimStatus: claimBody.status,
    hasToken: Boolean(claimBody.deviceToken),
  });
  assert.ok(claimBody.deviceToken, "no device token");

  const form = new FormData();
  form.append(
    "file",
    new Blob([new Uint8Array(PNG)], { type: "image/png" }),
    `diag-${Date.now()}.png`,
  );
  const up = await fetch(`${BASE}/api/admin/media`, {
    method: "POST",
    headers: { Cookie: cookie },
    body: form,
  });
  const upText = await up.text();
  console.log("admin media upload", { status: up.status, bodyLen: upText.length });
  assert.equal(up.status, 200, upText.slice(0, 300));
  const media = JSON.parse(upText) as {
    id: string;
    checksum?: string;
    storageKey?: string;
    mimeType?: string;
  };
  console.log("media asset", {
    idPrefix: media.id.slice(0, 8),
    hasChecksum: Boolean(media.checksum),
    storageKeySegments: media.storageKey?.split("/").length ?? null,
    mimeType: media.mimeType,
  });

  const proxy = await fetch(
    `${BASE}/api/device/media/${encodeURIComponent(media.id)}`,
    {
      headers: { Authorization: `Bearer ${claimBody.deviceToken}` },
    },
  );
  const proxyBuf = proxy.ok ? Buffer.from(await proxy.arrayBuffer()) : null;
  const proxyText = proxy.ok ? null : await proxy.text();
  console.log("device media proxy", {
    status: proxy.status,
    ok: proxy.ok,
    contentType: proxy.headers.get("content-type"),
    contentLength: proxy.headers.get("content-length"),
    bytes: proxyBuf?.length ?? 0,
    errorBody: proxyText?.slice(0, 200) ?? null,
  });
  if (proxyBuf) {
    const sum = `sha256:${createHash("sha256").update(proxyBuf).digest("hex")}`;
    console.log("proxy checksum", {
      match: !media.checksum || sum === media.checksum || sum.endsWith(media.checksum.replace(/^sha256:/, "")),
      sumPrefix: sum.slice(0, 20),
    });
  }

  // Also try storage.getUrl + fetch for this asset's key if we can load from DB via sync... skip

  console.log("\n=== DIAGNOSIS SUMMARY ===");
  if (proxy.status === 200) {
    console.log("PASS: device media proxy returns 200");
  } else if (proxy.status === 502) {
    console.log("FAIL: 502 at proxy layer — see LAYER 2 presigned fetch status above");
  } else {
    console.log(`FAIL: unexpected status ${proxy.status}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
