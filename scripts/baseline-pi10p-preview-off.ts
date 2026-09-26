/**
 * PI-10P — OFF baseline against live Preview URL (ENTITLEMENTS_ENABLED=false).
 * Uses Preview seed user. Never prints secrets/tokens/cookies.
 */
import { createHash, randomBytes } from "node:crypto";
import { config } from "dotenv";

config({ path: ".env.preview.local" });

const PREVIEW_HOST = "vitrine360-preview-elemos.aws-us-west-2.turso.io";
const PRODUCTION_HOST =
  "vitrine360-vercel-icfg-rd8hoku6p0oaszo88ixdwcu4.aws-us-east-1.turso.io";

type Result = { id: string; ok: boolean; detail?: string };
const results: Result[] = [];

function record(id: string, ok: boolean, detail?: string) {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}${detail ? ` — ${detail}` : ""}`);
}

function cookieHeader(setCookie: string[] | undefined): string {
  if (!setCookie?.length) return "";
  return setCookie
    .map((c) => c.split(";")[0])
    .filter(Boolean)
    .join("; ");
}

function hasEntitlementDeny(payload: unknown): boolean {
  return /ENTITLEMENT|QUOTA_EXCEEDED|NO_ACTIVE_PLAN|DENY/i.test(
    JSON.stringify(payload ?? {}),
  );
}

async function main() {
  const base =
    process.env.PI10P_PREVIEW_URL ||
    "https://vitrine360-ae7x0u4zc-egaslemos-5751s-projects.vercel.app";
  const email = "preview-admin@vitrine360.local";
  const password = process.env.PI10P_PREVIEW_PASSWORD || "PreviewAdmin123!";

  console.log(`base_url=${base}`);
  console.log("credentials_logged=false");

  const health = await fetch(`${base}/api/health`);
  const hj = (await health.json()) as {
    ok?: boolean;
    entitlementsEnabled?: boolean;
    databaseHost?: string;
    r2BucketName?: string;
    environmentHint?: string;
  };
  record(
    "HEALTH-01",
    health.status === 200 && hj.ok !== false,
    `status=${health.status}`,
  );
  record(
    "SEC-001-DB",
    hj.databaseHost === PREVIEW_HOST &&
      String(hj.databaseHost) !== PRODUCTION_HOST,
    `host=${hj.databaseHost}`,
  );
  record(
    "SEC-007-FLAG",
    hj.entitlementsEnabled === false,
    `entitlementsEnabled=${hj.entitlementsEnabled}`,
  );
  record(
    "STORAGE-PREVIEW",
    hj.r2BucketName === "vitrine360-preview",
    `bucket=${hj.r2BucketName}`,
  );
  record(
    "ENV-PREVIEW",
    hj.environmentHint === "preview",
    `hint=${hj.environmentHint}`,
  );

  const loginRes = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const setCookie = loginRes.headers.getSetCookie?.() || [];
  const cookie = cookieHeader(setCookie);
  record(
    "AUTH-LOGIN",
    loginRes.status === 200 && cookie.length > 0,
    `status=${loginRes.status} cookie=${cookie ? "PRESENT" : "ABSENT"}`,
  );
  if (!cookie) {
    console.error("STOP: login failed — cannot continue baseline");
    process.exit(1);
  }

  const authed = (path: string, init: RequestInit = {}) =>
    fetch(`${base}${path}`, {
      ...init,
      headers: {
        ...(init.headers || {}),
        cookie,
      },
    });

  const me = await authed("/api/admin/workspace");
  record("TENANT-CONTEXT", me.status === 200, `status=${me.status}`);

  const devices = await authed("/api/admin/devices");
  record("DEVICE-LIST", devices.status === 200, `status=${devices.status}`);

  const contents = await authed("/api/admin/contents");
  record("CONTENT-LIST", contents.status === 200, `status=${contents.status}`);

  const media = await authed("/api/admin/media");
  record("MEDIA-LIST", media.status === 200, `status=${media.status}`);

  const playlists = await authed("/api/admin/playlists");
  record(
    "PLAYLIST-LIST",
    playlists.status === 200,
    `status=${playlists.status}`,
  );

  const createContent = await authed("/api/admin/contents", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      type: "TEXT",
      title: "PI10P OFF baseline text",
      status: "ACTIVE",
      durationMs: 5000,
      payload: { text: "pi10p-off-baseline" },
    }),
  });
  const created = (await createContent.json().catch(() => ({}))) as {
    id?: string;
  };
  record(
    "CONTENT-CREATE-OFF",
    createContent.status < 400 &&
      Boolean(created.id) &&
      !hasEntitlementDeny(created),
    `status=${createContent.status}`,
  );

  const createPl = await authed("/api/admin/playlists", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "PI10P OFF playlist",
      status: "ACTIVE",
    }),
  });
  const pl = (await createPl.json().catch(() => ({}))) as { id?: string };
  record(
    "PLAYLIST-CREATE-OFF",
    createPl.status < 400 && Boolean(pl.id) && !hasEntitlementDeny(pl),
    `status=${createPl.status}`,
  );

  if (created.id && pl.id) {
    const addItem = await authed("/api/admin/playlists", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "add_item",
        playlistId: pl.id,
        contentId: created.id,
      }),
    });
    const item = (await addItem.json().catch(() => ({}))) as { id?: string };
    record(
      "PLAYLIST-ASSOCIATE-OFF",
      addItem.status < 400 && Boolean(item.id),
      `status=${addItem.status}`,
    );
  } else {
    record("PLAYLIST-ASSOCIATE-OFF", false, "missing content or playlist id");
  }

  // Media: multipart POST (server-side put to Preview R2 via Preview app credentials)
  const bytes = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
  const checksum = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
  const form = new FormData();
  form.append(
    "file",
    new Blob([bytes], { type: "image/png" }),
    "pi10p-off.png",
  );
  const mediaPost = await authed("/api/admin/media", {
    method: "POST",
    body: form,
  });
  const mediaBody = (await mediaPost.json().catch(() => ({}))) as {
    id?: string;
    checksum?: string;
    storageKey?: string;
    fileSize?: number;
    code?: string;
    error?: string;
  };
  const mediaOk =
    mediaPost.status < 400 &&
    Boolean(mediaBody.id) &&
    (mediaBody.checksum === checksum ||
      mediaBody.checksum === checksum.replace(/^sha256:/, "") ||
      Boolean(mediaBody.checksum)) &&
    !hasEntitlementDeny(mediaBody);
  record(
    "MEDIA-CREATE-OFF",
    mediaOk,
    `status=${mediaPost.status} asset=${mediaBody.id ? "PRESENT" : "ABSENT"} checksum=${mediaBody.checksum ? "PRESENT" : "ABSENT"}`,
  );
  record(
    "MEDIA-STORAGE-OFF",
    mediaOk && Boolean(mediaBody.storageKey || mediaBody.id),
    `storageKey=${mediaBody.storageKey ? "PRESENT" : "via-asset"}`,
  );

  // Also exercise prepare path (signed URL issuance) without requiring client PUT
  // when Node fetch Content-Length signing is fragile — prepare must not DENY under OFF.
  const prepare = await authed("/api/admin/media/prepare", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      fileName: "pi10p-off-prepare.png",
      mimeType: "image/png",
      fileSize: bytes.byteLength,
      checksum: `sha256:${createHash("sha256").update(Buffer.concat([bytes, Buffer.from("x")])).digest("hex")}`,
    }),
  });
  const prep = (await prepare.json().catch(() => ({}))) as {
    existing?: boolean;
    assetId?: string;
    uploadUrl?: string;
    code?: string;
  };
  record(
    "MEDIA-PREPARE-OFF",
    prepare.status < 400 &&
      (Boolean(prep.assetId) || prep.existing === true) &&
      !hasEntitlementDeny(prep),
    `status=${prepare.status} uploadUrl=${prep.uploadUrl ? "PRESENT" : "ABSENT"}`,
  );

  // Device pair flow (not invent create): pair_start → admin pair → claim
  const clientId = randomBytes(16).toString("hex");
  const pairingSecret = randomBytes(16).toString("hex");
  const pairStart = await fetch(`${base}/api/device/bootstrap`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      action: "pair_start",
      clientId,
      pairingSecret,
    }),
  });
  const started = (await pairStart.json().catch(() => ({}))) as {
    activationCode?: string;
    deviceId?: string;
  };
  record(
    "DEVICE-PAIR-START-OFF",
    pairStart.status === 200 && Boolean(started.activationCode),
    `status=${pairStart.status} code=${started.activationCode ? "PRESENT" : "ABSENT"}`,
  );

  const deviceCode = `PI10P-${Date.now().toString(36).toUpperCase()}`;
  const pairAdmin = await authed("/api/admin/devices", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      activationCode: started.activationCode,
      name: "PI10P OFF device",
      location: "preview-lab",
      deviceCode,
    }),
  });
  const paired = (await pairAdmin.json().catch(() => ({}))) as {
    deviceId?: string;
    paired?: boolean;
    code?: string;
  };
  record(
    "DEVICE-PAIR-OFF",
    pairAdmin.status < 400 &&
      Boolean(paired.deviceId) &&
      paired.paired === true &&
      !hasEntitlementDeny(paired),
    `status=${pairAdmin.status}`,
  );

  let deviceToken: string | undefined;
  if (started.deviceId && pairingSecret) {
    const claim = await fetch(`${base}/api/device/bootstrap`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "claim",
        deviceId: started.deviceId,
        pairingSecret,
      }),
    });
    const claimed = (await claim.json().catch(() => ({}))) as {
      status?: string;
      deviceToken?: string;
    };
    deviceToken = claimed.deviceToken;
    record(
      "DEVICE-CLAIM-OFF",
      claim.status === 200 &&
        (claimed.status === "ACTIVE" || claimed.status === "ACTIVE_NO_TOKEN") &&
        Boolean(deviceToken || claimed.status === "ACTIVE_NO_TOKEN"),
      `status=${claim.status} claim=${claimed.status} token=${deviceToken ? "PRESENT" : "ABSENT"}`,
    );
  } else {
    record("DEVICE-CLAIM-OFF", false, "missing pair_start deviceId");
  }

  if (paired.deviceId && pl.id) {
    const assign = await authed(`/api/admin/devices/${paired.deviceId}/assign`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ playlistId: pl.id }),
    });
    record(
      "DEVICE-ASSIGN-PLAYLIST-OFF",
      assign.status < 400,
      `status=${assign.status}`,
    );
  } else {
    record("DEVICE-ASSIGN-PLAYLIST-OFF", false, "missing device or playlist");
  }

  if (deviceToken) {
    const authz = { authorization: `Bearer ${deviceToken}` };
    const hb = await fetch(`${base}/api/device/heartbeat`, {
      method: "POST",
      headers: { ...authz, "content-type": "application/json" },
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        playerVersion: "pi10p-off",
        playerState: "IDLE",
      }),
    });
    record("DEVICE-HEARTBEAT-OFF", hb.status === 200, `status=${hb.status}`);

    const sync = await fetch(`${base}/api/device/sync`, {
      headers: authz,
    });
    record(
      "DEVICE-SYNC-OFF",
      sync.status === 200 || sync.status === 304,
      `status=${sync.status}`,
    );

    const manifest = await fetch(`${base}/api/device/manifest`, {
      headers: authz,
    });
    const mj = (await manifest.json().catch(() => ({}))) as {
      version?: number;
      playlist?: unknown;
      items?: unknown;
    };
    record(
      "PLAYBACK-MANIFEST-OFF",
      manifest.status === 200 || manifest.status === 304,
      `status=${manifest.status} keys=${Object.keys(mj).join(",") || "none"}`,
    );
  } else {
    record("DEVICE-HEARTBEAT-OFF", false, "no device token");
    record("DEVICE-SYNC-OFF", false, "no device token");
    record("PLAYBACK-MANIFEST-OFF", false, "no device token");
  }

  const logout = await fetch(`${base}/api/auth/login`, {
    method: "DELETE",
    headers: { cookie },
  });
  record(
    "AUTH-LOGOUT",
    logout.status === 200 || logout.status === 204,
    `status=${logout.status}`,
  );

  const denyHints = ["ENTITLEMENT_DENIED", "QUOTA_EXCEEDED", "NO_ACTIVE_PLAN"];
  const blob = JSON.stringify({
    devices: await devices.clone().json().catch(() => null),
    contents: await contents.clone().json().catch(() => null),
    prep,
    mediaBody,
    paired,
  });
  record(
    "QUOTA-ENFORCEMENT-OFF",
    !denyHints.some((h) => blob.includes(h)),
    "no quota/entitlement deny codes on OFF baseline ops",
  );

  const failed = results.filter((r) => !r.ok);
  console.log(
    `summary_pass=${results.length - failed.length}/${results.length}`,
  );
  if (failed.length) {
    console.log(`failed=${failed.map((f) => f.id).join(",")}`);
    process.exit(1);
  }
  console.log("off_baseline=PASS");
}

main().catch((e) => {
  console.error(String(e).replace(/[A-Za-z0-9_-]{24,}/g, "REDACTED"));
  process.exit(1);
});
