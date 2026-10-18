/**
 * MF-01…MF-07 — Manifest tenant–content–asset consistency (local file DB only).
 *
 * Run: npm run test:manifest-tenant-safe
 *
 * Refuses remote Turso / Production. No ACL / Vercel / deploy side effects.
 */
import { config } from "dotenv";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

config({ path: ".env.local" });
config({ path: ".env" });

const MF_DB = path.join(process.cwd(), "data", "mf-tenant-safe.db");
fs.mkdirSync(path.dirname(MF_DB), { recursive: true });
if (fs.existsSync(MF_DB)) fs.unlinkSync(MF_DB);

process.env.DATABASE_URL = `file:${MF_DB.replace(/\\/g, "/")}`;
process.env.MEDIA_STORAGE_PROVIDER = "local";
delete process.env.DATABASE_AUTH_TOKEN;
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;

type Status = "PASS" | "FAIL" | "BLOCKED" | "NOT_RUN";
type R = { id: string; name: string; status: Status; detail?: string };
const results: R[] = [];

async function applyLocalMigrations(dbFile: string) {
  const { createClient } = await import("@libsql/client");
  const client = createClient({ url: `file:${dbFile.replace(/\\/g, "/")}` });
  const migDir = path.join(process.cwd(), "drizzle");
  const files = fs
    .readdirSync(migDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const raw = fs.readFileSync(path.join(migDir, file), "utf8");
    const statements = raw
      .split("--> statement-breakpoint")
      .map((s) =>
        s
          .split("\n")
          .filter((l) => !l.trim().startsWith("-->"))
          .join("\n")
          .trim(),
      )
      .filter(Boolean);
    for (const stmt of statements) {
      try {
        await client.execute(stmt);
      } catch (err) {
        const msg = String(err).toLowerCase();
        if (msg.includes("already exists") || msg.includes("duplicate")) continue;
        throw err;
      }
    }
  }
  client.close();
}

async function record(
  id: string,
  name: string,
  fn: () => void | Promise<void>,
  opts?: { blocked?: string; notRun?: string },
) {
  if (opts?.blocked) {
    results.push({ id, name, status: "BLOCKED", detail: opts.blocked });
    console.log(`BLOCKED ${id} ${name} — ${opts.blocked}`);
    return;
  }
  if (opts?.notRun) {
    results.push({ id, name, status: "NOT_RUN", detail: opts.notRun });
    console.log(`NOT RUN ${id} ${name} — ${opts.notRun}`);
    return;
  }
  try {
    await fn();
    results.push({ id, name, status: "PASS" });
    console.log(`PASS ${id} ${name}`);
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    results.push({ id, name, status: "FAIL", detail });
    console.log(`FAIL ${id} ${name} — ${detail}`);
  }
}

async function insertAsset(params: {
  id: string;
  tenantId: string;
  fileName: string;
  checksum: string;
}) {
  const { db, schema } = await import("../src/db");
  await db.insert(schema.mediaAssets).values({
    id: params.id,
    tenantId: params.tenantId,
    fileName: params.fileName,
    mimeType: "image/png",
    fileSize: 32,
    checksum: params.checksum,
    storageKey: `tenants/${params.tenantId}/${params.id}.png`,
    storageProvider: "local",
    url: `/api/media/tenants/${params.tenantId}/${params.id}.png`,
  });
}

