import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  contentAssets,
  contents,
  mediaAssets,
  playlistItems,
  schedules,
} from "@/db/schema";
import { getMediaStorage, safeFileExtension, sniffMime } from "@/services/media";
import { logActivity } from "@/services/activity-log";
import { CONTENT_TYPES, type ContentType } from "@/domain/types";
import {
  buildExperienceContentPayload,
  parseExperienceContentRef,
  packageStoreExperienceLookup,
  validateExperienceContentAgainstRegistry,
} from "@/domain/experience-content-ref";
import { getStoredExperiencePackage } from "@/services/experience-package-store";
import type { ContentPreviewModel } from "@/features/contents/content-preview-types";
import { z } from "zod";
import crypto from "node:crypto";

const experienceLookup = packageStoreExperienceLookup(getStoredExperiencePackage);

function assertExperienceContentPayload(
  type: ContentType | string,
  payload: Record<string, unknown>,
  tenantId: string,
  mediaAssetId?: string,
) {
  if (type !== "EXPERIENCE") return;
  if (mediaAssetId) {
    throw new Error("EXPERIENCE content must not attach a MediaAsset");
  }
  const parsed = parseExperienceContentRef(payload);
  if (!parsed.ok) {
    throw new Error(`${parsed.code}: ${parsed.message}`);
  }
  const checked = validateExperienceContentAgainstRegistry(
    tenantId,
    parsed.ref,
    experienceLookup,
  );
  if (!checked.ok) {
    throw new Error(`${checked.code}: ${checked.message}`);
  }
}

/** Normalize EXPERIENCE payload to canonical pinned ref only. */
function normalizeContentPayload(
  type: ContentType | string,
  payload: Record<string, unknown>,
): Record<string, unknown> {
  if (type !== "EXPERIENCE") return payload;
  const parsed = parseExperienceContentRef(payload);
  if (!parsed.ok) return payload;
  return buildExperienceContentPayload(parsed.ref);
}

export type { ContentPreviewModel };
export type ContentPreviewRow = ContentPreviewModel;
export { isContentOutsideValidityWindow } from "@/features/contents/content-preview-types";

const MAX_UPLOAD = Number(process.env.MAX_UPLOAD_BYTES ?? 52_428_800);

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
  "audio/webm",
  "audio/mp4",
  "audio/x-m4a",
  "audio/m4a",
  "audio/aac",
]);

/** Map browser/OS aliases to a canonical allowlisted MIME. */
export function normalizeMediaMime(mimeType: string): string {
  const raw = (mimeType || "").trim().toLowerCase();
  if (!raw) return raw;
  if (raw === "audio/x-m4a" || raw === "audio/m4a") return "audio/mp4";
  if (raw === "audio/mp3") return "audio/mpeg";
  if (raw === "audio/x-wav") return "audio/wav";
  return raw;
}

const DELETE_BLOCKED_MSG =
  "Este conteúdo está associado a uma ou mais playlists ou agendamentos e não pode ser eliminado.";

/** IMAGE requires image/*; VIDEO requires video/*; AUDIO requires audio/*. Other types must not attach media. */
export function assertMediaCompatibleWithType(
  type: ContentType | string,
  mimeType: string,
) {
  if (type === "IMAGE") {
    if (!mimeType.startsWith("image/")) {
      throw new Error(
        "Media asset MIME type is not allowed for IMAGE content (expected image/*)",
      );
    }
    return;
  }
  if (type === "VIDEO") {
    if (!mimeType.startsWith("video/")) {
      throw new Error(
        "Media asset MIME type is not allowed for VIDEO content (expected video/*)",
      );
    }
    return;
  }
  if (type === "AUDIO") {
    if (!mimeType.startsWith("audio/")) {
      throw new Error(
        "Media asset MIME type is not allowed for AUDIO content (expected audio/*)",
      );
    }
    return;
  }
  throw new Error(`Content type ${type} does not accept a media asset`);
}

/** VIDEO/AUDIO may be 0 (natural duration). IMAGE and other timed types require > 0. */
export function assertContentDuration(
  type: ContentType | string,
  durationMs: number,
) {
  if (!Number.isInteger(durationMs) || durationMs < 0) {
    throw new Error("durationMs must be a non-negative integer");
  }
  if (type === "VIDEO" || type === "AUDIO") return;
  if (durationMs <= 0) {
    throw new Error(
      type === "IMAGE"
        ? "IMAGE duration must be greater than 0"
        : "durationMs must be greater than 0 for this content type",
    );
  }
}

const contentFieldsSchema = z.object({
  type: z.enum(CONTENT_TYPES),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  durationMs: z.number().int().nonnegative().default(10000),
  payload: z.record(z.string(), z.unknown()).default({}),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
  validFrom: z.string().optional(),
  validTo: z.string().optional(),
  mediaAssetId: z.string().optional(),
});

export const createContentSchema = contentFieldsSchema.superRefine(
  (data, ctx) => {
    try {
      assertContentDuration(data.type, data.durationMs);
    } catch (e) {
      ctx.addIssue({
        code: "custom",
        path: ["durationMs"],
        message: e instanceof Error ? e.message : "Invalid duration",
      });
    }
    if (data.type === "EXPERIENCE") {
      const parsed = parseExperienceContentRef(data.payload);
      if (!parsed.ok) {
        ctx.addIssue({
          code: "custom",
          path: ["payload"],
          message: `${parsed.code}: ${parsed.message}`,
        });
      }
      if (data.mediaAssetId) {
        ctx.addIssue({
          code: "custom",
          path: ["mediaAssetId"],
          message: "EXPERIENCE content must not attach a MediaAsset",
        });
      }
    }
  },
);

