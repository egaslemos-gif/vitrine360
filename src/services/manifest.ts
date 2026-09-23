import { and, asc, eq } from "drizzle-orm";
import { db, ensureSchema } from "@/db";
import {
  contentAssets,
  contents,
  devices,
  mediaAssets,
  playlistItems,
  playlists,
  schedules,
} from "@/db/schema";
import type { Device } from "@/db/schema";
import { resolveEffectivePlayback } from "@/domain/playback-resolver";
import { effectivePlaybackKey } from "@/domain/effective-playback-key";
import { parseTransition } from "@/domain/types";
import {
  isExperienceVersionPublished,
  packageStoreExperienceLookup,
  sanitizeExperienceManifestPayload,
  validateExperienceContentAgainstRegistry,
} from "@/domain/experience-content-ref";
import { getStoredExperiencePackage } from "@/services/experience-package-store";
import { ensureDefaultPlaylistAssigned } from "@/services/devices";
import { getMediaStorage } from "@/services/media";

const experienceLookup = packageStoreExperienceLookup(getStoredExperiencePackage);

export type ManifestAsset = {
  id: string;
  fileName: string;
  mimeType: string;
  url: string;
  /** Same-origin authenticated URL used by Passive Player to seed offline cache. */
  offlineUrl?: string;
  checksum: string;
  fileSize: number;
  width: number | null;
  height: number | null;
  durationMs: number | null;
};

export type ManifestItem = {
  playlistItemId: string;
  contentId: string;
  type: string;
  title: string;
  durationMs: number;
  transition: string;
  fitMode: string;
  payload: Record<string, unknown>;
  version: number;
  assets: ManifestAsset[];
  /**
   * EXPERIENCE-09: when type===EXPERIENCE and version is not PUBLISHED,
   * item is present but marked non-executable (Player shows safe fallback).
   */
  experienceExecutable?: boolean;
  experienceBlockReason?: string;
};

export type DeviceManifest = {
  manifestVersion: number;
  deviceId: string;
  deviceCode: string | null;
  playlist: {
    id: string;
    name: string;
    version: number;
    items: ManifestItem[];
  } | null;
  /** Diagnostic: why this playlist was chosen */
  effectivePlayback?: {
    source: string;
    scheduleId: string | null;
    priority: string;
    key: string;
  };
  schedules: Array<{
    id: string;
    name: string;
    playlistId: string | null;
    contentId: string | null;
    daysOfWeek: number[];
    startTime: string | null;
    endTime: string | null;
    startAt: string | null;
    endAt: string | null;
    priority: string;
  }>;
  generatedAt: string;
};

async function freshPlaybackUrl(asset: { url: string; storageKey: string }) {
  try {
    const fresh = await getMediaStorage().getUrl(asset.storageKey);
    if (
      fresh.startsWith("http://") ||
      fresh.startsWith("https://") ||
      fresh.startsWith("/")
    ) {
      return fresh;
    }
  } catch (err) {
    console.warn("Could not refresh media URL", asset.storageKey, err);
  }
  return asset.url;
}

export async function buildDeviceManifest(
  device: Device,
): Promise<DeviceManifest> {
  await ensureSchema();
  const { effectiveState } = await resolveEffectivePlayback(device.id);

  let playlistBlock: DeviceManifest["playlist"] = null;

  if (effectiveState.playlistId) {
    playlistBlock = await buildPlaylistBlock(effectiveState.playlistId);
  }

  // EMERGENCY content interrupt: prepend urgent content to current sequence
  if (
    effectiveState.source === "EMERGENCY" &&
    effectiveState.emergencyContentId &&
    playlistBlock
  ) {
    const interrupt = await buildContentManifestItem(
      effectiveState.emergencyContentId,
    );
    if (interrupt) {
      playlistBlock = {
        ...playlistBlock,
        items: [interrupt, ...playlistBlock.items],
      };
    }
  }

  const scheduleRows = await db
    .select()
    .from(schedules)
    .where(
      and(
        eq(schedules.active, true),
        eq(schedules.tenantId, device.tenantId ?? ""),
      ),
    );

  const key = effectivePlaybackKey(effectiveState);

  return {
    manifestVersion: device.manifestVersion,
    deviceId: device.id,
    deviceCode: device.deviceCode,
    playlist: playlistBlock,
    effectivePlayback: {
      source: effectiveState.source,
      scheduleId: effectiveState.scheduleId,
      priority: effectiveState.priority,
      key,
    },
    schedules: scheduleRows.map((s) => ({
      id: s.id,
      name: s.name,
      playlistId: s.playlistId,
      contentId: s.contentId,
      daysOfWeek: JSON.parse(s.daysOfWeek || "[]") as number[],
      startTime: s.startTime,
      endTime: s.endTime,
      startAt: s.startAt,
      endAt: s.endAt,
      priority: s.priority,
    })),
    generatedAt: new Date().toISOString(),
  };
}