async function main() {
  const dbUrl = process.env.DATABASE_URL ?? "";
  if (!dbUrl.startsWith("file:")) {
    throw new Error(`Refusing non-file DATABASE_URL: ${dbUrl.slice(0, 48)}`);
  }
  if (/turso\.io|libsql\.com/i.test(dbUrl)) {
    throw new Error("Refusing remote DATABASE_URL for MF suite");
  }

  await applyLocalMigrations(MF_DB);
  const { ensureSchema, db, schema } = await import("../src/db");
  await ensureSchema();

  const { createTenant } = await import("../src/services/tenants");
  const { createContent } = await import("../src/services/contents");
  const { createPlaylist, addPlaylistItem } = await import(
    "../src/services/playlists"
  );
  const { createSchedule } = await import("../src/services/schedules");
  const { buildDeviceManifest } = await import("../src/services/manifest");
  const { getContentForPreview } = await import("../src/services/contents");
  const { eq, and } = await import("drizzle-orm");

  const stamp = Date.now().toString(36);
  console.log("MF tenant-safe suite", stamp, "db=", MF_DB);

  const tenantA = await createTenant({
    name: `MF-A ${stamp}`,
    slug: `mf-a-${stamp}`,
  });
  const tenantB = await createTenant({
    name: `MF-B ${stamp}`,
    slug: `mf-b-${stamp}`,
  });

  const assetAId = crypto.randomUUID();
  const assetBId = crypto.randomUUID();
  await insertAsset({
    id: assetAId,
    tenantId: tenantA,
    fileName: "a.png",
    checksum: `sha256:mf-a-${stamp}`,
  });
  await insertAsset({
    id: assetBId,
    tenantId: tenantB,
    fileName: "b.png",
    checksum: `sha256:mf-b-${stamp}`,
  });

  const contentAId = await createContent(
    {
      type: "IMAGE",
      title: `Img A ${stamp}`,
      durationMs: 5000,
      payload: {},
      status: "ACTIVE",
      mediaAssetId: assetAId,
    },
    tenantA,
  );
  const contentTextId = await createContent(
    {
      type: "TEXT",
      title: `Text A ${stamp}`,
      durationMs: 4000,
      payload: { body: "no-asset" },
      status: "ACTIVE",
    },
    tenantA,
  );
  const contentBId = await createContent(
    {
      type: "IMAGE",
      title: `Img B ${stamp}`,
      durationMs: 5000,
      payload: {},
      status: "ACTIVE",
      mediaAssetId: assetBId,
    },
    tenantB,
  );

  const playlistA = await createPlaylist(
    { name: `PL-A ${stamp}` },
    tenantA,
  );
  await addPlaylistItem({
    playlistId: playlistA,
    contentId: contentAId,
    tenantId: tenantA,
  });
  await addPlaylistItem({
    playlistId: playlistA,
    contentId: contentTextId,
    tenantId: tenantA,
  });

  const deviceAId = crypto.randomUUID();
  await db.insert(schema.devices).values({
    id: deviceAId,
    deviceCode: `TV-MF-${stamp}`,
    name: "MF Device A",
    status: "ACTIVE",
    tenantId: tenantA,
    currentPlaylistId: playlistA,
    manifestVersion: 1,
    timezone: "UTC",
  });

  const [deviceA] = await db
    .select()
    .from(schema.devices)
    .where(eq(schema.devices.id, deviceAId))
    .limit(1);
  assert.ok(deviceA);

  // —— MF-01 ——
  await record("MF-01", "Manifest válido same-tenant", async () => {
    const manifest = await buildDeviceManifest(deviceA!);
    assert.ok(manifest.playlist);
    const imgItem = manifest.playlist!.items.find(
      (i) => i.contentId === contentAId,
    );
    assert.ok(imgItem, "IMAGE content missing from playlist");
    assert.equal(imgItem!.assets.length, 1);
    assert.equal(imgItem!.assets[0]!.id, assetAId);
    assert.ok(
      imgItem!.assets[0]!.offlineUrl?.includes(assetAId),
      "offlineUrl should reference asset A",
    );
    assert.ok(imgItem!.assets[0]!.url, "url should be present for same-tenant");
    assert.ok(
      !imgItem!.assets.some((a) => a.id === assetBId),
      "must not include asset B",
    );
  });

  // —— MF-02 lab: content A → asset B via direct content_assets write ——
  await record("MF-02", "Content A associado a asset B (lab)", async () => {
    await db
      .delete(schema.contentAssets)
      .where(eq(schema.contentAssets.contentId, contentAId));
    await db.insert(schema.contentAssets).values({
      contentId: contentAId,
      mediaAssetId: assetBId,
      role: "primary",
    });

    const manifest = await buildDeviceManifest(deviceA!);
    const imgItem = manifest.playlist!.items.find(
      (i) => i.contentId === contentAId,
    );
    assert.ok(imgItem, "IMAGE content must remain in playlist");
    assert.equal(
      imgItem!.assets.length,
      0,
      "cross-tenant asset B must not appear in assets[]",
    );
    const allAssetIds = manifest.playlist!.items.flatMap((i) =>
      i.assets.map((a) => a.id),
    );
    assert.ok(!allAssetIds.includes(assetBId), "asset B id must not leak");

    // restore same-tenant link for later cases
    await db
      .delete(schema.contentAssets)
      .where(eq(schema.contentAssets.contentId, contentAId));
    await db.insert(schema.contentAssets).values({
      contentId: contentAId,
      mediaAssetId: assetAId,
      role: "primary",
    });
  });

  // —— MF-05 (run before emergency so playlist baseline is clear) ——
  await record("MF-05", "Conteúdo sem asset / TEXT", async () => {
    const manifest = await buildDeviceManifest(deviceA!);
    const textItem = manifest.playlist!.items.find(
      (i) => i.contentId === contentTextId,
    );
    assert.ok(textItem, "TEXT content must remain in playlist without asset");
    assert.equal(textItem!.assets.length, 0);
    assert.ok(
      manifest.playlist!.items.some((i) => i.contentId === contentAId),
      "IMAGE item still present",
    );
  });

  // —— MF-03 emergency valid ——
  let emergencyContentId = contentAId;
  await record("MF-03", "Emergency item válido same-tenant", async () => {
    await createSchedule(
      {
        name: `EMG ${stamp}`,
        contentId: contentAId,
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        startTime: "00:00",
        endTime: undefined,
        priority: "EMERGENCY",
        active: true,
        targets: [{ targetType: "DEVICE", targetId: deviceAId }],
      },
      tenantA,
    );

    const manifest = await buildDeviceManifest(deviceA!);
    assert.equal(manifest.effectivePlayback?.source, "EMERGENCY");
    assert.ok(manifest.playlist?.items.length);
    const interrupt = manifest.playlist!.items[0]!;
    assert.ok(
      interrupt.playlistItemId.startsWith("emergency-"),
      "first item should be emergency interrupt",
    );
    assert.equal(interrupt.contentId, contentAId);
    assert.equal(interrupt.assets.length, 1);
    assert.equal(interrupt.assets[0]!.id, assetAId);
    assert.ok(!interrupt.assets.some((a) => a.id === assetBId));
    emergencyContentId = interrupt.contentId;
  });

  // —— MF-04 inconsistent emergency association ——
  await record(
    "MF-04",
    "Emergency associação inconsistente (lab)",
    async () => {
      // 4a: content A linked to asset B while EMERGENCY still points at content A
      await db
        .delete(schema.contentAssets)
        .where(eq(schema.contentAssets.contentId, contentAId));
      await db.insert(schema.contentAssets).values({
        contentId: contentAId,
        mediaAssetId: assetBId,
        role: "primary",
      });

      const m1 = await buildDeviceManifest(deviceA!);
      assert.equal(m1.effectivePlayback?.source, "EMERGENCY");
      const interrupt1 = m1.playlist!.items[0]!;
      assert.equal(interrupt1.contentId, emergencyContentId);
      assert.equal(
        interrupt1.assets.length,
        0,
        "emergency must not emit foreign asset B",
      );

      // restore A→A
      await db
        .delete(schema.contentAssets)
        .where(eq(schema.contentAssets.contentId, contentAId));
      await db.insert(schema.contentAssets).values({
        contentId: contentAId,
        mediaAssetId: assetAId,
        role: "primary",
      });

      // 4b: corrupt schedule contentId → tenant B content (fail-closed on read)
      await db
        .update(schema.schedules)
        .set({ contentId: contentBId })
        .where(
          and(
            eq(schema.schedules.tenantId, tenantA),
            eq(schema.schedules.priority, "EMERGENCY"),
          ),
        );

      const m2 = await buildDeviceManifest(deviceA!);
      const first = m2.playlist!.items[0];
      const hasEmergencyB =
        first?.playlistItemId.startsWith("emergency-") &&
        first.contentId === contentBId;
      assert.equal(
        hasEmergencyB,
        false,
        "must not prepend foreign tenant content as emergency",
      );
      const leakedB = m2.playlist!.items.some((i) =>
        i.assets.some((a) => a.id === assetBId),
      );
      assert.equal(leakedB, false, "asset B must not appear after corruption");

      // restore schedule contentId to A for cleanliness
      await db
        .update(schema.schedules)
        .set({ contentId: contentAId })
        .where(
          and(
            eq(schema.schedules.tenantId, tenantA),
            eq(schema.schedules.priority, "EMERGENCY"),
          ),
        );
    },
  );

  // —— MF-06 structural offline path (not full player E2E) ——
  await record(
    "MF-06",
    "Playback path: offlineUrl preference (structural)",
    async () => {
      // Clear emergency so playlist path is clean
      await db
        .delete(schema.schedules)
        .where(eq(schema.schedules.tenantId, tenantA));

      const manifest = await buildDeviceManifest(deviceA!);
      const imgItem = manifest.playlist!.items.find(
        (i) => i.contentId === contentAId,
      );
      assert.ok(imgItem?.assets[0]?.offlineUrl);
      assert.match(
        imgItem!.assets[0]!.offlineUrl!,
        new RegExp(`/api/device/media/${assetAId}`),
      );

      const engineSrc = fs.readFileSync(
        path.join(process.cwd(), "src/player/sync/engine.ts"),
        "utf8",
      );
      assert.ok(
        /offlineUrl\s*\?\?\s*asset\.url/.test(engineSrc),
        "sync engine must prefer offlineUrl over signed url",
      );
    },
  );

  await record(
    "MF-06b",
    "Player offline E2E (network cut)",
    async () => {},
    {
      notRun:
        "No device/player harness in this suite; structural offlineUrl covered by MF-06",
    },
  );

  // —— MF-07 regression of existing tenant controls + TTL ——
  await record("MF-07", "Regressão tenant + TTL inalterado", async () => {
    await assert.rejects(
      () =>
        createContent(
          {
            type: "IMAGE",
            title: "cross",
            durationMs: 1000,
            payload: {},
            status: "ACTIVE",
            mediaAssetId: assetBId,
          },
          tenantA,
        ),
      /not found/i,
      "loadTenantMediaAsset must still reject foreign asset",
    );

    await assert.rejects(
      () =>
        createSchedule(
          {
            name: `bad-emg ${stamp}`,
            contentId: contentBId,
            daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
            priority: "EMERGENCY",
            active: true,
            targets: [{ targetType: "ALL", targetId: null }],
          },
          tenantA,
        ),
      /not found/i,
      "assertTenantContent must still reject foreign content",
    );

    const preview = await getContentForPreview(contentAId, tenantA);
    assert.ok(preview);
    assert.equal(preview!.mimeType, "image/png");

    const previewCross = await getContentForPreview(contentAId, tenantB);
    assert.equal(previewCross, null, "preview must not leak content across tenants");

    const r2Src = fs.readFileSync(
      path.join(process.cwd(), "src/services/media/r2-provider.ts"),
      "utf8",
    );
    const getUrlBlock = r2Src.match(/async getUrl\([\s\S]*?expiresIn\s*=\s*(\d+)/);
    assert.ok(getUrlBlock, "r2 getUrl must define expiresIn");
    assert.equal(getUrlBlock![1], "604800", "GET signed URL TTL must remain 604800");
  });

  console.log("\n=== MF RESULTS ===");
  for (const r of results) {
    console.log(
      `${r.status.padEnd(8)} ${r.id.padEnd(6)} ${r.name}${r.detail ? ` — ${r.detail}` : ""}`,
    );
  }

  const failed = results.filter((r) => r.status === "FAIL");
  const executed = results.filter(
    (r) => r.status === "PASS" || r.status === "FAIL",
  );
  console.log(
    `\nExecuted: ${executed.length}  PASS: ${executed.filter((r) => r.status === "PASS").length}  FAIL: ${failed.length}  BLOCKED: ${results.filter((r) => r.status === "BLOCKED").length}  NOT_RUN: ${results.filter((r) => r.status === "NOT_RUN").length}`,
  );

  if (failed.length) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