export async function listContents(tenantId: string) {
  return db
    .select()
    .from(contents)
    .where(eq(contents.tenantId, tenantId))
    .orderBy(desc(contents.createdAt));
}

export async function listContentsWithUsage(tenantId: string) {
  const rows = await db
    .select({
      id: contents.id,
      type: contents.type,
      title: contents.title,
      description: contents.description,
      durationMs: contents.durationMs,
      status: contents.status,
      version: contents.version,
      createdAt: contents.createdAt,
      updatedAt: contents.updatedAt,
      playlistUsage: sql<number>`count(DISTINCT ${playlistItems.id})`.mapWith(
        Number,
      ),
      scheduleUsage: sql<number>`count(DISTINCT ${schedules.id})`.mapWith(
        Number,
      ),
    })
    .from(contents)
    .leftJoin(playlistItems, eq(contents.id, playlistItems.contentId))
    .leftJoin(schedules, eq(contents.id, schedules.contentId))
    .where(eq(contents.tenantId, tenantId))
    .groupBy(contents.id)
    .orderBy(desc(contents.updatedAt));

  const links = await db
    .select({
      contentId: contentAssets.contentId,
      mimeType: mediaAssets.mimeType,
      role: contentAssets.role,
    })
    .from(contentAssets)
    .innerJoin(mediaAssets, eq(contentAssets.mediaAssetId, mediaAssets.id))
    .where(eq(mediaAssets.tenantId, tenantId));

  const primaryMimeByContent = new Map<string, string>();
  for (const link of links) {
    if (link.role === "primary" || !primaryMimeByContent.has(link.contentId)) {
      primaryMimeByContent.set(link.contentId, link.mimeType);
    }
  }

  return rows.map((r) => {
    const usageCount = r.playlistUsage + r.scheduleUsage;
    return {
      id: r.id,
      type: r.type,
      title: r.title,
      description: r.description,
      durationMs: r.durationMs,
      status: r.status,
      version: r.version,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      usageCount,
      inUse: usageCount > 0,
      primaryMimeType: primaryMimeByContent.get(r.id) ?? null,
    };
  });
}

export async function getContent(id: string, tenantId: string) {
  const [row] = await db
    .select()
    .from(contents)
    .where(and(eq(contents.id, id), eq(contents.tenantId, tenantId)))
    .limit(1);
  return row ?? null;
}

/** Lightweight identity lookup for observability (no media blobs). */
export async function getContentsMetaByIds(
  ids: string[],
  tenantId: string,
): Promise<Map<string, { id: string; title: string | null; type: string | null }>> {
  const unique = [...new Set(ids.filter(Boolean))];
  const map = new Map<
    string,
    { id: string; title: string | null; type: string | null }
  >();
  if (!unique.length) return map;
  const rows = await db
    .select({
      id: contents.id,
      title: contents.title,
      type: contents.type,
    })
    .from(contents)
    .where(
      and(eq(contents.tenantId, tenantId), inArray(contents.id, unique)),
    );
  for (const row of rows) {
    map.set(row.id, {
      id: row.id,
      title: row.title,
      type: row.type,
    });
  }
  return map;
}

export async function getContentWithPrimaryMedia(id: string, tenantId: string) {
  const content = await getContent(id, tenantId);
  if (!content) return null;

  const [link] = await db
    .select({
      mediaAssetId: contentAssets.mediaAssetId,
      role: contentAssets.role,
      fileName: mediaAssets.fileName,
      mimeType: mediaAssets.mimeType,
      url: mediaAssets.url,
      fileSize: mediaAssets.fileSize,
    })
    .from(contentAssets)
    .innerJoin(mediaAssets, eq(mediaAssets.id, contentAssets.mediaAssetId))
    .where(
      and(
        eq(contentAssets.contentId, id),
        eq(mediaAssets.tenantId, tenantId),
      ),
    )
    .limit(1);

  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(content.payload || "{}") as Record<string, unknown>;
  } catch {
    payload = {};
  }

  return {
    ...content,
    payload,
    media: link
      ? {
          id: link.mediaAssetId,
          fileName: link.fileName,
          mimeType: link.mimeType,
          url: link.url,
          fileSize: link.fileSize,
          role: link.role,
        }
      : null,
  };
}

async function loadTenantMediaAsset(mediaAssetId: string, tenantId: string) {
  const [asset] = await db
    .select()
    .from(mediaAssets)
    .where(
      and(eq(mediaAssets.id, mediaAssetId), eq(mediaAssets.tenantId, tenantId)),
    )
    .limit(1);
  if (!asset) throw new Error("Media asset not found");
  return asset;
}

function parseContentPayload(raw: string | null | undefined): Record<string, unknown> {
  try {
    return JSON.parse(raw || "{}") as Record<string, unknown>;
  } catch {
    return {};
  }
}

/**
 * Tenant-scoped Content Preview model with fresh media URL.
 * Cross-tenant / missing → null (API/UI must respond 404 without existence leak).
 */
export async function getContentForPreview(
  id: string,
  tenantId: string,
): Promise<ContentPreviewRow | null> {
  const content = await getContent(id, tenantId);
  if (!content) return null;

  const links = await db
    .select({
      storageKey: mediaAssets.storageKey,
      mimeType: mediaAssets.mimeType,
      role: contentAssets.role,
    })
    .from(contentAssets)
    .innerJoin(mediaAssets, eq(mediaAssets.id, contentAssets.mediaAssetId))
    .where(
      and(
        eq(contentAssets.contentId, id),
        eq(mediaAssets.tenantId, tenantId),
      ),
    );

  const link =
    links.find((row) => row.role === "primary") ?? links[0] ?? null;

  let mediaUrl: string | null = null;
  let mimeType: string | null = null;
  if (link) {
    mimeType = link.mimeType;
    mediaUrl = await getMediaStorage().getUrl(link.storageKey);
  }

  return {
    id: content.id,
    title: content.title,
    type: content.type,
    durationMs: content.durationMs,
    payload: parseContentPayload(content.payload),
    mediaUrl,
    status: content.status,
    validFrom: content.validFrom ?? null,
    validTo: content.validTo ?? null,
    mimeType,
  };
}