function finalizeManifestItem(
  item: ManifestItem,
  contentTenantId: string,
): ManifestItem {
  if (item.type !== "EXPERIENCE") return item;

  const sanitized = sanitizeExperienceManifestPayload(item.payload);
  if (!sanitized.ok) {
    return {
      ...item,
      payload: {},
      assets: [],
      experienceExecutable: false,
      experienceBlockReason: sanitized.code,
    };
  }

  const checked = validateExperienceContentAgainstRegistry(
    contentTenantId,
    sanitized.payload.experience,
    experienceLookup,
  );
  if (!checked.ok) {
    return {
      ...item,
      payload: sanitized.payload,
      assets: [],
      experienceExecutable: false,
      experienceBlockReason: checked.code,
    };
  }

  const published = isExperienceVersionPublished(checked.record);
  return {
    ...item,
    payload: sanitized.payload,
    assets: [],
    experienceExecutable: published,
    experienceBlockReason: published
      ? undefined
      : "EXPERIENCE_NOT_EXECUTABLE",
  };
}

async function buildContentManifestItem(
  contentId: string,
): Promise<ManifestItem | null> {
  const rows = await db
    .select({
      content: contents,
      asset: mediaAssets,
    })
    .from(contents)
    .leftJoin(contentAssets, eq(contentAssets.contentId, contents.id))
    .leftJoin(mediaAssets, eq(mediaAssets.id, contentAssets.mediaAssetId))
    .where(and(eq(contents.id, contentId), eq(contents.status, "ACTIVE")));

  if (!rows.length) return null;
  const content = rows[0].content;

  const itemAssets: ManifestAsset[] = [];
  for (const row of rows) {
    if (row.asset) {
      itemAssets.push({
        id: row.asset.id,
        fileName: row.asset.fileName,
        mimeType: row.asset.mimeType,
        url: await freshPlaybackUrl(row.asset),
        offlineUrl: `/api/device/media/${encodeURIComponent(row.asset.id)}`,
        checksum: row.asset.checksum,
        fileSize: row.asset.fileSize,
        width: row.asset.width,
        height: row.asset.height,
        durationMs: row.asset.durationMs,
      });
    }
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(content.payload) as Record<string, unknown>;
  } catch {
    payload = {};
  }

  return finalizeManifestItem(
    {
      playlistItemId: `emergency-${content.id}`,
      contentId: content.id,
      type: content.type,
      title: content.title,
      durationMs: content.durationMs,
      transition: "cut",
      fitMode: "black",
      payload,
      version: content.version,
      assets: content.type === "EXPERIENCE" ? [] : itemAssets,
    },
    content.tenantId,
  );
}

async function buildPlaylistBlock(
  playlistId: string,
): Promise<DeviceManifest["playlist"]> {
  const [playlist] = await db
    .select()
    .from(playlists)
    .where(eq(playlists.id, playlistId))
    .limit(1);
  if (!playlist) return null;

  const rawItems = await db
    .select({
      item: playlistItems,
      content: contents,
      asset: mediaAssets,
    })
    .from(playlistItems)
    .innerJoin(contents, eq(contents.id, playlistItems.contentId))
    .leftJoin(contentAssets, eq(contentAssets.contentId, contents.id))
    .leftJoin(mediaAssets, eq(mediaAssets.id, contentAssets.mediaAssetId))
    .where(
      and(
        eq(playlistItems.playlistId, playlistId),
        eq(playlistItems.active, true),
        eq(contents.status, "ACTIVE"),
        eq(contents.tenantId, playlist.tenantId),
      )
    )
    .orderBy(asc(playlistItems.position));

  const itemsMap = new Map<string, ManifestItem>();
  const manifestItems: ManifestItem[] = [];

  for (const row of rawItems) {
    const { item, content, asset } = row;
    
    if (!itemsMap.has(item.id)) {
      let payload: Record<string, unknown> = {};
      try {
        payload = JSON.parse(content.payload) as Record<string, unknown>;
      } catch {
        payload = {};
      }

      const manifestItem: ManifestItem = finalizeManifestItem(
        {
          playlistItemId: item.id,
          contentId: content.id,
          type: content.type,
          title: content.title,
          durationMs: item.durationOverrideMs ?? content.durationMs,
          transition: parseTransition(item.transition),
          fitMode: item.fitMode,
          payload,
          version: content.version,
          assets: [],
        },
        content.tenantId,
      );
      
      itemsMap.set(item.id, manifestItem);
      manifestItems.push(manifestItem);
    }
    
    if (asset && content.type !== "EXPERIENCE") {
      itemsMap.get(item.id)!.assets.push({
        id: asset.id,
        fileName: asset.fileName,
        mimeType: asset.mimeType,
        url: await freshPlaybackUrl(asset),
        offlineUrl: `/api/device/media/${encodeURIComponent(asset.id)}`,
        checksum: asset.checksum,
        fileSize: asset.fileSize,
        width: asset.width,
        height: asset.height,
        durationMs: asset.durationMs,
      });
    }
  }

  return {
    id: playlist.id,
    name: playlist.name,
    version: playlist.version,
    items: manifestItems,
  };
}

export async function buildSyncDelta(
  device: Device,
  clientVersion: number,
): Promise<{
  upToDate: boolean;
  manifest: DeviceManifest | null;
  changedAssetIds: string[];
}> {
  await ensureSchema();
  const ready = await ensureDefaultPlaylistAssigned(device);
  const { effectiveState } = await resolveEffectivePlayback(ready.id);
  const key = effectivePlaybackKey(effectiveState);

  const versionStale = clientVersion < ready.manifestVersion;
  const storedKey = ready.effectivePlaybackKey ?? "";
  const playbackStale = storedKey !== "" && storedKey !== key;

  if (!versionStale && !playbackStale) {
    // First sync after deploy: seed fingerprint without forcing a re-download.
    if (storedKey === "") {
      await db
        .update(devices)
        .set({
          effectivePlaybackKey: key,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(devices.id, ready.id));
    }
    return { upToDate: true, manifest: null, changedAssetIds: [] };
  }

  let nextVersion = ready.manifestVersion;
  const now = new Date().toISOString();

  if (playbackStale) {
    nextVersion = (ready.manifestVersion ?? 0) + 1;
    await db
      .update(devices)
      .set({
        manifestVersion: nextVersion,
        effectivePlaybackKey: key,
        updatedAt: now,
      })
      .where(eq(devices.id, ready.id));
  } else {
    await db
      .update(devices)
      .set({
        effectivePlaybackKey: key,
        updatedAt: now,
      })
      .where(eq(devices.id, ready.id));
  }

  const deviceForManifest: Device = {
    ...ready,
    manifestVersion: nextVersion,
    effectivePlaybackKey: key,
  };

  const manifest = await buildDeviceManifest(deviceForManifest);
  // Candidate ids in the new playlist. Client applies hasAsset / checksum gate
  // so unchanged blobs are never re-downloaded (true idempotency lives on device).
  const changedAssetIds = [
    ...new Set(
      manifest.playlist?.items.flatMap((i) => i.assets.map((a) => a.id)) ?? [],
    ),
  ];
  return { upToDate: false, manifest, changedAssetIds };
}