export async function listContentsForPreview(
  tenantId: string,
): Promise<ContentPreviewRow[]> {
  const rows = await listContents(tenantId);
  if (!rows.length) return [];

  const links = await db
    .select({
      contentId: contentAssets.contentId,
      storageKey: mediaAssets.storageKey,
      mimeType: mediaAssets.mimeType,
      role: contentAssets.role,
    })
    .from(contentAssets)
    .innerJoin(mediaAssets, eq(contentAssets.mediaAssetId, mediaAssets.id))
    .where(eq(mediaAssets.tenantId, tenantId));

  const primaryByContent = new Map<
    string,
    { storageKey: string; mimeType: string }
  >();
  for (const link of links) {
    if (link.role === "primary" || !primaryByContent.has(link.contentId)) {
      primaryByContent.set(link.contentId, {
        storageKey: link.storageKey,
        mimeType: link.mimeType,
      });
    }
  }

  const storage = getMediaStorage();

  return Promise.all(
    rows.map(async (row) => {
      const primary = primaryByContent.get(row.id);
      const mediaUrl = primary
        ? await storage.getUrl(primary.storageKey)
        : null;
      return {
        id: row.id,
        title: row.title,
        type: row.type,
        durationMs: row.durationMs,
        payload: parseContentPayload(row.payload),
        mediaUrl,
        status: row.status,
        validFrom: row.validFrom ?? null,
        validTo: row.validTo ?? null,
        mimeType: primary?.mimeType ?? null,
      };
    }),
  );
}

export async function createContent(
  input: z.infer<typeof createContentSchema>,
  tenantId: string,
  userId?: string,
) {
  assertContentDuration(input.type, input.durationMs);
  assertExperienceContentPayload(
    input.type,
    input.payload,
    tenantId,
    input.mediaAssetId,
  );
  const payload = normalizeContentPayload(input.type, input.payload);

  let asset: Awaited<ReturnType<typeof loadTenantMediaAsset>> | null = null;
  if (input.mediaAssetId) {
    asset = await loadTenantMediaAsset(input.mediaAssetId, tenantId);
    assertMediaCompatibleWithType(input.type, asset.mimeType);
  } else if (input.type === "IMAGE" || input.type === "VIDEO" || input.type === "AUDIO") {
    throw new Error("mediaAssetId required for IMAGE/VIDEO/AUDIO content");
  }

  const id = crypto.randomUUID();

  await db.transaction(async (tx) => {
    await tx.insert(contents).values({
      id,
      type: input.type,
      title: input.title,
      description: input.description ?? null,
      durationMs: input.durationMs,
      payload: JSON.stringify(payload),
      status: input.status,
      validFrom: input.validFrom ?? null,
      validTo: input.validTo ?? null,
      tenantId,
    });

    if (asset) {
      await tx.insert(contentAssets).values({
        contentId: id,
        mediaAssetId: asset.id,
        role: "primary",
      });
    }
  });

  await logActivity({
    userId,
    tenantId,
    action: "content.created",
    resource: "content",
    resourceId: id,
    metadata: { type: input.type },
  });

  return id;
}

export async function uploadMediaAsset(params: {
  fileName: string;
  mimeType: string;
  data: Buffer;
  tenantId: string;
  userId?: string;
}) {
  const { assertTenantOperable } = await import("@/services/tenant-lifecycle");
  await assertTenantOperable(params.tenantId);

  if (params.data.byteLength > MAX_UPLOAD) {
    throw new Error("File exceeds upload size limit");
  }
  if (params.data.byteLength === 0) {
    throw new Error(`MIME type not allowed: ${params.mimeType}`);
  }

  // 1. Calculate SHA-256 before uploading
  const rawHash = crypto.createHash("sha256").update(params.data).digest("hex");
  const checksum = `sha256:${rawHash}`;

  // 2. Check if exists
  let [existing] = await db
    .select()
    .from(mediaAssets)
    .where(and(eq(mediaAssets.tenantId, params.tenantId), eq(mediaAssets.checksum, checksum)))
    .limit(1);

  if (existing) {
    // Re-use only when the backing object is still readable. Stale dedupe rows
    // (missing R2 key after provider migration) previously caused permanent 502
    // on /api/device/media without ever re-uploading.
    const storage = getMediaStorage();
    try {
      if (typeof storage.getObject === "function") {
        await storage.getObject(existing.storageKey);
      } else {
        const url = await storage.getUrl(existing.storageKey);
        const probe = await fetch(url, { method: "HEAD", cache: "no-store" });
        if (!probe.ok) {
          const getProbe = await fetch(url, { cache: "no-store" });
          if (!getProbe.ok) throw new Error(`probe ${getProbe.status}`);
        }
      }
      return existing;
    } catch {
      const id = existing.id;
      const ext = safeFileExtension(params.fileName);
      const sniffed = sniffMime(params.data, "") || params.mimeType;
      const key = `${params.tenantId}/${id}.${ext}`;
      const {
        reserveStorageForUpload,
        finishStorageReservation,
        mediaHealOperationId,
      } = await import("@/services/storage-quota");
      const expectedNew = params.data.byteLength;
      const delta = Math.max(0, expectedNew - (existing.fileSize ?? 0));
      const healOpId = mediaHealOperationId(id);
      const healReservation =
        delta > 0
          ? await reserveStorageForUpload({
              tenantId: params.tenantId,
              operationId: healOpId,
              expectedBytes: delta,
              operation: "media.heal",
            })
          : null;

      let stored;
      try {
        stored = await storage.put({
          key,
          data: params.data,
          mimeType: sniffed,
          fileName: params.fileName,
        });
      } catch (err) {
        if (healReservation) {
          await finishStorageReservation({
            tenantId: params.tenantId,
            operationId: healOpId,
            actualBytes: 0,
            outcome: "release",
          }).catch(() => {});
        }
        throw err;
      }

      const actualDelta = Math.max(0, stored.fileSize - (existing.fileSize ?? 0));
      if (
        healReservation &&
        actualDelta > healReservation.expectedBytes
      ) {
        await finishStorageReservation({
          tenantId: params.tenantId,
          operationId: healOpId,
          actualBytes: 0,
          outcome: "release",
        }).catch(() => {});
        throw new Error("healed object exceeds reserved growth");
      }

      await db
        .update(mediaAssets)
        .set({
          fileName: params.fileName,
          mimeType: stored.mimeType,
          fileSize: stored.fileSize,
          storageProvider: storage.name,
          storageKey: stored.storageKey,
          url: stored.url,
          checksum: stored.checksum,
        })
        .where(
          and(eq(mediaAssets.id, id), eq(mediaAssets.tenantId, params.tenantId)),
        );

      if (healReservation) {
        // Committed grew via file_size update — release reservation (do not commit).
        await finishStorageReservation({
          tenantId: params.tenantId,
          operationId: healOpId,
          actualBytes: 0,
          outcome: "release",
        }).catch(() => {});
      }

      console.warn("[media] healed stale dedupe asset", {
        idPrefix: id.slice(0, 8),
        storageKeySegments: stored.storageKey.split("/").length,
      });
      return {
        id,
        fileName: params.fileName,
        mimeType: stored.mimeType,
        fileSize: stored.fileSize,
        storageProvider: storage.name,
        storageKey: stored.storageKey,
        url: stored.url,
        checksum: stored.checksum,
        tenantId: params.tenantId,
        width: existing.width,
        height: existing.height,
        durationMs: existing.durationMs,
        createdAt: existing.createdAt,
      };
    }
  }

  // 3. New upload
  const id = crypto.randomUUID();
  const ext = safeFileExtension(params.fileName);
  const sniffed = normalizeMediaMime(
    sniffMime(params.data, params.mimeType) || params.mimeType,
  );
  if (!sniffed || !ALLOWED_MIME.has(sniffed)) {
    throw new Error(
      `MIME type not allowed: ${sniffed || params.mimeType || "unknown"}`,
    );
  }

  const {
    reserveStorageForUpload,
    finishStorageReservation,
    mediaBufferOperationId,
  } = await import("@/services/storage-quota");
  const operationId = mediaBufferOperationId(id);
  const reservation = await reserveStorageForUpload({
    tenantId: params.tenantId,
    operationId,
    expectedBytes: params.data.byteLength,
    operation: "media.upload",
  });

  const key = `${params.tenantId}/${id}.${ext}`;
  const storage = getMediaStorage();

  let stored;
  try {
    stored = await storage.put({
      key,
      data: params.data,
      mimeType: sniffed,
      fileName: params.fileName,
    });
  } catch (err) {
    if (reservation) {
      await finishStorageReservation({
        tenantId: params.tenantId,
        operationId,
        actualBytes: 0,
        outcome: "release",
      }).catch(() => {});
    }
    throw err;
  }

  // 4. Try insert with concurrency protection (UNIQUE constraint)
  try {
    await db.insert(mediaAssets).values({
      id,
      fileName: params.fileName,
      mimeType: stored.mimeType,
      fileSize: stored.fileSize,
      storageProvider: storage.name,
      storageKey: stored.storageKey,
      url: stored.url,
      checksum: stored.checksum, // Should be equal to the one we calculated
      tenantId: params.tenantId,
    });
  } catch (error: unknown) {
    // If it's a UNIQUE constraint failure, someone else inserted it while we were uploading
    const err =
      error && typeof error === "object"
        ? (error as {
            message?: string;
            code?: string;
            cause?: { message?: string; code?: string };
          })
        : null;
    const msg = err?.message || "";
    const causeMsg = err?.cause?.message || "";
    const code = err?.code || err?.cause?.code || "";
    
    if (code.includes("SQLITE_CONSTRAINT") || msg.includes("UNIQUE") || causeMsg.includes("UNIQUE")) {
      [existing] = await db
        .select()
        .from(mediaAssets)
        .where(and(eq(mediaAssets.tenantId, params.tenantId), eq(mediaAssets.checksum, checksum)))
        .limit(1);
      
      if (existing) {
        // Cleanup the orphaned storage object we just created
        await storage.delete(stored.storageKey).catch(() => {});
        if (reservation) {
          await finishStorageReservation({
            tenantId: params.tenantId,
            operationId,
            actualBytes: 0,
            outcome: "release",
          }).catch(() => {});
        }
        return existing;
      }
    }
    if (reservation) {
      await finishStorageReservation({
        tenantId: params.tenantId,
        operationId,
        actualBytes: 0,
        outcome: "release",
      }).catch(() => {});
    }
    throw error;
  }

  if (reservation) {
    await finishStorageReservation({
      tenantId: params.tenantId,
      operationId,
      actualBytes: stored.fileSize,
      outcome: "commit",
    });
  }

  await logActivity({
    userId: params.userId,
    tenantId: params.tenantId,
    action: "media.uploaded",
    resource: "media_asset",
    resourceId: id,
    metadata: { fileName: params.fileName, mimeType: params.mimeType },
  });

  return { id, ...stored };
}

function normalizeChecksum(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  if (trimmed.startsWith("sha256:")) {
    const hex = trimmed.slice("sha256:".length);
    if (!/^[a-f0-9]{64}$/.test(hex)) {
      throw new Error("Invalid checksum");
    }
    return `sha256:${hex}`;
  }
  if (!/^[a-f0-9]{64}$/.test(trimmed)) {
    throw new Error("Invalid checksum");
  }
  return `sha256:${trimmed}`;
}

async function probeExistingAssetReadable(
  storage: ReturnType<typeof getMediaStorage>,
  storageKey: string,
): Promise<boolean> {
  try {
    if (typeof storage.headObject === "function") {
      await storage.headObject(storageKey);
      return true;
    }
    if (typeof storage.getObject === "function") {
      await storage.getObject(storageKey);
      return true;
    }
    const url = await storage.getUrl(storageKey);
    const probe = await fetch(url, { method: "HEAD", cache: "no-store" });
    return probe.ok;
  } catch {
    return false;
  }
}

export async function prepareMediaUpload(params: {
  fileName: string;
  mimeType: string;
  fileSize: number;
  checksum: string;
  tenantId: string;
}) {
  const { assertTenantOperable } = await import("@/services/tenant-lifecycle");
  await assertTenantOperable(params.tenantId);

  if (params.fileSize <= 0) {
    throw new Error("file required");
  }
  if (params.fileSize > MAX_UPLOAD) {
    throw new Error(
      `File exceeds upload size limit (${MAX_UPLOAD} bytes)`,
    );
  }
  const declaredMime = normalizeMediaMime(
    params.mimeType || "application/octet-stream",
  );
  if (!ALLOWED_MIME.has(declaredMime)) {
    throw new Error(`MIME type not allowed: ${declaredMime}`);
  }

  const checksum = normalizeChecksum(params.checksum);
  const storage = getMediaStorage();

  const [existing] = await db
    .select()
    .from(mediaAssets)
    .where(
      and(
        eq(mediaAssets.tenantId, params.tenantId),
        eq(mediaAssets.checksum, checksum),
      ),
    )
    .limit(1);

  if (existing) {
    const readable = await probeExistingAssetReadable(
      storage,
      existing.storageKey,
    );
    if (readable) {
      return { existing: true as const, asset: existing };
    }
  }

  if (typeof storage.createUploadUrl !== "function") {
    throw new Error("Direct upload not supported");
  }

  const assetId = existing?.id ?? crypto.randomUUID();
  const ext = safeFileExtension(params.fileName);
  const key = `${params.tenantId}/${assetId}.${ext}`;
  const storageKey = `tenants/${key}`;

  const {
    reserveStorageForUpload,
    finishStorageReservation,
    mediaDirectOperationId,
    MEDIA_PREPARE_RESERVATION_TTL_MS,
  } = await import("@/services/storage-quota");
  const operationId = mediaDirectOperationId(assetId);
  await reserveStorageForUpload({
    tenantId: params.tenantId,
    operationId,
    expectedBytes: params.fileSize,
    operation: "media.prepare",
    expiresAt: new Date(
      Date.now() + MEDIA_PREPARE_RESERVATION_TTL_MS,
    ).toISOString(),
  });

  let signed;
  try {
    signed = await storage.createUploadUrl({
      storageKey,
      mimeType: declaredMime,
      expiresIn: 900,
      contentLength: params.fileSize,
    });
  } catch (err) {
    await finishStorageReservation({
      tenantId: params.tenantId,
      operationId,
      actualBytes: 0,
      outcome: "release",
    }).catch(() => {});
    throw err;
  }

  return {
    existing: false as const,
    assetId,
    storageKey: signed.storageKey,
    uploadUrl: signed.uploadUrl,
    expiresIn: signed.expiresIn,
    mimeType: declaredMime,
    fileSize: params.fileSize,
    contentLength: signed.contentLength,
    requiredHeaders: signed.requiredHeaders,
    checksum,
    fileName: params.fileName,
  };
}

export async function completeMediaUpload(params: {
  assetId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  checksum: string;
  tenantId: string;
  userId?: string;
}) {
  const { assertTenantOperable } = await import("@/services/tenant-lifecycle");
  await assertTenantOperable(params.tenantId);

  if (params.fileSize <= 0) {
    throw new Error("file required");
  }
  if (params.fileSize > MAX_UPLOAD) {
    throw new Error(
      `File exceeds upload size limit (${MAX_UPLOAD} bytes)`,
    );
  }
  if (
    !params.assetId ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      params.assetId,
    )
  ) {
    throw new Error("Invalid asset id");
  }

  const checksum = normalizeChecksum(params.checksum);
  const storage = getMediaStorage();
  const ext = safeFileExtension(params.fileName);
  const storageKey = `tenants/${params.tenantId}/${params.assetId}.${ext}`;

  const {
    reserveStorageForUpload,
    finishStorageReservation,
    mediaDirectOperationId,
    mediaHealOperationId,
    hasActiveStorageReservation,
  } = await import("@/services/storage-quota");
  const operationId = mediaDirectOperationId(params.assetId);

  if (typeof storage.headObject !== "function") {
    throw new Error("Direct upload not supported");
  }

  let head;
  try {
    head = await storage.headObject(storageKey);
  } catch {
    await finishStorageReservation({
      tenantId: params.tenantId,
      operationId,
      actualBytes: 0,
      outcome: "release",
    }).catch(() => {});
    throw new Error("Uploaded object not found");
  }

  // Provider HEAD is the authority for physical size (PI-10L). Fail-closed if unknown.
  if (
    typeof head.contentLength !== "number" ||
    !Number.isInteger(head.contentLength) ||
    head.contentLength <= 0
  ) {
    await storage.delete(storageKey).catch(() => {});
    await finishStorageReservation({
      tenantId: params.tenantId,
      operationId,
      actualBytes: 0,
      outcome: "release",
    }).catch(() => {});
    throw new Error("Uploaded object size unknown");
  }
  const actualBytes = head.contentLength;

  // Reservation amount = prepare expectedBytes (= params.fileSize intent).
  // actual > reserved → no MediaAsset, release, typed failure.
  // actual < reserved → commit with actual (excess freed when reservation leaves RESERVED).
  if (actualBytes > params.fileSize) {
    await storage.delete(storageKey).catch(() => {});
    await finishStorageReservation({
      tenantId: params.tenantId,
      operationId,
      actualBytes: 0,
      outcome: "release",
    }).catch(() => {});
    throw new Error("Uploaded file exceeds reserved size");
  }

  let sniffed = normalizeMediaMime(params.mimeType);
  if (typeof storage.getObjectRange === "function") {
    try {
      const prefix = await storage.getObjectRange(storageKey, 0, 63);
      sniffed = normalizeMediaMime(
        sniffMime(prefix, params.mimeType) || params.mimeType,
      );
    } catch {
      sniffed = normalizeMediaMime(params.mimeType);
    }
  }
  if (!ALLOWED_MIME.has(sniffed)) {
    await storage.delete(storageKey).catch(() => {});
    await finishStorageReservation({
      tenantId: params.tenantId,
      operationId,
      actualBytes: 0,
      outcome: "release",
    }).catch(() => {});
    throw new Error(`MIME type not allowed: ${sniffed}`);
  }

  const [existing] = await db
    .select()
    .from(mediaAssets)
    .where(
      and(
        eq(mediaAssets.tenantId, params.tenantId),
        eq(mediaAssets.checksum, checksum),
      ),
    )
    .limit(1);

  if (existing) {
    if (existing.id !== params.assetId) {
      await storage.delete(storageKey).catch(() => {});
    }
    const readable = await probeExistingAssetReadable(
      storage,
      existing.storageKey,
    );
    if (readable) {
      // Dedupe hit — release any prepare reservation (no new committed bytes)
      await finishStorageReservation({
        tenantId: params.tenantId,
        operationId,
        actualBytes: 0,
        outcome: "release",
      }).catch(() => {});
      return existing;
    }
    // Stale asset heal: object missing; may grow file_size — reserve delta if needed
    const prepareActive = await hasActiveStorageReservation({
      tenantId: params.tenantId,
      operationId,
    });
    const delta = Math.max(0, params.fileSize - (existing.fileSize ?? 0));
    const healOpId = mediaHealOperationId(existing.id);
    let healReserved = false;
    if (delta > 0 && !prepareActive) {
      await reserveStorageForUpload({
        tenantId: params.tenantId,
        operationId: healOpId,
        expectedBytes: delta,
        operation: "media.heal",
      });
      healReserved = true;
    }

    await db
      .update(mediaAssets)
      .set({
        fileName: params.fileName,
        mimeType: sniffed,
        fileSize: params.fileSize,
        storageProvider: storage.name,
        storageKey,
        url: await storage.getUrl(storageKey),
        checksum,
      })
      .where(
        and(
          eq(mediaAssets.id, existing.id),
          eq(mediaAssets.tenantId, params.tenantId),
        ),
      );
    await finishStorageReservation({
      tenantId: params.tenantId,
      operationId,
      actualBytes: 0,
      outcome: "release",
    }).catch(() => {});
    if (healReserved) {
      await finishStorageReservation({
        tenantId: params.tenantId,
        operationId: healOpId,
        actualBytes: 0,
        outcome: "release",
      }).catch(() => {});
    }
    return {
      ...existing,
      fileName: params.fileName,
      mimeType: sniffed,
      fileSize: params.fileSize,
      storageProvider: storage.name,
      storageKey,
      url: await storage.getUrl(storageKey),
      checksum,
    };
  }

  // Late reserve if flag ON and prepare did not reserve (e.g. flag flipped)
  await reserveStorageForUpload({
    tenantId: params.tenantId,
    operationId,
    expectedBytes: actualBytes,
    operation: "media.complete",
  });

  const url = await storage.getUrl(storageKey);

  try {
    await db.insert(mediaAssets).values({
      id: params.assetId,
      fileName: params.fileName,
      mimeType: sniffed,
      fileSize: actualBytes,
      storageProvider: storage.name,
      storageKey,
      url,
      checksum,
      tenantId: params.tenantId,
    });
  } catch (error: unknown) {
    const err =
      error && typeof error === "object"
        ? (error as {
            message?: string;
            code?: string;
            cause?: { message?: string; code?: string };
          })
        : null;
    const msg = err?.message || "";
    const causeMsg = err?.cause?.message || "";
    const code = err?.code || err?.cause?.code || "";

    if (
      code.includes("SQLITE_CONSTRAINT") ||
      msg.includes("UNIQUE") ||
      causeMsg.includes("UNIQUE")
    ) {
      const [race] = await db
        .select()
        .from(mediaAssets)
        .where(
          and(
            eq(mediaAssets.tenantId, params.tenantId),
            eq(mediaAssets.checksum, checksum),
          ),
        )
        .limit(1);
      if (race) {
        await storage.delete(storageKey).catch(() => {});
        await finishStorageReservation({
          tenantId: params.tenantId,
          operationId,
          actualBytes: 0,
          outcome: "release",
        }).catch(() => {});
        return race;
      }
    }
    await finishStorageReservation({
      tenantId: params.tenantId,
      operationId,
      actualBytes: 0,
      outcome: "release",
    }).catch(() => {});
    throw error;
  }

  await finishStorageReservation({
    tenantId: params.tenantId,
    operationId,
    actualBytes,
    outcome: "commit",
  });

  await logActivity({
    userId: params.userId,
    tenantId: params.tenantId,
    action: "media.uploaded",
    resource: "media_asset",
    resourceId: params.assetId,
    metadata: {
      fileName: params.fileName,
      mimeType: sniffed,
      direct: true,
    },
  });

  return {
    id: params.assetId,
    fileName: params.fileName,
    mimeType: sniffed,
    fileSize: actualBytes,
    storageProvider: storage.name,
    storageKey,
    url,
    checksum,
    tenantId: params.tenantId,
  };
}

export async function listMediaAssets(tenantId: string) {
  return db
    .select()
    .from(mediaAssets)
    .where(eq(mediaAssets.tenantId, tenantId))
    .orderBy(desc(mediaAssets.createdAt));
}

export async function listMediaAssetsWithUsage(tenantId: string) {
  const rows = await db
    .select({
      id: mediaAssets.id,
      fileName: mediaAssets.fileName,
      mimeType: mediaAssets.mimeType,
      fileSize: mediaAssets.fileSize,
      url: mediaAssets.url,
      checksum: mediaAssets.checksum,
      createdAt: mediaAssets.createdAt,
      storageProvider: mediaAssets.storageProvider,
      usageCount: sql<number>`count(distinct ${contentAssets.contentId})`.mapWith(Number),
    })
    .from(mediaAssets)
    .leftJoin(contentAssets, eq(mediaAssets.id, contentAssets.mediaAssetId))
    .where(eq(mediaAssets.tenantId, tenantId))
    .groupBy(mediaAssets.id)
    .orderBy(desc(mediaAssets.createdAt));

  return rows;
}

export async function getMediaAsset(id: string, tenantId: string) {
  const [row] = await db
    .select()
    .from(mediaAssets)
    .where(and(eq(mediaAssets.id, id), eq(mediaAssets.tenantId, tenantId)))
    .limit(1);
  return row ?? null;
}

export function defaultPayloadForType(
  type: ContentType,
): Record<string, unknown> {
  switch (type) {
    case "TEXT":
      return { body: "", align: "center", fontSize: "large" };
    case "NOTICE":
      return { message: "" };
    case "EVENT":
      return { date: "", time: "", location: "", description: "" };
    case "QR_CODE":
      return { url: "", label: "", size: "md" };
    case "CLOCK":
      return {
        showDate: true,
        showTime: true,
        showSeconds: false,
        format: "24h",
        style: "digital",
      };
    case "NEWS":
      return { body: "", source: "" };
    case "EXPERIENCE":
      return { experience: { experienceId: "", version: "" } };
    default:
      return {};
  }
}

export const updateContentSchema = contentFieldsSchema.partial();

export async function updateContent(
  id: string,
  input: z.infer<typeof updateContentSchema>,
  tenantId: string,
  userId?: string,
) {
  const existing = await getContent(id, tenantId);
  if (!existing) throw new Error("Content not found");

  const nextType = (input.type ?? existing.type) as ContentType;
  const nextDuration =
    input.durationMs !== undefined ? input.durationMs : existing.durationMs;
  assertContentDuration(nextType, nextDuration);

  let nextPayloadObj: Record<string, unknown> | undefined;
  if (input.payload !== undefined) {
    nextPayloadObj = input.payload;
  } else if (nextType === "EXPERIENCE") {
    try {
      nextPayloadObj = JSON.parse(existing.payload || "{}") as Record<
        string,
        unknown
      >;
    } catch {
      nextPayloadObj = {};
    }
  }
  if (nextType === "EXPERIENCE" && nextPayloadObj) {
    assertExperienceContentPayload(
      nextType,
      nextPayloadObj,
      tenantId,
      input.mediaAssetId,
    );
    nextPayloadObj = normalizeContentPayload(nextType, nextPayloadObj);
  }

  let asset: Awaited<ReturnType<typeof loadTenantMediaAsset>> | null = null;
  if (input.mediaAssetId) {
    asset = await loadTenantMediaAsset(input.mediaAssetId, tenantId);
    assertMediaCompatibleWithType(nextType, asset.mimeType);
  }

  await db.transaction(async (tx) => {
    await tx
      .update(contents)
      .set({
        title: input.title !== undefined ? input.title : existing.title,
        description:
          input.description !== undefined
            ? input.description
            : existing.description,
        durationMs: nextDuration,
        payload:
          nextPayloadObj !== undefined
            ? JSON.stringify(nextPayloadObj)
            : existing.payload,
        status: input.status !== undefined ? input.status : existing.status,
        validFrom:
          input.validFrom !== undefined ? input.validFrom : existing.validFrom,
        validTo: input.validTo !== undefined ? input.validTo : existing.validTo,
        version: existing.version + 1,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(contents.id, id));

    if (asset) {
      await tx.delete(contentAssets).where(eq(contentAssets.contentId, id));
      await tx.insert(contentAssets).values({
        contentId: id,
        mediaAssetId: asset.id,
        role: "primary",
      });
    }
  });

  await logActivity({
    userId,
    tenantId,
    action: "content.updated",
    resource: "content",
    resourceId: id,
    metadata: { type: nextType },
  });
}

export async function duplicateContent(
  id: string,
  tenantId: string,
  userId?: string,
) {
  const existing = await getContent(id, tenantId);
  if (!existing) throw new Error("Content not found");

  const links = await db
    .select()
    .from(contentAssets)
    .where(eq(contentAssets.contentId, id));

  const newId = crypto.randomUUID();
  const copyTitle = `${existing.title} — Cópia`.slice(0, 200);

  await db.transaction(async (tx) => {
    await tx.insert(contents).values({
      id: newId,
      type: existing.type,
      title: copyTitle,
      description: existing.description,
      durationMs: existing.durationMs,
      payload: existing.payload,
      status: existing.status,
      validFrom: existing.validFrom,
      validTo: existing.validTo,
      tenantId,
    });

    for (const link of links) {
      await tx.insert(contentAssets).values({
        contentId: newId,
        mediaAssetId: link.mediaAssetId,
        role: link.role,
      });
    }
  });

  await logActivity({
    userId,
    tenantId,
    action: "CONTENT_DUPLICATED",
    resource: "content",
    resourceId: newId,
    metadata: {
      sourceContentId: id,
      type: existing.type,
    },
  });

  return newId;
}

export async function deleteContent(
  id: string,
  tenantId: string,
  userId?: string,
) {
  const existing = await getContent(id, tenantId);
  if (!existing) throw new Error("Content not found");

  const [inPlaylist] = await db
    .select({ id: playlistItems.id })
    .from(playlistItems)
    .where(eq(playlistItems.contentId, id))
    .limit(1);

  const [inSchedule] = await db
    .select({ id: schedules.id })
    .from(schedules)
    .where(eq(schedules.contentId, id))
    .limit(1);

  if (inPlaylist || inSchedule) {
    throw new Error(DELETE_BLOCKED_MSG);
  }

  await db.delete(contents).where(eq(contents.id, id));

  await logActivity({
    userId,
    tenantId,
    action: "content.deleted",
    resource: "content",
    resourceId: id,
    metadata: { type: existing.type },
  });
}

/**
 * Safe delete: tenant-scoped, blocked when any ContentAsset links exist.
 * Order: dependency check → storage.delete → DB delete → activity.
 * If storage.delete throws, the DB row is left intact (no silent orphan of metadata).
 * If storage succeeds and DB delete fails, an orphan blob may remain (provider-dependent;
 * LocalFs/R2 deletes are best-effort / non-transactional across systems).
 */
export async function deleteMediaAsset(
  id: string,
  tenantId: string,
  userId?: string,
) {
  const [existing] = await db
    .select()
    .from(mediaAssets)
    .where(and(eq(mediaAssets.id, id), eq(mediaAssets.tenantId, tenantId)))
    .limit(1);
  if (!existing) throw new Error("Media asset not found");

  const used = await db
    .select()
    .from(contentAssets)
    .where(eq(contentAssets.mediaAssetId, id))
    .limit(1);

  if (used.length > 0) {
    throw new Error(
      "Este ficheiro está a ser utilizado por um ou mais conteúdos.",
    );
  }

  const storage = getMediaStorage();
  try {
    await storage.delete(existing.storageKey);
  } catch (err) {
    const detail = err instanceof Error ? err.message : "unknown storage error";
    throw new Error(`Storage delete failed; media asset was not removed: ${detail}`);
  }

  await db.delete(mediaAssets).where(eq(mediaAssets.id, id));

  await logActivity({
    userId,
    tenantId,
    action: "MEDIA_DELETED",
    resource: "media_asset",
    resourceId: id,
    metadata: {
      mediaAssetId: id,
      fileName: existing.fileName,
      tenantId,
    },
  });
}

export async function deduplicateMediaAssets(tenantId: string, userId?: string) {
  const assets = await listMediaAssets(tenantId);
  if (assets.length === 0) return 0;

  // Group by checksum or filename
  const map = new Map<string, typeof assets[0][]>();
  for (const a of assets) {
    const key = a.checksum || `name:${a.fileName.toLowerCase()}`;
    const group = map.get(key) || [];
    group.push(a);
    map.set(key, group);
  }

  let deletedCount = 0;
  const storage = getMediaStorage();

  for (const group of map.values()) {
    if (group.length <= 1) continue;

    // Sort descending by createdAt to keep the newest one
    group.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    
    const canonical = group[0];
    const duplicates = group.slice(1);
    
    if (duplicates.length === 0) continue;

    const dupIds = duplicates.map(d => d.id);

    // 1. Remap existing content associations to canonical ID
    const affectedContents = await db
      .select({ contentId: contentAssets.contentId, mediaAssetId: contentAssets.mediaAssetId })
      .from(contentAssets)
      .where(inArray(contentAssets.mediaAssetId, dupIds));

    for (const c of affectedContents) {
      // Check if the canonical is already linked to avoid PK violation
      const existingLink = await db
        .select()
        .from(contentAssets)
        .where(
          and(
            eq(contentAssets.contentId, c.contentId),
            eq(contentAssets.mediaAssetId, canonical.id)
          )
        )
        .limit(1);

      if (existingLink.length > 0) {
        // Just delete the duplicate link
        await db
          .delete(contentAssets)
          .where(
            and(
              eq(contentAssets.contentId, c.contentId),
              eq(contentAssets.mediaAssetId, c.mediaAssetId)
            )
          );
      } else {
        // Update the link to point to canonical
        await db
          .update(contentAssets)
          .set({ mediaAssetId: canonical.id })
          .where(
            and(
              eq(contentAssets.contentId, c.contentId),
              eq(contentAssets.mediaAssetId, c.mediaAssetId)
            )
          );
      }
    }

    // 2. Delete duplicates from storage and DB
    for (const dup of duplicates) {
      try {
        await storage.delete(dup.storageKey);
      } catch {
        console.warn(`Failed to delete storage key ${dup.storageKey} for asset ${dup.id}`);
      }
    }

    await db.delete(mediaAssets).where(inArray(mediaAssets.id, dupIds));
    deletedCount += dupIds.length;
  }

  if (deletedCount > 0) {
    await logActivity({
      userId,
      tenantId,
      action: "media.deduplicated",
      resource: "media_asset",
      metadata: { deletedCount },
    });
  }

  return deletedCount;
}
